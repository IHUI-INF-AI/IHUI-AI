// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SHARED_UI_DIR = resolve(__dirname, '../../packages/shared/src/ui')

/**
 * `@ihui/shared/ui/*-spec` 是纯几何/结构源(不触 DOM/RN),别名必须指真实源码 ——
 * 给它写 mock 测的就是 mock。逐条手写已被证明会漏:漏配 intelligent-assistant-spec 时
 * 471 条用例照样"通过",而该组件的套件在收集期就炸(一条没跑)。所以按目录派生。
 */
const SHARED_UI_SPEC_ALIASES = Object.fromEntries(
  readdirSync(SHARED_UI_DIR)
    .filter((f) => f.endsWith('-spec.ts'))
    .map((f) => [`@ihui/shared/ui/${f.replace(/\.ts$/, '')}`, resolve(SHARED_UI_DIR, f)]),
)

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
      // expo-device 与 expo-file-system 同一死法:它的 build/Device.js `import { … } from 'expo-modules-core'`,
      // 而 pnpm 严格布局下 store 里 expo-device 的兄弟面没有 expo-modules-core ⇒ vite 解析失败,
      // **收集期即失败**("Test Files 1 failed / Tests no tests",一条断言都没跑;实测撤掉本条别名即此形)。
      // src/lib/device-fingerprint.ts 现按值取它的 modelId(iOS 机型段)⇒ 替身必须存在。
      'expo-device': resolve(__dirname, 'tests/__mocks__/expo-device.ts'),
      // react-native-restart 与本端其它原生包同一死法,但它是 2026-09-24 才加进 active-tokens.ts
      // 的依赖而**没同步本文件** ⇒ 既无 alias 也不在 inline:被外部化后由 Node 解析,其内部
      // require('react-native') 绕过 alias 命中真实 RN 的 Flow 源码 →
      // `SyntaxError: Unexpected token 'typeof'`,**收集期即失败**。因为 active-tokens 被屏/组件/
      // ThemeContext 顶层 import,破裂面是 14 个套件 / 131 条 it() 一条都没跑(theme-active-tokens
      // 那 3 条测的就是 active-tokens 本身,却唯一被这一条依赖挡在外面)。
      // 收口必须在配置层:上一轮只给 tests/terminal-delta-live.test.ts 加局部 vi.mock,于是每个
      // 新触到 active-tokens 的套件再破一次 —— 逐套件补丁正是本条要根治的反模式。
      'react-native-restart': resolve(__dirname, 'tests/__mocks__/react-native-restart.ts'),
      // 2026-09-29 收口(同一族第三格,范本 = 下方 ihui-shared-auth / sso-core 两条 +
      // tests/shared-auth-alias-fidelity.test.ts):'@ihui/api-client' 此前指到端内手写替身
      // tests/__mocks__/ihui-api-client.ts。实测该替身只给 14 个名字,而消费面(mobile-rn/src
      // 全部取用,现读)从 '@ihui/api-client' 具名取用 250 个(其中 157 个含运行时值,如
      // fetchApi / setUnauthorizedHandler / streamChat / refreshAccessTokenOnce)——凡走这个
      // 别名且不自带 vi.mock 的用例,测的都是虚构 API。
      // 真实包本就框架无关(全 src 唯一外部导入是 @ihui/types 且实测全部 type-only):
      // 网络走 setTransport 注入口(默认包一层全局 fetch),WS 走 webSocketFactory 形参,
      // token 走 setTokenProvider,Taro 专用实现拆在 voice-stt.taro.ts 深路径——平台边界本来就是
      // adapter 注入(§3 工厂/DI),不存在"必须重写一份业务逻辑"的格子。故别名直指真实源码;
      // 替身降级为纯转发(同 ihui-shared-auth.ts 的处置:不删、只转发,防止别名被指回时长出
      // 第二份实现)。常驻锁:tests/api-client-alias-fidelity.test.ts。
      // 子路径别名必须排在父别名之前(最长匹配优先,同 @ihui/shared 各条的登记):
      // StudyPublishScreen / SubagentsScreen 按 '@ihui/api-client/endpoints/*' 深路径导入,
      // Metro 侧经 exports './endpoints/*' 解析到真实端点文件;被父别名吞掉会改写成
      // <index.ts>/endpoints/… 而解析失败。
      '@ihui/api-client/endpoints': resolve(__dirname, '../../packages/api-client/src/endpoints'),
      '@ihui/api-client': resolve(__dirname, '../../packages/api-client/src/index.ts'),
      // Sub-path aliases must come BEFORE their parent/base alias (longest match first)
      // 2026-09-28 收口(G-364):sso-core 从"手写替身"改为直指真实源码 —— 与同文件
      // app-control-intent / stores 那两条同一条规矩(纯逻辑模块,给它写 mock 测的就是 mock)。
      // 旧替身 ihui-shared-auth-sso-core.ts 只导出 startSSOFlow / parseSSOResponse /
      // SsoCoreOptions,这三个在真实 packages/shared/src/auth/sso-core.ts 里根本不存在;
      // 而本端真实消费方 src/lib/sso.ts 引的是 exchangeSsoCode / extractSsoCode /
      // buildSsoLoginUrl —— 替身一个都没导出,指到替身就是 undefined。sso-core 文件头自述
      // "纯逻辑,零平台依赖,仅依赖 fetch + URL"(jsdom 下具备),所以它不需要替身。
      '@ihui/shared/auth/sso-core': resolve(
        __dirname,
        '../../packages/shared/src/auth/sso-core.ts',
      ),
      // 2026-09-28 收口(G-364):auth 同上,从"手写替身"改为直指真实工厂(barrel index.ts)。
      // 旧替身 ihui-shared-auth.ts 与本端真实实现三处不同形,任一处都会让"测替身"伪装成
      // "测实现":① createInMemoryTokenStore 是同步版,忽略 onSetToken/onSetRefreshToken/
      // onClearAll 全部持久化回调;② 没有 setCachedWithoutPersist(真实 src/lib/token.ts 的
      // initApi() 靠它做 hydrate ⇒ 用替身跑真会 TypeError);③ 只声明 TokenStoreConfig,而
      // 真实类型名是 InMemoryTokenStoreOptions(TokenStoreWithUserInfo 也缺)。
      // 证据:auth-cold-start-after-logout.test.ts / auth-single-credential-source.test.ts
      // 的文件头"取材纪律"明写"别名仍是手写替身 ⇒ 必须自带 vi.mock 才测得到实现",
      // 本条收口正是把那个 vi.mock 绕道补成默认正确。
      // 2026-09-29 收口(G-365 另一半):冷启动静默重登判据的唯一实现住在共享层,端内那份
      // 已降级成 re-export。这一条必须排在 '@ihui/shared/auth' 之前 —— 父别名按 startsWith
      // 吞子路径是本文件上方反复登记过的陷阱;指向真实源码而不是替身,因为测的就是这条判据。
      '@ihui/shared/auth/auto-login-policy': resolve(
        __dirname,
        '../../packages/shared/src/auth/auto-login-policy.ts',
      ),
      // 票 #27:「记住登录」记录的唯一编解码出口(纯函数,零平台依赖)。同样必须排在
      // '@ihui/shared/auth' 之前 —— 父别名按 startsWith 会把子路径吞成 <index.ts>/remembered-account。
      // 指真实源码而不是替身:给它写 mock,测的就是 mock(同上方两条先例)。
      '@ihui/shared/auth/remembered-account': resolve(
        __dirname,
        '../../packages/shared/src/auth/remembered-account.ts',
      ),
      '@ihui/shared/auth': resolve(__dirname, '../../packages/shared/src/auth/index.ts'),
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
      // G-853:平移钳制的共享出口。必须排在下面的 '@ihui/shared/utils' 父别名**之前** ——
      // 父别名按 startsWith 会把这条子路径吞成 <mock>/image-preview-offset(收集期 MODULE_NOT_FOUND)。
      // 与 date-utils / app-control-intent 同一处理,原因写在该两条的注释里。
      '@ihui/shared/utils/image-preview-offset': resolve(
        __dirname,
        '../../packages/shared/src/utils/image-preview-offset.ts',
      ),
      '@ihui/shared/utils': resolve(__dirname, 'tests/__mocks__/ihui-shared-utils.ts'),
      '@ihui/shared/hooks': resolve(__dirname, 'tests/__mocks__/ihui-shared-hooks.ts'),
      // 2026-09-27 收口:stores 从"手写替身"改为直指真实工厂。
      // 旧替身自己实现了一份 createAuthStore/createThemeStore,与真实工厂**语义不同形**——
      // 最要命的是 hydrate:替身对 tokenStore 返回 null 是"跳过保留旧值"
      // (`if (t !== null) _token = t`),真实工厂是"覆盖并派生 isAuthenticated: !!token"。
      // 于是任何用替身写的凭据用例证明的都是 mock 而不是实现(登录态清没清、
      // isAuthenticated 有没有跟着 token 走,两条都判反),而这条正是"显式登出后冷启动
      // 会不会自动登录"要用的那条链 —— 与 @ihui/shared/utils/app-control-intent 同一条规矩:
      // 给它写 mock,测的就是 mock。
      // 真实 stores 按自身文件头声明"零运行时依赖:除 zustand 外不依赖任何端特定 API
      // (@ihui/api-client 仅类型)",所以它不需要替身;各端的存储差异本来就靠注入
      // transport / tokenStore adapter 表达(内存版见 packages/shared/src/stores/transport.ts)。
      '@ihui/shared/stores': resolve(__dirname, '../../packages/shared/src/stores/index.ts'),
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
      // 票 #27:storage key 的唯一真相。barrel 那一条别名此前指到端内替身(它手抄了一个子集,
      // 还把 FALLBACK_MODELS / SSO_CLIENT_IDS 刻意清空)——那正是 #32 同族的一格,本条已收口:
      // 真实 `packages/shared/src/constants/index.ts` 只做常量再导出(唯一的外部引用是
      // model-catalog 的 `import type`,编译期擦除),平台无关 ⇒ 别名直指真实源码,
      // 与同文件 auth / chat / ui / api-client 各条同一条规矩(纯逻辑/纯常量给它写 mock,测的就是 mock)。
      // 子路径别名仍排在前面(最长匹配优先,父别名按 startsWith 会吞子路径)。
      '@ihui/shared/constants/storage-keys': resolve(
        __dirname,
        '../../packages/shared/src/constants/storage-keys.ts',
      ),
      '@ihui/shared/constants': resolve(__dirname, '../../packages/shared/src/constants/index.ts'),
      // D111:权限档展示为纯逻辑模块(chat barrel 无 DOM/RN 依赖),指向真实源码而非 mock ——
      // 档位取词的价值就是"三端同源",给它写 mock 测的就是 mock。子路径 alias 必须在根 alias 前。
      // 子路径别名必须排在父路径之前(最长匹配优先,同 @ihui/shared/utils 的注释)。
      // D64② 接线回归:imagePreview 判据直连真实 element-pack,不写 mock(测 mock 即测假)。
      '@ihui/shared/chat/element-pack': resolve(
        __dirname,
        '../../packages/shared/src/chat/element-pack.ts',
      ),
      // D20 会话置顶:conversation-pin 同为纯逻辑(不触网络/DOM),必须指向真实源码 ——
      // 给它写 mock 测的就是 mock(同 app-control-intent 的理由)。子路径 alias 排在
      // '@ihui/shared/chat' 父路径之前(最长匹配优先)。
      '@ihui/shared/chat/conversation-pin': resolve(
        __dirname,
        '../../packages/shared/src/chat/conversation-pin.ts',
      ),
      '@ihui/shared/chat': resolve(__dirname, '../../packages/shared/src/chat/index.ts'),
      // O81 票③:shared 包新增 './ui' 子路径导出(barrel + 纯 spec 模块,无 DOM/RN 依赖),
      // 当时漏配别名 ⇒ 父别名 '@ihui/shared' 按 startsWith(pattern+'/') 吞掉 '@ihui/shared/ui',
      // 改写成 <mock ihui-shared.ts>/ui 而解析失败(BackChevron.tsx / VoiceInput.tsx 等收集期即炸)。
      // 派生表见文件头 SHARED_UI_SPEC_ALIASES;必须整体排在 '@ihui/shared/ui' 与 '@ihui/shared'
      // 之前(最长匹配优先)。
      ...SHARED_UI_SPEC_ALIASES,
      '@ihui/shared/ui': resolve(__dirname, '../../packages/shared/src/ui/index.ts'),
      // D28 补齐层(2026-10-03):「用场景分析」的判据与场景目录已从 web 下沉到
      // @ihui/shared/import-analysis{,/scenarios}。两条都必须排在下面的
      // '@ihui/shared' 兜底 mock 之前 —— 父别名按 startsWith(pattern+'/') 匹配,
      // 会把子路径吞进 <mock ihui-shared.ts>/import-analysis 而解析失败
      // (rn-app 的 ImportAnalysisSheet 收集期即炸,与 ui 那次同型)。
      // 指真实源码而非 mock:判据是纯函数(无 DOM/RN 依赖),给它写 mock 测的就是 mock。
      '@ihui/shared/import-analysis/scenarios': resolve(
        __dirname,
        '../../packages/shared/src/import-analysis/scenarios.ts',
      ),
      '@ihui/shared/import-analysis': resolve(
        __dirname,
        '../../packages/shared/src/import-analysis/provenance.ts',
      ),
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
