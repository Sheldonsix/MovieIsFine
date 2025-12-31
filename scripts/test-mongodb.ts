/**
 * MongoDB 连接测试脚本
 * 运行: npx tsx scripts/test-mongodb.ts
 */

import { MongoClient } from "mongodb";

const MONGODB_URI =
  process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

async function testConnection() {
  console.log("🔄 正在连接 MongoDB...");
  console.log(`   URI: ${MONGODB_URI.replace(/:[^:@]+@/, ":****@")}`);
  console.log(`   Database: ${MONGODB_DB_NAME}`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ 连接成功！");

    const db = client.db(MONGODB_DB_NAME);

    // 测试 ping 命令
    const pingResult = await db.command({ ping: 1 });
    console.log("✅ Ping 测试通过:", pingResult);

    // 列出所有集合
    const collections = await db.listCollections().toArray();
    console.log(`📁 数据库中的集合 (${collections.length} 个):`);
    if (collections.length === 0) {
      console.log("   (空数据库，暂无集合)");
    } else {
      collections.forEach((col) => console.log(`   - ${col.name}`));
    }

    // 获取服务器信息
    const serverInfo = await db.command({ buildInfo: 1 });
    console.log(`📊 MongoDB 版本: ${serverInfo.version}`);
  } catch (error) {
    console.error("❌ 连接失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("🔒 连接已关闭");
  }
}

testConnection();
