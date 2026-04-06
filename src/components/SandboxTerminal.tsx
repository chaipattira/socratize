// src/components/SandboxTerminal.tsx
'use client'
import { useEffect, useRef } from 'react'

interface SandboxTerminalProps {
  sandboxId: string
}

export function SandboxTerminal({ sandboxId }: SandboxTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      await import('@xterm/xterm/css/xterm.css')

      if (disposed || !containerRef.current) return

      const term = new Terminal({
        theme: {
          background: '#1c1917',
          foreground: '#d6d3d1',
          cursor: '#7C2D35',
          selectionBackground: '#44403c',
        },
        fontFamily: '"Cascadia Code", "Fira Code", "Menlo", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        scrollback: 1000,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/sandboxes/${sandboxId}/terminal`)

      ws.onopen = () => {
        fitAddon.fit()
      }

      ws.onmessage = (event: MessageEvent<string>) => {
        term.write(event.data)
      }

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })

      // Resize terminal when container size changes
      const observer = new ResizeObserver(() => {
        try { fitAddon.fit() } catch { /* ignore if terminal disposed */ }
      })
      observer.observe(containerRef.current!)

      // Store cleanup in the container for the effect cleanup
      ;(containerRef.current as HTMLDivElement & { _cleanup?: () => void })._cleanup = () => {
        ws.close()
        term.dispose()
        observer.disconnect()
      }
    }

    init()

    return () => {
      disposed = true
      const el = containerRef.current as (HTMLDivElement & { _cleanup?: () => void }) | null
      el?._cleanup?.()
    }
  }, [sandboxId])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: '4px' }}
    />
  )
}
