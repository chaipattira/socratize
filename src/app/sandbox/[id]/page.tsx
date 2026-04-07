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
      conversations: {
        orderBy: { createdAt: 'asc' },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!sandbox) return notFound()

  const workspaceExists = sandbox.workspaceFolderPath !== '' &&
    fs.existsSync(sandbox.workspaceFolderPath)
  const initialFiles = workspaceExists
    ? listWorkspaceFiles(sandbox.workspaceFolderPath)
    : []

  // Use the most recently updated conversation (or create one if none exist)
  let activeConv = sandbox.conversations.length > 0
    ? [...sandbox.conversations].sort((a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
      )[0]
    : null

  // If no conversations exist yet (new sandbox with no messages), create one
  if (!activeConv) {
    activeConv = await prisma.sandboxConversation.create({
      data: { sandboxId: id, title: 'New conversation', updatedAt: new Date() },
      include: { messages: true },
    })
    sandbox.conversations.push(activeConv as typeof sandbox.conversations[0])
  }

  const initialMessages = activeConv.messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const initialConversations = sandbox.conversations.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <SandboxView
      sandboxId={sandbox.id}
      name={sandbox.name}
      initialMessages={initialMessages}
      initialFiles={initialFiles}
      initialConversations={initialConversations}
      initialConversationId={activeConv.id}
    />
  )
}
