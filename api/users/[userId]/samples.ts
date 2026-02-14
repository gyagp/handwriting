import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put } from '@vercel/blob'

const BLOB_PREFIX = 'data/'
function blobPath(p: string) { return `${BLOB_PREFIX}${p}` }

async function writeBlobJson(pathname: string, data: any): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: 'public', addRandomSuffix: false, contentType: 'application/json',
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const { userId } = req.query
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId' })
  }

  try {
    const samples = req.body
    if (!Array.isArray(samples)) {
      return res.status(400).json({ error: 'Body must be an array' })
    }

    await writeBlobJson(blobPath(`users/${userId}/samples.json`), samples)
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('Error saving samples:', e)
    return res.status(500).json({ error: 'Failed to save samples' })
  }
}
