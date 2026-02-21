import { sql } from '@vercel/postgres';

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      deadline TIMESTAMP,
      prize_pool TEXT,
      score JSONB,
      summary TEXT,
      source TEXT,
      discovered_at TIMESTAMP DEFAULT NOW(),
      status TEXT DEFAULT 'new'
    );
  `;
  console.log('✅ DB 初始化完成');
}

export async function getProjects() {
  const { rows } = await sql`SELECT * FROM projects ORDER BY discovered_at DESC`;
  return rows;
}

export async function addProject(project: any) {
  await sql`
    INSERT INTO projects (title, url, deadline, prize_pool, summary, source)
    VALUES (${project.title}, ${project.url}, ${project.deadline}, ${project.prize_pool}, ${project.summary}, ${project.source})
    ON CONFLICT (url) DO NOTHING;
  `;
}

export async function updateProjectScore(id: number, score: any) {
  await sql`UPDATE projects SET score = ${JSON.stringify(score)} WHERE id = ${id}`;
}
