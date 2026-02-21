import { NextResponse } from 'next/server'

const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY!

async function braveSearch(query: string) {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
    { headers: { 'X-Subscription-Token': BRAVE_KEY, 'Accept': 'application/json' } }
  )
  if (!res.ok) throw new Error(`Brave API: ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    const queries = ['web3 hackathon 2026', 'ethereum builder program', 'solana grant']
    const results = await Promise.all(queries.map(q => braveSearch(q)))
    
    return NextResponse.json({ 
      success: true, 
      count: results.length,
      data: results 
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 })
  }
}
