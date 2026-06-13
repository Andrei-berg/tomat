import 'server-only'
import { verifySession, getSegmentTrend } from '@/lib/dal'
import NavBar from '@/components/ui/nav-bar'
import ReportTabs from '@/components/ui/report-tabs'
import TrendView from '@/components/ui/trend-view'

// searchParams are a Promise in Next.js 16 — must be awaited
type SearchParams = Promise<{ from?: string; to?: string }>

export default async function TrendPage({ searchParams }: { searchParams: SearchParams }) {
  await verifySession()

  const sp = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'

  const from = sp.from ?? firstOfMonth
  const to = sp.to ?? today

  const data = await getSegmentTrend(from, to)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 40px' }}>
        <NavBar />
        <ReportTabs active="trend" from={from} to={to} />
        <TrendView data={data} from={from} to={to} />
      </main>
    </div>
  )
}
