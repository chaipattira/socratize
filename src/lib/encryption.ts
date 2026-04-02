import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

if (KEY.length !== 32) {
  throw new Error(`ENCRYPTION_KEY must be 64 hex chars (32 bytes), got ${KEY.length} bytes`)
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv(32 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex')
}

export function decrypt(ciphertext: string): string {
  const iv = Buffer.from(ciphertext.slice(0, 32), 'hex')
  const tag = Buffer.from(ciphertext.slice(32, 64), 'hex')
  const encrypted = Buffer.from(ciphertext.slice(64), 'hex')
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
