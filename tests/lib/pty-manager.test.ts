// tests/lib/pty-manager.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { runCommand, destroyPty } from '@/lib/pty-manager'

const SANDBOX_ID = 'test-pty-sandbox'
const WORKSPACE = '/tmp'

afterEach(() => {
  destroyPty(SANDBOX_ID)
})

describe('runCommand', () => {
  it('executes a command and returns its stdout', async () => {
    const result = await runCommand(SANDBOX_ID, WORKSPACE, 'echo hello world')
    expect(result).toBe('hello world')
  }, 10000)

  it('returns empty string for commands with no output', async () => {
    const result = await runCommand(SANDBOX_ID, WORKSPACE, 'true')
    expect(result).toBe('')
  }, 10000)

  it('persists working directory across calls', async () => {
    await runCommand(SANDBOX_ID, WORKSPACE, 'cd /tmp')
    const result = await runCommand(SANDBOX_ID, WORKSPACE, 'pwd')
    expect(result).toBe('/tmp')
  }, 15000)

  it('captures multiline output', async () => {
    const result = await runCommand(SANDBOX_ID, WORKSPACE, 'printf "line1\\nline2\\nline3"')
    expect(result).toBe('line1\nline2\nline3')
  }, 10000)

  it('returns partial output with timeout message when command exceeds timeout', async () => {
    const result = await runCommand(SANDBOX_ID, WORKSPACE, 'sleep 10', 500)
    expect(result).toContain('[timed out]')
  }, 5000)
})
