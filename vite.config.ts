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
          const oldDataPath = resolve(__dirname, 'data.json')

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
                          if (Array.isArray(samples)) responseData.samples.push(...samples)
                        } catch (e) {}
                      }
                      const worksFile = resolve(userDir, 'works.json')
                      if (fs.existsSync(worksFile)) {
                        try {
                          const works = JSON.parse(fs.readFileSync(worksFile, 'utf-8'))
                          if (Array.isArray(works)) responseData.works.push(...works)
                        } catch (e) {}
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('Error loading data:', e)
              }
            } else if (fs.existsSync(oldDataPath)) {
              // Migration: Load from old data.json
              try {
                const data = JSON.parse(fs.readFileSync(oldDataPath, 'utf-8'))
                responseData.users = data.users || []
                responseData.samples = data.samples || []
                responseData.works = data.works || []
                responseData.ratings = data.ratings || []
                responseData.settings = data.settings || null
              } catch (e) {}
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
                    if (work.userId) {
                      if (!worksByUser[work.userId]) worksByUser[work.userId] = []
                      worksByUser[work.userId].push(work)
                    }
                  }
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
