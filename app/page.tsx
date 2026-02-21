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
      deadline,
      prize_pool,
      score::text as score_text
    FROM projects 
    ORDER BY 
      CASE WHEN score IS NOT NULL THEN (score->>'total_score')::float ELSE 0 END DESC,
      discovered_at DESC 
    LIMIT 20
  `;

  const parsedProjects = projects.map(p => ({
    ...p,
    score: p.score_text ? JSON.parse(p.score_text) : null
  }));

  const topProjects = parsedProjects.filter(p => p.score && p.score.total_score >= 8).slice(0, 3);
  const otherProjects = parsedProjects.filter(p => !p.score || p.score.total_score < 8);

  // 评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-emerald-400';
    if (score >= 8) return 'text-orange-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-zinc-400';
  };

  return (
    <div className="min-h-screen p-6 bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🦞 Web3 Builder 情报站</h1>
          <p className="text-zinc-500">
            已发现 {projects.length} 个项目 · 
            已评分 {projects.filter(p => p.score_text).length} 个
          </p>
        </div>

        {/* Top 3 */}
        {topProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              🔥 重点推荐
            </h2>
            <div className="grid gap-4">
              {topProjects.map((p, i) => (
                <a 
                  key={p.id} 
                  href={p.url}
                  target="_blank"
                  className="block bg-gradient-to-r from-zinc-900 to-zinc-800 p-5 rounded-xl border border-zinc-700 hover:border-orange-500/50 transition group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <h3 className="font-semibold text-lg group-hover:text-orange-400 transition">
                          {p.title}
                        </h3>
                      </div>
                      <p className="text-zinc-400 text-sm line-clamp-2 mb-3">
                        {p.summary}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {p.deadline && (
                          <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-300">
                            ⏰ {new Date(p.deadline).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {p.prize_pool && p.prize_pool !== 'null' && (
                          <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded">
                            💰 {p.prize_pool}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-500">
                          {p.source}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(p.score.total_score)}`}>
                        {p.score.total_score}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">总分</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Other Projects */}
        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
            📋 更多项目
          </h2>
          <div className="space-y-3">
            {otherProjects.map((p) => (
              <a 
                key={p.id} 
                href={p.url}
                target="_blank"
                className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 transition group"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate group-hover:text-orange-400 transition">
                    {p.title}
                  </h3>
                  <p className="text-zinc-500 text-sm truncate">
                    {p.summary}
                  </p>
                </div>
                {p.score ? (
                  <div className={`text-xl font-bold ${getScoreColor(p.score.total_score)}`}>
                    {p.score.total_score}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 px-2 py-1 bg-zinc-800 rounded">
                    待评分
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-zinc-800 text-center text-zinc-600 text-sm">
          <p>每天自动更新 · 早8点推送 Telegram</p>
        </div>
      </div>
    </div>
  );
}
