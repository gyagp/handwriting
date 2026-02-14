import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test 1: Basic response
    const checks: Record<string, string> = { status: 'ok' }

    // Test 2: Check env var
    checks.hasBlobToken = process.env.BLOB_READ_WRITE_TOKEN ? 'yes' : 'no'

    // Test 3: Try importing @vercel/blob
    try {
      const blob = await import('@vercel/blob')
      checks.blobImport = 'ok'
      checks.blobExports = Object.keys(blob).join(', ')
    } catch (e: any) {
      checks.blobImport = `error: ${e.message}`
    }

    // Test 4: Try importing node:crypto
    try {
      const crypto = await import('node:crypto')
      checks.cryptoImport = 'ok'
      checks.hasRandomUUID = typeof crypto.randomUUID === 'function' ? 'yes' : 'no'
    } catch (e: any) {
      checks.cryptoImport = `error: ${e.message}`
    }

    return res.status(200).json(checks)
  } catch (e: any) {
    return res.status(500).json({ error: e.message, stack: e.stack })
  }
}
