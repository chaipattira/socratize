import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { listWorkspaceFiles } from '@/lib/sandbox-tools'
import { SandboxView } from '@/components/SandboxView'
import fs from 'fs'

export default async function SandboxIdePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sandbox = await prisma.sandbox.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!sandbox) return notFound()

  const initialMessages = sandbox.messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const workspaceExists = sandbox.workspaceFolderPath !== '' &&
    fs.existsSync(sandbox.workspaceFolderPath)
  const initialFiles = workspaceExists
    ? listWorkspaceFiles(sandbox.workspaceFolderPath)
    : []

  return (
    <SandboxView
      sandboxId={sandbox.id}
      name={sandbox.name}
      initialMessages={initialMessages}
      initialFiles={initialFiles}
    />
  )
}
