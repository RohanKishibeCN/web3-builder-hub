import { sql } from '@vercel/postgres';

export default async function Home() {
  const { rows: projects } = await sql`
    SELECT 
      id,
      title,
      url,
      summary,
      source,
      discovered_at,
      score::text as score_text
    FROM projects 
    ORDER BY discovered_at DESC 
    LIMIT 20
  `;

  // 解析 score JSON
  const parsedProjects = projects.map(p => ({
    ...p,
    score: p.score_text ? JSON.parse(p.score_text) : null
  }));

  return (
    <div className="min-h-screen p-8 bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🦞 Web3 Builder 情报站</h1>
        <p className="text-zinc-400 mb-8">
          已发现 {parsedProjects.length} 个项目
        </p>

        <h2 className="text-2xl font-bold mb-4">最新项目</h2>
        <div className="space-y-4">
          {parsedProjects.map((p: any) => (
            <div key={p.id} className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              <div className="flex justify-between items-start">
                <a href={p.url} target="_blank" className="font-medium hover:text-orange-400">
                  {p.title}
                </a>
                {p.score && (
                  <span className="text-orange-400 font-bold text-xl">
                    {p.score.total_score}/10
                  </span>
                )}
              </div>
              <p className="text-zinc-400 text-sm mt-1">{p.summary}</p>
              {p.score && (
                <p className="text-zinc-500 text-xs mt-2">
                  评价: {p.score.reason}
                </p>
              )}
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span>来源: {p.source}</span>
                <span>发现: {new Date(p.discovered_at).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
