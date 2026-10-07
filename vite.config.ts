import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { resumeApi } from './server/resumes'
export default defineConfig({
  plugins: [react(), tailwindcss(), resumeApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: { manualChunks: { markdown: ['react-markdown', 'remark-gfm'], ui: ['radix-ui'] } },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
})
