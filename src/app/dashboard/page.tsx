import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './client'

export default async function DashboardPage() {
  const keyCount = await prisma.apiKey.count()
  if (keyCount === 0) {
    redirect('/settings?setup=1')
  }

  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, llmProvider: true, model: true,
      extractionMode: true, createdAt: true, updatedAt: true,
      _count: { select: { conversations: true } },
    },
  })

  const serialized = sessions.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return <DashboardClient initialSessions={serialized} />
}
