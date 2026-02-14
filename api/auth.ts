import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readBlobJson, writeBlobJson, blobPath } from './_lib/blob'
import { hashPassword, verifyPassword, sanitizeUser } from './_lib/password'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const { action, username, password } = req.body
  const systemPath = blobPath('system.json')
  const systemData = (await readBlobJson(systemPath)) || { users: [], ratings: [], settings: null }
  const users: any[] = systemData.users || []

  if (action === 'login') {
    const user = users.find((u: any) => u.username === username)
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Support migration from plaintext to hashed passwords
    if (user.password && !user.passwordHash) {
      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid password' })
      }
      // Migrate to hashed
      const { hash, salt } = hashPassword(password)
      user.passwordHash = hash
      user.passwordSalt = salt
      delete user.password
      await writeBlobJson(systemPath, systemData)
    } else if (user.passwordHash) {
      if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        return res.status(401).json({ error: 'Invalid password' })
      }
    }

    return res.status(200).json({ user: sanitizeUser(user) })

  } else if (action === 'register') {
    if (!username) return res.status(400).json({ error: '用户名不能为空' })
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ error: '用户名只允许使用汉字、数字、字母、下划线、点和短横线' })
    }

    let nameLen = 0
    for (const char of username) {
      nameLen += /[\u4e00-\u9fa5]/.test(char) ? 2 : 1
    }
    if (nameLen < 4 || nameLen > 30) {
      return res.status(400).json({ error: '用户名长度需为4至30个字符(1个汉字=2个字符)' })
    }

    if (!password) return res.status(400).json({ error: '密码不能为空' })
    if (password.length < 7 || password.length > 16) {
      return res.status(400).json({ error: '密码长度必须是7-16位' })
    }
    if (/^\d+$/.test(password)) {
      return res.status(400).json({ error: '密码不能是纯数字' })
    }
    if (users.find((u: any) => u.username === username)) {
      return res.status(400).json({ error: '用户名已存在' })
    }

    const { hash, salt } = hashPassword(password)
    const newUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'user',
      createdAt: Date.now(),
      collectionVisibility: 'private',
    }

    users.push(newUser)
    systemData.users = users
    await writeBlobJson(systemPath, systemData)

    // Create empty user data files
    await Promise.all([
      writeBlobJson(blobPath(`users/${newUser.id}/samples.json`), []),
      writeBlobJson(blobPath(`users/${newUser.id}/works.json`), []),
    ])

    return res.status(200).json({ user: sanitizeUser(newUser) })
  }

  return res.status(400).json({ error: 'Invalid action' })
}
