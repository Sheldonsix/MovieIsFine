/**
 * 电影数据迁移脚本 - 将 movies.ts 中的数据导入 MongoDB
 * 运行: npx tsx scripts/migration/migrate-movies.ts
 */

import { MongoClient } from "mongodb";
import { movies } from "../../src/data/movies";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

async function migrateMovies() {
  console.log("🎬 电影数据迁移脚本");
  console.log("=".repeat(50));
  console.log(`📊 待导入电影数量: ${movies.length}`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ 已连接到 MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection("movies");

    // 删除旧集合（包括索引）重新创建
    const collections = await db.listCollections({ name: "movies" }).toArray();
    if (collections.length > 0) {
      console.log("⚠️  集合已存在，正在删除...");
      await collection.drop();
      console.log("   ✅ 旧集合已删除");
    }

    // 为每条记录添加 _id 和时间戳
    const documentsToInsert = movies.map((movie) => ({
      ...movie,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 批量插入
    const result = await collection.insertMany(documentsToInsert);
    console.log(`✅ 成功插入 ${result.insertedCount} 条电影记录`);

    // 创建索引
    console.log("\n📇 创建索引...");
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ imdbId: 1 }, { unique: true, sparse: true });
    await collection.createIndex({ genres: 1 });
    await collection.createIndex({ doubanRating: -1 });
    await collection.createIndex({ releaseDate: -1 });
    // 文本索引：使用 "none" 语言并禁用语言覆盖
    await collection.createIndex(
      { title: "text", originalTitle: "text" },
      { default_language: "none", language_override: "textSearchLanguage" }
    );
    console.log("✅ 索引创建完成");

    // 验证
    const finalCount = await collection.countDocuments();
    console.log(`\n📊 验证: 集合中共有 ${finalCount} 条记录`);

    // 显示示例数据
    const sample = await collection.findOne({});
    console.log("\n📝 示例记录:");
    console.log(`   标题: ${sample?.title}`);
    console.log(`   IMDB ID: ${sample?.imdbId}`);
    console.log(`   评分: ${sample?.doubanRating}`);
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n🔒 连接已关闭");
  }
}

migrateMovies();
