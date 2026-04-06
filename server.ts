// server.ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import { getOrCreatePty } from './src/lib/pty-manager'
import { prisma } from './src/lib/prisma'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)
const app = next({ dev, port })
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
      socket.destroy()
      return
    }
    const sandboxId = match[1]

    wss.handleUpgrade(req, socket, head, async (ws) => {
      const sandbox = await prisma.sandbox.findUnique({ where: { id: sandboxId } })
      if (!sandbox) {
        ws.close(1008, 'Sandbox not found')
        return
      }

      const entry = getOrCreatePty(sandboxId, sandbox.workspaceFolderPath)

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
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
