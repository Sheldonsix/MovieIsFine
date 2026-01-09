#!/bin/bash

###############################################################################
# 电影数据更新 - 随机时间执行脚本
#
# 功能：在 10:00-22:00 之间的随机时间执行数据更新
# 使用方法：添加到 crontab，每天 10:00 执行此脚本
#
# crontab 示例：
# 0 10 * * * /path/to/MovieIsFine/scripts/cron/run-at-random-time.sh
###############################################################################

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/update-movie-data.log"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 生成 0-12 之间的随机小时数（对应 10:00-22:00 的 12 小时范围）
RANDOM_HOUR=$((RANDOM % 13))
RANDOM_MINUTE=$((RANDOM % 60))

# 计算延迟秒数
DELAY=$((RANDOM_HOUR * 3600 + RANDOM_MINUTE * 60))

# 计算实际执行时间
EXEC_TIME=$(date -d "+$DELAY seconds" "+%Y-%m-%d %H:%M:%S")

# 记录调度信息
echo "========================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 调度器启动" >> "$LOG_FILE"
echo "计划执行时间: $EXEC_TIME" >> "$LOG_FILE"
echo "延迟: ${RANDOM_HOUR}小时 ${RANDOM_MINUTE}分钟" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# 等待随机时间后执行
(
  sleep $DELAY

  echo "" >> "$LOG_FILE"
  echo "========================================" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始执行更新任务" >> "$LOG_FILE"
  echo "========================================" >> "$LOG_FILE"

  cd "$PROJECT_DIR" || exit 1
  npx tsx scripts/update-movie-data.ts >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?

  echo "========================================" >> "$LOG_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 任务完成 (退出码: $EXIT_CODE)" >> "$LOG_FILE"
  echo "========================================" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
) &

# 打印进程 ID
echo "后台任务 PID: $!" >> "$LOG_FILE"
