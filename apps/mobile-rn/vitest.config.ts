import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': resolve(__dirname, 'tests/__mocks__/react-native.ts'),
      // 2026-08-28 修复:lucide-react-native(Icon.mjs)import react-native-svg,
      // 真实包入口指向 Flow 源码导致 esbuild SyntaxError 'typeof' → 5 suite 加载失败。
      // mock 为渲染原生 SVG DOM 标签的 stub 组件(需配合 server.deps.inline)。
      'react-native-svg': resolve(__dirname, 'tests/__mocks__/react-native-svg.ts'),
      'react-native-safe-area-context': resolve(
        __dirname,
        'tests/__mocks__/react-native-safe-area-context.ts',
      ),
      '@react-native-async-storage/async-storage': resolve(
        __dirname,
        'tests/__mocks__/async-storage.ts',
      ),
      '@ihui/design-tokens': resolve(__dirname, 'tests/__mocks__/design-tokens.ts'),
      '@ihui/api-client': resolve(__dirname, 'tests/__mocks__/ihui-api-client.ts'),
      // Sub-path aliases must come BEFORE their parent/base alias (longest match first)
      '@ihui/shared/auth/sso-core': resolve(
        __dirname,
        'tests/__mocks__/ihui-shared-auth-sso-core.ts',
      ),
      '@ihui/shared/auth': resolve(__dirname, 'tests/__mocks__/ihui-shared-auth.ts'),
      '@ihui/shared/utils/date-utils': resolve(
        __dirname,
        'tests/__mocks__/ihui-shared-utils-date-utils.ts',
      ),
      '@ihui/shared/utils': resolve(__dirname, 'tests/__mocks__/ihui-shared-utils.ts'),
      '@ihui/shared/hooks': resolve(__dirname, 'tests/__mocks__/ihui-shared-hooks.ts'),
      '@ihui/shared/stores': resolve(__dirname, 'tests/__mocks__/ihui-shared-stores.ts'),
      '@ihui/shared/notifications/notification-store': resolve(
        __dirname,
        'tests/__mocks__/ihui-shared-notif-store.tsx',
      ),
      '@ihui/shared/notifications/use-notification-websocket': resolve(
        __dirname,
        'tests/__mocks__/ihui-shared-notif-ws.ts',
      ),
      '@ihui/shared/tasks/dispatch': resolve(
        __dirname,
        'tests/__mocks__/ihui-shared-tasks-dispatch.ts',
      ),
      '@ihui/shared/constants': resolve(__dirname, 'tests/__mocks__/ihui-shared.ts'),
      // Base alias last so it only catches direct @ihui/shared imports
      '@ihui/shared': resolve(__dirname, 'tests/__mocks__/ihui-shared.ts'),
      '@ihui/types': resolve(__dirname, 'tests/__mocks__/ihui-types.ts'),
      '@ihui/rn-app': resolve(__dirname, 'tests/__mocks__/ihui-rn-app.ts'),
      '@react-native-clipboard/clipboard': resolve(
        __dirname,
        'tests/__mocks__/react-native-clipboard.ts',
      ),
    },
  },
  test: {
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/tests/**/*.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/.git/**', 'dist/**', 'tests/*-debug*.test.tsx'],
    environment: 'jsdom',
    // 固定测试环境变量:Vitest 会自动加载 .env 注入 process.env,
    // 若开发者本地 .env 指向生产域名(如 EXPO_PUBLIC_API_BASE_URL),会导致
    // 依赖默认值的测试(如 config.ts 的 localhost:8802)非确定性失败。
    // 此处显式覆盖,保证测试环境始终确定性。
    env: {
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:8802',
      EXPO_PUBLIC_WEB_URL: 'http://localhost:8801',
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10_000,
    server: {
      deps: {
        inline: [
          'react-native',
          // lucide-react-native 是 node_modules ESM,若被 vitest 外部化,
          // 其内部的 import 'react-native-svg' 走 node 原生解析(不经过 alias),
          // 仍会命中真实包的 Flow 源码 → 必须与 react-native-svg 一起 inline
          'lucide-react-native',
          'react-native-svg',
          '@react-navigation/native',
          '@react-navigation/native-stack',
          '@ihui/api-client',
          'react-native-safe-area-context',
          '@ihui/shared',
        ],
      },
    },
  },
})
