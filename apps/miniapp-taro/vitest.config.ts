// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig, type Plugin } from 'vitest/config'
import path from 'path'

// 2026-11-06:JSX 运行时按模块来源分派。
//
// 根因:薄壳页(`src/pkg-content/**`)与 RN 壳(`apps/mobile-rn`,react@19.2.8)的 JSX
// 各自按所在包解析 `react/jsx-runtime`,而本套件用端内 react-dom@18 做 SSR ⇒ 19 元素
// 进 18 渲染器,报 "Objects are not valid as a React child"。
// 上面 `/^react$/` 只精确匹配包名,拦不住子路径 ⇒ 这里把两条子路径统一钉到端内
// react@18,与 `/^react$/`、react-dom@18 对齐。
//
// 例外:`packages/app` 自带 react@19,且其契约测试(chat-*-contract 等)显式
// `vi.mock('react')` 到 React19 并用同源 react-dom@19 SSR ⇒ 这些模块必须保留自解析,
// 否则测试侧单实例与渲染器版本错配。故只对 `packages/app` 之外(小程序页/RN 壳/
// packages/shared/tests 桩)生效。
const react18JsxRuntime: Plugin = {
  name: 'miniapp-react18-jsx-runtime',
  enforce: 'pre',
  resolveId(source, importer) {
    const replacement =
      source === 'react/jsx-runtime'
        ? path.resolve(__dirname, 'node_modules/react/jsx-runtime.js')
        : source === 'react/jsx-dev-runtime'
          ? path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js')
          : null
    if (!replacement) return null
    if (importer && importer.replace(/\\/g, '/').includes('/packages/app/')) return null
    return replacement
  },
}

export default defineConfig({
  plugins: [react18JsxRuntime],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // RN 壳目录(与 config/index.ts 的构建别名同源,2026-11-01 补):壳承载页以
      // `@rn-shells/<Name>` 直引 apps/mobile-rn/src/screens/*。构建侧早就配了这条,
      // 测试侧漏配 ⇒ vitest 解析不到,CI 实测 FAIL tests/dev-space-page-render.test.tsx
      // "Cannot find package '@rn-shells/DeveloperScreen'"。两处必须同源,否则"能构建、
      // 不能测"这种半边绿会一直存在。
      {
        find: '@rn-shells',
        replacement: path.resolve(__dirname, '../../apps/mobile-rn/src/screens'),
      },
      // 共享屏真源(packages/app)与构建别名同源:壳承载页按
      // `@ihui/rn-app/features/<dir>/<Screen>` 具体子路径直引。测试侧同配,
      // 否则 vitest 解析不到,页面级用例只能靠 mock 字符串硬编码。
      {
        find: '@ihui/rn-app',
        replacement: path.resolve(__dirname, '../../packages/app/src'),
      },
      // 强制 react / react-dom 单实例(dual React 问题):
      // @ihui/shared 源码从 packages/shared 上下文解析 react → react@19.0.0,
      // 而 react-dom@18.3.1 从 apps/miniapp-taro 上下文解析 react → react@18.3.1。
      // 两个 react 实例导致 useState 内部 dispatcher 为 null(Cannot read properties of null)。
      // 此 alias 拦截整个模块图的 react/react-dom import,统一解析到 miniapp-taro 的 react@18.3.1。
      // RegExp ^react$ 精确匹配包名 'react',不匹配 'react-dom' / 'react/jsx-runtime'。
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      // JSX 子路径(`react/jsx-runtime`)由文件顶部的 react18JsxRuntime 插件按来源分派,
      // 不能放这里:alias 无 importer 信息,会把 packages/app 的 React19 契约测试一起改写。
      // A2(2026-11-05):薄壳页会 import @ihui/rn-app 共享屏(RN 原语)。主树 pnpm
      // 链接面缺 react-native/index.js,node 测试里把裸包指到 DOM 桩(只切平台依赖)。
      {
        find: /^react-native$/,
        replacement: path.resolve(__dirname, 'tests/stubs/react-native.ts'),
      },
      // react-native-svg 同型(2026-11-06):共享屏的图标来自 lucide-react-native,其
      // Icon.mjs 静态引 'react-native-svg';该依赖内部再 require('react-native')。两条
      // 都是裸包 ⇒ 必须一并切到 DOM 桩,否则 Node 解析到真包 Flow 源码
      // (`import typeof * as ...`),收集期 SyntaxError: Unexpected token 'typeof'。
      // 配合下面 server.deps.inline 让 lucide 走 vite 模块图(否则外部化后 alias 够不着)。
      {
        find: /^react-native-svg$/,
        replacement: path.resolve(__dirname, 'tests/stubs/react-native-svg.ts'),
      },
      // 2026-11-06 同族:AsyncStorage 的 lib/commonjs 内部 require('react-native'),同理
      // 绕 alias 落到真包 Flow 源码。切到内存键值桩(只切平台依赖,不动判据)。
      {
        find: /^@react-native-async-storage\/async-storage$/,
        replacement: path.resolve(__dirname, 'tests/stubs/async-storage.ts'),
      },
      // 2026-11-06 同族(第三组):RN 共享屏在模块求值期就会碰到的三个原生包 —— 主题偏好
      // 文件(expo-file-system)、主题重载(react-native-restart)、色板(nativewind)。
      // 它们的入口同样 require('react-native'),在 Node 解析下绕过 alias ⇒ 收集期
      // SyntaxError。三个都切到同名桩(只保留测试需要的形参/内存语义)。
      {
        find: /^expo-file-system(\/.*)?$/,
        replacement: path.resolve(__dirname, 'tests/stubs/expo-file-system.ts'),
      },
      {
        find: /^react-native-restart$/,
        replacement: path.resolve(__dirname, 'tests/stubs/react-native-restart.ts'),
      },
      {
        find: /^nativewind$/,
        replacement: path.resolve(__dirname, 'tests/stubs/nativewind.ts'),
      },
      // 2026-11-06 同族(第四组):薄壳页真加载 RN 壳时引导航族。该包 index 会拉
      // createStandardNavigationFactories.js → `standard-navigation`,而 pnpm 链接面里
      // 该包未在 @react-navigation/native 内落链(require.resolve 直接 ERR),外部化/内联
      // 两条路径都在收集期抛 SyntaxError: Unexpected token 'typeof'。node 环境本就渲染不了
      // 导航容器 ⇒ 切到 no-op 形状桩(hook 形状与真实一致,动作空实现),判据不变。
      {
        find: /^@react-navigation\/native$/,
        replacement: path.resolve(__dirname, 'tests/stubs/react-navigation-native.ts'),
      },
      // 2026-11-06:lucide-react-native 按「本仓实际引用的 142 个图标名」生成同名桩。
      // 真包 index 会 re-export 约 1600 个图标模块,其 Icon.mjs 又静态引 react-native-svg
      // (后者 require('react-native'))⇒ 外部化时收集期 SyntaxError: Unexpected token
      // 'typeof';改 inline 则单套件 collect 从 1.9s 涨到 312s(实测)。桩只切平台依赖,
      // 断言判据不变。新增图标 import 需同步补桩(见该文件顶部口径)。
      {
        find: /^lucide-react-native$/,
        replacement: path.resolve(__dirname, 'tests/stubs/lucide-react-native.ts'),
      },
      // D28 补齐层(2026-10-03):「用场景分析」的判据与场景目录已从 web 下沉到
      // @ihui/shared/import-analysis{,/scenarios}。指真实源码而非 mock:判据与目录
      // 都是纯数据/纯函数(无 DOM/Taro 依赖),给它写 mock 测的就是 mock。
      // 两条按最长匹配在前(scenarios 在前),与 shared 其余子路径同一规矩。
      {
        find: '@ihui/shared/import-analysis/scenarios',
        replacement: path.resolve(
          __dirname,
          '../../packages/shared/src/import-analysis/scenarios.ts',
        ),
      },
      {
        find: '@ihui/shared/import-analysis',
        replacement: path.resolve(
          __dirname,
          '../../packages/shared/src/import-analysis/provenance.ts',
        ),
      },
    ],
  },
  test: {
    // 2026-10-05:CI 的 Test 步是 `pnpm turbo run test` 并行跑所有包,runner 争用下 vitest 默认 5000ms
    // 会把纯 I/O 用例判成超时(required 检查 run 37294883676 实测 "Test timed out in 5000ms")。
    // 取与 apps/api / apps/cli 已有的 15_000 同档 —— 这是**资源预算**,不改任何判据与用例内容。
    testTimeout: 15_000,
    environment: 'node',
    // 2026-11-06:zustand 默认被外部化,由 Node 直接加载 ⇒ 它内部的 `import 'react'` 走
    // Node 解析,落到 packages/shared 的 peer 上下文(react@19),而本套件渲染用的是
    // react-dom@18 ⇒ 双 React 实例,useCallback 读到 null dispatcher(实测
    // theme-store.ts:165 → react.development.js:1204 报错)。inline 后走 vite 模块图,
    // 上面的 /^react$/ 单实例 alias 生效;只影响测试运行时,不改任何判据。
    server: {
      deps: {
        inline: ['zustand'],
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    // 2026-10-03(G-1018201)'**/.ihui-agent/**':挡掉 .ihui-agent/tmp/ 里他人留下的 HEAD 整仓副本
    // ——vitest 4.1.10 收集面显式 `dot: true`,点目录被主动穿透,副本里同形的用例会被收进当次
    // 运行(apps/web 实测 484 → 687 份)。`.gitignore` 只管 git,拦不住文件系统 glob。
    // `**/` 前缀不可省:实测 `.ihui-agent/**` 会放过 `src/x/.ihui-agent/**` 这类嵌套落点。
    exclude: ['**/.ihui-agent/**'],
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
