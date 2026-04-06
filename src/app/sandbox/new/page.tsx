import { prisma } from '@/lib/prisma'
import { NewSandboxClient } from './client'
import fs from 'fs'

export default async function NewSandboxPage() {
  // Fetch all sessions that have a knowledge folder path configured
  const sessions = await prisma.chatSession.findMany({
    where: { knowledgeFolderPath: { not: '' } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, knowledgeFolderPath: true },
  })

  // Only include folders that actually exist on disk
  const skillFolders = sessions
    .filter(s => fs.existsSync(s.knowledgeFolderPath))
    .map(s => ({ id: s.id, title: s.title, path: s.knowledgeFolderPath }))

  return <NewSandboxClient skillFolders={skillFolders} />
}
