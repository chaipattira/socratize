import { prisma } from '@/lib/prisma'
import { DashboardClient } from './client'

export default async function DashboardPage() {
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, llmProvider: true, model: true,
      createdAt: true, updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  const serialized = sessions.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return <DashboardClient initialSessions={serialized} />
}
