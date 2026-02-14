import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put, list } from '@vercel/blob'

const BLOB_PREFIX = 'data/'
function blobPath(p: string) { return `${BLOB_PREFIX}${p}` }

// In-memory cache (persists across requests in warm serverless instances)
let _storeUrl: string | null = null
const _cache = new Map<string, { json: string; ts: number }>()
const CACHE_TTL = 30_000 // 30 seconds

async function getStoreUrl(): Promise<string | null> {
  if (_storeUrl) return _storeUrl
  const { blobs } = await list({ limit: 1 })
  if (blobs.length > 0) {
    _storeUrl = new URL(blobs[0].url).origin
  }
  return _storeUrl
}

async function readBlobJson(pathname: string): Promise<any | null> {
  const entry = _cache.get(pathname)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return JSON.parse(entry.json)
  try {
    const storeUrl = await getStoreUrl()
    if (!storeUrl) return null
    const response = await fetch(`${storeUrl}/${pathname}`)
    if (!response.ok) return null
    const data = await response.json()
    _cache.set(pathname, { json: JSON.stringify(data), ts: Date.now() })
    return data
  } catch { return null }
}

async function writeBlobJson(pathname: string, data: any): Promise<void> {
  await put(pathname, JSON.stringify(data, null, 2), {
    access: 'public', addRandomSuffix: false, contentType: 'application/json',
  })
  // Write-through: update cache immediately
  _cache.set(pathname, { json: JSON.stringify(data), ts: Date.now() })
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
    const works = req.body
    if (!Array.isArray(works)) {
      return res.status(400).json({ error: 'Body must be an array' })
    }

    // Save user's works AND read public works in parallel
    const [, currentPublicWorks] = await Promise.all([
      writeBlobJson(blobPath(`users/${userId}/works.json`), works),
      readBlobJson(blobPath('works.json')),
    ])
    // Update public works: remove this user's old entries, add new public ones
    const otherPublicWorks = Array.isArray(currentPublicWorks)
      ? currentPublicWorks.filter((w: any) => w.userId !== userId)
      : []

    const newPublicWorks = works
      .filter((w: any) => w.visibility === 'public')
      .map((w: any) => {
        const clean = { ...w }
        delete clean.charStyles
        delete clean.charAdjustments
        delete clean.isRefined
        delete clean.layout
        delete clean.gridType
        delete clean.visibility
        return clean
      })

    await writeBlobJson(blobPath('works.json'), [...otherPublicWorks, ...newPublicWorks])

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('Error saving works:', e)
    return res.status(500).json({ error: 'Failed to save works' })
  }
}
