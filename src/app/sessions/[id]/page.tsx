import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { readDoc } from '@/lib/local-docs'
import { SessionView } from '@/components/SessionView'

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
    .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))

  return (
    <SessionView
      sessionId={chatSession.id}
      title={chatSession.title}
      extractionMode={(chatSession.extractionMode as 'guided' | 'direct') ?? 'guided'}
      initialMessages={initialMessages}
      initialMarkdown={readDoc(chatSession.id)}
    />
  )
}
