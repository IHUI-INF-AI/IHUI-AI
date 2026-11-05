<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S2 落地票 — Qoder catalog 词表复现+超越(goal-b49)

## 1. 现场读数

- 标题行:goal-b49 执行席 S2 — 贡献词表扩档 + 装载器消费 + 权限→dataClass 默认拒
- 开工 `git rev-parse HEAD` = `e557c22648652636498e67f726fe74de1f46291f`;收尾再读一次 = 同一枚(本席未提交,按票面边界)
- 分支 `main`;四个目标文件动手前 `git status --porcelain -- <路径>` 均为净(含 `capability-catalog.ts`,故第 3 格在本席落地,未转主席)
- 词表基准不是抄文档得的:票面 §3 #8 只点名 4 档,归档件 2026-10 那篇列的 8 档里含 `activationEvents`(那是顶层键、不是 contributes)。
  正解取自对侧装机件现读一次(只读 JSON 的**键名与顺序**,未取任何源码正文):
  `G:/Qoder CN/resources/extensions/catalog.v1.json` → plugins=10、contributes 键集 8 档、permissions 去重 33、activationEvents 去重 15,
  与票面三个计数逐一对上;8 档第一出现序 = `views, filePreviewers, qoderAgentSdk, configuration, nativeModules, sidebarNavItems, sessionResources, chatMentionProviders`

## 2. 落了什么

### 2.1 `packages/types/src/capability-extensions.ts`
- `EXTENSION_CONTRIBUTION_KINDS` 由 3 档 → 10 档:**前 8 档与对侧同名同序照抄**,末 2 档 `tools`/`commands` 是本仓先行档。
  裁决依据(AGENTS §7 三问):对侧无同名键(其命令以 md 文件交付、工具走 MCP),但我方 `capability-catalog`
  的 `toolScopeMap()`/`scopeOfTool()`/`registeredTools` 全靠 `contributes.tools` 活着 —— 答"无等价实现",故只并集、不删不改名。
- `ExtensionContributions` 补齐 10 个键(键集与词表一一对应);全部档收敛成同一种载荷形 `{name, capability}`。
  这是**刻意的不照抄**:对侧各档形态互不相同(`views[].slot`、`filePreviewers[].filenameSuffixes`、`configuration.properties`),
  于是它的 permissions 与贡献之间没有任何可机读的绑定;我方一档一形统一,才可能让默认拒闸覆盖到每一档。
- 校验器无一处写死档名(`CONTRIBUTION_KEYS`/`unknown_field` 消息均由词表派生),`contribution_duplicate` 文案改为"各贡献档共用同一名字空间"。

### 2.2 `packages/types/src/capability-catalog.ts`(默认拒 + 堵住一个真洞)
- `eachContribution()` 原样硬编码 `['tools','commands','views']` —— 词表扩档后新档会**绕过贡献名冲突登记**
  (注册表说"没占用"、其实被占着)。改为遍历 `EXTENSION_CONTRIBUTION_KINDS`,头注写明为何不得写死。
- 新增 `extensionDataClassGrant()` / `extensionMayTouchDataClass()` + `ExtensionDataClassGrant` / `ExtensionDataClassBasis` 类型:
  permissions 经 `INDEX` → `effectiveDataClass()` 求并集。三条边界:空权限 ⇒ `allowed=[]`(默认拒);
  声明但未登记的 scope ⇒ 不贡献数据类并逐条点名进 `unregistered`(§0.3 不得写成"没限制");按声明顺序去重(可 diff)。
- 刻意**不动** `buildManifest()`,免碰 `export-capabilities --check` 的逐字节基线(已实测 `pnpm capabilities:check` 仍绿)。
- 刻意**不导入**对侧那 33 条点分权限名(`chat.createSession` 形态):`api-key.ts` 的枚举是 api/ai-service 真实授权面,
  把外部词表并进去 = 无消费者的授权面扩大,且该文件不在本席射程。复现的是"细粒度权限声明 + 数据类切分"这一**能力**,不是它的字符串。

### 2.3 `apps/cli/src/plugins/loader.ts`(词表的运行期消费方)
- 从 `@ihui/types` 取词表与 `extensionDataClassGrant`(不另抄名单,§0.6)。
- `CONTRIBUTION_SUPPORT: Record<ExtensionContributionKind, {support, reason}>` —— 键型即编译期闸:加档不登记即红。
  本宿主 `wired` 只有 `tools`/`commands`;其余 8 档 `no-host`,逐档给得出原因(`nativeModules` = "要匹配本机 ABI 的原生 .node,装载器从不加载原生码"…)。
- `classifyContributions()` 三态出声:`accepted` / `declined` / `unknown-kind`(后者把**当前词表全量**报进 reasons)。
  两道默认拒闸:档必须在词表内;落在词表内还得有数据面(权限求出的 `allowed` 为空 ⇒ 即使 `wired` 也 declined)。
- 接线位置在 `scanPlugins()` 的 `acceptManifest()` 内,即**每一份通过最小校验的清单**都逐档裁决 —— 含后来因同名歧义被弃装的那份
  (歧义管"装不装",本管"声明了什么、宿主吃不吃得下",互不遮蔽)。
- 出口:`loadPluginsWithDiagnostics()` 返回形态不变(`{plugins, diagnostics}`,`commands/agent.ts:531` 的解构零改动);
  新增 `loadPluginsWithContributionAudit()` 附带 `contributions` 汇总。诊断主通道用不了的原因见 §4-①。
- i18n 维的处理:裁决原因走 `PluginDiagnostic.message` 同一约定 = **ASCII 稳定文案**(types.ts 头注明文要求"要能进日志,不得被控制台码页吃掉"),
  属机器账面而非用户可见 UI 文案;因此**不新增五语言键、不改任何 messages JSON、端内零硬编码中文**。将来要给人看时,由 UI 侧按 `kind`+`verdict` 取具名键渲染,原因串只作日志凭据。

### 2.4 测试(两枚新件,五组用例齐)
- `packages/types/tests/capability-contribution-vocabulary.test.ts`(10 例):对侧 8 档同名同序锚定(独立 `BENCHMARK_KINDS` 常量,漂移即红)、
  ④词表↔校验器穷尽(逐档往返必须 ok,且规范化 `contributes` 带该键)、未知档拒并点名全量词表、③默认拒负侧、⑤默认拒不误伤正侧、
  未登记 scope 点名、多权限顺序去重、注册表遍历覆盖新档(nativeModules 同名二注册 ⇒ `contribution_conflict`)。
- `apps/cli/tests/plugin-contribution-audit.test.ts`(10 例):①新档被识别(= 具名 `declined`,不是 `unknown-kind`)、②未知档拒并点名、
  ③缺权限 ⇒ 默认拒(正反对照)、④装载器侧逐档穷尽(任何一档掉进 unknown-kind 即红)、⑤合法权限正常件 accepted 且照常装载、
  既有 `loadPlugins`/`loadPluginsWithDiagnostics` 契约回归对照、同名歧义仍逐条出声。

## 3. 验证末行现读

- `npx tsc --noEmit -p packages/types/tsconfig.json`(scripts.typecheck 现读 = 同形)⇒ `tsc exit=0`,零输出
- `cd packages/types && npx vitest run` ⇒ `Test Files  38 passed (38)` / `Tests  420 passed (420)`(含本席新增 10 例)
- `cd apps/cli && npx vitest run tests/plugin-contribution-audit.test.ts tests/plugin-loader-diagnostics.test.ts tests/plugins.test.ts tests/g-728-plugin-diagnostic-dispatch.test.ts tests/plugin-name-ambiguity.test.ts tests/plugin-dependency-closure-g682.test.ts`
  ⇒ `Test Files  6 passed (6)` / `Tests  99 passed (99)`
- `cd apps/cli && npx vitest run tests/plugins-integration.test.ts tests/plugin-ambiguous-name-g658.test.ts tests/plugin-name-ambiguity.test.ts`(装载链最重的既有件单独补跑一轮)
  ⇒ `Test Files  3 passed (3)` / `Tests  26 passed (26)`
- `pnpm --filter @ihui/types build` ⇒ `[atomic-build] 完成：新构建已原子换入 dist`(**必跑的一次**:loader.ts 取的是 `@ihui/types` 的 dist 运行时值,
  dist 不重建则 CLI 侧拿不到新导出;`dist/` 由 `.gitignore:76` 屏蔽,不进入任何提交面)
- `cd apps/cli && npx tsc --noEmit` ⇒ 剩余报错全在**他席在飞文件**:`src/commands/skill-package.ts`(票面已证的既有断口)+ 前一轮的 `src/checkpoints/index.ts`(S3,收尾时已被该席自行修好);
  本席改过的文件 `grep -E "plugins/|plugin-contribution|capability"` ⇒ **0 命中**
- `npx tsc --noEmit -p apps/cli/tsconfig.tests.json` ⇒ 本席测试件唯一命中是 `TS7016 scratch-dir.mjs`,同型报错全仓 35 枚测试件共有(非本席引入)
- `pnpm capabilities:check` ⇒ `[capabilities] ✓ 产物与能力目录一致`(scope 枚举 63 / 已登记 63 / 工具映射 103 条)
- `node scripts/check-declared-policy-has-consumer.mjs`(门 121)⇒ `✅ 通过(… 判红文件 0 / 未判定 0)`;本席新增符号不在"未接线 11"清单内
- `npx prettier --check` 五枚触及文件 ⇒ `All matched files use Prettier code style!`
- `node scripts/watermark.mjs verify` 两枚新建 `.ts` ⇒ 各 `覆盖 1/1 … 纳入口径的文件均已携带完整溯源水印`(prettier 后重新 inject 再 verify)
- 交付态 = 工作树改动(3 枚 M + 2 枚 ??),**未 commit、未 push、未动 PROJECT_PLAN.md/AGENTS.md/scripts/**/docs/benchmark-evidence/****(按票面边界,落地腿交主席)

## 4. 未竟(逐条带解锁条件)

- ① **拒档尚未进诊断主通道**。`PLUGIN_DIAGNOSTIC_CODES` 是 `types.ts` 里的封闭联合,`DIAGNOSTIC_SEVERITY` 又是 `Record<code,…>` 穷尽表,
  而票面限定"只许改 loader.ts 这一枚 `apps/cli/src/plugins/` 下的文件"⇒ 本席不能加 `plugin-contribution-declined` 码,只能另开出入口。
  解锁条件:`apps/cli/src/plugins/types.ts` 归属本席或空闲时,加一枚码 + 严重级(`warning`),把 findings 并进 `diagnostics`,
  并把 `apps/cli/src/commands/agent.ts:531` 的调用点切到 `loadPluginsWithContributionAudit()`(同批补 `g-728` 分档派利用例)。
- ② **`loadPluginsWithContributionAudit()` 生产调用方为零**(现仅测试件调用;判定本身已在生产扫描路径里跑)。
  解锁条件 = ①落地后由 `commands/agent.ts`(S1 射程外,现读他席在飞)换出口;在那之前不得对外称"已装车到用户可见面"。
- ③ **`loader.ts` 现 533 行**,超票面"每文件 <250 行"(动手前已 311 行)。机械门 11e 阈值 800 行且只拦新增文件 ⇒ 未红。
  解锁条件:允许在 `apps/cli/src/plugins/` 下新建 `contribution-audit.ts` 时拆分(本席受"只许改 loader.ts"约束,无法拆)。
- ④ **UI 类档(`views`/`sidebarNavItems`/`filePreviewers`/`chatMentionProviders`/`sessionResources`)只有拒绝路径,没有承接面**。
  解锁条件:desktop/web 侧落出可挂载的宿主扩展点之后,把该档从 `no-host` 改 `wired` 并在同批改 ②③④ 对应测试的分类断言。
- ⑤ **对侧 33 条权限名未入库**(见 §2.2 的裁决)。解锁条件:出现真消费方(某插件确实需要 `chat.observeTurn` 语义)时,
  按我方 `xxx:yyy` 命名法在 `packages/types/src/api-key.ts` + catalog 同批登记,并同步 `scripts/check-capability-catalog.mjs` 与 api 路由授权面 —— 那是跨席改动,不在本席射程。
- ⑥ **`activationEvents` 词表(我方 6 种 vs 对侧 15 种)本票未动**。票面 §3 #8 只把它当计数事实登记,落地范围明写"贡献词表 + 权限→dataClass"。
  解锁条件:另开一票扩 `EXTENSION_ACTIVATION_EVENTS`,同批必须有消费方(激活调度面在 `apps/cli/src/`,当前归属他席)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
