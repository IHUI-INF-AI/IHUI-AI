<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# apps/mobile-rn — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/mobile-rn` 是 Expo ~57 + React Native 0.86 的 iOS/Android App(`expo start --port 8805`)。
策略表 `layer: product` / **`exported: false`** / `managed: true`:它是端,不得被 import。
它对外只有两条通道 —— ① **深链接**:`src/navigation/linking.ts:14` 的
`prefixes: ['ihui://', 'https://aizhs.top']`(SSO 回跳 `ihui://sso/callback` 由
`src/context/AuthContext.tsx:52` 消费,微信 OAuth 的 `ihui://oauth/callback` 在 `App.tsx:110` 注释里
声明与前者互不干扰);② 它作为客户端调用 apps/api 的 HTTP/WS(`@ihui/api-client`,实测 212 个文件 import)。
`app.config.js` 是**硬失败**入口:缺 `extra.WX_APP_APPID` / `extra.WX_UNIVERSAL_LINK` /
`android.package` 三者任一即 `throw` ⇒ 本机没配微信参数时 `expo prebuild` / EAS 必断。

## 2. 入口与结构现实

- `index.js` 顺序有理由(注释逐条给):`require('./polyfills')` → 显式
  `require('react-native/Libraries/Core/InitializeCore')`(RN 0.79+ 在 bundle 里可能不自动执行)→
  `registerCallableModule('HMRClient')` → 挂 `ErrorUtils.setGlobalHandler` 崩溃上报 →
  `module.exports = require('./App')`。**不得**再调 `registerRootComponent`(`App.tsx` 顶层已
  `AppRegistry.registerComponent('main')`,重复注册会覆盖)。
- `App.tsx`:5 层 Provider(`ThemeProvider` ⊃ `SafeAreaProvider` ⊃ `I18nProvider` ⊃ `AuthProvider` ⊃
  `NetworkProvider`)+ `NavigationContainer` + `RootNavigator`,并在 **`App.tsx:87`
  `<SafeAreaView edges={['top']}>`** 落状态栏避让的唯一注入点(守门 97 的 S1 判据)。
- `src/`:`screens/`(实测 **204 个文件**)、`navigation/`(RootNavigator / linking / navigation-ref /
  tab-utils)、`components/`、`context/`、`hooks/`、`stores/`(auth-store、notification、storage-adapter)、
  `theme/`(`active-tokens.ts`、`color-scheme-sync.ts`)、`lib/`、`api/`、`i18n/`、`utils/`、`constants/`、
  `declarations.d.ts`。
- 构建侧不可轻动:`metro.config.cjs`(NativeWind × Tailwind v4 共存的 **monkey-patch**,头注逐条写
  为什么不能移除、为什么不能升 5.x、为什么 Metro resolver 拦不住 config-load 阶段的 `require()` 版本检查,
  并指向 `scripts/check-nativewind-status.mjs` 那把监控尺)、`babel.config.js`
  (`babel-preset-expo` + `nativewind/babel`)、`tailwind.config.js`、`global.css`(派生态)、
  `plugins/`(withWechat / withSplash / withCarrier / withExpoImportFix)、`polyfills.js`、`stubs/`、
  `eas.json`、`android/`。

## 3. 依赖方向与边界

策略表 `requires: packages/api-client, packages/app, packages/design-tokens, packages/shared,
packages/types, packages/i18n, packages/ui-native`,实测 import 文件数:api-client 212、
**`@ihui/rn-app`(= `packages/app`)202**、shared 128、design-tokens 86、types 42、ui-native 11、i18n 4。
`@ihui/ui-react` 在本端 **0 处 import**(DOM 组件禁面)。

AGENTS 在本端的具体化(每条都有尺子):
- §3 共享层优先:屏级实现住 `packages/app`,本端只做 wrapper + 平台适配。判据是守门 39
  `scripts/check-rn-app-migration.mjs`(blocking):`src/screens/` 每个文件必须
  `from '@ihui/rn-app'`,除 **28 项白名单**(RN 独占屏:WebView 壳、expo-file-system 深度耦合、
  产品定稿回退,逐条带理由注释)。
- §4 主题同源:`apps/mobile-rn/global.css` 是 `packages/design-tokens/src/styles/tokens.css` 的
  **派生态**,由 `scripts/sync-rn-global-css.mjs` 原位写回(挂在 `scripts/lib/pre-commit-hook.js` 的
  `TOKEN_SYNC_TARGETS`),复核门 `scripts/check-rn-global-css-sync.mjs`(默认判 HEAD blob、
  `--staged` 判索引、取不到判"无法判定"不回落)。**禁止手改**受管块。
- §4 `dark:` 类必须与 App 主题同源才允许依赖:这条链是本端 `src/theme/color-scheme-sync.ts` 的
  `syncNativeWindColorScheme()` / `syncWindowColorScheme()`,由 `src/context/ThemeContext.tsx:71/:78`
  调用。新增深色取用二选一:走 `tokens.*`(`src/theme/active-tokens.ts`)或走 `dark:` 变体,
  不得在端内自造第三个色源。
- §4 状态栏:唯一注入点是 `App.tsx` 的 `<SafeAreaView edges={['top']}>`;端内不得再取
  `StatusBar.currentHeight` / 写 `statusBarHeight`,也不得在 style 里写 `paddingTop: 24..60` 蒙量级
  (守门 97 的 S2/S3,零容忍)。
- §4 圆角/几何:只能取 `@ihui/design-tokens` 的 `rnRadius`(含括号形态 `rnRadius['2xl']`)与 `rnGeometry`
  档位,不得 `const *_RADIUS = <数字>`、不得字符串形态 `'8px'`(守门 77);跨端同元素差档与角色档
  分别由守门 128 / 150 判。
- NativeWind cssInterop:`Modal` **不在**注册表里(反直觉事实),函数形态 `style={({pressed}) => …})`
  落在注册过的组件上会被静默吃掉(守门 131)。

## 4. 已知缺口 / 未收口的点

- **入口的崩溃上报未脱敏**:`index.js` 把 `error.message` / `error.stack` 原样 POST 到
  `/api/crash-reports`(只 `slice(0,4000)` / `slice(0,20000)`),不经 `@ihui/shared` 的
  `redactCrashText`(实测本端 `git grep redactCrashText` 零命中)。守门 144 头注第 33 行把这里与
  miniapp 那处一并登记为"只影响少把原文送出设备,数据面已由服务端兜住",因此**默认只报数不判红** ——
  这是在账的敞口,不是已修。
- **守门 39 的通过语与它自己的白名单矛盾**:它打印"全量 204 个 screen 文件均已 import @ihui/rn-app",
  而按该门自身的 import 正则实测只有 **191** 个真含该 import,另 12 个靠白名单放行。
  读输出的人会把"已全量迁移"当事实(修这句话属守门 39 持有人,本端不改判据)。
- **本端 `package.json` 没有 `dev` / `build` 脚本**(只有 start / android / ios / typecheck / lint /
  test / gen:ui-routes),`test` 是裸 `vitest run`(无 `--passWithNoTests`)。即"RN 产物能不能跑"
  在提交链上无人代跑,真机验证不落尺子。
- 未取证:`stubs/` 与 `plugins/withExpoImportFix.cjs` 各自绕开的上游缺陷未逐条读;
  iOS 侧无等效接线可查(HEAD 面 `apps/mobile-rn/ios` = **0 个文件**,只有 `android/`);
  `src/screens` 与 `packages/app/src/features` 的重复实现面未逐文件比对(AGENTS 记过两侧各有存量)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
