import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // 强制 react / react-dom 单实例(dual React 问题):
      // @ihui/shared 源码从 packages/shared 上下文解析 react → react@19.0.0,
      // 而 react-dom@18.3.1 从 apps/miniapp-taro 上下文解析 react → react@18.3.1。
      // 两个 react 实例导致 useState 内部 dispatcher 为 null(Cannot read properties of null)。
      // 此 alias 拦截整个模块图的 react/react-dom import,统一解析到 miniapp-taro 的 react@18.3.1。
      // RegExp ^react$ 精确匹配包名 'react',不匹配 'react-dom' / 'react/jsx-runtime'。
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
})
