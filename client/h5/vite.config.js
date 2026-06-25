import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 支持通过环境变量配置 base 路径
// 如果部署在子目录，设置 VITE_BASE_PATH 环境变量，如：VITE_BASE_PATH=/dist/
// 如果部署在根目录，使用 '/' 或不设置
const basePath = process.env.VITE_BASE_PATH || '/dist/'

export default defineConfig({
  base: basePath,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/api': {
        target: 'https://kou.aizhs.top',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vue': ['vue'],
          'axios': ['axios']
        }
      }
    }
  }
})
