import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes, pbkdf2Sync } from 'node:crypto'
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

function hashPassword(password: string, salt?: string) {
  const s = salt || randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: s }
}

function sanitizeUser(user: any): any {
  const { password, passwordHash, passwordSalt, ...safe } = user
  return safe
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const { action, payload } = req.body
  const systemPath = blobPath('system.json')
  const systemData = (await readBlobJson(systemPath)) || { users: [], ratings: [], settings: null }
  if (!systemData.ratings) systemData.ratings = []
  if (!systemData.users) systemData.users = []

  switch (action) {
    case 'saveRating': {
      const { userId, targetId, targetType, score, targetUserId } = payload

      // Atomic read-modify-write on ratings
      const existingIndex = systemData.ratings.findIndex(
        (r: any) => r.userId === userId && r.targetId === targetId && r.targetType === targetType
      )
      const rating = { userId, targetId, targetType, score, createdAt: Date.now() }
      if (existingIndex >= 0) {
        systemData.ratings[existingIndex] = rating
      } else {
        systemData.ratings.push(rating)
      }

      // Compute average score in memory (no extra reads needed)
      const targetRatings = targetUserId ? systemData.ratings.filter(
        (r: any) => r.targetId === targetId && r.targetType === targetType
      ) : []
      const avg = targetRatings.length > 0
        ? Math.round((targetRatings.reduce((sum: number, r: any) => sum + r.score, 0) / targetRatings.length) * 10) / 10
        : 0

      if (targetUserId && targetRatings.length > 0) {
        const fileType = targetType === 'sample' ? 'samples' : 'works'
        const userDataPath = blobPath(`users/${targetUserId}/${fileType}.json`)

        // Parallelize: write system.json AND read user data simultaneously
        const [, userData] = await Promise.all([
          writeBlobJson(systemPath, systemData),
          readBlobJson(userDataPath),
        ])

        if (Array.isArray(userData)) {
          const item = userData.find((x: any) => x.id === targetId)
          if (item) {
            item.score = avg
            await writeBlobJson(userDataPath, userData)
          }
        }
      } else {
        await writeBlobJson(systemPath, systemData)
      }

      return res.status(200).json({ ok: true })
    }

    case 'saveSettings': {
      systemData.settings = { ...systemData.settings, ...payload }
      await writeBlobJson(systemPath, systemData)
      return res.status(200).json({ ok: true })
    }

    case 'updateUser': {
      const { userId, updates } = payload
      const userIndex = systemData.users.findIndex((u: any) => u.id === userId)
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' })

      const allowedFields = ['collectionVisibility', 'role', 'collectedWorkIds']
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          systemData.users[userIndex][key] = value
        }
      }
      await writeBlobJson(systemPath, systemData)
      return res.status(200).json({ user: sanitizeUser(systemData.users[userIndex]) })
    }

    case 'resetPassword': {
      const { userId, newPassword } = payload
      const userIndex = systemData.users.findIndex((u: any) => u.id === userId)
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' })

      const { hash, salt } = hashPassword(newPassword)
      systemData.users[userIndex].passwordHash = hash
      systemData.users[userIndex].passwordSalt = salt
      delete systemData.users[userIndex].password
      await writeBlobJson(systemPath, systemData)
      return res.status(200).json({ ok: true })
    }

    default:
      return res.status(400).json({ error: 'Invalid action' })
  }
}
