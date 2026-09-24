import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Matches the API server's own default; set API_PORT on both to run this
// project alongside another one that already owns 3001.
const API_PORT = process.env.API_PORT || 3001

const PRINTER_SCRIPTS = [
  'install-card-printer.ps1',
  'watch-and-print.ps1',
  'print-cards.ps1',
]

// Publishes the card-printing scripts at /setup/ so a new printing PC can fetch
// them from the site instead of needing access to the repository.
//
// They are copied from scripts/ at build time rather than kept in public/,
// because a second copy in the tree is a copy that quietly stops matching the
// one that is actually maintained.
//
// Static files are matched before the SPA rewrite in vercel.json, so these are
// served as files rather than being swallowed by the catch-all.
function printerScripts() {
  const dir = () => path.resolve(process.cwd(), 'scripts')
  return {
    name: 'printer-scripts',
    // Served in dev too, so the download links can be tested without deploying.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\/setup\//, '')
        if (!req.url?.startsWith('/setup/') || !PRINTER_SCRIPTS.includes(name)) return next()
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
        res.end(fs.readFileSync(path.join(dir(), name)))
      })
    },
    closeBundle() {
      const out = path.resolve(process.cwd(), 'dist/setup')
      fs.mkdirSync(out, { recursive: true })
      for (const f of PRINTER_SCRIPTS) fs.copyFileSync(path.join(dir(), f), path.join(out, f))
    },
  }
}

export default defineConfig({
  plugins: [react(), printerScripts()],
  server: {
    proxy: {
      '/api': `http://localhost:${API_PORT}`
    }
  }
})
