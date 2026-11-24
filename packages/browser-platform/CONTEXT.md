<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/browser-platform — 契约与边界

一句话职责:浏览器平台 API 的**适配层接口定义**。把 `chrome.*`(extension)/ `window.*`(web)/
`webContents.*`(desktop)抽象成纯 TS 接口,让调用方只依赖接口、不依赖具体平台。
立门依据是 2026-07-27 审计的 93 处 `chrome.*` 调用点,识别出 5 类平台硬边界 + 11 个可抽象接口。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/browser-platform'" HEAD -- apps`)

8 个文件,**全部在 `apps/extension` 一个端**:

`entrypoints/background.ts`、`lib/agent-control.ts`、`lib/config.ts`、`lib/message-router.ts`、
`lib/token-utils.ts`、`lib/token.ts`、`src/hooks/use-system-theme.ts`(取 `type StorageChange`)、
`src/stores/storage-adapter.ts`。

8 处里有 7 处只调 `createChromePlatform()`(第 3 行即 `const platform = createChromePlatform()`)。
web / desktop / mobile-rn 目前**零引用**。

## 2. 公开面(package.json `exports` 只有 `"."`;`src/index.ts` 是接口面)

`main`/`types` 都指向 **`./src/index.ts`**(本包对外递出的是 TS 源,不是 dist —— 见 §4)。
`src/index.ts` 递出 5 个适配接口 + 1 个聚合接口 + 4 个共享类型 + 1 个工厂:

- 接口:`StorageAdapter`、`TabsAdapter`、`MessagingAdapter`、`RuntimeAdapter`、`SchedulerAdapter`、
  `BrowserPlatform`(聚合)
- 类型:`TabInfo`、`StorageChange`、`MessageSender`、`StorageArea`(`'local' | 'session'`)
- 实现:`export { createChromePlatform } from './chrome-impl.js'`(唯一实现,`src/chrome-impl.ts:266`)

接口文件里**不出现** `chrome` / `window` / `webContents` 字样 —— 这是本包存在的理由,
新增接口时不得把平台符号带进 `index.ts`。

## 3. 依赖方向与边界(`- id: 'packages/browser-platform'`)

`layer: platform` · `exported: true` · `managed: true` · `requires: []` · `public_entrypoints: ['.']`

- 运行时依赖为空(`dependencies: {}`),`@types/chrome` 只在 devDeps ⇒ 接口层零平台耦合是**可机检的事实**,
  不只是注释。`requires: []` 与现实一致。
- **硬边界不进适配层**(头注明文登记):`sidePanel` / `contextMenus` / `action` / `onInstalled` / `onStartup`
  留在 `apps/extension` 内。把它们塞进 `BrowserPlatform` 去求"8 端一致",会造出一个在其他端永远实现不出来的接口。
- 端内不得按 `@ihui/browser-platform/src/chrome-impl.js` 深导入(chrome 实现只能经 `createChromePlatform` 拿);
  也不得在端内自己再写一份 `chrome.storage` 封装而绕开 `StorageAdapter`。
- 新端接入的正确形态:**在包内新增 `web-impl.ts` / `tauri-impl.ts`,而不是在端里现搭一套同名接口** ——
  否则适配层退化成"extension 专用",这正是它声称要消除的东西。

## 4. 已知缺口 / 未收口的点

- **只有 chrome 一个实现。** `src/index.ts` 头注写着"实现层各自适配:chrome-impl.ts(extension)/
  web-impl.ts(后续)/ tauri-impl.ts(后续)",现读 `src/` 只有 `index.ts` + `chrome-impl.ts` 两个文件。
  所以包描述里的"供 extension/web/desktop/mobile-rn 复用"目前只兑现了 extension 一端。
- 递出 **TS 源**(`main: ./src/index.ts`),而 `scripts` 里又有 `build: tsc`(且 `clean` 会删 `dist`)。
  ⇒ `dist` 在消费链上无人读取,构建产物是装饰性的;真要发布 npm 需要先定"递源还是递 dist"。
  同形的还有 `@ihui/ui-native`、`@ihui/auth` 的某一面 —— 见各自 CONTEXT.md。
- **无测试**:包里既没有 `test` 脚本也没有 `tests/` 目录。接口与 chrome 实现是否同形目前只由 `tsc` 保证。
- 无自有 `eslint.config.*`(`lint` 脚本靠向上继承根配置),同 `dom-actions` 那一格。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
