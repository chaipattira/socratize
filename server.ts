// server.ts
import { createServer } from 'http'
import { parse } from 'url'
import path from 'path'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import { getOrCreatePty } from './src/lib/pty-manager'
import { prisma } from './src/lib/prisma'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
// In production the bundled server runs from dist/; package root is one level up
const dir = dev ? undefined : path.resolve(__dirname, '..')
const app = next({ dev, dir })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    handle(req, res, parsedUrl)
  })

  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? ''
    const match = url.match(/^\/api\/sandboxes\/([^/?]+)\/terminal/)
    if (!match) {
      // Not our terminal — let Next.js handle it (e.g. /_next/webpack-hmr)
      return
    }
    const sandboxId = match[1]

    wss.handleUpgrade(req, socket, head, async (ws) => {
      try {
      const sandbox = await prisma.sandbox.findUnique({ where: { id: sandboxId } })
      if (!sandbox) {
        ws.close(1008, 'Sandbox not found')
        return
      }

      let entry
      try {
        entry = getOrCreatePty(sandboxId, sandbox.workspaceFolderPath)
      } catch (err) {
        console.error('[terminal] Failed to spawn PTY:', err)
        ws.send('\r\n\x1b[31mFailed to start terminal: ' + (err instanceof Error ? err.message : String(err)) + '\x1b[0m\r\n')
        ws.close(1011, 'PTY spawn failed')
        return
      }

      // Replay buffered output so the terminal shows what the agent already ran
      if (entry.outputBuffer) {
        ws.send(entry.outputBuffer)
      }

      // Stream PTY output to browser
      const dataListener = (data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      }
      entry.dataListeners.push(dataListener)

      // Forward browser keystrokes to PTY
      ws.on('message', (msg) => {
        entry.process.write(msg.toString())
      })

      ws.on('close', () => {
        entry.dataListeners = entry.dataListeners.filter(l => l !== dataListener)
      })

      ws.on('error', () => {
        entry.dataListeners = entry.dataListeners.filter(l => l !== dataListener)
      })
      } catch (err) {
        console.error('[terminal] WebSocket handler error:', err)
        try { ws.close(1011, 'Internal error') } catch { /* already closed */ }
      }
    })
  })

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
