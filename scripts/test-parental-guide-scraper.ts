/**
 * 测试 IMDb 家长指南爬虫（含翻译）
 * 运行: npx tsx scripts/test-parental-guide-scraper.ts [imdbId] [--no-translate]
 */

import { config } from "dotenv";
// 加载 .env.local 环境变量
config({ path: ".env.local" });

import { scrapeImdbParentalGuide, scrapeAndTranslateParentalGuide } from "../src/services/imdbParentalGuideScraper";

async function main() {
  // 默认测试 The Shawshank Redemption
  const args = process.argv.slice(2);
  const imdbId = args.find(arg => !arg.startsWith("--")) || "tt0111161";
  const noTranslate = args.includes("--no-translate");

  console.log(`\n🎬 测试 IMDb 家长指南爬虫`);
  console.log(`📍 目标: ${imdbId}`);
  console.log(`🌐 翻译: ${noTranslate ? "禁用" : "启用"}`);
  console.log("=".repeat(50));

  const result = noTranslate
    ? await scrapeImdbParentalGuide(imdbId)
    : await scrapeAndTranslateParentalGuide(imdbId);

  if (!result.success) {
    console.error(`❌ 爬取失败: ${result.error}`);
    process.exit(1);
  }

  const guide = result.data!;

  console.log(`\n✅ 爬取成功!`);
  console.log(`\n📋 基本信息:`);
  console.log(`  - 标题: ${guide.title}`);
  console.log(`  - IMDB ID: ${guide.imdb_id}`);
  console.log(`  - 内容分级: ${guide.content_rating || "N/A"}`);
  if (guide.content_rating_zh) {
    console.log(`  - 内容分级(中文): ${guide.content_rating_zh}`);
  }
  console.log(`  - URL: ${guide.url}`);

  console.log(`\n📊 各类别严重程度:`);
  console.log(
    `  - 性与裸露: ${guide.sex_nudity.severity} (${guide.sex_nudity.items.length} 条)`
  );
  console.log(
    `  - 暴力血腥: ${guide.violence_gore.severity} (${guide.violence_gore.items.length} 条)`
  );
  console.log(
    `  - 粗口: ${guide.profanity.severity} (${guide.profanity.items.length} 条)`
  );
  console.log(
    `  - 酒精/毒品/吸烟: ${guide.alcohol_drugs_smoking.severity} (${guide.alcohol_drugs_smoking.items.length} 条)`
  );
  console.log(
    `  - 惊吓/紧张: ${guide.frightening_intense.severity} (${guide.frightening_intense.items.length} 条)`
  );

  console.log(`\n🌍 各国分级: ${guide.certifications.length} 个国家`);

  // 显示翻译示例
  if (!noTranslate && guide.violence_gore.items_zh.length > 0) {
    console.log(`\n📝 暴力血腥条目翻译示例 (前 2 条):`);
    guide.violence_gore.items.slice(0, 2).forEach((item, i) => {
      console.log(`  [原文] ${item.substring(0, 80)}...`);
      console.log(`  [译文] ${guide.violence_gore.items_zh[i]?.substring(0, 80) || "N/A"}...`);
      console.log("");
    });
  } else if (guide.violence_gore.items.length > 0) {
    console.log(`\n📝 暴力血腥条目示例 (前 2 条):`);
    guide.violence_gore.items.slice(0, 2).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.substring(0, 100)}...`);
    });
  }

  console.log("\n" + "=".repeat(50));
  console.log("测试完成!");
}

main().catch(console.error);
