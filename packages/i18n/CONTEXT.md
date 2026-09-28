<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/i18n — 契约与边界

一句话职责:语言包与取词/格式化内核的**单一来源**。`messages/<端>/<locale>.json` 是全仓唯一的一手翻译落点,
`src/icu.ts` 是端内自渲染 ICU 的那一份实现。AGENTS §19 的五道语言纯度门(2b/2c/2d/2e/2f)与守门 133
判的都是这里的内容。

## 1. 对外给谁用(现查 HEAD,按入口分别 `git grep -l`)

语言:5 档 —— `SUPPORTED_LOCALES = ['zh-CN','en','ja','ko','zh-TW']`,`DEFAULT_LOCALE = 'zh-CN'`(`src/types.ts:9,11`)。

- 主入口 `'@ihui/i18n'`:生产面 3 处 —— `apps/cli/src/i18n/index.ts`、
  `apps/extension/entrypoints/background.ts`、`apps/extension/entrypoints/content.ts`
- `'@ihui/i18n/loader'` + `'@ihui/i18n/types'`:生产面 9 处 —— `apps/web/src/i18n/request.ts`、
  `apps/web/src/providers/i18n-provider.tsx`、`apps/extension/src/i18n/index.tsx`、
  `apps/extension/src/lib/model-catalog.ts`、`apps/miniapp-taro/src/i18n/index.tsx`、
  `apps/miniapp-taro/src/utils/{model-catalog,wechat-login}.ts`、`apps/mobile-rn/src/i18n/index.tsx`、
  `apps/mobile-rn/src/lib/ui-action-registry.ts`(+ 生成器 `apps/miniapp-taro/scripts/gen-i18n-compressed.mjs`)
- `'@ihui/i18n/messages/*'`(引用该路径的文件数,含测试与脚本):`web` 102、`shared` 61、`extension` 28、
  `mobile-rn` 22、`miniapp-taro` 21、`cli` 16、`api` 7 —— **7 个命名空间 × 5 语言 = 35 份 JSON**。

## 2. 公开面(package.json `exports`:`.` / `./types` / `./loader` / `./messages/*` / `./package.json`)

`main`/`types` = `./dist/index.js`(`build: tsc`)。`src/index.ts` 就是三行 `export *`,所以公开面 = 三个子模块之和:

- `src/types.ts`:`Locale`、`SUPPORTED_LOCALES`、`DEFAULT_LOCALE`、`Messages`、`LocaleMessages`、`isLocale`、`IcuFormatOptions`
- `src/loader.ts`:`getValueByPath`、`translate`、`resolveList`、`mergeMessages`、`getMessagesForLocale`、`TranslateOptions`
- `src/icu.ts`:`hasIcuSyntax`、`formatIcu` —— **手写 ICU 子集**,不是 `intl-messageformat` 的包装。
  `intl-messageformat@11.2.13` 只是 **devDependency**,唯一用途是 `tests/cross-engine.test.ts` 里做跨引擎逐字对账。

`./messages/*` 按 npm exports 语义**跨段**匹配,直接递出 JSON 原文(不套 loader)—— 各端就是这么把词包烘进产物的。

## 3. 依赖方向与边界(`- id: 'packages/i18n'`)

`layer: platform`(rank 20) · `exported: true` · `managed: true` · `requires: []` ·
`public_entrypoints: ['.', './types', './loader', './messages/*']`

- `requires: []` 与现实一致:现查 `packages/i18n/src` 内**零条** `@ihui/*` import
  (`src/index.ts` 里那三处 `@ihui/i18n` 字样是头注的用法示例,不是依赖)。
- **端内不得再写第二份 ICU 渲染器,也不得用 `.replace('{n}', v)` 手工填占位** ——
  后者是端内已立案的反模式,由 `scripts/check-miniapp-replace-antipattern.mjs` 判红。要插值就 `formatIcu` /
  `t(key, vars)`。
- 端内不得按 `@ihui/i18n/src/loader` 这类路径穿透(只能走 `./loader`),D3 判红。
- 新增/改 `zh-CN.json` 的键必须走 AGENTS §19 的流水线:`i18n-diff.mjs` → 译 → `i18n-apply.mjs` →
  `check-i18n-keys.mjs` → `scan-i18n-zh-residue.mjs`。不得只补一个语言(parity 是键集判据,内容语种由守门 133 判)。
- 语言包是**多会话共写的活文档级文件**:AGENTS §19 记过一次"改对了又被并发提交拿旧基线写回",
  改前后都要按被审面现读,不得把"我改过了"当事实。

## 4. 已知缺口 / 未收口的点

- **"4 端"这句已经落后于现实。** `package.json` 的 `description` 与 `src/index.ts` 头注都写
  "4 端(web/extension/miniapp-taro/mobile-rn)",而 `messages/` 现读有 **7 个命名空间**,其中 `api/` 与 `cli/`
  各有真实生产消费者(`apps/api/src/services/budget-alert-service.ts`、`apps/cli/src/i18n/index.ts` 等)。
  头注列出的目录结构里根本没有 `api` 与 `cli` 两行 ⇒ 照注释新增端的人会以为不存在这一档。
- **`messages/` 树是第二层事实公开面,却没有任何"写权"边界。** 根 `scripts/` 里的
  `i18n-apply.mjs`、`i18n-diff.mjs`、`check-i18n-keys.mjs`、`scan-i18n-zh-residue.mjs` 都按
  `packages/i18n/messages/**` 字面路径读、且 `i18n-apply.mjs` 会**原位写回**这些 JSON。
  这条写链不在 `exports` 里、也不在任何 entrypoint 声明里,只由脚本自身约束。
- `exports` 里有 `"./package.json"` 而表里 `public_entrypoints` 未列(E1 不核对它,但读者会以为只有四条出口)。
- `src/icu.ts` 的"子集边界"是**手写清单**(文件头注列出与 intl-messageformat 有意不一致的几形:
  `#` 作用域、`plural`/`selectordinal` 的 string 数字、`=N` 精确匹配等),不一致处降级为"原文 + `console.warn`、不抛错"。
  ⇒ 端上表现是"某句没翻"而不是崩,回归只能靠 `tests/cross-engine.test.ts` 与 `tests/h28.test.ts`,
  而这两枚都**不在提交链**(本包 `test` 脚本是 `vitest run`,runner 不调它)。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
