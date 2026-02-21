import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/ascii-game-frontend/',

  define: {
    API_BASE: JSON.stringify(
      command === 'serve'
        ? '' // local dev uses proxy
        : 'https://game-backend.callawayservice.com'
    )
  },

  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'https://game-backend.callawayservice.com',
        changeOrigin: true,
        secure: true,
      }
    }
  }
}))