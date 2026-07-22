import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri dev 默认用 1420 端口,固定端口便于 src-tauri 引用
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 3006,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
  },
})
