# Phase 3: 半自动执行辅助系统

## 新增 API

### 1. 申请文案生成 API
```
GET /api/generate-proposal?projectId=123
POST /api/generate-proposal
Body: { "projectId": 123 }
```

返回：
```json
{
  "success": true,
  "projectId": 123,
  "projectTitle": "Solana AI Hackathon",
  "proposal": "完整的申请文案...",
  "duration": 5000
}
```

### 2. 代码模板生成 API
```
GET /api/generate-template?projectId=123
POST /api/generate-template
Body: { "projectId": 123, "techStack": ["Solidity", "React"] }
```

返回：
```json
{
  "success": true,
  "projectId": 123,
  "projectTitle": "Solana AI Hackathon",
  "readme": "# README 内容...",
  "fileStructure": ["contracts/", "frontend/"],
  "keyFiles": [
    { "path": "contracts/Main.sol", "content": "..." }
  ]
}
```

### 3. Telegram Webhook
```
POST /api/telegram-webhook
```

处理 Telegram 消息回复，支持指令：
- `GO <projectId>` - 生成申请文案
- `CODE <projectId>` - 生成代码模板

## Telegram 交互

每日推送消息格式：
```
🔥 Solana AI Hackathon
━━━━━━━━━━━━━━
🆔 ID: 1
📊 评分: 9.2/10
⏰ 截止: 2026/3/15
💰 $50,000+

🎯 赛道潜力: AI Agent + DeFi 交叉赛道
🏆 预计胜率: 35%

📋 参与计划:
建议构建 AI 驱动的流动性管理工具...

💡 顶级机会，奖金丰厚

🔗 查看详情

💬 可用指令：
GO 1 - 生成申请文案
CODE 1 - 生成代码模板
```

## 设置 Telegram Webhook

1. 获取你的 Webhook URL：
   ```
   https://your-domain.com/api/telegram-webhook
   ```

2. 设置 Telegram Bot Webhook：
   ```
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-domain.com/api/telegram-webhook"}'
   ```

## 工作流程

```
每天 22:00 - discover-v2: 发现新项目
每天 23:00 - deep-dive: 深度研判
每天 08:00 - daily-report-v2: Telegram 推送

用户回复:
  GO <id> → generate-proposal → Telegram 回复
  CODE <id> → generate-template → Telegram 回复
```
