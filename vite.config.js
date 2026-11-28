import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function devApiPlugin() {
  return {
    name: 'wishradar-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (!(key in process.env)) {
          process.env[key] = value
        }
      }

      server.middlewares.use('/api', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost')
          const name = url.pathname.replace(/^\/+/, '').split('/')[0]

          if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'API route not found' }))
            return
          }

          const handlerPath = path.resolve(process.cwd(), 'api', `${name}.js`)
          if (!fs.existsSync(handlerPath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Unknown API route: /api/${name}` }))
            return
          }

          let body
          if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            const chunks = []
            for await (const chunk of req) {
              chunks.push(chunk)
            }
            const raw = Buffer.concat(chunks).toString('utf8')
            if (raw) {
              try {
                body = JSON.parse(raw)
              } catch {
                body = raw
              }
            }
          }

          const reqAdapter = {
            method: req.method || 'GET',
            headers: req.headers,
            query: Object.fromEntries(url.searchParams.entries()),
            body,
            socket: req.socket,
          }

          const resAdapter = {
            setHeader(k, v) {
              res.setHeader(k, v)
              return resAdapter
            },
            status(code) {
              res.statusCode = code
              return resAdapter
            },
            json(obj) {
              if (!res.getHeader('Content-Type')) {
                res.setHeader('Content-Type', 'application/json')
              }
              res.end(JSON.stringify(obj))
              return resAdapter
            },
            end(chunk) {
              res.end(chunk)
              return resAdapter
            },
          }

          const mod = await import(pathToFileURL(handlerPath).href)
          if (typeof mod.default !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: `Invalid handler in /api/${name}` }))
            return
          }

          await mod.default(reqAdapter, resAdapter)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || 'Internal dev API error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
})
