// src/lib/pty-manager.ts
import * as pty from 'node-pty'

const MAX_BUFFER = 200 * 1024 // 200KB scrollback buffer

interface PtyEntry {
  process: pty.IPty
  dataListeners: Array<(data: string) => void>
  outputBuffer: string
}

// Use a Node.js global so both the custom server (tsx) and the Next.js
// bundled API routes share the same ptyMap instance.
declare global {
  // eslint-disable-next-line no-var
  var __socratize_ptyMap: Map<string, PtyEntry> | undefined
}
const ptyMap: Map<string, PtyEntry> = global.__socratize_ptyMap ?? new Map()
global.__socratize_ptyMap = ptyMap

export function getOrCreatePty(sandboxId: string, workspacePath: string): PtyEntry {
  if (!ptyMap.has(sandboxId)) {
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
    const p = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workspacePath,
      env: process.env as Record<string, string>,
    })
    const entry: PtyEntry = { process: p, dataListeners: [], outputBuffer: '' }
    p.onData(data => {
      entry.outputBuffer += data
      if (entry.outputBuffer.length > MAX_BUFFER) {
        entry.outputBuffer = entry.outputBuffer.slice(-MAX_BUFFER)
      }
      for (const listener of entry.dataListeners) listener(data)
    })
    ptyMap.set(sandboxId, entry)
  }
  return ptyMap.get(sandboxId)!
}

export function destroyPty(sandboxId: string): void {
  const entry = ptyMap.get(sandboxId)
  if (entry) {
    try { entry.process.kill() } catch { /* already dead */ }
    ptyMap.delete(sandboxId)
  }
}

export async function runCommand(
  sandboxId: string,
  workspacePath: string,
  command: string,
  timeoutMs = 30000
): Promise<string> {
  const entry = getOrCreatePty(sandboxId, workspacePath)
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const startSentinel = `__CMD_START_${id}__`
  const endSentinel = `__CMD_END_${id}__`
  let buffer = ''

  return new Promise<string>(resolve => {
    const timer = setTimeout(() => {
      entry.dataListeners = entry.dataListeners.filter(l => l !== listener)
      const partial = extractOutput(buffer, startSentinel, endSentinel)
      resolve((partial || stripAnsi(buffer).trim()) + '\n[timed out]')
    }, timeoutMs)

    const listener = (data: string) => {
      buffer += data
      // Check that endSentinel appears at the start of a line (actual output),
      // not inside the echoed command (where it appears after "echo ").
      if (buffer.includes('\n' + endSentinel) || buffer.includes('\r' + endSentinel)) {
        clearTimeout(timer)
        entry.dataListeners = entry.dataListeners.filter(l => l !== listener)
        resolve(extractOutput(buffer, startSentinel, endSentinel))
      }
    }

    entry.dataListeners.push(listener)
    // Write: echo start sentinel, run command, force newline, echo end sentinel.
    // The forced newline ensures the end sentinel is always at the start of a line
    // even when the command's last output doesn't end with a newline (e.g. printf).
    entry.process.write(`echo ${startSentinel}\n${command}\nprintf '\\n'\necho ${endSentinel}\r`)
  })
}

function stripAnsi(str: string): string {
  // Remove CSI sequences (colors, cursor movement, etc.) and OSC sequences
  return str
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[()][0-9A-Za-z]/g, '')
}

function extractOutput(raw: string, startSentinel: string, endSentinel: string): string {
  const cleaned = stripAnsi(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  // The start sentinel appears twice: once echoed as typed input, once as actual output.
  // We skip the first occurrence (echoed input line) by finding \n<sentinel>\n.
  const startPattern = `\n${startSentinel}\n`
  const startIdx = cleaned.indexOf(startPattern)
  if (startIdx === -1) return cleaned.trim()

  const contentStart = startIdx + startPattern.length
  const endIdx = cleaned.indexOf(endSentinel, contentStart)
  if (endIdx === -1) return cleaned.slice(contentStart).trim()

  // Trim trailing newline before end sentinel
  const beforeEnd = cleaned.lastIndexOf('\n', endIdx)
  const contentEnd = beforeEnd > contentStart ? beforeEnd : endIdx

  return cleaned.slice(contentStart, contentEnd).trim()
}
