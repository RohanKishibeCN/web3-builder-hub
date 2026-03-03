# Web3 Builder Hub - Phase 1 部署指南

## 文件清单

```
lib/
  whitelist.ts          # 白名单配置
  db.ts                 # 数据库工具函数
  telegram.ts           # Telegram 推送封装

types/
  project.ts            # TypeScript 类型定义

app/api/
  discover-v2/route.ts      # 新的发现 API（白名单 + Kimi 过滤）
  deep-dive/route.ts        # 深度研判 API（Jina AI + Kimi 分析）
  daily-report-v2/route.ts  # 每日推送 API

sql/
  migrations.sql        # 数据库迁移脚本

vercel.json           # 更新后的定时任务配置
```

## 部署步骤

### Step 1: 复制文件到项目

将上述文件复制到你的项目对应位置。

### Step 2: 执行数据库迁移

在 Vercel Postgres 控制台执行：

```sql
-- 添加新字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS deep_dive_result JSONB;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_score ON projects((score->>'total_score'));
```

### Step 3: 更新环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加：

```
# 已有
BRAVE_SEARCH_API_KEY=xxx
KIMI_API_KEY=xxx
POSTGRES_URL=xxx

# 新增
TELEGRAM_BOT_TOKEN=xxx          # 你的 Telegram Bot Token
TELEGRAM_CHAT_ID=xxx            # 你的 Chat ID
CRON_SECRET=xxx                 # 随机字符串，用于保护定时任务
```

获取 Telegram Chat ID：
1. 给 @userinfobot 发送消息，获取你的 ID
2. 或者给 @raw_data_bot 发送消息

### Step 4: 更新 vercel.json

用新的 `vercel.json` 替换旧的，新的定时任务：
- `22:00` - 发现新项目
- `23:00` - 深度研判
- `08:00` - 每日推送

### Step 5: 部署

```bash
git add .
git commit -m "Phase 1: 自动化发现 + 深度研判 + Telegram 推送"
git push
```

Vercel 会自动部署。

### Step 6: 测试

#### 测试发现 API
```bash
curl https://your-domain.com/api/discover-v2
```

#### 测试深度研判
```bash
curl https://your-domain.com/api/deep-dive?limit=3
```

#### 测试每日推送
```bash
curl https://your-domain.com/api/daily-report-v2
```

## 工作流程

```
每天 22:00 ──→ discover-v2 ──→ 发现新项目 ──→ 状态: pending_deep_dive
                (搜索白名单 + Kimi 过滤)

每天 23:00 ──→ deep-dive ──→ 深度分析 ──→ 状态: scored
                (Jina AI 提取 + Kimi 评分)

每天 08:00 ──→ daily-report-v2 ──→ Telegram 推送
                (只推送 score >= 8.0 的项目)
```

## 预期效果

每天早上 8 点，你会收到 Telegram 消息：

```
🦞 Web3 Builder Hub - 每日精选
📅 2026/3/3
━━━━━━━━━━━━━━

🔥 Solana AI Hackathon
━━━━━━━━━━━━━━
📊 评分: 9.2/10
⏰ 截止: 2026/3/15
💰 $50,000+

🎯 赛道潜力: AI Agent + DeFi 交叉赛道，竞争相对较小
🏆 预计胜率: 35%

📋 参与计划:
建议基于 Solana 构建 AI 驱动的流动性管理工具，
利用 Kimi API 实现智能仓位管理，3 天可完成 MVP...

💡 顶级机会，奖金丰厚，技术栈匹配度高

🔗 查看详情

回复 "GO Solana AI Hackathon" 生成申请文案
```

## 成本估算

| 服务 | 用量 | 月费用 |
|------|------|--------|
| Kimi API | ~500 次调用 | ¥30-50 |
| Brave Search | 免费额度 | ¥0 |
| Vercel | Hobby 计划 | ¥0 |
| Telegram Bot | 免费 | ¥0 |
| **总计** | | **¥30-50** |

## 下一步 (Phase 2)

1. 添加申请文案生成 API
2. 添加代码模板生成
3. Telegram 添加交互按钮
4. 个人偏好记忆系统

## 故障排查

### 问题：API 返回 401
解决：检查 `CRON_SECRET` 环境变量，本地测试时不需要

### 问题：Telegram 没收到消息
解决：检查 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`

### 问题：Kimi API 报错
解决：检查 `KIMI_API_KEY` 是否有效，额度是否充足

### 问题：数据库报错
解决：确认 migrations.sql 已执行

---

有问题随时问我！🚀
