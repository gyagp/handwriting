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
          const dataPath = resolve(__dirname, 'data.json')
          
          if (req.method === 'GET') {
            if (fs.existsSync(dataPath)) {
              const data = fs.readFileSync(dataPath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(data)
            } else {
              res.end(JSON.stringify({ samples: [], works: [], settings: null }))
            }
          } else if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => {
              body += chunk.toString()
            })
            req.on('end', () => {
              try {
                // 验证JSON格式
                JSON.parse(body)
                fs.writeFileSync(dataPath, body)
                res.end('ok')
              } catch (e) {
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
