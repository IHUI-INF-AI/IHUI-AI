<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# apps/extension — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/extension` 是 Chrome MV3 扩展(WXT 框架),三个 UI 面 + 一个后台:popup、sidepanel(47 个页面)、
注入页面的 content toolbar、`background.ts`(509 行,含 alarms / chrome.identity SSO / agent 控制转发)。
策略表 `layer: product` / **`exported: false`** / `managed: true` —— 它是端,不是库;
它对外只暴露"扩展自身的 manifest 面"(`wxt.config.ts` 的 permissions 8 项 +
host_permissions: `http://localhost:8802/*`、`http://localhost:8803/*`、`https://*.aizhs.top/*`),
跨端能力一律经 `@ihui/api-client` 打 apps/api 的 HTTP 路由(AGENTS §3:不得在端内直接 fetch 后端)。

## 2. 入口与结构现实

- `wxt.config.ts` 是清单真相源(名字 "IHUI AI"、`minimum_chrome_version: 114`、dev server 固定
  `127.0.0.1:8808` —— 注释写明 Windows + Node 17+ 把 localhost 解析成 ::1 导致连接被拒,必须显式 IPv4)。
- `entrypoints/` 即 WXT 约定入口:`background.ts`、`content.ts` + `content/content-toolbar.tsx`、
  `popup/{index.html,main.tsx,App.tsx}`、`sidepanel/{index.html,main.tsx,SidepanelApp.tsx,
  ext-ui-listener.ts,components/,pages/}`;entrypoints 下 .tsx 共 61 个。
- `lib/`(与 entrypoints 平级的端内适配层):`agent-control.ts` / `agent-control-bridge.ts` /
  `page-snapshot-adapter.ts` / `ext-ui-forwarder.ts` / `ext-ui-routes.generated.ts` /
  `login-api-client.ts` / `browser-tab.ts` / `config.ts`。
- `src/`:`i18n/`(端内实例)、`stores/`(`auth-store.ts` + `storage-adapter.ts`,后者是把
  chrome.storage 喂给共享层 store 工厂的 adapter)、`idb/vocab-db.ts`、`hooks/`、`lib/`、`content/`。
- `tests/` 32 个文件,`pnpm test` = `vitest run --passWithNoTests`。产物 `.output/` 被根 `.gitignore:103` 忽略。

## 3. 依赖方向与边界

策略表 `requires: packages/i18n, packages/ui-react, packages/api-client, packages/shared,
packages/types, packages/browser-platform, packages/design-tokens, packages/dom-actions`,
逐项实测到源码 import:ui-react 51 文件、api-client 48 文件、shared 36 文件、types 16 文件、
browser-platform 8 文件、dom-actions 4 文件(`lib/agent-control.ts:22` 的 `executeDomAction`、
`lib/agent-control-bridge.ts:37` 的 `PAGE_ACTIONS`)、design-tokens 3 处(`entrypoints/content.ts:19`
的 `RADIUS_CSS_PX`)、i18n 以 `@ihui/i18n/messages/extension/<locale>.json` 深导入 5 语言。

AGENTS 在本端的具体化:§4 图标一律 lucide(本端走 `@ihui/ui-react` 的整表转发)、
按钮尺寸只能取 `size` 档;§3 端内不得重新实现共享 hook/util —— `login-api-client.ts` 的写法就是范本:
它**适配** `@ihui/ui-react` 的 `LoginForm` 契约(把 token 存 `chrome.storage.local`、复用
`@ihui/api-client` 的 `loginByAccount/loginBySms/sendSmsCode`),而不是另做一套登录 UI。

## 4. 已知缺口 / 未收口的点

- `lib/ext-ui-routes.generated.ts` 自称"生成常量,非手写维护",但**仓里没有任何写它的脚本**
  (`git grep -ln "ext-ui-routes.generated" HEAD` 只命中消费方 `lib/ui-action-registry.ts`、其测试与文档),
  文件头第 9 行的原话是"路由表变更时需重新清点并同步本文件"。对照:miniapp 与 RN 各有
  `scripts/generate-ui-routes.mjs` 产出 `src/constants/ui-routes.generated.ts`。这一格靠人记。
- `login-api-client.ts` 头注自述一处缺口:邮箱登录端点 `@ihui/api-client` **未导出**,于是本端直接用
  `fetchApi` 打 `/api/auth/login/email` —— 属绕过 api-client 契约的有意例外,补导出前不得当作范式抄。
- 未取证:manifest 的 `host_permissions` 与生产部署域名是否逐条一致(只读了 `wxt.config.ts`);
  sidepanel 47 个页面与生成清单声称的 50 条路由的差集未逐条核对(清单含 5 条兼容重定向)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
