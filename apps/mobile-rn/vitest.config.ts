import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': resolve(__dirname, 'tests/__mocks__/react-native.ts'),
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
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10_000,
    server: {
      deps: {
        inline: [
          'react-native',
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
