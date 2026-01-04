import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/data', (req, res, next) => {
          const rootDataDir = resolve(__dirname, 'data')
          const usersDir = resolve(rootDataDir, 'users')
          const systemFile = resolve(rootDataDir, 'system.json')
          const publicWorksFile = resolve(rootDataDir, 'works.json')

          // Ensure directories exist
          if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true })
          if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir, { recursive: true })

          if (req.method === 'GET') {
            const responseData = {
              users: [],
              samples: [],
              works: [],
              ratings: [],
              settings: null
            }

            if (fs.existsSync(systemFile)) {
              // Load from new structure
              try {
                const systemData = JSON.parse(fs.readFileSync(systemFile, 'utf-8'))
                responseData.users = systemData.users || []
                responseData.ratings = systemData.ratings || []
                responseData.settings = systemData.settings || null

                // Load public works
                const worksMap = new Map()
                if (fs.existsSync(publicWorksFile)) {
                  try {
                    const publicWorks = JSON.parse(fs.readFileSync(publicWorksFile, 'utf-8'))
                    if (Array.isArray(publicWorks)) {
                      publicWorks.forEach(w => worksMap.set(w.id, w))
                    }
                  } catch (e) {}
                }

                // Load user data
                if (fs.existsSync(usersDir)) {
                  const userFolders = fs.readdirSync(usersDir)
                  for (const userId of userFolders) {
                    const userDir = resolve(usersDir, userId)
                    if (fs.statSync(userDir).isDirectory()) {
                      const samplesFile = resolve(userDir, 'samples.json')
                      if (fs.existsSync(samplesFile)) {
                        try {
                          const samples = JSON.parse(fs.readFileSync(samplesFile, 'utf-8'))
                          if (Array.isArray(samples)) {
                            samples.forEach(s => s.userId = userId)
                            responseData.samples.push(...samples)
                          }
                        } catch (e) {}
                      }
                      const worksFile = resolve(userDir, 'works.json')
                      if (fs.existsSync(worksFile)) {
                        try {
                          const works = JSON.parse(fs.readFileSync(worksFile, 'utf-8'))
                          if (Array.isArray(works)) {
                            works.forEach(w => {
                              w.userId = userId
                              worksMap.set(w.id, w) // Overwrite public work if exists
                            })
                          }
                        } catch (e) {}
                      }
                    }
                  }
                }
                responseData.works = Array.from(worksMap.values())
              } catch (e) {
                console.error('Error loading data:', e)
              }
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(responseData))

          } else if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })
            req.on('end', () => {
              try {
                const data = JSON.parse(body)

                // Save system data
                const systemData = {
                  users: data.users || [],
                  ratings: data.ratings || [],
                  settings: data.settings || null
                }
                fs.writeFileSync(systemFile, JSON.stringify(systemData, null, 2))

                // Group data by user
                const samplesByUser = {}
                const worksByUser = {}
                const publicWorks = []

                if (Array.isArray(data.samples)) {
                  for (const sample of data.samples) {
                    if (sample.userId) {
                      if (!samplesByUser[sample.userId]) samplesByUser[sample.userId] = []
                      samplesByUser[sample.userId].push(sample)
                    }
                  }
                }

                if (Array.isArray(data.works)) {
                  for (const work of data.works) {
                    // 1. Save full work to user directory if it has userId
                    if (work.userId) {
                      if (!worksByUser[work.userId]) worksByUser[work.userId] = []
                      worksByUser[work.userId].push(work)
                    }

                    // 2. If public, ALSO save a sanitized copy to public_works.json
                    if (work.visibility === 'public') {
                      const cleanWork = { ...work }
                      // Strip user-specific and handwriting specific data
                      delete cleanWork.charStyles
                      delete cleanWork.charAdjustments
                      delete cleanWork.isRefined
                      delete cleanWork.layout      // User-specific preference
                      delete cleanWork.gridType    // User-specific preference
                      delete cleanWork.visibility  // Always public in this file
                      // Keep: id, title, content, author, userId, status, createdAt, updatedAt, score, authorDeleted
                      publicWorks.push(cleanWork)
                    }
                  }
                }

                // Only save public works if content actually changed
                // Compare with existing file to avoid unnecessary writes
                let existingPublicWorks = []
                if (fs.existsSync(publicWorksFile)) {
                  try {
                    existingPublicWorks = JSON.parse(fs.readFileSync(publicWorksFile, 'utf-8'))
                  } catch (e) {}
                }

                // Compare by id, title, content, author, status (ignoring updatedAt for user changes)
                const publicWorksChanged = () => {
                  if (existingPublicWorks.length !== publicWorks.length) return true
                  const existingMap = new Map(existingPublicWorks.map(w => [w.id, w]))
                  for (const work of publicWorks) {
                    const existing = existingMap.get(work.id)
                    if (!existing) return true
                    if (existing.title !== work.title ||
                        existing.content !== work.content ||
                        existing.author !== work.author ||
                        existing.status !== work.status) {
                      return true
                    }
                  }
                  return false
                }

                if (publicWorksChanged()) {
                  fs.writeFileSync(publicWorksFile, JSON.stringify(publicWorks, null, 2))
                }

                // Save user data
                if (Array.isArray(data.users)) {
                  for (const user of data.users) {
                    const userDir = resolve(usersDir, user.id)
                    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })

                    const userSamples = samplesByUser[user.id] || []
                    const userWorks = worksByUser[user.id] || []

                    fs.writeFileSync(resolve(userDir, 'samples.json'), JSON.stringify(userSamples, null, 2))
                    fs.writeFileSync(resolve(userDir, 'works.json'), JSON.stringify(userWorks, null, 2))
                  }
                }

                res.end('ok')
              } catch (e) {
                console.error('Error saving data:', e)
                res.statusCode = 500
                res.end('error')
              }
            })
          } else {
            next()
          }
        })
      }
    },
    vue(),
    Components({
      resolvers: [VantResolver()]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
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
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
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
    port: 3000
  }
})
