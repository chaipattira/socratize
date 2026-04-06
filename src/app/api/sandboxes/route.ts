import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import { getWorkspacePath } from '@/lib/sandbox-tools'

export async function GET() {
  const sandboxes = await prisma.sandbox.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      skillFolderPaths: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return NextResponse.json(sandboxes)
}

export async function POST(request: Request) {
  const { name, skillFolderPaths = [], workspaceFolderPath: customWorkspacePath } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Validate skill folder paths exist
  const validatedPaths: string[] = []
  for (const p of skillFolderPaths) {
    if (typeof p === 'string' && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      validatedPaths.push(p)
    }
  }

  // Validate custom workspace path if provided
  let resolvedWorkspacePath: string | null = null
  if (customWorkspacePath && typeof customWorkspacePath === 'string') {
    const trimmed = customWorkspacePath.trim()
    if (trimmed) {
      if (!fs.existsSync(trimmed) || !fs.statSync(trimmed).isDirectory()) {
        return NextResponse.json({ error: 'Workspace folder not found or is not a directory' }, { status: 400 })
      }
      resolvedWorkspacePath = trimmed
    }
  }

  // Create sandbox record
  const sandbox = await prisma.sandbox.create({
    data: {
      name: name.trim(),
      skillFolderPaths: JSON.stringify(validatedPaths),
      workspaceFolderPath: resolvedWorkspacePath ?? '', // filled in after we have the id if managed
    },
  })

  // If no custom workspace, create a managed workspace directory
  if (!resolvedWorkspacePath) {
    const managedPath = getWorkspacePath(sandbox.id)
    try {
      fs.mkdirSync(managedPath, { recursive: true })
    } catch {
      await prisma.sandbox.delete({ where: { id: sandbox.id } })
      return NextResponse.json({ error: 'Failed to create workspace directory' }, { status: 500 })
    }
    const updated = await prisma.sandbox.update({
      where: { id: sandbox.id },
      data: { workspaceFolderPath: managedPath },
    })
    return NextResponse.json(updated, { status: 201 })
  }

  return NextResponse.json(sandbox, { status: 201 })
}
