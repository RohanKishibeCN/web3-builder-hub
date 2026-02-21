export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">🦞 Web3 Builder 情报站</h1>
      <p className="text-zinc-400">每天自动发现高价值 Web3 机会</p>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  )
}
