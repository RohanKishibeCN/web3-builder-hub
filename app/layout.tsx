import './globals.css';
import { Inter, Newsreader, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata = {
  title: 'Web3 Builder Hub',
  description: '自动发现 Web3 Hackathon 和 Builder Program',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-claude-bg text-claude-near-black font-sans antialiased">
        {children}
        <Toaster position="top-center" toastOptions={{ style: { background: '#faf9f5', color: '#141413', border: '1px solid #f0eee6' } }} />
      </body>
    </html>
  )
}
