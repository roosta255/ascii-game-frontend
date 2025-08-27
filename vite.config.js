import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/ascii-game-frontend/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8081", // replace with your actual backend port
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
})
