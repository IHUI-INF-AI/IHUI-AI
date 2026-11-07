// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// vitest 配置(packages/app = @ihui/rn-app)。
//
// 立因(2026-11-01):本包此前无 vitest 配置,靠 vitest 默认值跑;绝大多数用例自带
// `vi.mock('react-native', …)` 因而能过。但触到 feature 屏(ContextUsagePanel / CourseScreen /
// AgentChatScreen 等)的用例会经 `lucide-react-native` → `react-native-svg` → `react-native`
// 这条**node_modules ESM 链**把真 RN 的 Flow 源码(`react-native/index.js` 的 `import typeof`)
// 拖进收集期 ⇒ `RollupError: Parse failure: Expected 'from', got 'typeOf'`,整份套件一条断言都跑不了。
//
// 判据与处置同 apps/mobile-rn/vitest.config.ts 那两条既有注释:
//   ① 被外部化的 node_modules(rn 系)走 Node 原生解析,**绕过 vi.mock 与 alias** ⇒ 必须 inline;
//   ② inline 后由 vite 转换,仍需 alias 到 mock(真包是 Flow 语法,esbuild/rollup 解析不了)。
// 替身复用 apps/mobile-rn/tests/__mocks__ 的唯一一份(§22c 单一真相源:不复制第二份 mock)。
//
// ■ 测试发现范围(2026-11-06 实测留痕,勿删):
//   本文件存在即**优先于** packages/app/package.json:54-56 的 `vitest.include`
//   (`src/**/__tests__/**/*.test.{ts,tsx}`);本 config **没有** `include` 字段 ⇒ 走 vitest
//   默认 glob,才会扫到 `packages/app/tests/`。当前靠这条机制被发现的契约用例:
//     · tests/chat-shell-anchors.test.tsx —— 3 用例(槽序 status→queue→input / 尾注按 item.id 挂行后 / 尾注不串行)
//     · tests/chat-message-item-visual.test.tsx —— 6 用例(用户气泡与 AI 气泡 class / share 回落与 shareSlot 替换 /
//       versionMenuSlot 位置 / 共享件无平台 API)
//   ⚠ 任何人给本文件加 `include`,必须显式纳入 `tests/**/*.test.{ts,tsx}`;
//   否则上述用例(以及 tests/ 下整批既有用例)会**静默不跑**,全量仍显示绿 —— 已知的假绿入口。
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const RN_MOCK = resolve(__dirname, '../../apps/mobile-rn/tests/__mocks__/react-native.ts')
const RN_SVG_MOCK = resolve(__dirname, '../../apps/mobile-rn/tests/__mocks__/react-native-svg.ts')

export default defineConfig({
  resolve: {
    alias: {
      // 子路径/更长的键在前(最长匹配优先),与 mobile-rn 配置同一纪律
      'react-native-svg': RN_SVG_MOCK,
      'react-native': RN_MOCK,
    },
  },
  test: {
    environment: 'jsdom',
    // 这些 node_modules 若是 external,其内部的 import 'react-native' 走 Node 原生解析、
    // 不经过上面的 alias ⇒ 命中真 RN 的 Flow 源码,收集期即失败。inline 后由 vitest 转换,
    // alias 才生效。
    server: {
      deps: {
        inline: ['react-native', 'lucide-react-native', 'react-native-svg'],
      },
    },
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
