# Web3 Builder Hub 🦞

An automated intelligence hub designed specifically for Web3 Builders and Indie Hackers. It continuously monitors the internet for high-ROI Web3 Hackathons, Grants, and Builder Programs, leveraging AI Agents to deeply analyze requirements, score opportunities, and generate tailored MVP proposals.

Built with **Next.js**, **Vercel AI SDK**, **PostgreSQL**, and **Apify**.

## 🌟 Key Features

### 1. 🕵️‍♂️ Automated Intelligence Discovery (Apify)
Replaces manual searches by utilizing the Apify Twitter Scraper (`apidojo/tweet-scraper`) to monitor high-engagement tweets containing keywords like `hackathon`, `grant`, and `bounty` within the Web3 ecosystem. It extracts real opportunities while filtering out airdrop noise.

### 2. 🧠 Agentic Deep Dive Analysis (Kimi LLM)
Every discovered opportunity is processed by Kimi's most advanced LLMs:
- **Jina AI Reader** extracts full official documentation (up to 15,000 characters).
- **kimi-k2.5** performs deep reasoning, scoring the opportunity across 5 dimensions from an *Agentic Coding* perspective:
  - **Prize ROI** (Total prize pool & stability)
  - **Time ROI** (MVP development cycle & submission threshold)
  - **Competition Intensity** (Blue ocean vs. crowded ecosystems)
  - **Trend Match** (Alignment with hot narratives like AI+Crypto, DePIN)
  - **Rule Clarity** (Documentation quality for AI code generation)

### 3. 💻 Industrial Dark-Mode Dashboard
A developer-focused, utilitarian UI built with Tailwind CSS and `lucide-react`.
- **Intelligence Feed**: A rapid-scroll left panel showing scores, deadlines, and prize pools.
- **Deep Dive Panel**: Detailed radar metrics and a 3-Day MVP execution timeline.
- **Agentic Workspace**: An integrated terminal interface utilizing Vercel AI SDK's streaming capabilities to generate application proposals and codebase skeletons on demand.

### 4. 📝 GitHub Daily Markdown Reports
High-scoring projects (Score >= 8.0) are automatically formatted into a clean Markdown report and committed to the repository (`dailyreport.md`) via the GitHub REST API. This acts as a reliable data source for external notification bots (e.g., Nanobot).

---

## 🚀 Architecture & Workflow

The system operates entirely on Vercel Cron Jobs:

1. **`GET /api/discover-v2`** (Cron: e.g., Every 12 Hours)
   - Fetches tweets via Apify.
   - Uses `kimi-k2-turbo-preview` to extract structured JSON data.
   - Inserts pending projects into Vercel Postgres.

2. **`GET /api/deep-dive`** (Cron: e.g., Every 6 Hours)
   - Fetches official website content using Jina AI.
   - Uses `kimi-k2.5` to score and formulate MVP plans.
   - Updates project status in the database.

3. **`GET /api/daily-report-v2`** (Cron: e.g., Every 24 Hours)
   - Aggregates top-scoring projects.
   - Commits the report to `dailyreport.md` via GitHub API.

4. **`POST /api/generate`** (On-Demand via Dashboard)
   - Uses `kimi-k2-0905-preview` (optimized for Agentic Coding) to stream tailored proposals and code skeletons directly to the frontend workspace.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Vercel Postgres (`@vercel/postgres`)
- **AI Integration**: Vercel AI SDK 3.0 (`@ai-sdk/react`, `@ai-sdk/openai`)
- **LLM Provider**: Moonshot AI (Kimi International Models)
- **Web Scraping**: Apify Client (`apify-client`) + Jina AI Reader
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Automation**: Vercel Cron + GitHub API (`@octokit/rest`)

---

## ⚙️ Local Setup & Deployment

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/RohanKishibeCN/web3-builder-hub.git
cd web3-builder-hub
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a \`.env.local\` file in the root directory:

\`\`\`env
# Vercel Postgres (Get these from Vercel Storage Dashboard)
POSTGRES_URL="..."
POSTGRES_PRISMA_URL="..."
POSTGRES_URL_NON_POOLING="..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."

# Security
CRON_SECRET="your-secure-cron-secret-string"

# LLM Configuration (Moonshot / Kimi)
LLM_PROVIDER="kimi"
LLM_API_KEY="sk-your-kimi-api-key"

# Data Sources
APIFY_API_TOKEN="apify_api_your_token"

# GitHub Integration (For dailyreport.md)
GITHUB_PAT="ghp_your_personal_access_token"
\`\`\`

### 4. Initialize Database
Before running the app, initialize the PostgreSQL tables and indexes:
\`\`\`bash
curl -H "Authorization: Bearer your-secure-cron-secret-string" http://localhost:3000/api/init
\`\`\`

### 5. Run the development server
\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:3000](http://localhost:3000) with your browser to see the dashboard.

---

## 🛡️ Security Notes
- The Cron API endpoints (`/api/discover-v2`, `/api/deep-dive`, `/api/daily-report-v2`) are protected by the `CRON_SECRET` environment variable. In a production environment (`NODE_ENV === 'production'`), requests missing the correct Bearer token will be rejected with a 401 Unauthorized error.
- Ensure your `GITHUB_PAT` has limited scopes (only repository write access) to prevent security risks.

## 📄 License
MIT License
