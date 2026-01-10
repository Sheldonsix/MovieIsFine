/**
 * 电影数据定期更新脚本
 * 功能：从数据库中选取电影，抓取最新数据并比较更新
 *
 * 运行方式:
 *   npx tsx scripts/update-movies.ts [limit] [delayMs]
 *   例如: npx tsx scripts/update-movies.ts 10 3000
 */

import { config } from "dotenv";
import path from "path";

// 必须在其他模块导入前加载环境变量
config({ path: path.join(process.cwd(), ".env.local") });

import type { Movie } from "@/types/movie";
import type { ParentalGuide, GuideCategoryKey } from "@/types/parentalGuide";
import type { DoubanMovieData } from "@/services/doubanScraper";

// 更新统计
export interface UpdateStats {
  total: number;
  checked: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ movieId: string; title: string; error: string }>;
}

// 需要比较的基础字段
const COMPARABLE_FIELDS: (keyof Movie)[] = [
  "title",
  "originalTitle",
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
];

// 家长指南类别键
const GUIDE_CATEGORY_KEYS: GuideCategoryKey[] = [
  "sex_nudity",
  "violence_gore",
  "profanity",
  "alcohol_drugs_smoking",
  "frightening_intense",
];

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 比较数组是否相等
 */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => {
    if (Array.isArray(val) && Array.isArray(b[idx])) {
      return arraysEqual(val, b[idx]);
    }
    return val === b[idx];
  });
}

/**
 * 比较家长指南原始内容是否有变化
 * 只比较原始英文内容（items），不比较翻译
 */
function hasParentalGuideChanged(
  existing: ParentalGuide | undefined,
  fresh: ParentalGuide
): boolean {
  if (!existing) return true;

  // 比较 content_rating
  if (existing.content_rating !== fresh.content_rating) {
    return true;
  }

  // 比较各类别的 severity 和 items（原始内容）
  for (const key of GUIDE_CATEGORY_KEYS) {
    const existingCat = existing[key];
    const freshCat = fresh[key];

    if (existingCat.severity !== freshCat.severity) {
      return true;
    }

    if (!arraysEqual(existingCat.items, freshCat.items)) {
      return true;
    }
  }

  return false;
}

/**
 * 比较电影基础字段是否有变化
 */
function getMovieChanges(
  existing: Movie,
  fresh: DoubanMovieData
): Partial<Movie> {
  const changes: Partial<Movie> = {};

  for (const field of COMPARABLE_FIELDS) {
    const existingValue = existing[field];
    const freshValue = fresh[field as keyof DoubanMovieData];

    if (Array.isArray(existingValue) && Array.isArray(freshValue)) {
      if (!arraysEqual(existingValue, freshValue)) {
        (changes as Record<string, unknown>)[field] = freshValue;
      }
    } else if (existingValue !== freshValue) {
      (changes as Record<string, unknown>)[field] = freshValue;
    }
  }

  return changes;
}

/**
 * 检查海报是否需要更新（远程海报变为本地海报）
 */
function needsPosterUpdate(existing: Movie, fresh: DoubanMovieData): boolean {
  // 如果已经是本地海报，不需要更新
  if (existing.poster?.startsWith("/posters/")) {
    return false;
  }
  // 如果新数据有海报，需要下载
  return !!fresh.poster;
}

/**
 * 主更新流程
 */
export async function runMovieUpdate(
  limit: number = 250,
  delayMs: number = 2000
): Promise<UpdateStats> {
  // 动态导入依赖模块（确保环境变量已加载）
  const { getDatabase, closeConnection } = await import("@/lib/mongodb");
  const { updateMovie } = await import("@/services/movieService");
  const { scrapeDoubanMovie } = await import("@/services/doubanScraper");
  const { scrapeImdbRating } = await import("@/services/imdbRatingScraper");
  const { scrapeImdbParentalGuide, translateParentalGuide } = await import(
    "@/services/imdbParentalGuideScraper"
  );
  const { downloadPoster } = await import("@/services/imageDownloader");

  console.log("========================================");
  console.log(`电影数据更新任务开始`);
  console.log(`时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log(`计划更新: ${limit} 部电影`);
  console.log(`请求间隔: ${delayMs}ms`);
  console.log("========================================");

  const stats: UpdateStats = {
    total: 0,
    checked: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  /**
   * 从数据库获取需要更新的电影
   * 策略：按 updatedAt 升序排列，优先更新最久未更新的电影
   */
  async function getMoviesToUpdate(movieLimit: number): Promise<Movie[]> {
    const db = await getDatabase();

    const docs = await db
      .collection("movies")
      .find({})
      .sort({ updatedAt: 1 }) // 最久未更新的优先
      .limit(movieLimit)
      .toArray();

    return docs.map((doc) => {
      const { _id, createdAt, updatedAt, ...movie } = doc;
      return movie as Movie;
    });
  }

  /**
   * 更新单部电影
   */
  async function updateSingleMovie(movie: Movie): Promise<void> {
    const movieTitle = movie.title;
    console.log(`\n[${stats.checked + 1}/${stats.total}] 检查: ${movieTitle}`);

    try {
      // 1. 抓取豆瓣数据
      if (!movie.doubanUrl) {
        console.log(`  ⚠️ 跳过: 无豆瓣链接`);
        stats.skipped++;
        return;
      }

      const doubanResult = await scrapeDoubanMovie(movie.doubanUrl);
      if (!doubanResult.success || !doubanResult.data) {
        console.log(`  ❌ 豆瓣抓取失败: ${doubanResult.error}`);
        stats.failed++;
        stats.errors.push({
          movieId: movie.id,
          title: movieTitle,
          error: `豆瓣抓取失败: ${doubanResult.error}`,
        });
        return;
      }

      const freshData = doubanResult.data;
      const updates: Partial<Movie> = {};

      // 2. 比较基础字段
      const baseChanges = getMovieChanges(movie, freshData);
      Object.assign(updates, baseChanges);

      // 3. 检查海报是否需要更新
      if (needsPosterUpdate(movie, freshData)) {
        console.log(`  📷 下载海报...`);
        const localPoster = await downloadPoster(freshData.poster, movie.id);
        if (localPoster) {
          updates.poster = localPoster;
        }
      }

      // 4. 抓取 IMDb 评分（如果有 imdbId）
      const imdbId = movie.imdbId || freshData.imdbId;
      if (imdbId) {
        // 更新 imdbId（如果之前没有）
        if (!movie.imdbId && freshData.imdbId) {
          updates.imdbId = freshData.imdbId;
        }

        console.log(`  🎬 获取 IMDb 评分...`);
        const ratingResult = await scrapeImdbRating(imdbId);
        if (ratingResult.success && ratingResult.data) {
          const newRating = ratingResult.data.rating ?? undefined;
          const newRatingCount = ratingResult.data.ratingCount ?? undefined;

          if (movie.imdbRating !== newRating) {
            updates.imdbRating = newRating;
          }
          if (movie.imdbRatingCount !== newRatingCount) {
            updates.imdbRatingCount = newRatingCount;
          }
        }

        // 5. 检查家长指南
        console.log(`  👨‍👩‍👧 获取家长指南...`);
        const guideResult = await scrapeImdbParentalGuide(imdbId);
        if (guideResult.success && guideResult.data) {
          const freshGuide = guideResult.data;

          if (hasParentalGuideChanged(movie.parentalGuide, freshGuide)) {
            console.log(`  🔄 家长指南有更新，重新翻译...`);
            const translatedGuide = await translateParentalGuide(freshGuide);
            updates.parentalGuide = translatedGuide;
          }
        }
      }

      // 6. 如果有更新，写入数据库
      if (Object.keys(updates).length > 0) {
        const changedFields = Object.keys(updates).join(", ");
        console.log(`  ✅ 更新字段: ${changedFields}`);
        await updateMovie(movie.id, updates);
        stats.updated++;
      } else {
        console.log(`  ⏭️ 无变化`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ❌ 错误: ${errorMsg}`);
      stats.failed++;
      stats.errors.push({
        movieId: movie.id,
        title: movieTitle,
        error: errorMsg,
      });
    }
  }

  try {
    // 获取需要更新的电影
    const movies = await getMoviesToUpdate(limit);
    stats.total = movies.length;
    console.log(`\n从数据库获取 ${movies.length} 部电影`);

    // 逐个更新
    for (const movie of movies) {
      await updateSingleMovie(movie);
      stats.checked++;

      // 请求间隔，避免触发反爬
      if (stats.checked < stats.total) {
        await delay(delayMs);
      }
    }
  } catch (error) {
    console.error("\n致命错误:", error);
  } finally {
    await closeConnection();
  }

  // 输出统计
  console.log("\n========================================");
  console.log("更新任务完成");
  console.log(`时间: ${new Date().toLocaleString("zh-CN")}`);
  console.log(`总计: ${stats.total}`);
  console.log(`已检查: ${stats.checked}`);
  console.log(`已更新: ${stats.updated}`);
  console.log(`已跳过: ${stats.skipped}`);
  console.log(`失败: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log("\n错误详情:");
    for (const err of stats.errors) {
      console.log(`  - ${err.title}: ${err.error}`);
    }
  }
  console.log("========================================");

  return stats;
}

// 直接运行
if (require.main === module) {
  const limit = parseInt(process.argv[2] || "250", 10);
  const delayMs = parseInt(process.argv[3] || "2000", 10);

  runMovieUpdate(limit, delayMs)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("脚本执行失败:", error);
      process.exit(1);
    });
}
