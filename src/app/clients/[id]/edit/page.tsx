import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import EditClientForm from './form'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession()
  const { id } = await params

  const supabase = createSupabaseClient()
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 80px' }}>
        <div style={{ paddingTop: '20px', paddingBottom: '20px' }}>
          <Link href={`/clients/${id}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', color: 'var(--mk-text-2)', textDecoration: 'none', fontWeight: 500,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {client.name}
          </Link>
          <h1 style={{ margin: '12px 0 0', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--mk-text)' }}>
            Редактировать
          </h1>
        </div>
        <EditClientForm id={id} name={client.name} phone={client.phone ?? ''} notes={client.notes ?? ''} />
      </div>
    </div>
  )
}
