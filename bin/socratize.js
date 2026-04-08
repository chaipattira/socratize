#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const net = require('net')
const crypto = require('crypto')
const { execFileSync, spawn } = require('child_process')
const https = require('https')

const PKG_VERSION = require('../package.json').version
const PKG_NAME    = require('../package.json').name

// ── Paths ──────────────────────────────────────────────────────────────────
const SOCRATIZE_DIR = path.join(os.homedir(), '.socratize')
const CONFIG_PATH   = path.join(SOCRATIZE_DIR, 'config.json')
const DB_PATH       = path.join(SOCRATIZE_DIR, 'data.db')
const SERVER_PATH   = path.join(__dirname, '../dist/server.cjs')
const PRISMA_BIN    = findPrismaBin()
const SCHEMA_PATH   = path.join(__dirname, '../prisma/schema.prisma')

// ── Helpers ─────────────────────────────────────────────────────────────────
function findPrismaBin() {
  // Try direct relative path first (local dev / non-hoisted install)
  const localBin = path.join(__dirname, '../node_modules/.bin/prisma')
  if (fs.existsSync(localBin)) return localBin

  // When installed via npx, deps may be hoisted — resolve via require
  try {
    const pkgJsonPath = require.resolve('prisma/package.json', {
      paths: [path.join(__dirname, '..'), __dirname],
    })
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.prisma
    return path.join(path.dirname(pkgJsonPath), binRel)
  } catch (_) {}

  return 'prisma' // last resort: hope it's in PATH
}


function checkForUpdate() {
  return new Promise(resolve => {
    const req = https.get(
      `https://registry.npmjs.org/${PKG_NAME}/latest`,
      { timeout: 3000 },
      res => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            const { version } = JSON.parse(data)
            resolve(version !== PKG_VERSION ? version : null)
          } catch { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function findAvailablePort(start) {
  return new Promise(resolve => {
    let port = start
    function tryPort() {
      const server = net.createServer()
      server.listen(port, '127.0.0.1', () => {
        const p = server.address().port
        server.close(() => resolve(p))
      })
      server.on('error', () => { port++; tryPort() })
    }
    tryPort()
  })
}

function print(msg) { process.stdout.write(msg + '\n') }
function printInline(msg) { process.stdout.write('  ' + msg) }
function done() { process.stdout.write(' done\n') }

// ── Helpers (native-module fixups) ──────────────────────────────────────────
function fixNodePtyPermissions() {
  // npm tarballs strip the execute bit from prebuilt binaries.
  // node-pty's posix_spawnp will fail unless spawn-helper is executable.
  // Use require.resolve to find node-pty regardless of npm hoisting.
  let nodePtyDir
  try {
    nodePtyDir = path.dirname(require.resolve('node-pty/package.json', {
      paths: [path.join(__dirname, '..'), __dirname],
    }))
  } catch {
    // Fallback to relative path
    nodePtyDir = path.join(__dirname, '..', 'node_modules', 'node-pty')
  }
  const spawnHelper = path.join(
    nodePtyDir, 'prebuilds',
    `${process.platform}-${process.arch}`, 'spawn-helper'
  )
  try {
    if (fs.existsSync(spawnHelper)) {
      fs.chmodSync(spawnHelper, 0o755)
    }
  } catch {}
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  print('')
  print(`  Socratize v${PKG_VERSION}`)
  print('')

  // Fix native module permissions (npm strips execute bit from prebuilts)
  fixNodePtyPermissions()

  // Fire update check immediately — non-blocking
  const updatePromise = checkForUpdate()

  // 1. Setup ~/.socratize/
  const isFirstRun = !fs.existsSync(SOCRATIZE_DIR)
  if (isFirstRun) {
    printInline('Setting up ~/.socratize/ ...')
    fs.mkdirSync(SOCRATIZE_DIR, { recursive: true })
    done()
  }

  // 2. Load or create config.json
  let config
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } else {
    config = {
      encryptionKey: crypto.randomBytes(32).toString('hex'),
      version: PKG_VERSION,
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  }

  // 3. Find available port
  const port = await findAvailablePort(3000)

  // 4. Set environment variables for the child server process
  process.env.DATABASE_URL   = `file:${DB_PATH}`
  process.env.ENCRYPTION_KEY = config.encryptionKey
  process.env.PORT           = String(port)
  process.env.NODE_ENV       = 'production'

  // 5. Run Prisma migrations
  printInline('Running database migrations ...')
  try {
    execFileSync(PRISMA_BIN, ['migrate', 'deploy', `--schema=${SCHEMA_PATH}`], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: 'pipe',
    })
    done()
  } catch (err) {
    process.stdout.write(' failed\n')
    console.error(err.stderr?.toString() ?? err.message)
    process.exit(1)
  }

  // 6. Spawn the server
  printInline('Starting server ...')
  const child = spawn(process.execPath, [SERVER_PATH], {
    env: process.env,
    stdio: ['inherit', 'pipe', 'inherit'],
  })

  await new Promise((resolve, reject) => {
    child.stdout.on('data', chunk => {
      const text = chunk.toString()
      if (text.includes('Ready on')) {
        resolve()
      }
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code !== 0) reject(new Error(`Server exited with code ${code}`))
    })
  })

  done()

  // 7. Print update notice if available
  const latestVersion = await updatePromise
  if (latestVersion) {
    print(`  (update available: ${latestVersion} — run npx ${PKG_NAME}@latest)`)
  }

  const url = `http://localhost:${port}`

  // 8. Open browser
  try {
    const open = require('open')
    print(`  Open ${url} in your browser`)
    print('  (Opening automatically...)')
    await open(url)
  } catch {
    print(`  Open ${url} in your browser`)
  }

  print('')
  print('  Press Ctrl+C to stop.')
  print('')

  // Forward SIGINT to child so it can shut down cleanly
  process.on('SIGINT', () => {
    child.kill('SIGINT')
    process.exit(0)
  })

  // Forward child stdout (Next.js errors, etc.) but suppress the "Ready" line
  child.stdout.on('data', chunk => {
    const text = chunk.toString()
    if (!text.includes('Ready on')) {
      process.stdout.write(text)
    }
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
