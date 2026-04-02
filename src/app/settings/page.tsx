import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import SettingsClient from './client'

export default async function SettingsPage() {
  try {
    await requireAuth()
  } catch {
    redirect('/api/auth/signin')
  }
  return <SettingsClient />
}
