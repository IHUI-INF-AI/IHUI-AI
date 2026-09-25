// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
      // nativewind 真实入口拉 react-native-css-interop(原生依赖),vitest 下解析失败会让整个
      // 测试文件加载不进来。src/context/ThemeContext.tsx 现在要同步它的 colorScheme store
      // (否则全端 dark: 类只跟系统外观、不跟 App 主题)⇒ 必须替身 + 可断言调用记录。
      nativewind: resolve(__dirname, 'tests/__mocks__/nativewind.ts'),
      'react-native-safe-area-context': resolve(
        __dirname,
        'tests/__mocks__/react-native-safe-area-context.ts',
      ),
      '@react-native-async-storage/async-storage': resolve(
        __dirname,
        'tests/__mocks__/async-storage.ts',
      ),
      '@ihui/design-tokens': resolve(__dirname, '../../packages/design-tokens/src/index.ts'),
      // expo-file-system 入口 import expo-modules-core(原生模块),vitest 下解析失败会
      // 让**整个测试文件加载不进来**(报 "Test Files N failed",但一条断言都没跑)。
      // src/theme/active-tokens.ts 与 5 个 screen 引它 ⇒ 替身必须存在。
      'expo-file-system': resolve(__dirname, 'tests/__mocks__/expo-file-system.ts'),
      // react-native-restart 与本端其它原生包同一死法,但它是 2026-09-24 才加进 active-tokens.ts
      // 的依赖而**没同步本文件** ⇒ 既无 alias 也不在 inline:被外部化后由 Node 解析,其内部
      // require('react-native') 绕过 alias 命中真实 RN 的 Flow 源码 →
      // `SyntaxError: Unexpected token 'typeof'`,**收集期即失败**。因为 active-tokens 被屏/组件/
      // ThemeContext 顶层 import,破裂面是 14 个套件 / 131 条 it() 一条都没跑(theme-active-tokens
      // 那 3 条测的就是 active-tokens 本身,却唯一被这一条依赖挡在外面)。
      // 收口必须在配置层:上一轮只给 tests/terminal-delta-live.test.ts 加局部 vi.mock,于是每个
      // 新触到 active-tokens 的套件再破一次 —— 逐套件补丁正是本条要根治的反模式。
      'react-native-restart': resolve(__dirname, 'tests/__mocks__/react-native-restart.ts'),
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
      // 纯逻辑模块,直接指向真实源码而非 mock:这条链路的全部价值就是"关键词判定四端同源",
      // 一旦给它写 mock,测的就是 mock。其余 @ihui/shared 子路径必须 mock(依赖 DOM/RN API),
      // 故不能照此办理。 Metro 侧同样按子路径 exports 解析(见 src/hooks/use-websocket.ts)。
      '@ihui/shared/utils/app-control-intent': resolve(
        __dirname,
        '../../packages/shared/src/utils/app-control-intent.ts',
      ),
      // 同上:投递定址判定也是纯逻辑(只读 assignment + 注入的身份),必须指向真实源码 ——
      // 给它写 mock 就等于"测 mock",而本票的全部意义是让五桥共用这一份实现。
      '@ihui/shared/utils/agent-action-addressing': resolve(
        __dirname,
        '../../packages/shared/src/utils/agent-action-addressing.ts',
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
      // D111:权限档展示为纯逻辑模块(chat barrel 无 DOM/RN 依赖),指向真实源码而非 mock ——
      // 档位取词的价值就是"三端同源",给它写 mock 测的就是 mock。子路径 alias 必须在根 alias 前。
      // 子路径别名必须排在父路径之前(最长匹配优先,同 @ihui/shared/utils 的注释)。
      // D64② 接线回归:imagePreview 判据直连真实 element-pack,不写 mock(测 mock 即测假)。
      '@ihui/shared/chat/element-pack': resolve(
        __dirname,
        '../../packages/shared/src/chat/element-pack.ts',
      ),
      '@ihui/shared/chat': resolve(__dirname, '../../packages/shared/src/chat/index.ts'),
      '@ihui/types/permission-mode': resolve(
        __dirname,
        '../../packages/types/src/permission-mode.ts',
      ),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
