<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# apps/mobile-cap — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/mobile-cap` 是 **Capacitor 7 壳**,`package.json` 自述:"复用 apps/web 静态导出(out/)打包
Android/iOS App,官方插件提供离线推送/相机/分享/扫码等原生能力"。策略表 `layer: product` /
**`exported: false`** / `managed: true` / **`requires: []`** —— 它不 import 任何 workspace 包,
`dependencies` 全是 `@capacitor/*`(实测 11 个,无 `@ihui/*`)。

它对外的面只有一个:**装到手机上的那个 APK**。首版形态是"远程加载壳"——
`capacitor.config.ts` 里 `server.url = 'https://aizhs.top'`,即 App 打开的是线上站,
origin 与浏览器访问同一域名(`androidScheme: 'https'` + `hostname: 'aizhs.top'` 的组合就是为了让
api-client 的空 baseUrl 走同源相对 `/api`,零 CORS 改造)。

## 2. 入口与结构现实

实测 HEAD 面本模块共 **62 个跟踪文件**,其中 `android/` 占 55 个(Gradle 工程 + 资源),
非 android 只有 7 个:`.gitignore`、`capacitor.config.ts`、`package.json`、`tsconfig.json`、
`patches/@capacitor+android+7.6.9.patch`、`scripts/sync-web.mjs`、`scripts/gen-assets.mjs`。

- **没有 `src/`,没有 TS 业务代码**(只有配置文件与两个 node 脚本)。UI 真值在 `apps/web`。
- `www/`(Capacitor 的 `webDir`)被 `apps/mobile-cap/.gitignore` 忽略;它由
  `scripts/sync-web.mjs` 从 `../../apps/web/out` **纯复制**得到,脚本"缺失 out/ 直接报错退出",
  防止把陈旧/空目录打进 APK。`pnpm sync:web` / `cap:sync` 是唯一出口。
- 原生入口 `android/app/src/main/java/top/aizhs/app/MainActivity.java`(`extends BridgeActivity`),
  里面是两条真机修复:① `adjustMarginsForEdgeToEdge: 'force'` 会把 IME insets 一并 CONSUMED,
  导致软键盘不弹且进程被杀 ⇒ `onCreate` 显式 `SOFT_INPUT_ADJUST_RESIZE` + 触摸时主动 `showSoftInput`;
  ② 状态栏遮挡由配置侧的 force 档解决。
- 品牌资源不手画:`scripts/gen-assets.mjs` 以 `apps/web/public/favicon.svg` 为源,幂等生成
  自适应图标 / 传统图标 / 各密度 splash。

## 3. 依赖方向与边界

策略表把本模块的 `requires` 记为**空**,与实测一致(无 workspace import)。这意味着两条边界规矩:

- **不得在本端长业务代码**:所有页面/状态/i18n 归 `apps/web`;本端只放壳配置、原生桥接、资源生成。
  若在此新增 TS 逻辑去 import `@ihui/shared` 之类,等于把策略表的 `requires: []` 变成假账 ——
  必须先改表再改码(架构门 103 的 D1/D2 会判)。
- **UI 同源靠"同一份 web 产物",不靠第二套实现**。因此 §4 那条色值手抄是本端唯一一处"看起来像
  真值、其实不是派生态"的东西(见下)。
- AGENTS §5e 的通道口径同样适用:本端脚本(`sync-web.mjs` / `gen-assets.mjs`)若要落临时物或
  发消息,一律走批准落点与 `notify-deploy-failure.ts`,不得自拼 SMTP。

## 4. 已知缺口 / 未收口的点

- **运行模式是远程加载,离线能力尚未落地**。`capacitor.config.ts` 第 26-30 行原话:
  仅设 hostname 时 Android WebView 会把发往 `aizhs.top` 的 XHR 也拦进本地资产服务器
  ("Handling local request")⇒ 404,故首版用 `server.url`;本地资产离线模式要等
  "后端 CORS 白名单补 `https://localhost` 后切回(见 `.mode-local-assets` 备注分支)"。
  **实测 `git grep -l mode-local-assets HEAD` 只命中 `capacitor.config.ts` 这一行注释本身**,
  没有任何脚本、文件或分支实现它 —— 那句出路当前跑不通(与 AGENTS"文档不得写跑不通的出路"同一条禁令)。
- **`res/values/colors.xml` 的 `windowBackgroundDark = #0B0C0E` 是手抄值,无人对账**。
  它自己注释写"来源 web 端 bg-shell-panel 设计 token";实测源头是
  `packages/design-tokens/src/styles/tokens.css:549` 的 `.dark --color-shell-panel: hsl(220 12% 5%)`,
  换算确为 rgb(11,12,14) —— **今天同值,但源档一改它不会跟着动**:本端既不在
  `TOKEN_SYNC_TARGETS` 的四行受管副本里(那三行是 miniapp app.css / theme.json+THEME_CHROME /
  mobile-rn global.css),也没有对应的守门。
- **`gen-assets.mjs` 的 `sharp` 未在本端 manifest 声明**,靠根 `package.json:215` 的 `sharp: 0.35.3`
  经 hoisting 解析到(实测 `require.resolve` 落根 `.pnpm`)。属守门 78 第①维看不见的形态
  (它只判 `workspace:` 声明),换机或裁剪依赖树时这条会静默断。
- 未取证:`patches/@capacitor+android+7.6.9.patch` 修掉的具体上游缺陷(未逐行读);
  `build:apk` 在本机能否跑通(需 Android SDK/gradle,属机器状态);`google-services.json` 已入库
  而配置注释仍写"项目无 Firebase 配置(无 google-services.json)" —— 注释与仓库现实矛盾,
  本票只登记不定性(移除 `@capacitor/push-notifications` 的决策是否仍成立,归该端持有人)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
