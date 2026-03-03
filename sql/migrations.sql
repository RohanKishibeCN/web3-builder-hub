-- Web3 Builder Hub - 数据库迁移脚本
-- 执行方式: 在 Vercel Postgres 控制台执行

-- 1. 为 projects 表添加新字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
ADD COLUMN IF NOT EXISTS deep_dive_result JSONB;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_score ON projects((score->>'total_score'));
CREATE INDEX IF NOT EXISTS idx_projects_discovered_at ON projects(discovered_at);

-- 3. 创建 API 日志表
CREATE TABLE IF NOT EXISTS api_logs (
  id SERIAL PRIMARY KEY,
  api_name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  found INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_api_name ON api_logs(api_name);

-- 4. 创建动态白名单表
CREATE TABLE IF NOT EXISTS dynamic_whitelist (
  id SERIAL PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  track TEXT,
  priority INTEGER DEFAULT 3,
  source TEXT DEFAULT 'auto-discovered',
  status TEXT DEFAULT 'pending',
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_dynamic_whitelist_status ON dynamic_whitelist(status);
CREATE INDEX IF NOT EXISTS idx_dynamic_whitelist_priority ON dynamic_whitelist(priority);

-- 5. 迁移现有数据
UPDATE projects 
SET status = 'scored'
WHERE score IS NOT NULL AND status = 'new';

-- 6. 验证迁移结果
SELECT 
  'projects' as table_name,
  COUNT(*) as total_rows
FROM projects
UNION ALL
SELECT 
  'api_logs' as table_name,
  COUNT(*) as total_rows
FROM api_logs
UNION ALL
SELECT 
  'dynamic_whitelist' as table_name,
  COUNT(*) as total_rows
FROM dynamic_whitelist;
