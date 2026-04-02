import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SessionView } from '@/components/SessionView'

export default async function SessionPage({ params }: { params: { id: string } }) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) redirect('/login')

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: params.id, userId: authSession.user.id },
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
      initialMessages={initialMessages}
      initialMarkdown={chatSession.markdownContent}
    />
  )
}
