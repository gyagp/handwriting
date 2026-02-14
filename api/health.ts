import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readBlobJson, blobPath } from './_lib/blob'
import { sanitizeUser } from './_lib/password'

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
