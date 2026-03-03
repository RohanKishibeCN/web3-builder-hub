import { sql } from '@vercel/postgres';

interface Project {
  id: number;
  title: string;
  url: string;
  summary: string;
  source: string;
  discovered_at: string;
  deadline: string | null;
  prize_pool: string | null;
  score_text: string | null;
  score: {
    total_score: number;
    reason: string;
  } | null;
}

export default async function Home() {
  const { rows } = await sql`
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
    LIMIT 50
  `;

  const projects: Project[] = rows.map((p: any) => ({
    ...p,
    score: p.score_text ? JSON.parse(p.score_text) : null
  }));

  const topProjects = projects.filter(p => p.score && p.score.total_score >= 8).slice(0, 3);
  const tableProjects = projects.slice(3);

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-emerald-400';
    if (score >= 8) return 'text-orange-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-zinc-400';
  };

  return (
    <div className="min-h-screen p-6 bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🦞 Web3 Builder 情报站</h1>
          <p className="text-zinc-500">
            已发现 {projects.length} 个项目 · 已评分 {projects.filter(p => p.score).length} 个
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
                <div 
                  key={p.id} 
                  className="bg-gradient-to-r from-zinc-900 to-zinc-800 p-5 rounded-xl border border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <a 
                          href={p.url}
                          target="_blank"
                          className="font-semibold text-lg text-orange-400 hover:underline"
                        >
                          {p.title}
                        </a>
                      </div>
                      <p className="text-zinc-400 text-sm mb-3">{p.summary}</p>
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
                        <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-500">{p.source}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(p.score!.total_score)}`}>
                        {p.score!.total_score}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">总分</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
            📋 全部项目
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-sm">
                  <th className="py-3 px-4 font-medium">排名</th>
                  <th className="py-3 px-4 font-medium">项目</th>
                  <th className="py-3 px-4 font-medium">来源</th>
                  <th className="py-3 px-4 font-medium">截止</th>
                  <th className="py-3 px-4 font-medium text-right">评分</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {projects.map((p, i) => (
                  <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-3 px-4 text-zinc-500">{i + 1}</td>
                    <td className="py-3 px-4">
                      <a 
                        href={p.url}
                        target="_blank"
                        className="text-orange-400 hover:underline font-medium"
                      >
                        {p.title}
                      </a>
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{p.summary}</p>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{p.source}</td>
                    <td className="py-3 px-4 text-zinc-400">
                      {p.deadline ? new Date(p.deadline).toLocaleDateString('zh-CN') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.score ? (
                        <span className={`font-bold ${getScoreColor(p.score.total_score)}`}>
                          {p.score.total_score}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">待评分</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-800 text-center text-zinc-600 text-sm">
          <p>每天自动更新 · 早8点推送 Telegram</p>
        </div>
      </div>
    </div>
  );
}
