# Web3 Builder Hub

Web3 自动化情报系统 - 发现、分析、推送 Web3 Hackathon 和 Builder Program 机会。

## 功能特性

- **智能发现**: 自动搜索 15+ 白名单来源，发现新项目
- **深度分析**: 使用 LLM 分析项目潜力、胜率、技术方案
- **每日推送**: 推送高质量项目（评分 >= 8.0）到 Telegram
- **交互生成**: Telegram 回复指令生成申请文案和代码模板
- **飞书集成**: 同步推送项目到 Lark（飞书）

## 架构优化（最新）

### 1. 统一 LLM 客户端

通过 `lib/llm-client.ts` 实现统一的大模型调用接口：

```typescript
// 支持的提供商
- Kimi (默认)
- OpenAI
- Groq
- Anthropic

// 使用方式
import { callLLM, callLLMJSON, extractJSON } from '@/lib/llm-client';

const response = await callLLM(prompt, { temperature: 0.7 });
const json = await callLLMJSON(prompt);
```

**环境变量配置**:
```bash
# 切换提供商
LLM_PROVIDER=kimi  # 或 openai, groq, anthropic

# 统一 API Key
LLM_API_KEY=your_api_key
```

### 2. Telegram Webhook 修复

**问题**: 原代码通过 HTTP 调用 `/api/generate-proposal` 导致超时

**解决方案**: 直接在 Webhook 内部调用 LLM 函数

```typescript
// 修复前：HTTP 调用（可能超时）
const response = await fetch(`${baseUrl}/api/generate-proposal?projectId=${projectId}`);

// 修复后：直接函数调用
const proposal = await generateProposal(projectId);
```

### 3. Lark (飞书) 推送模块

新增 `lib/lark.ts` 支持飞书消息推送：

```typescript
import { sendLarkMessage, sendLarkCard, sendLarkDailyReport } from '@/lib/lark';

// 发送文本消息
await sendLarkMessage('Hello from Web3 Builder Hub');

// 发送卡片消息
await sendLarkCard(formatLarkProjectCard(project));

// 发送每日报告
await sendLarkDailyReport(projects);
```

**配置**:
```bash
LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```


## QQ Bot 配置

### 1. 在 QQ 开放平台创建机器人

1. 访问 [QQ 开放平台](https://q.qq.com/)
2. 注册开发者账号
3. 创建机器人应用，获取：
   - **AppID**
   - **AppSecret**

### 2. 配置环境变量

```bash
QQ_APP_ID=your_qq_app_id
QQ_APP_SECRET=your_qq_app_secret
QQ_TARGET_TYPE=group  # channel | group | c2c
QQ_TARGET_ID=your_target_id
QQ_USE_SANDBOX=false  # 开发时设为 true
```

### 3. 配置回调地址

在 QQ 开放平台 → 机器人 → 开发设置 → 回调地址：
```
https://your-domain.com/api/qq-webhook
```

### 4. 邀请机器人加入群/频道

- **群聊**: 在 QQ 群设置中添加机器人
- **频道**: 在频道设置中邀请机器人

### 5. 使用指令

在群/频道中发送：
- `GO <projectId>` - 生成申请文案
- `CODE <projectId>` - 生成代码模板
- `CONFIRM <id>` - 确认加入白名单
- `REJECT <id>` - 拒绝加入白名单

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的配置
```

### 3. 初始化数据库

```bash
# 访问初始化 API
curl http://localhost:3000/api/init
```

### 4. 本地开发

```bash
npm run dev
```

### 5. 部署到 Vercel

```bash
vercel --prod
```

## API 端点

| 端点 | 描述 | 定时 |
|------|------|------|
| `/api/discover-v2` | 发现新项目 | 每天 02:00 |
| `/api/deep-dive` | 深度分析 | 每天 23:00 |
| `/api/daily-report-v2` | 每日推送 | 每天 08:00 |
| `/api/generate-proposal` | 生成申请文案 | 手动 |
| `/api/generate-template` | 生成代码模板 | 手动 |
| `/api/telegram-webhook` | Telegram Webhook | - |
| `/api/whitelist-confirm` | 白名单确认 | - |

## Telegram 指令

在 Telegram 中回复以下指令：

- `GO <projectId>` - 生成申请文案
- `CODE <projectId>` - 生成代码模板
- `CONFIRM <id>` - 确认加入白名单
- `REJECT <id>` - 拒绝加入白名单

## 项目结构

```
web3-builder-hub/
├── app/
│   └── api/
│       ├── discover-v2/        # 项目发现
│       ├── deep-dive/          # 深度分析
│       ├── daily-report-v2/    # 每日推送
│       ├── generate-proposal/  # 申请文案生成
│       ├── generate-template/  # 代码模板生成
│       ├── telegram-webhook/   # Telegram 交互
│       └── whitelist-confirm/  # 白名单确认
├── lib/
│   ├── llm-client.ts          # 统一 LLM 客户端 ⭐
│   ├── lark.ts                # 飞书推送模块 ⭐
│   ├── db.ts                  # 数据库操作
│   ├── telegram.ts            # Telegram 推送
│   ├── whitelist.ts           # 白名单管理
│   ├── domain-evaluator.ts    # 域名评估
│   └── content-extractor.ts   # 内容提取
├── types/
│   └── project.ts             # 类型定义
└── README.md
```

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `POSTGRES_URL` | PostgreSQL 连接字符串 | ✅ |
| `BRAVE_SEARCH_API_KEY` | Brave Search API Key | ✅ |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID | ✅ |
| `CRON_SECRET` | Cron 任务密钥 | ✅ |
| `LLM_PROVIDER` | LLM 提供商 (kimi/openai/groq/anthropic) | ❌ |
| `LLM_API_KEY` | 统一的 LLM API Key | ✅ |
| `LARK_WEBHOOK_URL` | 飞书 Webhook URL | ❌ |

## 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: Vercel Postgres
- **部署**: Vercel
- **LLM**: Kimi / OpenAI / Groq / Anthropic
- **搜索**: Brave Search API
- **内容提取**: Jina AI Reader
- **推送**: Telegram Bot / Lark (飞书)

## License

MIT
