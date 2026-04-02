import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/encryption'

export async function GET() {
  const keys = await prisma.apiKey.findMany({
    select: { id: true, provider: true },
  })
  return NextResponse.json(keys)
}

export async function POST(request: Request) {
  const { provider, key } = await request.json()

  if (!['anthropic', 'openai'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!key?.trim()) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 })
  }

  const apiKey = await prisma.apiKey.upsert({
    where: { provider },
    create: { provider, encryptedKey: encrypt(key.trim()) },
    update: { encryptedKey: encrypt(key.trim()) },
    select: { id: true, provider: true },
  })
  return NextResponse.json(apiKey, { status: 201 })
}
