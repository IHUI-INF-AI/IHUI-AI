<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/design-tokens — 契约与边界

一句话职责:全仓**可见真值的唯一源头**。色板/间距/字号/圆角/几何/z-index 与 `cn()` 类名合并工具,
双形式递出(JS 对象 + CSS 变量)。AGENTS §4 那句"任何端改了样式必须同步另一端"的实现前提就是:
同步的终点只在这里,各端的 `app.css` / `global.css` / `rn-tokens.ts` 一律是**派生态**。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/design-tokens" HEAD -- apps packages`)

433 个文件(按 `from '@ihui/design-tokens` 前缀现查、排除包内自引用;只数主入口则是 432)。文件数:
`packages/app` 206、`apps/mobile-rn` 86、`apps/web` 59、`apps/miniapp-taro` 46、`packages/ui-native` 11、
`packages/ui-react` 10、`packages/shared` 5、`apps/api` 5、`apps/extension` 3、`apps/cli` 2。

子路径入口的真实消费者:`./tailwind-preset` → `apps/miniapp-taro/tailwind.config.ts:20`、`apps/mobile-rn/tailwind.config.js:8`;`./styles/tokens.css` 现查**零消费者**(见 §4)。

## 2. 公开面(package.json `exports`:`.` + `./styles/tokens.css` + `./tailwind-preset` + `./package.json`)

`main`/`types` 指向 `./dist/*`。`src/index.ts` 按**来源模块**分组递出:

- `cn.js` → `cn`(依赖 clsx + tailwind-merge,是这两个包在本仓的唯一入口)
- `token-registry.js` → `TOKEN_REGISTRY` / `TOKEN_NAMES` / `TOKEN_COUNT` / `validateTokenConsistency` /
  `listMissingTokens` / `extractCssVars`(名称与类型的元数据层,与 `tokens.css` 互为校验)
- `rn-tokens.js` → `rnTokens` / `rnLightTokens` / `rnDarkTokens` / `getRnTokens`
- `chart-colors.js` → `CHART_*` 全族 + `BRAND_*` + `SWARM_ROLE_*` + `DESIGN_OVERLAY_*` + `COLOR_BLACK` +
  `withAlpha` / `chartText` / `chartAxis` / `chartBg`
- `chart-templates.js` → `CHART_TEMPLATES` / `isChartTemplateId` / `chartTemplateMeta` /
  `parseChartTemplatePayload` / `parseChartTemplateJson`(D46 受控模板白名单)
- `oauth-colors.js` → `OAUTH_BRAND_COLORS`
- `close-button.js` / `icon-button.js` → `CLOSE_BUTTON_*` / `ICON_BUTTON_*` + 两个 classes 工厂(全项目关闭按钮、
  图标按钮 32×32 尺寸的唯一真相源)
- `doc-colors.js` → `DOC_*`(生成式 PDF/Email/落地页配色)
- `component-props.js` → `ButtonBaseProps` / `BadgeBaseProps` / `VipBadgeBaseProps` 等
  (**ui-react 与 ui-native 共享的那一份 props 契约**)
- `radius.js` → `RADIUS_STEPS` / `RADIUS_ROLES` / `RADIUS_REM` / `RADIUS_CSS_PX` / `RADIUS_CSS_VAR` /
  `RADIUS_SCALE_PX` / `rnRadius` / `rnRadiusFor` / `rpxToStep` / `pxToStep`
- `geometry.js` → `GEOMETRY_PX` / `rnGeometry` / `taroGeometry` / `TARO_RPX_PER_PX`

## 3. 依赖方向与边界(`- id: 'packages/design-tokens'`)

`layer: contract`(rank 10,最底层) · `exported: true` · `managed: true` · `requires: []` ·
`public_entrypoints: ['.', './styles/tokens.css', './tailwind-preset']`

- `requires: []` 与现实一致:包内只 import `clsx` / `tailwind-merge`(外部),**不 import 任何仓内包**。
  这是它能站在全仓最底层的原因 —— 一旦它 import 了别的包,所有端都会跟着反向依赖。
- 端内**不得自立品牌档**。主 CTA 的唯一写法是 `brand.cta` + `brand.ctaForeground`(CSS 侧 `--color-cta*`),
  真要先在 `tokens.css` 落一个 CSS 变量再去同源对账门登记;`RN_ONLY_BRAND_KEYS` 之类的豁免清单会腐烂。
- 端内**不得抄数字**:圆角取 `rnRadius` / `var(--radius-*)`,几何取 `rnGeometry` / `taroGeometry`,
  生成式 CSS 字符串取 `RADIUS_CSS_PX`。守门 77(圆角单一源)/ 128(跨端几何对账)/ 150(角色档合规)按这个判。
- 各端**派生副本**的取源只有一份实现:`scripts/lib/design-token-blocks.mjs`;副本由 `scripts/sync-*.mjs` 派生并挂在
  `TOKEN_SYNC_TARGETS` 上,**禁止手改副本、禁止再写第二个取源实现**(AGENTS §4 明文)。web 端不经这条链,
  它是直接 `@import` CSS 源文件 —— 见 §4 第 1 条。
- 构建必须 `pnpm --filter @ihui/design-tokens build` = `tsc` **+ `node scripts/copy-assets.mjs`**;
  只跑 tsc 会产出"编译成功但装起来就坏"的 dist(见 §4 第 3 条)。

## 4. 已知缺口 / 未收口的点

- **`./styles/tokens.css` 是一个"声明了但没人按它消费"的公开入口。** 现查 HEAD:
  `git grep "design-tokens/styles"` 零命中;web 端实际取值走**相对仓库路径**
  `apps/web/app/globals.css:20` `@import '../../../packages/design-tokens/src/styles/tokens.css'`。
  ⇒ E1 判它"解析得到"(dist 里有那份文件),但它对真实消费链零覆盖,且拿的是 `src` 而不是入口声明的 `dist`。
- **`src/` 目录本身就是一层事实上的公开面**:现查 61 个文件按 `packages/design-tokens/src/...` 字面路径读它
  (根 `scripts/` 的 sync/守门、各端 css、`packages/app/src/theme/tokens.ts:8` 的注释)。
  `scripts/copy-assets.mjs` 头注已把这写成理由("src 是唯一真相源,路径一动整片瞎"),
  后果是:`public_entrypoints` 低估了真实面,搬家 `src/` 不会被 E1/D3 拦住,只会把 60+ 处读取一次性弄瞎。
- **dist 是复制出来的派生态,且 `tsc` 单独跑必然产坏包**:`include` 只有 `src/**/*.ts`,而
  `radius.js` / `geometry.js` / `tailwind-preset.js` / `tailwind-alpha-plugin.js` 与两份 `.d.ts`、`styles/*.css`
  都不是 `.ts` ⇒ 靠 `copy-assets.mjs` 逐字节复制 + 回读校验。改构建脚本时不得把它当"顺手加的可选步骤"。
- `tailwind-alpha-plugin.js` **既不在 `exports` 也不在 `public_entrypoints`**,却有两类真实读者:
  `src/tailwind-preset.js:22`(包内 import,合法)与根 `scripts/check-cross-end-tokens.mjs:609`、
  `scripts/sync-alpha-usage.mjs`(`ALPHA_PLUGIN_REL` 字面路径,原位写回它的 `ALPHA_USAGE` 表)。
  一个被脚本**写**的文件不在任何声明面上,是表与现实脱节的一格。
- 只有 1 个自有测试文件(`tests/tokens-invariants.test.ts`),档位表四处对账 / `-rgb` 三元组 /
  落地率这些真正会漂的东西由根 `scripts/` 那 6 道门(36/77/93/124/128/150)守,不住在本包。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
