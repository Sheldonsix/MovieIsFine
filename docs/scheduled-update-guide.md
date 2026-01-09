# 电影数据定期更新 - 定时任务配置

## 脚本说明

`scripts/update-movie-data.ts` 是一个自动更新电影数据的脚本，功能如下：

1. **智能选择**：从数据库中选择需要更新的电影
   - 70% 来自更新时间最早的电影
   - 30% 完全随机选择
   - 默认每次更新 250 部电影

2. **数据抓取**：从豆瓣抓取最新电影信息

3. **增量更新**：
   - 比较新旧数据差异
   - 仅更新有变化的字段
   - 记录详细的更新日志

4. **防爬机制**：
   - 请求间隔 3-5 秒（随机延迟）
   - 避免触发豆瓣反爬虫

## 使用方法

### 基础使用

```bash
# 更新 250 部电影（默认）
npx tsx scripts/update-movie-data.ts

# 更新指定数量的电影
npx tsx scripts/update-movie-data.ts --limit 100

# 测试模式（不实际更新数据库）
npx tsx scripts/update-movie-data.ts --dry-run

# 更新单部电影
npx tsx scripts/update-movie-data.ts --douban-id 1292052
```

## 定时任务配置

### 方案一：Linux Cron（推荐）

#### 1. 创建日志目录

```bash
mkdir -p /path/to/MovieIsFine/logs
```

#### 2. 编辑 crontab

```bash
crontab -e
```

#### 3. 添加定时任务

**选项 A：每天固定时间执行（例如每天下午 2 点）**

```cron
0 14 * * * cd /path/to/MovieIsFine && npx tsx scripts/update-movie-data.ts >> logs/update-movie-data.log 2>&1
```

**选项 B：每天随机时间执行（10:00-22:00 之间）**

```cron
# 方法1：在 10-22 点之间的整点随机执行
0 10-22 * * * [ $((RANDOM \% 13)) -eq 0 ] && cd /path/to/MovieIsFine && npx tsx scripts/update-movie-data.ts >> logs/update-movie-data.log 2>&1

# 方法2：使用辅助脚本（推荐）
0 10 * * * /path/to/MovieIsFine/scripts/cron/run-at-random-time.sh
```

#### 4. 创建随机时间执行脚本

创建 `scripts/cron/run-at-random-time.sh`:

```bash
#!/bin/bash

# 生成 0-12 之间的随机小时数（对应 10:00-22:00）
RANDOM_HOUR=$((RANDOM % 13))
RANDOM_MINUTE=$((RANDOM % 60))

# 计算延迟秒数
DELAY=$((RANDOM_HOUR * 3600 + RANDOM_MINUTE * 60))

# 等待随机时间后执行
(sleep $DELAY && cd /path/to/MovieIsFine && npx tsx scripts/update-movie-data.ts >> logs/update-movie-data.log 2>&1) &
```

赋予执行权限：

```bash
chmod +x /path/to/MovieIsFine/scripts/cron/run-at-random-time.sh
```

### 方案二：使用 systemd timer（Linux）

#### 1. 创建 service 文件

创建 `/etc/systemd/system/movie-update.service`:

```ini
[Unit]
Description=Update Movie Data
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/MovieIsFine
ExecStart=/usr/bin/npx tsx scripts/update-movie-data.ts
StandardOutput=append:/path/to/MovieIsFine/logs/update-movie-data.log
StandardError=append:/path/to/MovieIsFine/logs/update-movie-data.log

[Install]
WantedBy=multi-user.target
```

#### 2. 创建 timer 文件

创建 `/etc/systemd/system/movie-update.timer`:

```ini
[Unit]
Description=Daily Movie Data Update Timer
Requires=movie-update.service

[Timer]
# 每天在 10:00-22:00 之间的随机时间执行
OnCalendar=daily
RandomizedDelaySec=12h
AccuracySec=1h

[Install]
WantedBy=timers.target
```

#### 3. 启用并启动 timer

```bash
sudo systemctl daemon-reload
sudo systemctl enable movie-update.timer
sudo systemctl start movie-update.timer

# 查看 timer 状态
sudo systemctl status movie-update.timer
sudo systemctl list-timers
```

### 方案三：使用 Node.js 调度库（node-cron）

如果项目需要更复杂的调度逻辑，可以使用 node-cron。

#### 1. 安装依赖

```bash
npm install node-cron @types/node-cron
```

#### 2. 创建调度脚本

创建 `scripts/cron/scheduler.ts`:

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 每天在 10:00-22:00 之间的随机时间执行
function getRandomCronExpression(): string {
  const hour = Math.floor(Math.random() * 13) + 10; // 10-22
  const minute = Math.floor(Math.random() * 60);
  return `${minute} ${hour} * * *`;
}

async function runUpdate() {
  console.log(`[${new Date().toISOString()}] Starting movie data update...`);
  try {
    const { stdout, stderr } = await execAsync(
      'npx tsx scripts/update-movie-data.ts',
      { cwd: process.cwd() }
    );
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error('Update failed:', error);
  }
}

// 每天重新计算随机时间
cron.schedule('0 0 * * *', () => {
  const cronExpr = getRandomCronExpression();
  console.log(`Scheduled next update at: ${cronExpr}`);
  cron.schedule(cronExpr, runUpdate);
});

console.log('Movie data update scheduler started');
```

#### 3. 使用 PM2 保持运行

```bash
# 安装 PM2
npm install -g pm2

# 启动调度器
pm2 start scripts/cron/scheduler.ts --name movie-scheduler

# 设置开机自启
pm2 startup
pm2 save
```

## 日志管理

### 查看日志

```bash
# 查看最新日志
tail -f logs/update-movie-data.log

# 查看最近 100 行
tail -n 100 logs/update-movie-data.log

# 搜索错误
grep "✗" logs/update-movie-data.log
```

### 日志轮转（logrotate）

创建 `/etc/logrotate.d/movie-update`:

```
/path/to/MovieIsFine/logs/update-movie-data.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 your-username your-username
    sharedscripts
}
```

## 监控和告警

### 邮件通知（可选）

修改 cron 任务，添加邮件通知：

```bash
# 安装 mailutils
sudo apt-get install mailutils

# 修改 crontab
MAILTO=your-email@example.com
0 14 * * * cd /path/to/MovieIsFine && npx tsx scripts/update-movie-data.ts >> logs/update-movie-data.log 2>&1
```

### Slack 通知（可选）

在脚本中添加 Slack webhook 通知功能。

## 故障排查

### 常见问题

1. **权限错误**
   ```bash
   chmod +x scripts/update-movie-data.ts
   chmod +x scripts/cron/run-at-random-time.sh
   ```

2. **环境变量未加载**
   - 确保 `.env.local` 文件存在
   - 检查 cron 任务的工作目录是否正确

3. **Node.js 版本**
   - 确保 Node.js 版本 >= 18
   - 在 cron 中使用完整路径：`/usr/local/bin/npx`

4. **MongoDB 连接超时**
   - 检查网络连接
   - 增加 MongoDB 连接超时配置

### 测试定时任务

```bash
# 立即执行一次（测试）
npx tsx scripts/update-movie-data.ts --limit 10 --dry-run

# 查看 cron 日志
grep CRON /var/log/syslog
```

## 最佳实践

1. **首次运行建议使用 `--dry-run` 模式测试**
2. **监控日志，定期检查失败记录**
3. **建议每天更新 100-300 部电影**
4. **避免在高峰时段运行（选择 10:00-22:00）**
5. **定期备份数据库**

## 性能估算

- 单部电影抓取：约 3-5 秒
- 250 部电影：约 12.5-20.8 分钟
- 数据库查询：<1 秒
- 数据比对和更新：<1 秒/部

**总耗时**：约 15-25 分钟（250 部电影）
