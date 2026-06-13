'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

export type ClientFormState = { error?: string } | undefined

export async function updateClient(
  id: string,
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await verifySession()
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name) return { error: 'Имя не может быть пустым' }

  const supabase = createSupabaseClient()
  const { error } = await supabase.from('clients').update({ name, phone, notes }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
  redirect(`/clients/${id}`)
}

// Promote an occasional client to a regular (or demote back).
// Same row — order and debt history is preserved.
export async function setClientRegular(id: string, isRegular: boolean): Promise<void> {
  await verifySession()
  const supabase = createSupabaseClient()
  await supabase.from('clients').update({ is_regular: isRegular }).eq('id', id)
  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
}
