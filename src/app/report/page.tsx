import 'server-only'
import { verifySession } from '@/lib/dal'
import { getReportData } from '@/lib/dal'
import NavBar from '@/components/ui/nav-bar'
import ReportForm from '@/components/ui/report-form'

// searchParams are a Promise in Next.js 16 — must be awaited
type SearchParams = Promise<{ from?: string; to?: string }>

export default async function ReportPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await verifySession()

  const sp = await searchParams
  // Default: first day of current month → today
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = today.slice(0, 8) + '01'

  const from = sp.from ?? firstOfMonth
  const to = sp.to ?? today

  const data = await getReportData(from, to)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 40px' }}>
        <NavBar />
        <ReportForm data={data} from={from} to={to} />
      </main>
    </div>
  )
}
