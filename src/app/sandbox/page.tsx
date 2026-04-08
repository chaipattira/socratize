import { prisma } from '@/lib/prisma'
import { SandboxDashboardClient } from './client'

export const dynamic = 'force-dynamic'

export default async function SandboxPage() {
  const sandboxes = await prisma.sandbox.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      skillFolderPath: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const serialized = sandboxes.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return <SandboxDashboardClient initialSandboxes={serialized} />
}
