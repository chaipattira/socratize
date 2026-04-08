#!/usr/bin/env node
// Copies required assets into .next/standalone/ after next build.
// Next.js standalone mode does not include static or public files automatically.

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const staticSrc  = path.join(root, '.next', 'static')
const staticDest = path.join(root, '.next', 'standalone', '.next', 'static')
const publicSrc  = path.join(root, 'public')
const publicDest = path.join(root, '.next', 'standalone', 'public')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

const standaloneDir = path.join(root, '.next', 'standalone')

function removePattern(dir, test) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      removePattern(p, test)
    } else if (test(entry.name)) {
      fs.rmSync(p)
    }
  }
}

copyDir(staticSrc, staticDest)
copyDir(publicSrc, publicDest)
console.log('Copied .next/static and public/ into .next/standalone/')

removePattern(standaloneDir, name => name.endsWith('.db') || name.startsWith('.env'))
console.log('Removed *.db and .env* files from .next/standalone/')
