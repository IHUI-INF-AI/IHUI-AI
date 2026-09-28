<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# packages/shared — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/shared` 是跨端复用层:平台无关的 hook、store 工厂、工具函数、领域常量与业务判据。
策略表里 `layer: composite` / `exported: true` / `managed: true`,所以它**是**对外面 —— 各端直接
按子路径 import。已验证的消费面(`git grep -l "from '@ihui/shared" HEAD -- <端>` 的文件数):
apps/web 283、apps/mobile-rn 128、apps/miniapp-taro 88、apps/api 43、apps/extension 36、apps/cli 18、
packages/app 3。`packages/ui-react` 与 `packages/ui-native` 对它零 import —— 组件不在这个包里。

## 2. 入口与结构现实

- `package.json` 的 `main`/`module`/`types` 全部指向 `./src/index.ts`(源码直给,消费端不做 dist 解析)。
- `exports` 表有 41 条子路径(`.`、`./ui`、`./auth`、`./chat`、`./hooks`、`./utils`、`./stores`、
  `./constants`、`./skills/*`、`./tasks/*`、`./design/*` 等),`src/index.ts` 用 `export *` 转出 21 个目录。
- `src/` 实际 24 个目录。**两个不在 barrel 里**:`src/ui/`(`*-spec.ts` 几何/圆角档,只走 `./ui` 与
  `./ui/*` 子路径)与 `src/agent/`(见 §4)。
- 代表实现:`src/hooks/index.ts`(剪贴板/防抖/分页/表单/聊天运行态)、`src/stores/`
  (`createAuthStore` / `createThemeStore` + `create{Memory,Sync,Async,Json}Transport`)、
  `src/utils/`(日期、格式化、危险命令探测、`redact.ts`、`error-messages.ts`、`ssrf-guard.ts`)、
  `src/chat/`(队列、上下文装载、工具状态)、`src/spec/`、`src/plan/`、`src/subagents/`。

## 3. 依赖方向与边界

策略表声明 `requires: packages/types, packages/api-client, packages/design-tokens`;
运行时依赖只有 `zod` / `zustand` / `xstate`,`react` 是 peerDependency(`>=18`)—— 这是"不得带平台 API 进来"
的物质保证。守门 126 `scripts/check-shared-nonde-node-purity.mjs`(blocking)按入口可达闭包判 `node:` 内建。

AGENTS §3 在本模块的具体化:写新 hook/util 前先查这里;各端 `hooks/`、`lib/`、`stores/` 只允许
**re-export wrapper + 平台 adapter**,不得重新实现。实测正例:`apps/miniapp-taro/src/stores/storage-adapter.ts`
的 `createTaroStorageTransport()` 与 `apps/mobile-rn/src/stores/storage-adapter.ts` 都是把端侧 storage
喂给本包的 `PersistTransport` 工厂。跨端能力一律走**工厂 + 注入**(`createUseClipboard(impl)`、
`createAuthStore<TUser>(...)`),不得在本包写 `if (Platform.OS === 'web')`。
守门 40 `scripts/check-shared-layer-duplication.mjs`(blocking)判端内 export 名与本包 export 名求交集。
守门 149 `scripts/check-package-barrel-export.mjs`(blocking)判"符号存在但入口没递出来"。

## 4. 已知缺口 / 未收口的点

- `src/agent/doom-loop-detector.ts` 是唯一的卡死反思算法源,但 `exports` 表**没有** `./agent/*` 条目。
  现状是经 `src/utils/doom-loop-detector.ts` 这行"可导入桥"转发给 apps/cli;桥文件头注写明收口出口
  (补 `./agent/*` → 删桥 → 消费端改回子路径)。package.json 属本票禁改区,该债仍在。
- `src/utils/ssrf-guard.ts` 第 24-25 行 import `node:dns`。守门 126 现读:`含内建文件 1(不可达 1)` ——
  它不在 barrel 闭包内,只有 apps/cli 经 `@ihui/shared/utils/ssrf-guard` 子路径取用(7 处)。
  **不得**把它补进 `utils/index.ts`:那会让 web/小程序/RN 四个宿主立刻拿到一个 Node-only 依赖。
- `src/chat/file-tool-intent.ts`(`FILE_READ_INTENT_TOOLS` / `FILE_WRITE_INTENT_TOOLS`,能力清单)刻意
  **不进** `src/chat/index.ts`,因为 `task-status.ts` 已有同词不同义的 `FILE_WRITE_TOOLS`(识别白名单);
  `chat/index.ts` 第 114-116 行留了说明,反向锁在 `chat/__tests__/file-tool-intent.test.ts`。
- 未取证:本包 dist 是否被任何宿主按产物路径解析(我只验了 `main` 指向 `src/index.ts`);
  各子路径的**内容**契约未逐条核对,本节只登记结构与依赖方向。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
