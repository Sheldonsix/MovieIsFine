/**
 * 豆瓣片单导入数据库脚本
 *
 * 功能：
 * 1. 获取片单中的所有电影URL
 * 2. 调用 addMovie 将电影保存到数据库
 * 3. 已存在的电影自动跳过
 *
 * 使用方法:
 * npx tsx scripts/scraping/import-doulist-to-db.ts <片单URL> [--limit N] [--delay MS]
 * npx tsx scripts/scraping/import-doulist-to-db.ts --file <文件路径> [--limit N] [--delay MS]
 *
 * 示例:
 * npx tsx scripts/scraping/import-doulist-to-db.ts https://www.douban.com/doulist/1518184/
 * npx tsx scripts/scraping/import-doulist-to-db.ts https://www.douban.com/doulist/1518184/ --limit 10
 * npx tsx scripts/scraping/import-doulist-to-db.ts https://www.douban.com/doulist/1518184/ --delay 5000
 * npx tsx scripts/scraping/import-doulist-to-db.ts --file doulists.txt
 *
 * 文件格式（每行一个URL，支持 # 注释）:
 * https://www.douban.com/doulist/1518184/
 * https://www.douban.com/doulist/123456/
 * # 这是注释行
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as cheerio from 'cheerio';

// 必须在导入其他模块之前加载环境变量
config({ path: path.join(__dirname, '../../.env.local') });

// 类型定义
import type { AddMovieResult } from '../../src/app/add/actions';

// 配置
const DEFAULT_DELAY = 3000;
const TIMEOUT = 30000;
const MAX_RETRIES = 3;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

interface DoulistItem {
  title: string;
  url: string;
  doubanId: string;
}

interface ImportStats {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  errors: Array<{ title: string; error: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT),
      });

      if (response.status === 403) {
        throw new Error('访问被拒绝 (403)');
      }

      if (response.status === 429) {
        console.log('  ⚠️ 请求过于频繁，延长等待时间...');
        await sleep(DEFAULT_DELAY * 3);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      if (i < retries - 1) {
        await sleep(DEFAULT_DELAY * (i + 1));
      } else {
        throw error;
      }
    }
  }
  throw new Error('所有重试都失败了');
}

async function parseDoulistPage(html: string): Promise<DoulistItem[]> {
  const $ = cheerio.load(html);
  const items: DoulistItem[] = [];

  $('.doulist-item').each((_, element) => {
    const $item = $(element);
    const $title = $item.find('.title a');
    const titleText = $title.text().trim();
    const url = $title.attr('href') || '';

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

function getTotalPages(html: string): number {
  const $ = cheerio.load(html);
  const $pagination = $('.paginator a');

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

async function scrapeDoulist(doulistUrl: string, delay: number): Promise<DoulistItem[]> {
  console.log('\n📋 获取片单列表...');
  console.log(`   URL: ${doulistUrl}\n`);

  const firstPageHtml = await fetchWithRetry(doulistUrl);
  const totalPages = getTotalPages(firstPageHtml);
  const firstPageItems = await parseDoulistPage(firstPageHtml);

  console.log(`   第 1/${totalPages} 页: ${firstPageItems.length} 部电影`);

  let allItems = [...firstPageItems];

  for (let page = 2; page <= totalPages; page++) {
    await sleep(delay);

    const pageUrl = `${doulistUrl}?start=${(page - 1) * 25}`;
    const pageHtml = await fetchWithRetry(pageUrl);
    const pageItems = await parseDoulistPage(pageHtml);

    console.log(`   第 ${page}/${totalPages} 页: ${pageItems.length} 部电影`);
    allItems = [...allItems, ...pageItems];
  }

  console.log(`\n✅ 片单获取完成，共 ${allItems.length} 部电影\n`);
  return allItems;
}

async function importMovies(
  items: DoulistItem[],
  delay: number,
  addMovie: (url: string) => Promise<AddMovieResult>,
  limit?: number
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const moviesToImport = limit ? items.slice(0, limit) : items;
  stats.total = moviesToImport.length;

  console.log('🎬 开始导入电影到数据库...\n');
  console.log('='.repeat(60));

  for (let i = 0; i < moviesToImport.length; i++) {
    const item = moviesToImport[i];
    const progress = `[${i + 1}/${stats.total}]`;

    console.log(`\n${progress} ${item.title}`);
    console.log(`   URL: ${item.url}`);

    try {
      const result = await addMovie(item.url);

      if (result.success) {
        stats.success++;
        console.log(`   ✅ 导入成功`);
        if (result.movie) {
          console.log(`      评分: ${result.movie.doubanRating}`);
          console.log(`      IMDb: ${result.movie.imdbId || '无'}`);
        }
      } else if (result.message === '电影已存在') {
        stats.skipped++;
        console.log(`   ⏭️ 跳过 - 电影已存在`);
      } else {
        stats.failed++;
        console.log(`   ❌ 失败 - ${result.error || result.message}`);
        stats.errors.push({
          title: item.title,
          error: result.error || result.message,
        });
      }
    } catch (error) {
      stats.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ 异常 - ${errorMsg}`);
      stats.errors.push({
        title: item.title,
        error: errorMsg,
      });
    }

    if (i < moviesToImport.length - 1) {
      await sleep(delay);
    }
  }

  return stats;
}

function printSummary(stats: ImportStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 导入统计');
  console.log('='.repeat(60));
  console.log(`   总数:   ${stats.total}`);
  console.log(`   成功:   ${stats.success} ✅`);
  console.log(`   跳过:   ${stats.skipped} ⏭️`);
  console.log(`   失败:   ${stats.failed} ❌`);

  if (stats.errors.length > 0) {
    console.log('\n⚠️ 失败详情:');
    stats.errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.title}: ${err.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

function parseArgs(args: string[]): {
  doulistUrl: string;
  filePath?: string;
  limit?: number;
  delay: number;
} {
  let doulistUrl = '';
  let filePath: string | undefined;
  let limit: number | undefined;
  let delay = DEFAULT_DELAY;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--delay' && args[i + 1]) {
      delay = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--file' && args[i + 1]) {
      filePath = args[i + 1];
      i++;
    } else if (!arg.startsWith('--') && !doulistUrl) {
      doulistUrl = arg;
    }
  }

  return { doulistUrl, filePath, limit, delay };
}

function readUrlsFromFile(filePath: string): string[] {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const urls: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // 跳过空行和注释行
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    // 验证是否是有效的片单 URL
    if (trimmed.match(/doulist\/\d+/)) {
      urls.push(trimmed);
    } else {
      console.warn(`⚠️ 跳过无效 URL: ${trimmed}`);
    }
  }

  return urls;
}

async function main() {
  const args = process.argv.slice(2);
  const { doulistUrl, filePath, limit, delay } = parseArgs(args);

  // 确定要处理的片单 URL 列表
  let doulistUrls: string[] = [];

  if (filePath) {
    try {
      doulistUrls = readUrlsFromFile(filePath);
      if (doulistUrls.length === 0) {
        console.error('❌ 文件中没有找到有效的片单 URL');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else if (doulistUrl) {
    const match = doulistUrl.match(/doulist\/(\d+)/);
    if (!match) {
      console.error('❌ 无效的片单URL');
      process.exit(1);
    }
    doulistUrls = [doulistUrl];
  } else {
    console.error('❌ 请提供片单URL或文件路径');
    console.log('\n用法:');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts <片单URL> [选项]');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts --file <文件路径> [选项]');
    console.log('\n选项:');
    console.log('  --file FILE  从文件读取片单URL列表（每行一个URL，支持 # 注释）');
    console.log('  --limit N    每个片单只导入前 N 部电影');
    console.log('  --delay MS   请求延迟毫秒数（默认 3000）');
    console.log('\n示例:');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts https://www.douban.com/doulist/1518184/');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts https://www.douban.com/doulist/1518184/ --limit 5');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts --file doulists.txt');
    console.log('  npx tsx scripts/scraping/import-doulist-to-db.ts --file doulists.txt --limit 10 --delay 5000');
    process.exit(1);
  }

  console.log('🎬 豆瓣片单导入工具');
  console.log('='.repeat(60));
  console.log(`片单数量: ${doulistUrls.length}`);
  console.log(`延迟: ${delay}ms`);
  if (limit) {
    console.log(`限制: 每个片单前 ${limit} 部`);
  }
  console.log('='.repeat(60));

  // 动态导入模块（确保环境变量已加载）
  const { addMovie } = await import('../../src/app/add/actions');
  const { closeConnection } = await import('../../src/lib/mongodb');

  // 汇总统计
  const totalStats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    for (let i = 0; i < doulistUrls.length; i++) {
      const url = doulistUrls[i];
      const match = url.match(/doulist\/(\d+)/);
      const doulistId = match ? match[1] : '未知';

      console.log(`\n${'#'.repeat(60)}`);
      console.log(`# 片单 ${i + 1}/${doulistUrls.length}: ${doulistId}`);
      console.log(`${'#'.repeat(60)}`);

      try {
        // 步骤1: 获取片单所有电影
        const items = await scrapeDoulist(url, delay);

        // 步骤2: 导入到数据库
        const stats = await importMovies(items, delay, addMovie, limit);

        // 累计统计
        totalStats.total += stats.total;
        totalStats.success += stats.success;
        totalStats.skipped += stats.skipped;
        totalStats.failed += stats.failed;
        totalStats.errors.push(...stats.errors);

        // 步骤3: 打印当前片单统计
        printSummary(stats);
      } catch (error) {
        console.error(`\n❌ 片单 ${doulistId} 处理失败:`, error instanceof Error ? error.message : String(error));
        totalStats.errors.push({
          title: `片单 ${doulistId}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 片单之间的延迟
      if (i < doulistUrls.length - 1) {
        console.log(`\n⏳ 等待 ${delay}ms 后处理下一个片单...`);
        await sleep(delay);
      }
    }

    // 多片单时打印汇总统计
    if (doulistUrls.length > 1) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('📊 全部片单汇总统计');
      printSummary(totalStats);
    }

    console.log('✅ 全部导入完成！\n');
  } catch (error) {
    console.error('\n❌ 发生错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

main();
