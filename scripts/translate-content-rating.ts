/**
 * content_rating 翻译脚本 - 将家长指南中的 content_rating 翻译成中文
 * 运行: npx tsx scripts/translate-content-rating.ts
 *
 * 使用前请配置以下 API 信息：
 */

import { MongoClient } from "mongodb";

// ============== API 配置（请修改为你的配置）==============
const AI_API_URL = "YOUR_API_URL"; // 如 https://api.openai.com/v1/chat/completions
const AI_API_KEY = "YOUR_API_KEY"; // 你的 API Key
const AI_MODEL = "YOUR_AI_MODEL"; // 如 gpt-3.5-turbo
// =========================================================

const MONGODB_URI =
  process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "movieisfine";

// 批量处理配置
const BATCH_SIZE = 10; // 每批处理数量
const DELAY_BETWEEN_REQUESTS = 3000; // 请求间隔（毫秒）

interface TranslationStats {
  total: number;
  translated: number;
  skipped: number;
  failed: number;
}

/**
 * 调用 AI API 进行翻译
 */
async function translateText(text: string): Promise<string> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的电影分级翻译助手。请将 MPAA 电影分级说明翻译成简洁的中文。保持原文的专业性和准确性。只返回翻译结果，不要添加任何解释。",
        },
        {
          role: "user",
          content: `请将以下电影分级说明翻译成中文：\n\n${text}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateContentRatings() {
  console.log("🌐 content_rating 翻译脚本");
  console.log("=".repeat(50));

  // 检查 API 配置
  if (
    AI_API_URL === "YOUR_API_URL" ||
    AI_API_KEY === "YOUR_API_KEY" ||
    AI_MODEL === "YOUR_MODEL"
  ) {
    console.error("❌ 请先配置 API 信息！");
    console.log("\n请修改脚本顶部的以下变量：");
    console.log("  - AI_API_URL: API 地址");
    console.log("  - AI_API_KEY: API 密钥");
    console.log("  - AI_MODEL: 模型名称");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  const stats: TranslationStats = {
    total: 0,
    translated: 0,
    skipped: 0,
    failed: 0,
  };

  try {
    await client.connect();
    console.log("✅ 已连接到 MongoDB\n");

    const db = client.db(MONGODB_DB_NAME);
    const moviesCollection = db.collection("movies");

    // 查找所有需要翻译的记录
    const moviesToTranslate = await moviesCollection
      .find({
        "parentalGuide.content_rating": { $exists: true, $ne: "" },
        "parentalGuide.content_rating_zh": { $exists: false },
      })
      .toArray();

    stats.total = moviesToTranslate.length;
    console.log(`📊 需要翻译的记录: ${stats.total}\n`);

    if (stats.total === 0) {
      console.log("✅ 没有需要翻译的记录，所有 content_rating 已翻译完成！");
      return;
    }

    // 分批处理
    for (let i = 0; i < moviesToTranslate.length; i++) {
      const movie = moviesToTranslate[i];
      const contentRating = movie.parentalGuide?.content_rating;

      if (!contentRating) {
        stats.skipped++;
        continue;
      }

      const progress = `[${i + 1}/${stats.total}]`;

      try {
        // 调用 API 翻译
        const translatedText = await translateText(contentRating);

        if (translatedText) {
          // 更新数据库
          await moviesCollection.updateOne(
            { _id: movie._id },
            {
              $set: {
                "parentalGuide.content_rating_zh": translatedText,
                updatedAt: new Date(),
              },
            }
          );

          stats.translated++;
          console.log(`${progress} ✅ ${movie.title}`);
          console.log(`    EN: ${contentRating}`);
          console.log(`    ZH: ${translatedText}`);
        } else {
          stats.failed++;
          console.log(`${progress} ⚠️ ${movie.title} - 翻译结果为空`);
        }

        // 请求间隔，避免限流
        if (i < moviesToTranslate.length - 1) {
          console.log(` 请求限流 ${DELAY_BETWEEN_REQUESTS / 1000} 秒\n`)
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        stats.failed++;
        console.error(`${progress} ❌ ${movie.title} - 翻译失败:`, error);
      }
    }

    // 输出统计
    console.log("\n" + "=".repeat(50));
    console.log("📊 翻译统计:");
    console.log(`   总记录数: ${stats.total}`);
    console.log(`   成功翻译: ${stats.translated}`);
    console.log(`   已跳过: ${stats.skipped}`);
    console.log(`   失败: ${stats.failed}`);

    // 验证
    const translatedCount = await moviesCollection.countDocuments({
      "parentalGuide.content_rating_zh": { $exists: true },
    });
    console.log(`\n📋 验证: ${translatedCount} 部电影已有中文分级说明`);
  } catch (error) {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("\n🔒 连接已关闭");
  }
}

translateContentRatings();
