import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Matches the API server's own default; set API_PORT on both to run this
// project alongside another one that already owns 3001.
const API_PORT = process.env.API_PORT || 3001

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://localhost:${API_PORT}`
    }
  }
})
