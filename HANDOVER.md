# Web3 Builder Hub - 最新项目架构与开发交接文档 (Phase 3 准备版)

## 🎯 一、项目总览与核心目标
**Web3 Builder Hub** 是一个用于自动化追踪、过滤和评估全网 Web3 开发者机会（Hackathons, Grants, Builder Programs）的智能情报平台。
- **核心诉求**：低成本、防爬虫封禁、高信噪比。
- **部署环境**：前端与 API 均部署在 Vercel (Serverless / Edge) 上。
- **数据库**：Vercel Postgres (Serverless SQL)。
- **AI 引擎**：月之暗面 Kimi 大模型 (Turbo 用于低成本初筛，K2.5 用于深度研判打分，0905 用于代码/文案生成)。
- **技术栈**：Next.js (App Router), Tailwind CSS, Drizzle ORM, Lucide React。

---

## ✅ 二、当前已完成事项 (Phase 1 & Phase 2 闭环)

目前系统已经完整跑通了**“情报发现 ➡️ 网页内容提取 ➡️ LLM 深度研判打分 ➡️ 前端展示”**的全自动闭环，并对成本和执行效率进行了极致优化。

### 1. 基础架构与安全 (Phase 1)
- **数据库重构**：全面接入了 **Drizzle ORM**，数据表定义在 `db/schema.ts` (`projects` 和 `api_logs`)。
  - **最新优化**：重构了批量插入逻辑，使用 `onConflictDoNothing` 消除了 N+1 查询，极大提升了入库性能。
- **全站防护**：在 `middleware.ts` 实现了 Basic Auth 密码锁（排除 `/api` 路由以允许 Cron 任务调用）。
- **限流防刷**：对高成本的 LLM API 接口实现了基于 IP 的内存级限流（Rate Limiting）。

### 2. 情报拉取与双重漏斗 (Phase 2)
- **Tier 1 数据源自动抓取 (`/api/discover-tier1`)**：
  - 零成本、零阻力的原生抓取策略。使用 Node.js 原生 `fetch` + `rss-parser` 每日拉取 Sui, Ethereum Foundation 等 5 个顶级源。
- **Alpha 猎犬挖掘早期高潜项目 (`/api/discover-alpha`)**：
  - **渠道 A (CryptoFundraising)**：抓取刚完成 Seed/Pre-seed 轮融资的新项目。
  - **渠道 B (GitHub API)**：搜索过去 7 天内创建的 Web3 Hackathon/Grant 仓库。
  - **漏斗 1 (低成本初筛)**：将抓到的几百条标题/简介批量发给便宜的 `kimi-k2-turbo-preview`，过滤掉空投、抽奖等噪音，幸存者入库。
- **瀑布流网页内容提取器 (`lib/extractor.ts`)**：
  - 专为应对 Cloudflare 防爬虫机制设计。
  - **Layer 1 (免费/极速)**：优先使用原生 Fetch + Cheerio 提取纯净正文（移除了沉重的 JSDOM 避免 Vercel OOM）。
  - **Layer 2 (付费兜底)**：如果被 403 拦截，自动降级调用现有的 `r.jina.ai` 接口。
- **LLM 深度研判打分 (`/api/deep-dive`) & JSON 反思自愈**：
  - 将提取的长文交给聪明的 `kimi-k2.5` 进行五维打分（Prize ROI, 趋势匹配度等）并生成 MVP 计划。
  - **JSON 自愈机制 (`lib/llm-client.ts`)**：捕获 Zod 校验失败的错误，将其作为提示词让 LLM 自己重新修正 JSON 格式，解决了不可控模型在结构化抽取中的坏点问题。
  - **状态机延迟重试**：数据库增加了 `retryCount` 字段，支持失败项目跨日指数退避重试。

---

## 🚀 三、下一步工作计划：Telegram 交互与半自动执行 (Phase 3)

目前“高价值情报发现”已经稳固，接下来需要让 Agent 具备**“半自动执行辅助系统”**的能力，让开发者能在 Telegram 中一键生成提案和代码骨架。

### 任务 1：开发申请文案生成 API (`/api/generate-proposal`)
- **目标**：根据研判得出的 MVP 路线图，生成一份高质量的、极客风格的参赛提案（Proposal/Pitch）。
- **实现方案**：
  - 创建 REST API 接收 `projectId` 参数。
  - 查询数据库获取项目的详细分析结果。
  - 调用 `kimi-k2-0905-preview` 生成文案，包含团队背景、解决的痛点、如何切入该赛道以及技术栈优势。
  - 返回 JSON 格式的生成结果。

### 任务 2：开发代码模板生成 API (`/api/generate-template`)
- **目标**：生成一份初始化代码骨架（Code Skeleton），帮助开发者快速启动黑客松项目。
- **实现方案**：
  - 创建 REST API 接收 `projectId` 和可选的 `techStack`（如 Solana, React）。
  - 调用 LLM 生成纯 Markdown 格式的代码骨架，包含：目录结构树、核心智能合约接口定义、前端与合约交互的关键 Hook 示例。
  - 返回包含 `readme`、`fileStructure` 和 `keyFiles` 详情的 JSON。

### 任务 3：构建 Telegram Webhook 交互引擎 (`/api/telegram-webhook`)
- **目标**：接收用户的 Telegram 消息并触发对应的 Agent 动作。
- **实现方案**：
  - 建立 Webhook 接收端点。
  - 解析用户文本指令：
    - `GO <projectId>`：调用 `/api/generate-proposal` 并将结果回复给用户。
    - `CODE <projectId>`：调用 `/api/generate-template` 并将代码骨架回复给用户。

### 任务 4：Telegram 每日精选推送升级
- **目标**：将每日的高分项目主动推送到 Telegram 频道。
- **实现方案**：
  - 扩展现有的 `daily-report-v2` 逻辑。
  - 按照精美卡片格式（包含分数、ROI、MVP 计划、以及 `GO <projectId>` 快捷指令提示）向绑定的 Telegram 频道发送消息。

---

## 🛠️ 四、部署与环境注意事项
- **Kimi API 补丁**：项目中已在 `lib/utils.ts` 中提取了通用的 `kimiCustomFetch`，用于剥离 Vercel AI SDK 自动添加的 `stream_options` 参数，防止 Kimi API 报错 400。升级 AI SDK 时需注意。
- **数据库迁移**：后续如有表结构改动，请务必执行 `npx drizzle-kit generate` 并将迁移文件提交。
- **Vercel 配置**：长时间运行的 LLM 任务（如 deep-dive 和 generate）已配置 `maxDuration = 300` 或 `runtime = 'edge'`，请勿随意改回默认的短超时配置。