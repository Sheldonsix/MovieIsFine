#!/usr/bin/env npx tsx
/**
 * 电影数据更新调度器
 *
 * 使用 node-cron 实现定时任务调度
 * 每天在 10:00-22:00 之间的随机时间执行更新
 *
 * 使用 PM2 运行：
 *   pm2 start scripts/cron/scheduler.ts --name movie-scheduler
 *   pm2 startup
 *   pm2 save
 *
 * 直接运行：
 *   npx tsx scripts/cron/scheduler.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { appendFile } from "fs/promises";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

const execAsync = promisify(exec);

const LOG_FILE = resolve(process.cwd(), "logs", "scheduler.log");

/**
 * 写日志
 */
async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  try {
    await appendFile(LOG_FILE, logMessage);
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}

/**
 * 生成 10:00-22:00 之间的随机时间（单位：毫秒）
 */
function getRandomDelay(): number {
  const randomHour = Math.floor(Math.random() * 13); // 0-12 小时
  const randomMinute = Math.floor(Math.random() * 60); // 0-59 分钟
  return (randomHour * 60 + randomMinute) * 60 * 1000; // 转换为毫秒
}

/**
 * 格式化时间延迟为可读字符串
 */
function formatDelay(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}小时${minutes}分钟`;
}

/**
 * 执行更新任务
 */
async function runUpdate(): Promise<void> {
  await log("========================================");
  await log("开始执行电影数据更新任务");
  await log("========================================");

  try {
    const { stdout, stderr } = await execAsync(
      "npx tsx scripts/update-movie-data.ts",
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    // 输出到控制台和日志文件
    if (stdout) {
      console.log(stdout);
      await appendFile(LOG_FILE, stdout);
    }

    if (stderr) {
      console.error(stderr);
      await appendFile(LOG_FILE, `STDERR: ${stderr}\n`);
    }

    await log("========================================");
    await log("任务执行成功完成");
    await log("========================================");
  } catch (error) {
    await log("========================================");
    await log(`任务执行失败: ${error}`);
    await log("========================================");
    console.error("Update failed:", error);
  }
}

/**
 * 调度下一次任务
 */
function scheduleNextRun(): void {
  const delay = getRandomDelay();
  const execTime = new Date(Date.now() + delay);

  log(
    `已调度下一次更新任务：${execTime.toLocaleString("zh-CN")} (${formatDelay(delay)}后)`
  );

  setTimeout(async () => {
    await runUpdate();
    // 执行完后调度下一次
    scheduleNextRun();
  }, delay);
}

/**
 * 每天零点重新调度
 */
function scheduleDaily(): void {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilMidnight = tomorrow.getTime() - now.getTime();

  log(`下次重新调度时间：${tomorrow.toLocaleString("zh-CN")}`);

  setTimeout(() => {
    log("========================================");
    log("每日调度器重置");
    log("========================================");
    scheduleNextRun();
    scheduleDaily(); // 递归调度下一天
  }, timeUntilMidnight);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  await log("========================================");
  await log("电影数据更新调度器启动");
  await log("========================================");
  await log(`工作目录: ${process.cwd()}`);
  await log(`日志文件: ${LOG_FILE}`);
  await log(`调度策略: 每天 10:00-22:00 之间随机时间执行`);
  await log("========================================");

  // 首次调度
  scheduleNextRun();

  // 每天零点重新调度
  scheduleDaily();

  // 优雅关闭处理
  process.on("SIGINT", async () => {
    await log("========================================");
    await log("收到 SIGINT 信号，准备关闭调度器");
    await log("========================================");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await log("========================================");
    await log("收到 SIGTERM 信号，准备关闭调度器");
    await log("========================================");
    process.exit(0);
  });
}

// 启动
main().catch(async (error) => {
  await log(`致命错误: ${error}`);
  console.error("Fatal error:", error);
  process.exit(1);
});
