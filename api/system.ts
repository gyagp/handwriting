import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readBlobJson, writeBlobJson, blobPath } from './_lib/blob'
import { hashPassword, sanitizeUser } from './_lib/password'

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

      await writeBlobJson(systemPath, systemData)

      // Compute average and update the target's score in the owner's data
      if (targetUserId) {
        const targetRatings = systemData.ratings.filter(
          (r: any) => r.targetId === targetId && r.targetType === targetType
        )
        const total = targetRatings.reduce((sum: number, r: any) => sum + r.score, 0)
        const avg = Math.round((total / targetRatings.length) * 10) / 10

        if (targetType === 'sample') {
          const samplesPath = blobPath(`users/${targetUserId}/samples.json`)
          const samples = (await readBlobJson(samplesPath)) || []
          const sample = samples.find((s: any) => s.id === targetId)
          if (sample) {
            sample.score = avg
            await writeBlobJson(samplesPath, samples)
          }
        } else if (targetType === 'work') {
          const worksPath = blobPath(`users/${targetUserId}/works.json`)
          const works = (await readBlobJson(worksPath)) || []
          const work = works.find((w: any) => w.id === targetId)
          if (work) {
            work.score = avg
            await writeBlobJson(worksPath, works)
          }
        }
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
