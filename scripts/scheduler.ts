/**
 * 电影更新定时调度器
 * 功能：每天在 10:00-22:00 之间的随机时间点执行更新任务
 *
 * 运行方式:
 *   npx tsx scripts/scheduler.ts       # 守护进程模式
 *   npx tsx scripts/scheduler.ts --now # 立即执行一次
 */

import { config } from "dotenv";
import path from "path";

// 必须在其他模块导入前加载环境变量
config({ path: path.join(process.cwd(), ".env.local") });

import { runMovieUpdate } from "./update-movies";

// 配置
const CONFIG = {
  // 执行时间窗口
  START_HOUR: 10, // 10:00
  END_HOUR: 22, // 22:00
  // 更新配置
  MOVIE_LIMIT: 250,
  REQUEST_DELAY_MS: 2000,
};

/**
 * 获取今天执行时间窗口内的随机时间
 */
function getRandomExecutionTime(): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 计算时间窗口的毫秒范围
  const startMs = CONFIG.START_HOUR * 60 * 60 * 1000;
  const endMs = CONFIG.END_HOUR * 60 * 60 * 1000;

  // 生成随机时间
  const randomMs = startMs + Math.random() * (endMs - startMs);
  const executionTime = new Date(today.getTime() + randomMs);

  // 如果随机时间已过，推迟到明天
  if (executionTime <= now) {
    executionTime.setDate(executionTime.getDate() + 1);
  }

  return executionTime;
}

/**
 * 计算到目标时间的毫秒数
 */
function msUntil(targetTime: Date): number {
  return Math.max(0, targetTime.getTime() - Date.now());
}

/**
 * 格式化时间显示
 */
function formatTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 格式化时间间隔
 */
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);

  return parts.join("");
}

/**
 * 执行一次更新任务
 */
async function executeUpdate(): Promise<void> {
  console.log("\n🚀 开始执行电影更新任务...\n");

  try {
    await runMovieUpdate(CONFIG.MOVIE_LIMIT, CONFIG.REQUEST_DELAY_MS);
    console.log("\n✅ 更新任务执行完成\n");
  } catch (error) {
    console.error("\n❌ 更新任务执行失败:", error);
  }
}

/**
 * 调度下一次执行
 */
function scheduleNextExecution(): void {
  const nextTime = getRandomExecutionTime();
  const waitMs = msUntil(nextTime);

  console.log("========================================");
  console.log("📅 电影更新调度器");
  console.log(`当前时间: ${formatTime(new Date())}`);
  console.log(`下次执行: ${formatTime(nextTime)}`);
  console.log(`等待时间: ${formatDuration(waitMs)}`);
  console.log("========================================\n");

  setTimeout(async () => {
    await executeUpdate();
    // 执行完成后调度下一次
    scheduleNextExecution();
  }, waitMs);
}

/**
 * 立即执行模式
 */
async function runImmediately(): Promise<void> {
  console.log("⚡ 立即执行模式\n");
  await executeUpdate();
}

/**
 * 守护进程模式
 */
function runAsDaemon(): void {
  console.log("🔄 守护进程模式 - 持续运行\n");
  console.log(`配置: 每天 ${CONFIG.START_HOUR}:00 - ${CONFIG.END_HOUR}:00 随机执行`);
  console.log(`每次更新 ${CONFIG.MOVIE_LIMIT} 部电影\n`);

  scheduleNextExecution();

  // 优雅退出处理
  process.on("SIGINT", async () => {
    console.log("\n收到终止信号，正在关闭...");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n收到终止信号，正在关闭...");
    process.exit(0);
  });
}

// 主入口
const args = process.argv.slice(2);
const isImmediate = args.includes("--now") || args.includes("-n");

if (isImmediate) {
  runImmediately()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("执行失败:", error);
      process.exit(1);
    });
} else {
  runAsDaemon();
}
