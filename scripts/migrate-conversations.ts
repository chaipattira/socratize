import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Migrate sandboxes
  const sandboxes = await prisma.sandbox.findMany({
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  for (const sandbox of sandboxes) {
    if (sandbox.messages.length === 0) continue
    const firstUserMsg = sandbox.messages.find(m => m.role === 'user')
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 40).trim()
      : 'Conversation 1'

    const conv = await prisma.sandboxConversation.create({
      data: {
        sandboxId: sandbox.id,
        title,
        updatedAt: sandbox.updatedAt,
        createdAt: sandbox.createdAt,
      },
    })

    await prisma.sandboxMessage.updateMany({
      where: { sandboxId: sandbox.id },
      data: { conversationId: conv.id },
    })
    console.log(`Migrated sandbox ${sandbox.id}: ${sandbox.messages.length} messages → conv ${conv.id}`)
  }

  // Migrate sessions
  const sessions = await prisma.chatSession.findMany({
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  for (const session of sessions) {
    if (session.messages.length === 0) continue
    const firstUserMsg = session.messages.find(m => m.role === 'user')
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 40).trim()
      : 'Conversation 1'

    const conv = await prisma.sessionConversation.create({
      data: {
        sessionId: session.id,
        title,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt,
      },
    })

    await prisma.message.updateMany({
      where: { chatSessionId: session.id },
      data: { conversationId: conv.id },
    })
    console.log(`Migrated session ${session.id}: ${session.messages.length} messages → conv ${conv.id}`)
  }

  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
