/**
 * 修复未翻译的家长指南（包括翻译失败仍为英文的情况）
 */
import { config } from "dotenv";
import { resolve } from "path";

// 必须在导入模块之前加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// 家长指南类别键
const CATEGORY_KEYS = [
  "sex_nudity",
  "violence_gore",
  "profanity",
  "alcohol_drugs_smoking",
  "frightening_intense",
] as const;

// 检测字符串是否包含中文字符
function containsChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

// 检测字符串数组中是否有任何中文内容
function hasChineseContent(items: string[]): boolean {
  return items.some((item) => containsChinese(item));
}

// 延时函数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fixParentalGuideTranslation() {
  // 动态导入，确保环境变量已加载
  const { getDatabase, closeConnection } = await import("../src/lib/mongodb");
  const { translateTexts, translateContentRating } = await import(
    "../src/services/translationService"
  );

  const db = await getDatabase();
  const collection = db.collection("movies");

  console.log("=== 修复家长指南翻译 ===\n");

  // 查询有家长指南的电影
  const moviesWithGuide = await collection
    .find({ parentalGuide: { $exists: true, $ne: null } })
    .toArray();

  console.log(`有家长指南的电影总数: ${moviesWithGuide.length}\n`);

  let fixedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < moviesWithGuide.length; i++) {
    const movie = moviesWithGuide[i];
    const guide = movie.parentalGuide;
    let needsUpdate = false;
    const updates: Record<string, unknown> = {};

    try {
      // 检查并翻译 content_rating
      if (guide.content_rating && guide.content_rating.trim() !== "") {
        if (!guide.content_rating_zh || !containsChinese(guide.content_rating_zh)) {
          console.log(`[${i + 1}/${moviesWithGuide.length}] [${movie.title}] 翻译 content_rating...`);
          const translated = await translateContentRating(guide.content_rating);
          if (containsChinese(translated)) {
            updates["parentalGuide.content_rating_zh"] = translated;
            needsUpdate = true;
          }
        }
      }

      // 检查并翻译各类别
      for (const key of CATEGORY_KEYS) {
        const category = guide[key];
        if (category && category.items && category.items.length > 0) {
          const needsTranslation =
            !category.items_zh ||
            category.items_zh.length === 0 ||
            category.items_zh.length !== category.items.length ||
            !hasChineseContent(category.items_zh);

          if (needsTranslation) {
            console.log(`[${i + 1}/${moviesWithGuide.length}] [${movie.title}] 翻译 ${key} (${category.items.length} 条)...`);
            const translatedItems = await translateTexts(category.items);
            if (hasChineseContent(translatedItems)) {
              updates[`parentalGuide.${key}.items_zh`] = translatedItems;
              needsUpdate = true;
            } else {
              console.log(`[${i + 1}/${moviesWithGuide.length}] [${movie.title}] ${key} 翻译失败（仍为英文）`);
            }
          }
        }
      }

      // 更新数据库
      if (needsUpdate) {
        await collection.updateOne({ _id: movie._id }, { $set: updates });
        console.log(`✅ [${movie.title}] 翻译完成并保存\n`);
        fixedCount++;

        // 每处理 10 部电影暂停 1 秒，避免 API 限流
        if (fixedCount % 10 === 0) {
          console.log(`已修复 ${fixedCount} 部，暂停 1 秒...\n`);
          await delay(1000);
        }
      }
    } catch (error) {
      console.error(`❌ [${movie.title}] 翻译失败:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== 修复完成 ===`);
  console.log(`共修复 ${fixedCount} 部电影的家长指南翻译`);
  if (errorCount > 0) {
    console.log(`失败 ${errorCount} 部`);
  }

  await closeConnection();
}

fixParentalGuideTranslation().catch(console.error);
