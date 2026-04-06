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
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true },
      },
    },
  })
  if (!chatSession) notFound()

  const initialMessages = chatSession.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => m.content !== '__KB_START__')
    .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))

  const knowledgeFolderPath = chatSession.knowledgeFolderPath ?? ''
  const isKbSession = !!knowledgeFolderPath && fs.existsSync(knowledgeFolderPath)
  const initialFiles = isKbSession ? listFiles(knowledgeFolderPath) : []

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
    />
  )
}
