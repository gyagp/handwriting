import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readBlobJson, listBlobsByPrefix, blobPath } from './_lib/blob'
import { sanitizeUser } from './_lib/password'

/**
 * GET /api/data — Load all application data.
 * Passwords are stripped. Scores are computed from ratings for consistency.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  try {
    const responseData: any = {
      users: [],
      samples: [],
      works: [],
      ratings: [],
      settings: null,
    }

    const systemData = await readBlobJson(blobPath('system.json'))
    if (systemData) {
      // Strip passwords from users
      responseData.users = (systemData.users || []).map(sanitizeUser)
      responseData.ratings = systemData.ratings || []
      responseData.settings = systemData.settings || null

      // Load public works
      const worksMap = new Map<string, any>()
      const publicWorks = await readBlobJson(blobPath('works.json'))
      if (Array.isArray(publicWorks)) {
        publicWorks.forEach((w: any) => worksMap.set(w.id, w))
      }

      // Load all user data blobs in parallel
      const blobs = await listBlobsByPrefix(blobPath('users/'))
      const fetchPromises = blobs
        .filter(blob => /^data\/users\/[^/]+\/(samples|works)\.json$/.test(blob.pathname))
        .map(async (blob) => {
          const match = blob.pathname.match(/^data\/users\/([^/]+)\/(samples|works)\.json$/)
          if (!match) return
          const [, userId, fileType] = match

          try {
            const response = await fetch(blob.url)
            const fileData = await response.json()

            if (fileType === 'samples' && Array.isArray(fileData)) {
              fileData.forEach((s: any) => (s.userId = userId))
              responseData.samples.push(...fileData)
            } else if (fileType === 'works' && Array.isArray(fileData)) {
              fileData.forEach((w: any) => {
                w.userId = userId
                worksMap.set(w.id, w)
              })
            }
          } catch (e) {
            console.error(`Failed to read ${blob.pathname}:`, e)
          }
        })

      await Promise.all(fetchPromises)
      responseData.works = Array.from(worksMap.values())

      // Compute scores from ratings so they are always up-to-date
      const ratingsByTarget = new Map<string, { total: number; count: number }>()
      for (const r of responseData.ratings) {
        const key = `${r.targetType}:${r.targetId}`
        if (!ratingsByTarget.has(key)) ratingsByTarget.set(key, { total: 0, count: 0 })
        const entry = ratingsByTarget.get(key)!
        entry.total += r.score
        entry.count++
      }
      for (const s of responseData.samples) {
        const entry = ratingsByTarget.get(`sample:${s.id}`)
        if (entry) s.score = Math.round((entry.total / entry.count) * 10) / 10
      }
      for (const w of responseData.works) {
        const entry = ratingsByTarget.get(`work:${w.id}`)
        if (entry) w.score = Math.round((entry.total / entry.count) * 10) / 10
      }
    }

    return res.status(200).json(responseData)
  } catch (e) {
    console.error('Error loading data:', e)
    return res.status(500).json({ error: 'Failed to load data' })
  }
}
