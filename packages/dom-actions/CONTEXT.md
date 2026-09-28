<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/dom-actions — 契约与边界

一句话职责:纯 DOM 侧的页面动作与页面快照的**唯一实现处**。8 个 `BrowserControlActionType`
(click_element / type_text / scroll / extract_dom / wait_for_element / get_attribute / hover / select_option)
的 DOM API 实现,加上句柄制的页面快照协议 —— 全程零 `chrome.*` 依赖,可在任何浏览器环境运行
(content script / web / desktop webview / RN webview)。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/dom-actions'" HEAD -- apps`)

8 个文件,全部走主入口:

- `apps/extension`:`lib/agent-control.ts`(`type DomActionResult`、`isDomAction`、`executeDomAction`)、
  `lib/agent-control-bridge.ts`(`PAGE_ACTIONS`)、`lib/ext-ui-forwarder.ts`(`type DomActionResult`)、
  `lib/page-snapshot-adapter.ts`
- `apps/cli`:`src/tools/browser-page.ts`(+ `tests/browser-page-action-parity.test.ts`、
  `tests/browser-page-snapshot.test.ts`、`tests/browser-page-snapshot-injection.test.ts`)

## 2. 公开面(package.json `exports` = `"."` 与 `"./package.json"`;`src/index.ts` 是唯一递出面)

`main`/`types` = `./dist/index.js`(构建 `tsc -p tsconfig.build.json`)。入口由「5 个 `export *` 子模块 + 本文件自有导出」组成:

- 动作分派:`DOM_ACTIONS`(Set)、`isDomAction()`、`executeDomAction()`、`DomActionResult`
  (其 `errorCode` 是 `AgentActionErrorCode | PageActionErrorCode` **并列**而非改写 —— 句柄族与选择器族错误码语义不同)
- `page-snapshot/contract.ts`:`PAGE_API_GLOBAL_KEY`(`__ihuiPageApiV1`)、`PAGE_HANDLE_PREFIX`、`PAGE_SNAPSHOT_SCHEMA`、
  `PageActionType`、`PAGE_ACTIONS`、`PAGE_READONLY_ACTIONS`、`isPageAction`、`PageActionErrorCode`、
  `DEFAULT_PAGE_SNAPSHOT_BUDGET` / `PAGE_SNAPSHOT_BUDGET_CAPS` / `clampPageSnapshotBudget`、
  `SNAPSHOT_ROW_FIELD_ORDER` / `SNAPSHOT_ROW_DROP_ORDER` / `SNAPSHOT_ROW_PROTECTED_FIELDS` / `SNAPSHOT_TOP_LEVEL_DROP_ORDER`、
  `formatPageHandle` / `parsePageHandle`、`PAGE_ATTR_WHITELIST` / `normalizeAttrName`
- `page-snapshot/page-api.ts`:`installIhuiPageApi`、`pageApiInstallerSource`、`buildPageApiOptions`、`newPageScope`、
  `getIhuiPageApi`、`disposeIhuiPageApi`、`PAGE_INTERACTIVE_SELECTOR`、`PAGE_BODY_SELECTOR`
- `page-snapshot/install-expression.ts`:`buildPageApiInstallExpression`、`wrapInstallerSource`、`injectedHelperNeeds`
- `page-snapshot/serialize.ts`:`serializeSnapshotResult`、`renderSnapshot`、`snapshotToText`、`renderEmptySnapshot`、`protectedRowFields`
- `page-snapshot/host.ts`:`installPageApi`、`pageApiState`、`outcomeOf`、`runPageAction`、`runPageActionWithApi`、
  `snapshotOutcomeOf`、`buildSnapshotResult`、`dispatchedOutcome`
- 编译期契约钉:`PageActionContractParity = Expect<Equals<PageActionType, BrowserPageControlActionType>>`
  —— 本包动作枚举与 `@ihui/types` 的 `BrowserPageControlActionType` 一旦不等,**编译即失败**,不靠人记。

## 3. 依赖方向与边界(`- id: 'packages/dom-actions'`)

`layer: platform` · `exported: true` · `managed: true` · `requires: ['packages/types']` · `public_entrypoints: ['.']`

- 唯一的仓内依赖就是 `@ihui/types`(`src/index.ts:19` 取三个类型),层级 platform(20) → contract(10) 不反向。
- **快照预算、字段顺序、丢弃顺序、属性白名单只在这里有一份**。端内要改"快照里留哪些字段/多少行",
  改本包并同步消费端;不得在 `apps/extension` 或 `apps/cli` 里另拼一份字段表 —— 那正是 AGENTS §3 禁止的端内重复实现。
- 只有 `.` 一个出口 ⇒ 任何 `@ihui/dom-actions/src/page-snapshot/...` 形态的穿透都是 D3 深导入,本门判红。
- `host.ts` 与 `page-api.ts` 是**两个运行位置**:`page-api` 注入到被测页面里跑,`host` 在宿主侧调度。
  把宿主逻辑写进 page-api(或反向)会跨执行环境,不构成"复用"。

## 4. 已知缺口 / 未收口的点

- `src/index.ts` 头注的"调用方"一栏只写了 `@ihui/extension`,漏了 `apps/cli` —— 现查 HEAD `apps/cli` 有 4 个
  引用点,且表里 `requires` 也是 2026-09-25 才按现实补上的(见策略表内该票留痕)。措辞待随下次改动更正。
- package.json 的 `exports` 里有 `"./package.json"`,而策略表 `public_entrypoints` 只列 `'.'`。
  这是 pnpm/打包惯例暴露,**不等于**允许端内按路径 import 内部文件;E1 只核对表里声明的那一条。
- 本包无 `eslint.config.*`(见 `@ihui/eslint-config` 的 CONTEXT.md 同一条):`lint` 脚本存在但配置向上继承仓库根。
- 无自有 `test` 脚本,判据用例住在**消费端**(`apps/cli/tests/browser-page-*.test.ts`)⇒ 单独改本包时
  必须去跑那三枚 cli 测试,本包自身跑不出红。
- 本包不声明 `contract_files`,也不命中 `contract_file_patterns` ⇒ E2 齐备性由此文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
