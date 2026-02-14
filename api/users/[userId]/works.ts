import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put, list } from '@vercel/blob'

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
    const works = req.body
    if (!Array.isArray(works)) {
      return res.status(400).json({ error: 'Body must be an array' })
    }

    // Save this user's works
    await writeBlobJson(blobPath(`users/${userId}/works.json`), works)

    // Update public works: remove this user's old entries, add new public ones
    const currentPublicWorks = (await readBlobJson(blobPath('works.json'))) || []
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
