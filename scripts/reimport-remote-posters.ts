/**
 * 重新导入远程海报脚本
 * 删除数据库中 poster 为 https:// 开头的电影，然后使用 addMovie 重新导入
 */

import { config } from "dotenv";
import path from "path";

// 必须在其他模块导入前加载环境变量
config({ path: path.join(process.cwd(), ".env.local") });

/**
 * 配置选项
 */
interface ReimportOptions {
  dryRun?: boolean; // 是否仅测试，不实际操作
  delayMs?: number; // 每次请求之间的延迟（毫秒）
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批量重新导入远程海报电影
 */
async function reimportRemotePosters(
  options: ReimportOptions = {}
): Promise<void> {
  const { dryRun = false, delayMs = 2000 } = options;

  // 动态导入依赖模块（确保环境变量已加载）
  const { getDatabase } = await import("@/lib/mongodb");
  const { addMovie } = await import("@/app/add/actions");

  console.log("=".repeat(60));
  console.log("重新导入远程海报脚本");
  console.log("=".repeat(60));
  console.log(`配置选项:`);
  console.log(`  - 仅测试模式: ${dryRun ? "是" : "否"}`);
  console.log(`  - 请求延迟: ${delayMs}ms`);
  console.log("=".repeat(60));

  const db = await getDatabase();

  // 查询所有 poster 以 https:// 开头的电影
  const movies = await db
    .collection("movies")
    .find({
      poster: { $regex: "^https://", $options: "i" },
    })
    .toArray();

  console.log(`\n找到 ${movies.length} 部需要重新导入的电影\n`);

  if (movies.length === 0) {
    console.log("没有需要处理的电影，退出。");
    return;
  }

  // 提取 doubanUrl 列表（用于重新导入）
  const moviesToReimport: Array<{
    id: string;
    title: string;
    doubanUrl: string;
  }> = [];

  for (const movie of movies) {
    const doubanUrl = movie.doubanUrl as string | undefined;
    if (!doubanUrl) {
      console.warn(
        `[${movie.id}] ✗ 电影《${movie.title}》没有 doubanUrl，跳过`
      );
      continue;
    }
    moviesToReimport.push({
      id: movie.id as string,
      title: movie.title as string,
      doubanUrl,
    });
  }

  console.log(`\n将处理 ${moviesToReimport.length} 部电影\n`);

  // 统计信息
  const stats = {
    total: moviesToReimport.length,
    deleted: 0,
    reimported: 0,
    failed: 0,
  };

  for (let i = 0; i < moviesToReimport.length; i++) {
    const { id, title, doubanUrl } = moviesToReimport[i];
    console.log(`\n[${i + 1}/${stats.total}] 处理电影: 《${title}》`);
    console.log(`  ID: ${id}`);
    console.log(`  豆瓣链接: ${doubanUrl}`);

    if (dryRun) {
      console.log(`  [DRY-RUN] 将删除并重新导入`);
      continue;
    }

    try {
      // 1. 删除电影
      console.log(`  删除中...`);
      const deleteResult = await db.collection("movies").deleteOne({ id });
      if (deleteResult.deletedCount === 1) {
        stats.deleted++;
        console.log(`  ✓ 已删除`);
      } else {
        console.warn(`  ✗ 删除失败`);
        stats.failed++;
        continue;
      }

      // 2. 使用 addMovie 重新导入
      console.log(`  重新导入中...`);
      const addResult = await addMovie(doubanUrl);

      if (addResult.success) {
        stats.reimported++;
        console.log(`  ✓ 重新导入成功: ${addResult.movie?.id}`);
      } else {
        stats.failed++;
        console.error(`  ✗ 重新导入失败: ${addResult.error}`);
      }
    } catch (error) {
      stats.failed++;
      const errorMsg = error instanceof Error ? error.message : "未知错误";
      console.error(`  ✗ 处理失败: ${errorMsg}`);
    }

    // 延迟，避免请求过快
    if (delayMs > 0 && i < moviesToReimport.length - 1) {
      console.log(`  等待 ${delayMs}ms...`);
      await delay(delayMs);
    }
  }

  // 输出统计信息
  console.log("\n" + "=".repeat(60));
  console.log("处理完成");
  console.log("=".repeat(60));
  console.log(`总计: ${stats.total}`);
  console.log(`已删除: ${stats.deleted}`);
  console.log(`已重新导入: ${stats.reimported}`);
  console.log(`失败: ${stats.failed}`);
  console.log("=".repeat(60));
}

// 主函数
async function main() {
  try {
    // 从命令行参数读取配置
    const args = process.argv.slice(2);
    const options: ReimportOptions = {
      dryRun: args.includes("--dry-run"),
      delayMs: parseInt(
        args.find((arg) => arg.startsWith("--delay="))?.split("=")[1] || "2000"
      ),
    };

    await reimportRemotePosters(options);

    console.log("\n脚本执行完成！");
    process.exit(0);
  } catch (error) {
    console.error("脚本执行失败:", error);
    process.exit(1);
  }
}

// 仅在直接运行时执行
if (require.main === module) {
  main();
}

export { reimportRemotePosters, type ReimportOptions };
