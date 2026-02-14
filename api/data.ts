import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list } from '@vercel/blob'

// In-memory cache (persists across requests in warm serverless instances)
const _cache = new Map<string, { json: string; ts: number }>()
let _urlMapCache: { map: Map<string, string>; blobs: any[]; ts: number } | null = null
const CACHE_TTL = 30_000 // 30 seconds

function getCached(key: string): any | undefined {
  const e = _cache.get(key)
  if (e && Date.now() - e.ts < CACHE_TTL) return JSON.parse(e.json)
  return undefined
}

function setCache(key: string, data: any) {
  _cache.set(key, { json: JSON.stringify(data), ts: Date.now() })
}

function sanitizeUser(user: any): any {
  const { password, passwordHash, passwordSalt, ...safe } = user
  return safe
}

/**
 * GET /api/data — Load all application data.
 * Optimized: in-memory cache + single list() + parallel fetch().
 * Warm instances with valid cache: 0 network calls.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  try {
    const noCache = req.query.nocache === '1'

    // Get blob URL map (cached or fresh)
    let urlMap: Map<string, string>
    let allBlobs: any[]
    if (!noCache && _urlMapCache && Date.now() - _urlMapCache.ts < CACHE_TTL) {
      urlMap = _urlMapCache.map
      allBlobs = _urlMapCache.blobs
    } else {
      const result = await list({ prefix: 'data/' })
      allBlobs = result.blobs
      urlMap = new Map(allBlobs.map((b: any) => [b.pathname, b.url]))
      _urlMapCache = { map: urlMap, blobs: allBlobs, ts: Date.now() }
    }

    // Fetch JSON with per-blob cache
    const fetchBlob = async (pathname: string) => {
      if (!noCache) {
        const cached = getCached(pathname)
        if (cached !== undefined) return cached
      }
      const url = urlMap.get(pathname)
      if (!url) return null
      try {
        const r = await fetch(url)
        if (!r.ok) return null
        const data = await r.json()
        setCache(pathname, data)
        return data
      } catch { return null }
    }

    // Identify user data blobs
    const userBlobs = allBlobs.filter((b: any) =>
      /^data\/users\/[^/]+\/(samples|works)\.json$/.test(b.pathname)
    )

    // Fetch all in parallel (cache hits skip network entirely)
    const fetchPromises = [
      fetchBlob('data/system.json'),
      fetchBlob('data/works.json'),
      ...userBlobs.map(async (b: any) => ({
        pathname: b.pathname,
        data: await fetchBlob(b.pathname),
      }))
    ]

    const [systemData, publicWorksData, ...userResults] = await Promise.all(fetchPromises)

    const responseData: any = {
      users: [],
      samples: [],
      works: [],
      ratings: [],
      settings: null,
    }

    if (systemData) {
      responseData.users = (systemData.users || []).map(sanitizeUser)
      responseData.ratings = systemData.ratings || []
      responseData.settings = systemData.settings || null
    }

    // Build works map from public works + user works
    const worksMap = new Map<string, any>()
    if (Array.isArray(publicWorksData)) {
      publicWorksData.forEach((w: any) => worksMap.set(w.id, w))
    }

    // Process user blobs
    for (const result of userResults) {
      if (!result?.data || !Array.isArray(result.data)) continue
      const match = result.pathname.match(/^data\/users\/([^/]+)\/(samples|works)\.json$/)
      if (!match) continue
      const [, userId, fileType] = match

      if (fileType === 'samples') {
        result.data.forEach((s: any) => { s.userId = userId })
        responseData.samples.push(...result.data)
      } else if (fileType === 'works') {
        result.data.forEach((w: any) => { w.userId = userId; worksMap.set(w.id, w) })
      }
    }

    responseData.works = Array.from(worksMap.values())

    // Compute scores from ratings
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

    return res.status(200).json(responseData)
  } catch (e) {
    console.error('Error loading data:', e)
    return res.status(500).json({ error: 'Failed to load data' })
  }
}
