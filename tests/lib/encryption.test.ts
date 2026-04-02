import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/encryption'

describe('encryption', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'sk-ant-api03-test-key-123'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-key'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('round-trips empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })
})
