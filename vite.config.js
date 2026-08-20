/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: command === 'serve' ? '/' : '/ascii-game-frontend/',

    define: {
      API_BASE: JSON.stringify(
        command === 'serve'
          ? '' // local dev uses proxy
          : env.VITE_API_URL
      )
    },

    plugins: [react()],

    test: {
      globals: true,
      environment: 'node',
    },

    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_URL,
          changeOrigin: true,
          secure: true,
        }
      }
    }
  }
})