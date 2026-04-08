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

copyDir(staticSrc, staticDest)
copyDir(publicSrc, publicDest)
console.log('Copied .next/static and public/ into .next/standalone/')
