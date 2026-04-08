#!/usr/bin/env node
// Turbopack externalizes native modules with hashed names and creates symlinks
// in .next/node_modules/ to map them back (e.g. better-sqlite3-90e2652d1716b047 -> ../../node_modules/better-sqlite3).
// These relative symlinks break when the package is installed elsewhere (npm hoists deps).
// This script replaces each symlink with a proxy module that uses standard require() resolution.

const fs = require('fs')
const path = require('path')

const nmDir = path.resolve(__dirname, '..', '.next', 'node_modules')
if (!fs.existsSync(nmDir)) {
  console.log('No .next/node_modules/ found, skipping externals fix')
  process.exit(0)
}

function fixSymlinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      // Recurse into scoped package dirs like @prisma/
      fixSymlinks(fullPath)
      continue
    }

    if (!entry.isSymbolicLink()) continue

    // Read where the symlink points to extract the real package name
    const target = fs.readlinkSync(fullPath)
    // Target looks like ../../node_modules/better-sqlite3 or ../../../node_modules/@prisma/client
    const nmIndex = target.indexOf('node_modules/')
    if (nmIndex === -1) continue
    const realPkg = target.slice(nmIndex + 'node_modules/'.length)

    // Replace symlink with a proxy directory containing index.js
    fs.rmSync(fullPath)
    fs.mkdirSync(fullPath, { recursive: true })
    fs.writeFileSync(
      path.join(fullPath, 'index.js'),
      `module.exports = require(${JSON.stringify(realPkg)});\n`
    )
    console.log(`  ${entry.name} -> require("${realPkg}")`)
  }
}

console.log('Replacing Turbopack external symlinks with proxy modules:')
fixSymlinks(nmDir)
console.log('Done.')
