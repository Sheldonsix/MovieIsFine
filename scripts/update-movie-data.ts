#!/usr/bin/env npx tsx
/**
 * 电影数据定期更新脚本
 *
 * 功能：
 * 1. 从数据库中随机选择 250 部电影
 * 2. 从豆瓣抓取最新数据
 * 3. 比较数据差异，仅更新有变化的字段
 * 4. 记录更新统计信息
 *
 * 使用方法:
 *   npx tsx scripts/update-movie-data.ts
 *   npx tsx scripts/update-movie-data.ts --limit 100
 *   npx tsx scripts/update-movie-data.ts --dry-run
 *   npx tsx scripts/update-movie-data.ts --douban-id 1292052
 *
 * 定时任务设置（每天随机时间 10:00-22:00 执行）:
 *   0 10-22 * * * cd /path/to/MovieIsFine && npx tsx scripts/update-movie-data.ts >> logs/update-movie-data.log 2>&1
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

import { MongoClient, Db } from "mongodb";
import { scrapeDoubanMovie, type DoubanMovieData } from "../src/services/doubanScraper";
import type { Movie } from "../src/types/movie";

// 数据库配置
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

// 默认配置
const DEFAULT_LIMIT = 250; // 默认更新 250 部电影
const REQUEST_DELAY = 3000; // 请求间隔（毫秒），避免触发反爬
const RANDOM_DELAY_RANGE = 2000; // 随机延迟范围（毫秒）

interface UpdateStats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  details: {
    doubanId: string;
    title: string;
    status: "updated" | "skipped" | "failed";
    changes?: string[];
    error?: string;
  }[];
}

/**
 * 延迟函数（支持随机延迟）
 */
function delay(ms: number, randomRange: number = 0): Promise<void> {
  const actualDelay = randomRange > 0
    ? ms + Math.floor(Math.random() * randomRange)
    : ms;
  return new Promise((resolve) => setTimeout(resolve, actualDelay));
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
 * 从数据库随机选择指定数量的电影
 * 优先选择更新时间较早的电影
 */
async function getMoviesToUpdate(
  db: Db,
  limit: number,
  doubanId?: string
): Promise<Array<{ id: string; doubanId: string; doubanUrl: string; title: string; updatedAt?: Date }>> {
  // 如果指定了 doubanId，只获取该电影
  if (doubanId) {
    const movie = await db
      .collection("movies")
      .findOne(
        { doubanId },
        { projection: { id: 1, doubanId: 1, doubanUrl: 1, title: 1, updatedAt: 1 } }
      );

    if (!movie) {
      return [];
    }

    return [{
      id: movie.id as string,
      doubanId: movie.doubanId as string,
      doubanUrl: movie.doubanUrl as string,
      title: movie.title as string,
      updatedAt: movie.updatedAt as Date | undefined,
    }];
  }

  // 随机抽样策略：
  // 1. 70% 来自更新时间最早的电影（按 updatedAt 升序）
  // 2. 30% 完全随机
  const oldestLimit = Math.floor(limit * 0.7);
  const randomLimit = limit - oldestLimit;

  // 获取更新时间最早的电影
  const oldestMovies = await db
    .collection("movies")
    .find(
      { doubanId: { $exists: true, $ne: "" } },
      { projection: { id: 1, doubanId: 1, doubanUrl: 1, title: 1, updatedAt: 1 } }
    )
    .sort({ updatedAt: 1 })
    .limit(oldestLimit)
    .toArray();

  // 获取随机电影
  const randomMovies = await db
    .collection("movies")
    .aggregate([
      { $match: { doubanId: { $exists: true, $ne: "" } } },
      { $sample: { size: randomLimit } },
      { $project: { id: 1, doubanId: 1, doubanUrl: 1, title: 1, updatedAt: 1 } }
    ])
    .toArray();

  const allMovies = [...oldestMovies, ...randomMovies];

  return allMovies.map((m) => ({
    id: m.id as string,
    doubanId: m.doubanId as string,
    doubanUrl: m.doubanUrl as string,
    title: m.title as string,
    updatedAt: m.updatedAt as Date | undefined,
  }));
}

/**
 * 将豆瓣数据转换为 Movie 更新数据
 * 仅包含需要更新的字段
 */
function doubanDataToMovieUpdate(data: DoubanMovieData): Partial<Movie> {
  return {
    title: data.title,
    originalTitle: data.originalTitle,
    poster: data.poster,
    director: data.director,
    writers: data.writers,
    cast: data.cast,
    genres: data.genres,
    language: data.language,
    releaseDate: data.releaseDate,
    duration: data.duration,
    synopsis: data.synopsis,
    doubanRating: data.doubanRating,
    ratingCount: data.ratingCount,
    imdbId: data.imdbId,
    doubanUrl: data.doubanUrl,
  };
}

/**
 * 比较两个值是否相等
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
  return a === b;
}

/**
 * 检测数据变化并返回变化字段
 */
function detectChanges(
  oldData: Partial<Movie>,
  newData: Partial<Movie>
): { hasChanges: boolean; changes: string[]; updates: Partial<Movie> } {
  const changes: string[] = [];
  const updates: Partial<Movie> = {};

  const fieldsToCheck: (keyof Movie)[] = [
    "title",
    "originalTitle",
    "poster",
    "director",
    "writers",
    "cast",
    "genres",
    "language",
    "releaseDate",
    "duration",
    "synopsis",
    "doubanRating",
    "ratingCount",
    "imdbId",
  ];

  for (const field of fieldsToCheck) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    if (!isEqual(oldValue, newValue)) {
      changes.push(field);
      updates[field] = newValue as never;
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    updates,
  };
}

/**
 * 更新单部电影数据
 */
async function updateMovieData(
  db: Db,
  movieId: string,
  updates: Partial<Movie>,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    return true;
  }

  const result = await db.collection("movies").updateOne(
    { id: movieId },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount > 0;
}

/**
 * 处理单部电影更新
 */
async function processMovie(
  db: Db,
  movie: { id: string; doubanId: string; doubanUrl: string; title: string; updatedAt?: Date },
  index: number,
  total: number,
  dryRun: boolean
): Promise<{
  status: "updated" | "skipped" | "failed";
  changes?: string[];
  error?: string;
}> {
  const lastUpdate = movie.updatedAt
    ? new Date(movie.updatedAt).toISOString().split('T')[0]
    : "从未更新";

  console.log(`\n[${index + 1}/${total}] ${movie.title} (豆瓣ID: ${movie.doubanId})`);
  console.log(`  上次更新: ${lastUpdate}`);

  // 从豆瓣抓取最新数据
  const scrapeResult = await scrapeDoubanMovie(movie.doubanUrl);

  if (!scrapeResult.success || !scrapeResult.data) {
    console.log(`  ✗ 抓取失败: ${scrapeResult.error}`);
    return {
      status: "failed",
      error: scrapeResult.error,
    };
  }

  // 转换为 Movie 更新数据
  const newData = doubanDataToMovieUpdate(scrapeResult.data);

  // 获取当前数据库中的数据
  const currentMovie = await db.collection("movies").findOne({ id: movie.id });
  if (!currentMovie) {
    console.log(`  ✗ 数据库中未找到电影`);
    return {
      status: "failed",
      error: "数据库中未找到电影",
    };
  }

  // 将 MongoDB 文档转换为 Partial<Movie>
  const currentData: Partial<Movie> = {
    title: currentMovie.title as string,
    originalTitle: currentMovie.originalTitle as string | undefined,
    poster: currentMovie.poster as string,
    director: currentMovie.director as string,
    writers: currentMovie.writers as string[],
    cast: currentMovie.cast as string[],
    genres: currentMovie.genres as string[],
    language: currentMovie.language as string,
    releaseDate: currentMovie.releaseDate as string,
    duration: currentMovie.duration as number,
    synopsis: currentMovie.synopsis as string,
    doubanRating: currentMovie.doubanRating as number,
    ratingCount: currentMovie.ratingCount as number | undefined,
    imdbId: currentMovie.imdbId as string | undefined,
  };

  // 检测变化
  const { hasChanges, changes, updates } = detectChanges(currentData, newData);

  if (!hasChanges) {
    console.log(`  ⊘ 无变化`);
    return {
      status: "skipped",
    };
  }

  console.log(`  ✓ 检测到 ${changes.length} 个字段变化: ${changes.join(", ")}`);

  if (dryRun) {
    console.log(`  [DRY RUN] 将更新以下字段:`);
    changes.forEach((field) => {
      console.log(`    - ${field}: ${JSON.stringify(updates[field as keyof Movie])}`);
    });
  } else {
    const updated = await updateMovieData(db, movie.id, updates, dryRun);
    if (updated) {
      console.log(`  ✓ 已更新`);
    } else {
      console.log(`  ✗ 更新失败`);
      return {
        status: "failed",
        error: "数据库更新失败",
      };
    }
  }

  return {
    status: "updated",
    changes,
  };
}

/**
 * 批量更新电影数据
 */
async function updateMovies(
  db: Db,
  limit: number,
  dryRun: boolean,
  doubanId?: string
): Promise<UpdateStats> {
  const movies = await getMoviesToUpdate(db, limit, doubanId);

  if (movies.length === 0) {
    console.log("\n未找到需要更新的电影");
    return {
      total: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };
  }

  console.log(`\n准备更新 ${movies.length} 部电影`);

  const stats: UpdateStats = {
    total: movies.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const result = await processMovie(db, movie, i, movies.length, dryRun);

    const detail = {
      doubanId: movie.doubanId,
      title: movie.title,
      status: result.status,
      changes: result.changes,
      error: result.error,
    };

    stats.details.push(detail);

    switch (result.status) {
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
      await delay(REQUEST_DELAY, RANDOM_DELAY_RANGE);
    }
  }

  return stats;
}

/**
 * 打印统计信息
 */
function printStats(stats: UpdateStats, dryRun: boolean): void {
  console.log("\n" + "=".repeat(60));
  console.log(dryRun ? "DRY RUN 模式 - 摘要" : "更新摘要");
  console.log("=".repeat(60));
  console.log(`总计:   ${stats.total}`);
  console.log(`已更新: ${stats.updated} (${((stats.updated / stats.total) * 100).toFixed(1)}%)`);
  console.log(`无变化: ${stats.skipped} (${((stats.skipped / stats.total) * 100).toFixed(1)}%)`);
  console.log(`失败:   ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
  console.log("=".repeat(60));

  // 打印失败详情
  if (stats.failed > 0) {
    console.log("\n失败的电影:");
    stats.details
      .filter((d) => d.status === "failed")
      .forEach((d) => {
        console.log(`  - ${d.title} (${d.doubanId}): ${d.error}`);
      });
  }

  // 打印更新详情（只在非 dry run 模式下显示）
  if (!dryRun && stats.updated > 0 && stats.updated <= 10) {
    console.log("\n已更新的电影:");
    stats.details
      .filter((d) => d.status === "updated")
      .forEach((d) => {
        console.log(`  - ${d.title} (${d.doubanId}): ${d.changes?.join(", ")}`);
      });
  }
}

/**
 * 解析命令行参数
 */
function parseArgs(): {
  limit: number;
  dryRun: boolean;
  doubanId?: string;
} {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let dryRun = false;
  let doubanId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--douban-id" && args[i + 1]) {
      doubanId = args[i + 1];
      i++;
    }
  }

  return { limit, dryRun, doubanId };
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const startTime = Date.now();

  console.log("电影数据定期更新脚本");
  console.log("=".repeat(60));
  console.log(`执行时间: ${new Date().toLocaleString("zh-CN")}`);

  const { limit, dryRun, doubanId } = parseArgs();

  if (dryRun) {
    console.log("模式: DRY RUN (不会实际更新数据库)");
  }

  if (doubanId) {
    console.log(`指定电影: 豆瓣ID ${doubanId}`);
  } else {
    console.log(`更新数量: ${limit} 部电影`);
  }

  const { client, db } = await connectDatabase();

  try {
    const stats = await updateMovies(db, limit, dryRun, doubanId);
    printStats(stats, dryRun);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`\n总耗时: ${duration} 分钟`);
  } finally {
    await client.close();
    console.log("\n✓ 数据库连接已关闭");
  }
}

// 执行
main().catch((error) => {
  console.error("\n✗ 致命错误:", error);
  process.exit(1);
});
