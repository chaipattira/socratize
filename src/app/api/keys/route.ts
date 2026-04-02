import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'

export async function GET() {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true },
  })
  return NextResponse.json(keys)
}

export async function POST(request: Request) {
  let user: { id: string }
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { provider, key } = await request.json()

  if (!['anthropic', 'openai'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!key?.trim()) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 })
  }

  const apiKey = await prisma.apiKey.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: { userId: user.id, provider, encryptedKey: encrypt(key.trim()) },
    update: { encryptedKey: encrypt(key.trim()) },
    select: { id: true, provider: true },
  })
  return NextResponse.json(apiKey, { status: 201 })
}
