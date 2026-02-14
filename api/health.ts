import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list } from '@vercel/blob'

const BLOB_PREFIX = 'data/'
function blobPath(p: string) { return `${BLOB_PREFIX}${p}` }

async function readBlobJson(pathname: string): Promise<any | null> {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 10 })
    const blob = blobs.find(b => b.pathname === pathname)
    if (!blob) return null
    const response = await fetch(blob.url)
    return await response.json()
  } catch { return null }
}

function sanitizeUser(user: any): any {
  const { password, passwordHash, passwordSalt, ...safe } = user
  return safe
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const checks: Record<string, any> = { status: 'ok' }

    // Test 1: Check env var
    checks.hasBlobToken = process.env.BLOB_READ_WRITE_TOKEN ? 'yes' : 'no'

    // Test 2: Static imports worked
    checks.staticImports = 'ok'
    checks.blobPathTest = blobPath('system.json')
    checks.sanitizeUserTest = JSON.stringify(sanitizeUser({ id: '1', username: 'test', passwordHash: 'xxx' }))

    // Test 3: Try reading system.json via readBlobJson
    try {
      const data = await readBlobJson(blobPath('system.json'))
      if (data) {
        checks.systemRead = 'ok'
        checks.userCount = data.users?.length || 0
      } else {
        checks.systemRead = 'null (not found)'
      }
    } catch (e: any) {
      checks.systemReadError = `${e.name}: ${e.message}`
    }

    return res.status(200).json(checks)
  } catch (e: any) {
    return res.status(500).json({ error: e.message, stack: e.stack })
  }
}
