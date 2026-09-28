<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/eslint-config — 契约与边界

一句话职责:全仓 lint 规则的**唯一装配处**。四份 ESLint 9 flat config 预设(base / react / next / cross-end)
加两枚自写规则,14 份配置文件共 16 个 import 点从这里取规则,而不是各端各写一份。

## 1. 对外给谁用(现查 HEAD,`git grep -l "@ihui/eslint-config" HEAD`)

按入口分(现查 HEAD,共 14 份配置文件 / 16 个 import 点,不含本包自身):

- `'.'`(base)—— 10 处:仓库根 `eslint.config.mjs:5`、`apps/api`、`apps/cli`、
  `packages/api-client`、`packages/auth`、`packages/context-compaction`、`packages/database`、
  `packages/design-tokens`、`packages/types`、`packages/ui-react`(各自的 `eslint.config.js`)
- `'./react'` —— 3 处:`apps/extension/eslint.config.js:17`、`apps/miniapp-taro/eslint.config.mjs:5`、
  `apps/mobile-rn/eslint.config.js:5`
- `'./next'` —— 1 处:`apps/web/eslint.config.js:5`
- `'./cross-end'` —— 2 处:`apps/miniapp-taro/eslint.config.mjs:6`、`apps/mobile-rn/eslint.config.js:6`

## 2. 公开面(package.json `exports` 四条,与策略表 `public_entrypoints` **逐条同名**)

包根**没有 `src/`,也没有 dist** —— 四个入口就是四个 `.js` 文件,直接递出:

- `index.js`(base):`typescript-eslint` recommended + ignores(`dist` `.turbo` `node_modules` `build` `.next` `coverage`)
  + `@typescript-eslint/no-explicit-any: error`、`no-unused-vars`(带 `^_` 三档忽略)、
  `consistent-type-imports`(inline 形态)、`prefer-const`、`eqeqeq: always`、`no-console`(allow warn/error/info)、
  `no-restricted-syntax` 两条 **zod 4 废弃 API 防回归**(`z.preprocess`、`z.string().datetime`)、
  `*.{js,cjs,mjs}` 关 `no-require-imports`,以及**测试文件面关 `no-explicit-any`**(AGENTS §3 的例外档)。
  自写规则注册为 `ihui/no-unpaired-card-content-padding: warn`(`rules/no-unpaired-card-content-padding.js`)。
- `react.js`:`...base` + `**/*.{tsx,jsx}` 上 `react` / `react-hooks` 插件,`exhaustive-deps: warn`、`jsx-key`、
  `self-closing-comp` 等。`settings.react.version` 写死 `'19.0'` 的理由写在文件头注里
  (ESLint 10 移除了 `context.getFilename()`,而 `eslint-plugin-react@7.37.5` 的 `'detect'` 会调它 ⇒ 崩)。
- `next.js`:`...reactConfig` + `@next/next` 规则,并单列 `**/pages/**` 一块。
- `cross-end.js`:**只**给 `src/{hooks,utils,stores}/**/*.{ts,tsx}` 挂 `ihui-cross-end/no-reimpl-when-shared-exists: error`
  (`plugins/ihui-cross-end.js`),即 AGENTS §3"共享层优先"的那道机器判据。

## 3. 依赖方向与边界(`- id: 'packages/eslint-config'`)

`layer: contract`(rank 10) · `exported: true` · `managed: true` · `requires: []` ·
`public_entrypoints: ['.', './react', './next', './cross-end']`

- `requires: []` 诚实:包内不 import 任何仓内包,只 import 外部插件(`typescript-eslint`、
  `eslint-plugin-react`、`eslint-plugin-react-hooks`、`@next/eslint-plugin-next`)。
  `eslint` 本身是 **peerDependency**(`^9 || ^10`)⇒ 版本由消费方定,本包不得自带一份。
- `rules/` 与 `plugins/` **两个目录都不在 `exports` 里** ⇒ 端内按 `@ihui/eslint-config/rules/...` 或
  `.../plugins/ihui-cross-end` 取规则文件是 D3 深导入,本门判红;要暴露新规则,加一条 `exports` 键并同步表。
- **端内不得另起一份同义规则**。要偏离(例如 miniapp-taro 是 React 18,而 base 的 react 版本档写死 19.0),
  正确姿势是在该端 config 里 `settings` 覆盖,而不是复制一份 preset。
- 改这里等于改 14 份配置的判据 —— 收紧一条规则前,必须先在全部 8 端 + 主要包上试跑一次,
  否则产出的是"与本次提交无关的恒红",唯一结局是各会话 `--no-verify`、连带全部守门作废(AGENTS §12e)。

## 4. 已知缺口 / 未收口的点

- **base 的"无框架规则"这句是错的。** `index.js` 头注写着"TypeScript recommended + 基础最佳实践,无框架规则",
  但同一文件 `import react from 'eslint-plugin-react'`、`import reactHooks from 'eslint-plugin-react-hooks'`,
  把两个插件都注册进去,并设了 `react/react-in-jsx-scope: 'off'` 与 `react-hooks/rules-of-hooks: 'error'`;
  `react.js` 随后又原样叠一遍。⇒ base 实际已含 react 规则,`react.js` 的那一层部分冗余。
  按"改被审代码写法必须同时改审它的措辞"这条规矩,要么删 base 里的 react 档,要么改头注,不得两头都说。
- **两枚自写规则零测试。** 现查 HEAD:`no-unpaired-card-content-padding` 与 `ihui-cross-end` 这两个名字
  只出现在 `packages/eslint-config/` 自己的三个文件里,全仓没有任何 `RuleTester` / 镜像用例。
  规则漏判或误判不会有任何地方变红。
- **包 `package.json` 连 `scripts` 字段都没有**(实测 `p.scripts === null`)⇒ `pnpm -r lint` / `typecheck` /
  `test` 全部跳过本包。也就是说:一个语法错、或一条把 14 份配置全钉红的规则,在提交链上只能靠"别人真的去跑 lint"
  才会被发现。
- 4 个兄弟包(`dom-actions` / `browser-platform` / `ui-native` / `i18n`)声明了 `"lint": "eslint src/"`
  却**没有自己的 `eslint.config.*`**,实测在包目录里直接跑 eslint 返回 0(即解析到了上层配置)。
  ⇒ 这几包实际生效的规则集由"eslint 从哪个目录被调用"决定,而不是由包自己声明。
- **`docs/PACKAGES.md` 给的出路跑不通。** 现查 HEAD:该文件 384/385/462 行写着
  `import baseConfig from '@ihui/eslint-config/base.js'` 与 `'@ihui/eslint-config/react.js'` ——
  `base.js` 这个文件在本包**根本不存在**(base 就是 `index.js`,经 `'.'` 递出),而带 `.js` 后缀的
  `'./react.js'` 也不在 `exports` 里(`exports` 键是 `'./react'`)。照文档抄会得到解析失败。
  AGENTS 已多次记过"文档不得写跑不通的出路",这一格属同一型,归该文档持有人改,不由本包消红。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
