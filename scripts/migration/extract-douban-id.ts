/**
 * 从 doubanUrl 提取 doubanId 并更新到数据库
 * 运行: npx tsx scripts/migration/extract-douban-id.ts
 */

import { MongoClient } from "mongodb";
import { config } from "dotenv";
import path from "path";

// 加载环境变量
config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

/**
 * 从豆瓣 URL 中提取豆瓣 ID
 * @param url 豆瓣 URL，如 "https://movie.douban.com/subject/6424756/"
 * @returns 豆瓣 ID，如 "6424756"
 */
function extractDoubanId(url: string): string | null {
  const match = url.match(/\/subject\/(\d+)\/?/);
  return match ? match[1] : null;
}

async function updateDoubanIds() {
  console.log("🎬 从 doubanUrl 提取 doubanId");
  console.log("=".repeat(50));

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ 已连接到 MongoDB");

    const db = client.db(MONGODB_DB_NAME);
    const collection = db.collection("movies");

    // 获取所有有 doubanUrl 的记录
    const moviesWithUrl = await collection
      .find({
        doubanUrl: { $exists: true, $ne: "" },
      })
      .toArray();

    console.log(`\n📊 找到 ${moviesWithUrl.length} 条有 doubanUrl 的记录`);

    if (moviesWithUrl.length === 0) {
      console.log("⚠️  没有需要更新的记录");
      return;
    }

    // 统计
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 批量更新
    for (const movie of moviesWithUrl) {
      const doubanUrl = movie.doubanUrl as string;
      const doubanId = extractDoubanId(doubanUrl);

      if (!doubanId) {
        console.log(`❌ 无法从 URL 提取 ID: ${doubanUrl}`);
        errorCount++;
        continue;
      }

      // 检查是否已有 doubanId
      if (movie.doubanId === doubanId) {
        skipCount++;
        continue;
      }

      // 更新记录
      await collection.updateOne(
        { _id: movie._id },
        {
          $set: {
            doubanId: doubanId,
            updatedAt: new Date(),
          },
        }
      );

      successCount++;
      console.log(`✅ [${successCount}/${moviesWithUrl.length}] ${movie.title} -> doubanId: ${doubanId}`);
    }

    // 输出统计
    console.log("\n" + "=".repeat(50));
    console.log("📊 更新统计:");
    console.log(`   ✅ 成功更新: ${successCount} 条`);
    console.log(`   ⏭️  已存在跳过: ${skipCount} 条`);
    console.log(`   ❌ 提取失败: ${errorCount} 条`);

    // 验证结果
    const withDoubanId = await collection.countDocuments({
      doubanId: { $exists: true, $ne: "" },
    });
    console.log(`\n✅ 验证: 数据库中现有 ${withDoubanId} 条记录有 doubanId`);

    // 创建索引（如果不存在）
    console.log("\n📇 确保 doubanId 索引存在...");
    try {
      await collection.createIndex({ doubanId: 1 }, { unique: true, sparse: true });
      console.log("✅ doubanId 索引已创建");
    } catch (error) {
      console.log("ℹ️  doubanId 索引已存在");
    }

  } catch (error) {
    console.error("❌ 更新失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n🔒 连接已关闭");
  }
}

updateDoubanIds();
