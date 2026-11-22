<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# apps/miniapp-taro — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/miniapp-taro` 是 Taro 4.2.1 小程序端(weapp / alipay / swan / tt / h5 五 target,主用 weapp+alipay)。
策略表 `layer: product` / **`exported: false`** / `managed: true` —— 它是端。实测它的
`package.json` 里 `main`、`module`、`exports` **三个字段都不存在**,所以"被别的模块 import"在结构上
就不成立;跨端复用的方向是反的:它向下取 `@ihui/shared` / `@ihui/api-client` / `@ihui/types`。
对外的面是微信/支付宝的 AppID 与页面路由表(`src/app.config.ts` + 各页 `index.config.ts`)。

## 2. 入口与结构现实

- 构建入口是 `src/app.config.ts` + `src/app.tsx`;路由 = 主包 `pages`(入口页 + 5 个 tabBar 页是平台
  硬性要求)+ **17 个 `subPackages`**(`pkg-ai` / `pkg-shop` / `pkg-learn` / `pkg-user` / `pkg-content` /
  `pkg-about` 六个业务包,加 `pages/` 下 11 个:distribution、exam、study、circle、ask、member、setting、
  login、register、forgot-password、webview)。实测 `src/pages` 与六个 `pkg-*` 下共 **75 个 `index.tsx`**。
- tabBar:主包 `pages` 5 条即 5 个 tab(index / community / plaza / user / share,`app.config.ts:255-273`)。
  **当前用的是原生 tabBar**:`app.config.ts` 里显式 `custom: false`,注释写明原因(Taro 4 Vite 编译不输出
  `custom-tab-bar`,GitHub #17978 / #18415),配色以 `@变量` 引用 `theme.json` 并与 `THEME_CHROME` 对齐
  (图标 28 张在 `src/assets/tabbar/`)。`src/custom-tab-bar/{index.tsx,index.config.ts}` **仍在仓库里但不生效**
  —— 见 §4。
- 页面根容器一律 `<ThemeRoot>`(`src/components/ThemeRoot.tsx`,内部调 `useThemeRoot()`;实测 src 下
  156 个文件引用它)。端内适配层:`src/components/adapters/*.taro.tsx` **3 个**
  (ColorfulLoader / SectionHeader / Selecter)、`src/stores/storage-adapter.ts` 的
  `createTaroStorageTransport()`(把 Taro 同步 storage 喂给共享层 store 工厂)、`src/lib/{theme,sse,
  ui-action-registry,ui-control-tools,ui-field-registry}.ts`。
- 派生产物(都有脚本、都不该手改):`src/i18n/generated/remote-locales.gen.ts`(`pnpm gen:i18n`)、
  `src/constants/ui-routes.generated.ts`(端内 `scripts/generate-ui-routes.mjs` 按 `app.config.ts` 生成
  `TARO_UI_ROUTES` + `TARO_APP_WINDOW_TITLE`)、`src/components/LineIcon/icons.ts`(端内
  `gen-line-icons.mjs`,值是**内联 `<svg>` 串**,故 `src/static/images/icons/` 在 HEAD 里只剩 1 个 svg)、
  `src/assets/tabbar/*.png`(`gen-tabbar-icons.mjs`)。

## 3. 依赖方向与边界

策略表 `requires: packages/shared, packages/types, packages/design-tokens, packages/api-client,
packages/i18n`,实测 import 文件数:shared 85、design-tokens 45、types 39、api-client 32、i18n 7。
`@ihui/ui-react` 与 `@ihui/rn-app` 在本端 **0 处 import**(DOM/RN 组件禁面,实测)。
调后端一律经 `@ihui/api-client`(AGENTS §3),不得裸 `Taro.request` 打自家路由(守门 73)。

AGENTS §4 在本端的具体化(每条都有尺子):
- 色值与原生 chrome 是**派生态,不得手改**:`src/app.css` 的受管块(含 Tailwind v4 的 `@theme`
  色档注册区)由 `scripts/sync-miniapp-tokens.mjs` 从 `packages/design-tokens/src/styles/tokens.css`
  派生,由守门 36 `scripts/check-miniapp-tokens-sync.mjs` 复核(同时核 `:root` / `.dark` / `@theme`
  三面:无缺档 + 逐位同值 + 反向拦 `-rgb` 脏档);`src/theme.json` 与 `src/lib/theme.ts` 的
  `THEME_CHROME` 由 `scripts/sync-miniapp-chrome.mjs` 派生,守门 124 复核。两条都挂在
  `scripts/lib/pre-commit-hook.js` 的 `TOKEN_SYNC_TARGETS`(各自触发面自动写回)。
- 主题切换必须调 `@/lib/theme` 的 `setThemePreference()`(同步原生导航栏/tabBar 配色 + 广播事件);
  只写 `Taro.setStorageSync('theme')` 属违规。新增路由页忘挂 `ThemeRoot`、改回深色科技风、
  复用已删装饰类,由 `scripts/check-miniapp-taro-style-parity.mjs` 阻断。
- 单位:Tailwind v3 消费端禁止裸 rpx 写进 `text-` / `border-` 任意值 —— `text-[28rpx]` 会被解析成
  `color: 28rpx`,整条声明无效且不报错;唯一正解 `text-[length:28rpx]`(守门 93 R7,存量已清零,
  现零容忍)。圆角只能取 `rounded-xs..2xl` 档位或 `var(--radius-*)`,禁止 `rounded-[24rpx]`(守门 77),
  "这类元素取哪档"按 `RADIUS_ROLES` 由守门 150 判。
- §3 共享层优先:端内 `hooks/`、`stores/`、`utils/` 只做 re-export wrapper + 平台 adapter,
  不得重新实现 `packages/shared` 已有的件(守门 40 blocking);`adapters/*.taro.tsx` 若在 adapters
  目录外无人从该路径 import,即"造好没装车"(守门 64 blocking)。

## 4. 已知缺口 / 未收口的点

- **"到端生效"不在提交链**。守门 105 `scripts/check-miniapp-generated.mjs` 判四件派生产物是否落后于源
  (G1 漏生成判红),但它要求**产物在场**;`scripts/check-miniapp-css-landing.mjs`(判 CSS 是否真进 wxss)
  只在 `build` / `check:css-landing` 里跑,不在提交链。`package.json` 的 build 用的是
  `--min-coverage 0.5` 而 `check:css-landing` 用 `0.9` —— 同一个指标两个阈值,构建线更松。
- **构建档位会改变结论**:AGENTS §4 记录同一份配置实测三档产物(可达率 34.89% / 93.77% / 99.35%),
  "任一百分比都得先认档再说数"。本票未复跑构建,故不引用任何具体覆盖率。
- 端内 `package.json` 声明 `tailwindcss ^3.4.17`,AGENTS §4 记录实际引擎是 `weapp-tailwindcss@5.2.9`
  自带的 vendored v4 —— 本票未复核该归因,引用时按"文档记录"对待。
- **`src/custom-tab-bar/` 是死面**:`app.config.ts` 的 `custom: false` 让它当前不参与渲染,而组件文件仍在
  仓库里(且不在任何守门射程内)。改 tabBar 观感要改的是 `theme.json` + `THEME_CHROME` 那条派生链,
  不是这个目录 —— 按目录名去改会改到不生效的那一份。
- 未取证:28 张 tabbar png 是否全部由 `gen-tabbar-icons.mjs` 覆盖;17 个分包的主包体积余量
  (2MB 硬上限)未量;`src/i18n/generated/remote-locales.gen.ts` 与五语言源包是否逐键同批未跑对账。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
