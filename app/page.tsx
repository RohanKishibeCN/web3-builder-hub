import { sql } from '@vercel/postgres';

export default async function Home() {
  const { rows: projects } = await sql`SELECT * FROM projects ORDER BY discovered_at DESC LIMIT 10`;

  return (
    <div className="min-h-screen p-8 bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">🦞 Web3 Builder 情报站</h1>
        <p className="text-zinc-400 mb-8">每天自动发现高价值 Web3 机会 • 已发现 {projects.length} 个项目</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">自动发现</h2>
            <p className="text-sm text-zinc-500">Brave Search + AI 抓取全网 Hackathon</p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">智能评分</h2>
            <p className="text-sm text-zinc-500">Claude 评分，筛选 Top 机会</p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">每日推送</h2>
            <p className="text-sm text-zinc-500">早 8 点自动发送 Telegram 日报</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">最新发现的项目</h2>
        <div className="space-y-4">
          {projects.map((p: any) => (
            <div key={p.id} className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              <a href={p.url} target="_blank" className="text-lg font-semibold hover:text-orange-400">
                {p.title}
              </a>
              <p className="text-zinc-400 text-sm mt-1">{p.summary}</p>
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span>来源: {p.source}</span>
                <span>发现时间: {new Date(p.discovered_at).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
