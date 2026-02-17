import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { resolve } from 'path'
import fs from 'fs'
import crypto from 'crypto'

// --- Password helpers (mirror api/_lib/password.ts for local dev) ---
function hashPasswordLocal(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex')
  return { hash, salt: s }
}

function verifyPasswordLocal(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPasswordLocal(password, storedSalt)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'))
}

function sanitizeUserLocal(user: any): any {
  const { password, passwordHash, passwordSalt, ...safe } = user
  return safe
}

// --- Helpers for JSON body parsing ---
function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: any) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch (e) { reject(e) }
    })
  })
}

// --- File helpers ---
function readJsonFile(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch { return null }
}

function writeJsonFile(filePath: string, data: any): void {
  const dir = resolve(filePath, '..')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export default defineConfig({
  plugins: [
    {
      name: 'api-middleware',
      configureServer(server) {
        const rootDataDir = resolve(__dirname, 'data')
        const usersDir = resolve(rootDataDir, 'users')
        const systemFile = resolve(rootDataDir, 'system.json')
        const publicWorksFile = resolve(rootDataDir, 'works.json')

        // Ensure directories exist
        if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true })
        if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true })

        // ---- GET /api/data ----
        server.middlewares.use('/api/data', (req, res, next) => {
          if (req.method !== 'GET') { next(); return }

          const responseData: any = {
            users: [],
            samples: [],
            works: [],
            ratings: [],
            settings: null
          }

          const systemData = readJsonFile(systemFile)
          if (systemData) {
            responseData.users = (systemData.users || []).map(sanitizeUserLocal)
            responseData.ratings = systemData.ratings || []
            responseData.settings = systemData.settings || null

            const worksMap = new Map()
            const publicWorks = readJsonFile(publicWorksFile)
            if (Array.isArray(publicWorks)) {
              publicWorks.forEach((w: any) => worksMap.set(w.id, w))
            }

            if (fs.existsSync(usersDir)) {
              for (const userId of fs.readdirSync(usersDir)) {
                const userDir = resolve(usersDir, userId)
                if (!fs.statSync(userDir).isDirectory()) continue

                const samples = readJsonFile(resolve(userDir, 'samples.json'))
                if (Array.isArray(samples)) {
                  samples.forEach((s: any) => s.userId = userId)
                  responseData.samples.push(...samples)
                }

                const works = readJsonFile(resolve(userDir, 'works.json'))
                if (Array.isArray(works)) {
                  works.forEach((w: any) => {
                    w.userId = userId
                    worksMap.set(w.id, w)
                  })
                }
              }
            }
            responseData.works = Array.from(worksMap.values())
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(responseData))
        })

        // ---- POST /api/auth ----
        server.middlewares.use('/api/auth', async (req, res, next) => {
          if (req.method !== 'POST') { next(); return }

          try {
            const body = await parseJsonBody(req)
            const { action, username, password } = body
            const systemData = readJsonFile(systemFile) || { users: [], ratings: [], settings: null }
            const users: any[] = systemData.users || []

            if (action === 'login') {
              const user = users.find((u: any) => u.username === username)
              if (!user) {
                res.statusCode = 401
                res.end(JSON.stringify({ error: 'User not found' }))
                return
              }
              // Support plaintext passwords (migration)
              if (user.password && !user.passwordHash) {
                if (user.password !== password) {
                  res.statusCode = 401
                  res.end(JSON.stringify({ error: 'Invalid password' }))
                  return
                }
                // Migrate
                const { hash, salt } = hashPasswordLocal(password)
                user.passwordHash = hash
                user.passwordSalt = salt
                delete user.password
                writeJsonFile(systemFile, systemData)
              } else if (user.passwordHash) {
                if (!verifyPasswordLocal(password, user.passwordHash, user.passwordSalt)) {
                  res.statusCode = 401
                  res.end(JSON.stringify({ error: 'Invalid password' }))
                  return
                }
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ user: sanitizeUserLocal(user) }))

            } else if (action === 'register') {
              // Validation
              if (!username) { res.statusCode = 400; res.end(JSON.stringify({ error: '用户名不能为空' })); return }
              if (!/^[\u4e00-\u9fa5a-zA-Z0-9_.-]+$/.test(username)) {
                res.statusCode = 400; res.end(JSON.stringify({ error: '用户名只允许使用汉字、数字、字母、下划线、点和短横线' })); return
              }
              let nameLen = 0
              for (const char of username) nameLen += /[\u4e00-\u9fa5]/.test(char) ? 2 : 1
              if (nameLen < 4 || nameLen > 30) { res.statusCode = 400; res.end(JSON.stringify({ error: '用户名长度需为4至30个字符(1个汉字=2个字符)' })); return }
              if (!password) { res.statusCode = 400; res.end(JSON.stringify({ error: '密码不能为空' })); return }
              if (password.length < 7 || password.length > 16) { res.statusCode = 400; res.end(JSON.stringify({ error: '密码长度必须是7-16位' })); return }
              if (/^\d+$/.test(password)) { res.statusCode = 400; res.end(JSON.stringify({ error: '密码不能是纯数字' })); return }
              if (users.find((u: any) => u.username === username)) { res.statusCode = 400; res.end(JSON.stringify({ error: '用户名已存在' })); return }

              const { hash, salt } = hashPasswordLocal(password)
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
              writeJsonFile(systemFile, systemData)

              // Create empty user data
              const userDir = resolve(usersDir, newUser.id)
              writeJsonFile(resolve(userDir, 'samples.json'), [])
              writeJsonFile(resolve(userDir, 'works.json'), [])

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ user: sanitizeUserLocal(newUser) }))
            } else {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid action' }))
            }
          } catch (e: any) {
            console.error('Auth error:', e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Internal error' }))
          }
        })

        // ---- POST /api/system ----
        server.middlewares.use('/api/system', async (req, res, next) => {
          if (req.method !== 'POST') { next(); return }

          try {
            const body = await parseJsonBody(req)
            const { action, payload } = body
            const systemData = readJsonFile(systemFile) || { users: [], ratings: [], settings: null }
            if (!systemData.ratings) systemData.ratings = []
            if (!systemData.users) systemData.users = []

            switch (action) {
              case 'saveRating': {
                const { userId, targetId, targetType, score, targetUserId } = payload
                const existingIndex = systemData.ratings.findIndex(
                  (r: any) => r.userId === userId && r.targetId === targetId && r.targetType === targetType
                )
                const rating = { userId, targetId, targetType, score, createdAt: Date.now() }
                if (existingIndex >= 0) systemData.ratings[existingIndex] = rating
                else systemData.ratings.push(rating)
                writeJsonFile(systemFile, systemData)

                // Update score on target
                if (targetUserId) {
                  const targetRatings = systemData.ratings.filter(
                    (r: any) => r.targetId === targetId && r.targetType === targetType
                  )
                  const total = targetRatings.reduce((sum: number, r: any) => sum + r.score, 0)
                  const avg = Math.round((total / targetRatings.length) * 10) / 10

                  if (targetType === 'sample') {
                    const samplesPath = resolve(usersDir, targetUserId, 'samples.json')
                    const samples = readJsonFile(samplesPath) || []
                    const sample = samples.find((s: any) => s.id === targetId)
                    if (sample) { sample.score = avg; writeJsonFile(samplesPath, samples) }
                  } else if (targetType === 'work') {
                    const worksPath = resolve(usersDir, targetUserId, 'works.json')
                    const works = readJsonFile(worksPath) || []
                    const work = works.find((w: any) => w.id === targetId)
                    if (work) { work.score = avg; writeJsonFile(worksPath, works) }
                  }
                }

                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
                break
              }
              case 'saveSettings': {
                systemData.settings = { ...systemData.settings, ...payload }
                writeJsonFile(systemFile, systemData)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
                break
              }
              case 'updateUser': {
                const { userId: uid, updates } = payload
                const userIndex = systemData.users.findIndex((u: any) => u.id === uid)
                if (userIndex === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'User not found' })); return }
                const allowedFields = ['collectionVisibility', 'role', 'collectedWorkIds']
                for (const [key, value] of Object.entries(updates)) {
                  if (allowedFields.includes(key)) systemData.users[userIndex][key] = value
                }
                writeJsonFile(systemFile, systemData)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ user: sanitizeUserLocal(systemData.users[userIndex]) }))
                break
              }
              case 'resetPassword': {
                const { userId: uid2, newPassword } = payload
                const ui = systemData.users.findIndex((u: any) => u.id === uid2)
                if (ui === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'User not found' })); return }
                const { hash, salt } = hashPasswordLocal(newPassword)
                systemData.users[ui].passwordHash = hash
                systemData.users[ui].passwordSalt = salt
                delete systemData.users[ui].password
                writeJsonFile(systemFile, systemData)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
                break
              }
              default:
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid action' }))
            }
          } catch (e: any) {
            console.error('System error:', e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Internal error' }))
          }
        })

        // ---- POST /api/users/:userId/samples ----
        server.middlewares.use((req, res, next) => {
          const match = req.url?.match(/^\/api\/users\/([^/]+)\/samples\/?$/)
          if (!match || req.method !== 'POST') { next(); return }

          const userId = match[1]
          parseJsonBody(req).then(samples => {
            if (!Array.isArray(samples)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Body must be an array' })); return }
            const samplesPath = resolve(usersDir, userId, 'samples.json')
            writeJsonFile(samplesPath, samples)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          }).catch(e => {
            console.error('Error saving samples:', e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to save samples' }))
          })
        })

        // ---- POST /api/users/:userId/works ----
        server.middlewares.use((req, res, next) => {
          const match = req.url?.match(/^\/api\/users\/([^/]+)\/works\/?$/)
          if (!match || req.method !== 'POST') { next(); return }

          const userId = match[1]
          parseJsonBody(req).then(works => {
            if (!Array.isArray(works)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Body must be an array' })); return }

            // Save user works
            writeJsonFile(resolve(usersDir, userId, 'works.json'), works)

            // Update public works
            const existingPublicWorks = readJsonFile(publicWorksFile) || []
            const otherPublicWorks = Array.isArray(existingPublicWorks)
              ? existingPublicWorks.filter((w: any) => w.userId !== userId)
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
            writeJsonFile(publicWorksFile, [...otherPublicWorks, ...newPublicWorks])

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          }).catch(e => {
            console.error('Error saving works:', e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to save works' }))
          })
        })
      }
    },
    vue(),
    Components({
      resolvers: [VantResolver()]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: '书法集字',
        short_name: '书法集字',
        description: '书法练习与集字工具',
        theme_color: '#8B4513',
        background_color: '#FFF8DC',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: true,
    port: 5173
  }
})
