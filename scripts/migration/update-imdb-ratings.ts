#!/usr/bin/env npx tsx
/**
 * IMDb 评分更新脚本
 *
 * 从 IMDb 抓取电影评分并更新到 MongoDB 数据库
 *
 * 使用方法:
 *   npx tsx scripts/migration/update-imdb-ratings.ts
 *   npx tsx scripts/migration/update-imdb-ratings.ts --imdb tt0111161
 *   npx tsx scripts/migration/update-imdb-ratings.ts --dry-run
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

import { MongoClient, Db } from "mongodb";
import {
  scrapeImdbRating,
  type IMDBRating,
} from "../../src/services/imdbRatingScraper";

// 数据库配置
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

// 请求延迟（毫秒）
const REQUEST_DELAY = 2000;

interface UpdateStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 连接数据库
 */
async function connectDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  console.log(`✓ Connected to MongoDB: ${MONGODB_DB_NAME}`);
  return { client, db };
}

/**
 * 获取所有有 imdbId 的电影
 */
async function getMoviesWithImdbId(
  db: Db
): Promise<Array<{ id: string; imdbId: string; title: string }>> {
  const movies = await db
    .collection("movies")
    .find(
      { imdbId: { $exists: true, $ne: "" } },
      { projection: { id: 1, imdbId: 1, title: 1 } }
    )
    .toArray();

  return movies.map((m) => ({
    id: m.id as string,
    imdbId: m.imdbId as string,
    title: m.title as string,
  }));
}

/**
 * 更新单部电影的 IMDb 评分
 */
async function updateMovieRating(
  db: Db,
  movieId: string,
  rating: IMDBRating,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would update:`);
    console.log(`    - imdbRating: ${rating.rating}`);
    console.log(`    - imdbRatingCount: ${rating.ratingCount}`);
    return true;
  }

  const result = await db.collection("movies").updateOne(
    { id: movieId },
    {
      $set: {
        imdbRating: rating.rating,
        imdbRatingCount: rating.ratingCount,
        updatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount > 0;
}

/**
 * 处理单部电影
 */
async function processMovie(
  db: Db,
  movie: { id: string; imdbId: string; title: string },
  index: number,
  total: number,
  dryRun: boolean
): Promise<"updated" | "skipped" | "failed"> {
  console.log(`\n[${index + 1}/${total}] ${movie.title} (${movie.imdbId})`);

  const result = await scrapeImdbRating(movie.imdbId);

  if (!result.success || !result.data) {
    console.log(`  ✗ Failed: ${result.error}`);
    return "failed";
  }

  const rating = result.data;

  if (rating.rating === null) {
    console.log(`  ⊘ Skipped: No rating available`);
    return "skipped";
  }

  console.log(`  Rating: ${rating.rating}/10 (${rating.ratingCount?.toLocaleString()} votes)`);

  const updated = await updateMovieRating(db, movie.id, rating, dryRun);

  if (updated) {
    console.log(`  ✓ Updated`);
    return "updated";
  } else {
    console.log(`  ⊘ No changes`);
    return "skipped";
  }
}

/**
 * 更新所有电影的 IMDb 评分
 */
async function updateAllRatings(db: Db, dryRun: boolean): Promise<UpdateStats> {
  const movies = await getMoviesWithImdbId(db);
  console.log(`\nFound ${movies.length} movies with IMDb IDs`);

  const stats: UpdateStats = {
    total: movies.length,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (let i = 0; i < movies.length; i++) {
    const result = await processMovie(db, movies[i], i, movies.length, dryRun);

    switch (result) {
      case "updated":
        stats.updated++;
        break;
      case "skipped":
        stats.skipped++;
        break;
      case "failed":
        stats.failed++;
        break;
    }

    // 请求间隔（最后一个不需要等待）
    if (i < movies.length - 1) {
      await delay(REQUEST_DELAY);
    }
  }

  return stats;
}

/**
 * 更新单部电影的 IMDb 评分
 */
async function updateSingleRating(
  db: Db,
  imdbId: string,
  dryRun: boolean
): Promise<UpdateStats> {
  // 标准化 IMDb ID
  if (!imdbId.startsWith("tt")) {
    imdbId = `tt${imdbId}`;
  }

  // 查找电影
  const movie = await db
    .collection("movies")
    .findOne(
      { imdbId },
      { projection: { id: 1, imdbId: 1, title: 1 } }
    );

  if (!movie) {
    console.log(`\n✗ Movie not found in database: ${imdbId}`);
    return { total: 1, updated: 0, skipped: 0, failed: 1 };
  }

  const movieData = {
    id: movie.id as string,
    imdbId: movie.imdbId as string,
    title: movie.title as string,
  };

  const result = await processMovie(db, movieData, 0, 1, dryRun);

  return {
    total: 1,
    updated: result === "updated" ? 1 : 0,
    skipped: result === "skipped" ? 1 : 0,
    failed: result === "failed" ? 1 : 0,
  };
}

/**
 * 打印统计信息
 */
function printStats(stats: UpdateStats, dryRun: boolean): void {
  console.log("\n" + "=".repeat(50));
  console.log(dryRun ? "DRY RUN SUMMARY" : "SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total:   ${stats.total}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed:  ${stats.failed}`);
  console.log("=".repeat(50));
}

/**
 * 解析命令行参数
 */
function parseArgs(): { imdbId?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let imdbId: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--imdb" && args[i + 1]) {
      imdbId = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { imdbId, dryRun };
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log("IMDb Rating Updater");
  console.log("=".repeat(50));

  const { imdbId, dryRun } = parseArgs();

  if (dryRun) {
    console.log("Mode: DRY RUN (no changes will be made)");
  }

  const { client, db } = await connectDatabase();

  try {
    let stats: UpdateStats;

    if (imdbId) {
      console.log(`\nUpdating single movie: ${imdbId}`);
      stats = await updateSingleRating(db, imdbId, dryRun);
    } else {
      console.log("\nUpdating all movies with IMDb IDs...");
      stats = await updateAllRatings(db, dryRun);
    }

    printStats(stats, dryRun);
  } finally {
    await client.close();
    console.log("\n✓ Database connection closed");
  }
}

// 执行
main().catch((error) => {
  console.error("\n✗ Fatal error:", error);
  process.exit(1);
});
