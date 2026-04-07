import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readDoc } from '@/lib/local-docs'
import { listFiles } from '@/lib/knowledge-base'
import { SessionView } from '@/components/SessionView'
import fs from 'fs'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chatSession = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      conversations: {
        orderBy: { createdAt: 'asc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, role: true, content: true },
          },
        },
      },
    },
  })
  if (!chatSession) notFound()

  const knowledgeFolderPath = chatSession.knowledgeFolderPath ?? ''
  const isKbSession = !!knowledgeFolderPath && fs.existsSync(knowledgeFolderPath)
  const initialFiles = isKbSession ? listFiles(knowledgeFolderPath) : []

  // Use most recently updated conversation
  let activeConv = chatSession.conversations.length > 0
    ? [...chatSession.conversations].sort((a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
      )[0]
    : null

  if (!activeConv) {
    activeConv = await prisma.sessionConversation.create({
      data: { sessionId: id, title: 'New conversation', updatedAt: new Date() },
      include: { messages: { select: { id: true, role: true, content: true } } },
    })
    chatSession.conversations.push(activeConv as typeof chatSession.conversations[0])
  }

  const initialMessages = activeConv.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => m.content !== '__KB_START__')
    .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))

  const initialConversations = chatSession.conversations.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <SessionView
      sessionId={chatSession.id}
      title={chatSession.title}
      extractionMode={(chatSession.extractionMode as 'guided' | 'direct' | 'socratize') ?? 'guided'}
      initialMessages={initialMessages}
      initialMarkdown={isKbSession ? '' : readDoc(chatSession.id)}
      knowledgeFolderPath={knowledgeFolderPath}
      initialFiles={initialFiles}
      llmProvider={chatSession.llmProvider}
      model={chatSession.model}
      initialConversations={initialConversations}
      initialConversationId={activeConv.id}
    />
  )
}
