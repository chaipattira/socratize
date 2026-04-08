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

removePattern(standaloneDir, name =>
  name.endsWith('.db') || name.startsWith('.env') || name === 'package-lock.json'
)
console.log('Removed *.db, .env*, and package-lock.json from .next/standalone/')

// Remove output: 'standalone' from the standalone config so the Next.js
// programmatic API (used by our custom server) works without conflicts.
const configPath = path.join(standaloneDir, 'next.config.mjs')
if (fs.existsSync(configPath)) {
  let config = fs.readFileSync(configPath, 'utf8')
  config = config.replace(/output:\s*['"]standalone['"],?\s*\n?/g, '')
  fs.writeFileSync(configPath, config)
  console.log('Patched next.config.mjs in standalone (removed output: standalone)')
}
