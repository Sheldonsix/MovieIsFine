/**
 * 家长指南数据迁移脚本 - 将 parental_guides 目录中的 JSON 文件导入到 MongoDB 电影记录中
 * 运行: npx tsx scripts/migration/migrate-parental-guides.ts
 */

import { MongoClient } from "mongodb";
import { promises as fs } from "fs";
import path from "path";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";
const PARENTAL_GUIDES_DIR = path.join(
  process.cwd(),
  "scripts",
  "scraping",
  "parental_guides"
);

interface MigrationStats {
  total: number;
  success: number;
  notFound: number;
  error: number;
}

async function migrateParentalGuides() {
  console.log("📋 家长指南数据迁移脚本");
  console.log("=".repeat(50));

  const client = new MongoClient(MONGODB_URI);
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    notFound: 0,
    error: 0,
  };

  try {
    await client.connect();
    console.log("✅ 已连接到 MongoDB\n");

    const db = client.db(MONGODB_DB_NAME);
    const moviesCollection = db.collection("movies");

    // 读取所有家长指南 JSON 文件
    const files = await fs.readdir(PARENTAL_GUIDES_DIR);
    const jsonFiles = files.filter(
      (f) => f.endsWith("_parental_guide.json") && !f.startsWith("scrape")
    );

    console.log(`📁 找到 ${jsonFiles.length} 个家长指南文件\n`);
    stats.total = jsonFiles.length;

    // 逐个处理文件
    for (const file of jsonFiles) {
      // 从文件名提取 IMDB ID (例如: tt0111161_parental_guide.json -> tt0111161)
      const imdbId = file.replace("_parental_guide.json", "");

      try {
        // 读取 JSON 文件
        const filePath = path.join(PARENTAL_GUIDES_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const parentalGuide = JSON.parse(content);

        // 更新对应电影的文档
        const result = await moviesCollection.updateOne(
          { imdbId: imdbId },
          {
            $set: {
              parentalGuide: parentalGuide,
              updatedAt: new Date(),
            },
          }
        );

        if (result.matchedCount > 0) {
          stats.success++;
          console.log(`✅ ${imdbId} - 更新成功`);
        } else {
          stats.notFound++;
          console.log(`⚠️  ${imdbId} - 未找到对应电影`);
        }
      } catch (err) {
        stats.error++;
        console.error(`❌ ${imdbId} - 处理失败:`, err);
      }
    }

    // 输出统计
    console.log("\n" + "=".repeat(50));
    console.log("📊 迁移统计:");
    console.log(`   总文件数: ${stats.total}`);
    console.log(`   成功更新: ${stats.success}`);
    console.log(`   未找到电影: ${stats.notFound}`);
    console.log(`   处理失败: ${stats.error}`);

    // 验证
    const moviesWithGuide = await moviesCollection.countDocuments({
      parentalGuide: { $exists: true },
    });
    console.log(`\n📋 验证: ${moviesWithGuide} 部电影已关联家长指南`);

    // 显示示例
    const sample = await moviesCollection.findOne({
      parentalGuide: { $exists: true },
    });
    if (sample) {
      console.log("\n📝 示例记录:");
      console.log(`   电影: ${sample.title}`);
      console.log(`   IMDB ID: ${sample.imdbId}`);
      console.log(
        `   内容分级: ${sample.parentalGuide?.content_rating || "N/A"}`
      );
    }
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n🔒 连接已关闭");
  }
}

migrateParentalGuides();
