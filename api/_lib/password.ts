import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto'

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns { hash, salt } for storage.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: s }
}

/**
 * Verify a password against a stored hash and salt.
 * Uses timing-safe comparison.
 */
export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt)
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))
}

/**
 * Strip sensitive password fields from a user object before sending to the client.
 */
export function sanitizeUser(user: any): any {
  const { password, passwordHash, passwordSalt, ...safe } = user
  return safe
}
