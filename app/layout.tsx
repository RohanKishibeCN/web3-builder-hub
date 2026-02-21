export const metadata = {
  title: 'Web3 Builder Hub',
  description: '自动发现 Web3 Hackathon 和 Builder Program',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-zinc-950 text-white">{children}</body>
    </html>
  )
}
