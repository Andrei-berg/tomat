import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'

export default async function Home() {
  await verifySession() // defense-in-depth — called even though proxy also guards this
  redirect('/orders')
}
