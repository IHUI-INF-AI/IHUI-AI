<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# packages/ui-react — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/ui-react` 是 React(web 形态)组件库:`src/components/` 共 34 项(33 个组件文件 +
`login-form/` 目录),含 Card / Button / Input / Dialog / Sheet / Drawer / Select / Table / DataTable /
Tooltip / Upload / TreeSelect / LogViewer 等,供 React 宿主统一取用(AGENTS §4「复用
`packages/ui-react` 的 Card/Button/Input/Dialog」指的就是这里)。
策略表 `layer: composite` / `exported: true` / `managed: true`,`exports` 表**只有 `.` 一条**,
即唯一对外面是 barrel。已验证消费面(`git grep -l "from '@ihui/ui-react" HEAD -- <端>` 的文件数):
apps/web 1554、apps/extension 51;apps/cli、apps/desktop、packages/app、packages/ui-native、
apps/miniapp-taro、apps/mobile-rn 均为 0 —— **非 React(web 形态)宿主不得 import 本包**
(Taro / RN 各有自己的组件实现)。

## 2. 入口与结构现实

- `main`/`module`/`types` 指向 `./src/index.ts`,`build: tsc`(产出 `dist/`),但消费端按源码解析。
- `src/index.ts` 递出:`cn`、Esc 层栈(`pushOverlay` / `popOverlay` / `guardEscKeyDown`,2026-09-26 立的
  单栈协议)、`lucide-react` 全量 `export *`(图标唯一入口,禁止各端散落 `import 'lucide-react'`)、
  Button/Input/SearchInput/Label/Card/StatCard/Dialog/Sheet/Drawer/Select/Table/Tooltip 等具名导出。
- 目录:`src/components/`(34 项,含 `login-form/` 11 个文件)、`src/lib/`(5 项:`utils.ts`、
  `overlay-stack.ts`、`use-esc-stack.ts`、`remember-credentials.ts`、`artifact-preview.ts`)、
  `src/styles/`(只有 `auth-shell.css`、`login-form.css` 两份)、`src/page-shell.tsx`。

## 3. 依赖方向与边界

策略表 `requires: packages/design-tokens` —— 实测**只有**这一条 workspace 依赖被源码 import
(`git grep "@ihui/design-tokens" HEAD -- packages/ui-react/src`:button.tsx 的 `ICON_BUTTON_SIZE`、
badge.tsx 的 `BadgeBaseProps`、auth-shell.tsx 的 `CLOSE_BUTTON_*`)。本包**不** import `@ihui/shared`、
`@ihui/types`、`@ihui/api-client`(实测 0 处),第三方侧是 Radix 原语 + cva + lucide + @tanstack/react-table。

AGENTS §4 在本模块的具体化:档位是唯一真相源,不得用 className 覆盖尺寸 ——
`components/button.tsx` 的 `size` 表(xs/sm/default/lg/icon-2xs/icon-xs/icon-sm/icon)由守门
`scripts/check-button-height.mjs` **动态解析**(不再手抄),`icon-xs`/`icon-sm`/`icon` 三档当前同值 32px,
要 28px 图标只能用 `icon-2xs`。`<Button>` 内置 `wrapRawTextChildren`(button.tsx:84),
裸文本 children 自动包 `<span>`,这是中文+图标垂直对齐补偿规则能命中的前提 —— 手写原生 `<button>`
仍须自行包裹。圆角档位经 `@ihui/design-tokens` 的 `RADIUS_*`,不得在本包写 px 字面量。

## 4. 已知缺口 / 未收口的点

- `src/index.ts` 里 `export * from 'lucide-react'` 让入口导出面**不可枚举**:守门 149
  `scripts/check-package-barrel-export.mjs` 对这类三方整表转发记「未判定」而非通过。
  后果是"某个图标名到底存不存在"要等到构建/运行才知道。
- `icon-2xs` 之外的 `h-5`/`h-6`(24px/20px 紧凑档)按钮在本仓仍存量存在,由 §4 的豁免条款兜住,
  统一档位属后续批次 —— 现值请跑守门脚本读,勿按本文数字派单。
- 未取证:本包 dist 是否被任何宿主按产物路径解析(实测 `exports` 只给源码路径);
  `page-shell.tsx` 的消费方未逐一核对,故不声明"已被 web 端使用"。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
