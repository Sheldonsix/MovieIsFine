#!/usr/bin/env npx tsx
/**
 * 从豆瓣片单中删除剧集脚本
 *
 * 功能：
 * 1. 爬取指定豆瓣片单的所有条目
 * 2. 逐个检测是否为剧集（通过"集数"和"单集片长"关键词）
 * 3. 从 MongoDB 数据库中删除识别出的剧集
 *
 * 使用方法:
 *   npx tsx scripts/migration/remove-tv-series-from-doulist.ts <片单URL>
 *   npx tsx scripts/migration/remove-tv-series-from-doulist.ts <片单URL> --dry-run
 *
 * 示例:
 *   npx tsx scripts/migration/remove-tv-series-from-doulist.ts https://www.douban.com/doulist/813181/
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

import * as cheerio from "cheerio";
import { MongoClient, Db } from "mongodb";

// 数据库配置
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

// 请求配置
const CONFIG = {
  delay: 3000, // 请求延迟（毫秒）
  timeout: 30000, // 请求超时
  maxRetries: 3, // 最大重试次数
};

// 请求头
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  Cookie: "bid=temp123", // 基本的 cookie
};

// 片单条目
interface DoulistItem {
  title: string;
  url: string;
  doubanId: string;
}

// 统计信息
interface Stats {
  total: number;
  movies: number;
  tvSeries: number;
  deleted: number;
  notInDb: number;
  failed: number;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP 请求（带重试）
 */
async function fetchWithRetry(
  url: string,
  retries = CONFIG.maxRetries
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(CONFIG.timeout),
      });

      if (response.status === 403) {
        throw new Error("访问被拒绝 (403)，可能触发了反爬虫机制");
      }

      if (response.status === 404) {
        throw new Error("页面不存在 (404)");
      }

      if (response.status === 429) {
        console.log("  [警告] 请求过于频繁 (429)，延长等待时间...");
        await sleep(CONFIG.delay * 3);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (i < retries - 1) {
        const waitTime = CONFIG.delay * (i + 1);
        console.log(`  [等待] ${waitTime / 1000}秒后重试...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
  throw new Error("所有重试都失败了");
}

/**
 * 解析片单页面，获取条目列表
 */
function parseDoulistPage(html: string): DoulistItem[] {
  const $ = cheerio.load(html);
  const items: DoulistItem[] = [];

  $(".doulist-item").each((_, element) => {
    const $item = $(element);
    const $title = $item.find(".title a");
    const titleText = $title.text().trim();
    const url = $title.attr("href") || "";

    // 提取豆瓣ID
    const match = url.match(/subject\/(\d+)/);
    if (match) {
      items.push({
        title: titleText,
        url: url,
        doubanId: match[1],
      });
    }
  });

  return items;
}

/**
 * 获取片单总页数
 */
function getTotalPages(html: string): number {
  const $ = cheerio.load(html);
  const $pagination = $(".paginator a");

  let maxPage = 1;
  $pagination.each((_, element) => {
    const pageText = $(element).text().trim();
    const pageNum = parseInt(pageText);
    if (!isNaN(pageNum) && pageNum > maxPage) {
      maxPage = pageNum;
    }
  });

  return maxPage;
}

/**
 * 爬取完整片单（含分页）
 */
async function scrapeDoulist(doulistUrl: string): Promise<DoulistItem[]> {
  console.log("\n📋 开始爬取片单列表...");
  console.log(`   URL: ${doulistUrl}\n`);

  // 获取第一页
  const firstPageHtml = await fetchWithRetry(doulistUrl);
  const totalPages = getTotalPages(firstPageHtml);
  const firstPageItems = parseDoulistPage(firstPageHtml);

  console.log(`✅ 第 1/${totalPages} 页: 找到 ${firstPageItems.length} 个条目`);

  let allItems = [...firstPageItems];

  // 获取后续页面
  for (let page = 2; page <= totalPages; page++) {
    await sleep(CONFIG.delay);

    const pageUrl = `${doulistUrl}?start=${(page - 1) * 25}`;
    const pageHtml = await fetchWithRetry(pageUrl);
    const pageItems = parseDoulistPage(pageHtml);

    console.log(`✅ 第 ${page}/${totalPages} 页: 找到 ${pageItems.length} 个条目`);
    allItems = [...allItems, ...pageItems];
  }

  console.log(`\n📊 片单爬取完成，共 ${allItems.length} 个条目\n`);
  return allItems;
}

/**
 * 检测是否为剧集
 * 基于豆瓣页面的"集数"和"单集片长"关键词
 */
async function isTVSeries(url: string): Promise<boolean> {
  try {
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    const infoText = $("#info").text();

    // 检查关键词
    const hasEpisodes = /集数/.test(infoText);
    const hasSingleEpisode = /单集片长/.test(infoText);

    return hasEpisodes || hasSingleEpisode;
  } catch (error) {
    console.error(
      `  检测失败: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
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
 * 从数据库删除电影（通过豆瓣 URL）
 */
async function deleteFromDatabase(
  db: Db,
  doubanUrl: string,
  dryRun: boolean
): Promise<boolean> {
  const movie = await db.collection("movies").findOne({ doubanUrl });

  if (!movie) {
    return false; // 数据库中不存在
  }

  if (dryRun) {
    console.log(`  [DRY RUN] 将删除: ${movie.title} (${movie.id})`);
    return true;
  }

  const result = await db.collection("movies").deleteOne({ doubanUrl });
  return result.deletedCount > 0;
}

/**
 * 处理单个条目
 */
async function processItem(
  db: Db,
  item: DoulistItem,
  index: number,
  total: number,
  dryRun: boolean
): Promise<"movie" | "tv_deleted" | "tv_not_in_db" | "failed"> {
  console.log(`\n[${index + 1}/${total}] ${item.title}`);
  console.log(`  URL: ${item.url}`);

  try {
    // 检测是否为剧集
    const isTv = await isTVSeries(item.url);

    if (!isTv) {
      console.log(`  ✓ 电影，保留`);
      return "movie";
    }

    console.log(`  ⚠️  检测到剧集`);

    // 尝试从数据库删除
    const deleted = await deleteFromDatabase(db, item.url, dryRun);

    if (deleted) {
      console.log(`  ✓ ${dryRun ? "[DRY RUN] 将" : "已"}从数据库删除`);
      return "tv_deleted";
    } else {
      console.log(`  ⊘ 数据库中不存在，跳过`);
      return "tv_not_in_db";
    }
  } catch (error) {
    console.error(
      `  ✗ 处理失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return "failed";
  }
}

/**
 * 批量处理片单条目
 */
async function processDoulist(
  db: Db,
  items: DoulistItem[],
  dryRun: boolean
): Promise<Stats> {
  console.log("\n🎬 开始检测并删除剧集...\n");

  const stats: Stats = {
    total: items.length,
    movies: 0,
    tvSeries: 0,
    deleted: 0,
    notInDb: 0,
    failed: 0,
  };

  for (let i = 0; i < items.length; i++) {
    const result = await processItem(db, items[i], i, items.length, dryRun);

    switch (result) {
      case "movie":
        stats.movies++;
        break;
      case "tv_deleted":
        stats.tvSeries++;
        stats.deleted++;
        break;
      case "tv_not_in_db":
        stats.tvSeries++;
        stats.notInDb++;
        break;
      case "failed":
        stats.failed++;
        break;
    }

    // 请求间隔（最后一个不需要等待）
    if (i < items.length - 1) {
      await sleep(CONFIG.delay);
    }
  }

  return stats;
}

/**
 * 打印统计信息
 */
function printStats(stats: Stats, dryRun: boolean): void {
  console.log("\n" + "=".repeat(50));
  console.log(dryRun ? "DRY RUN SUMMARY" : "SUMMARY");
  console.log("=".repeat(50));
  console.log(`总条目数:       ${stats.total}`);
  console.log(`电影 (保留):    ${stats.movies}`);
  console.log(`剧集 (检测到):  ${stats.tvSeries}`);
  console.log(`  - 已删除:     ${stats.deleted}`);
  console.log(`  - 不在数据库: ${stats.notInDb}`);
  console.log(`处理失败:       ${stats.failed}`);
  console.log("=".repeat(50));
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ 请提供片单 URL");
    console.log("\n用法:");
    console.log(
      "  npx tsx scripts/migration/remove-tv-series-from-doulist.ts <片单URL>"
    );
    console.log(
      "  npx tsx scripts/migration/remove-tv-series-from-doulist.ts <片单URL> --dry-run"
    );
    console.log("\n示例:");
    console.log(
      "  npx tsx scripts/migration/remove-tv-series-from-doulist.ts https://www.douban.com/doulist/813181/"
    );
    process.exit(1);
  }

  const doulistUrl = args[0];
  const dryRun = args.includes("--dry-run");

  // 验证 URL
  const match = doulistUrl.match(/doulist\/(\d+)/);
  if (!match) {
    console.error("❌ 无效的片单 URL");
    process.exit(1);
  }
  const doulistId = match[1];

  console.log("🗑️  从豆瓣片单删除剧集");
  console.log("=".repeat(50));
  console.log(`片单ID: ${doulistId}`);
  console.log(`延迟设置: ${CONFIG.delay / 1000}秒/请求`);
  if (dryRun) {
    console.log("模式: DRY RUN (不会实际删除)");
  }
  console.log("=".repeat(50));

  const { client, db } = await connectDatabase();

  try {
    // 步骤1: 爬取片单列表
    const items = await scrapeDoulist(doulistUrl);

    // 步骤2: 检测并删除剧集
    const stats = await processDoulist(db, items, dryRun);

    // 步骤3: 打印统计
    printStats(stats, dryRun);

    console.log("\n✅ 全部完成！");
  } catch (error) {
    console.error(
      "\n❌ 处理过程出错:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    await client.close();
    console.log("✓ 数据库连接已关闭");
  }
}

// 执行
main().catch((error) => {
  console.error("\n✗ Fatal error:", error);
  process.exit(1);
});
