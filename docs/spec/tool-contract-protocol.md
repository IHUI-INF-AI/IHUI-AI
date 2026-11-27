<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI Tool Contract Protocol（ITCP）· v0.1

> 状态：草案。本仓现行实现即参考实现：`packages/types/src/tool-contract.ts`（类型与谓词）、
> `scripts/check-tool-contract-declared.mjs`（守门）、`scripts/tool-contract-conformance.mjs`（一致性读数）、
> `docs/engineering/tool-contract-consumers-2026-11-27.md`（消费账）。

## 0. 目的

把“一个工具怎样声明自己”从注释和约定，提升为**可机检的契约**。四件套：

一份声明（`ToolContract`）+ 一个守门（棘轮只降不升）+ 一份消费账（字段 → 消费者 → 行为 → 测试）+ 一个一致性运行器（五项读数）。

判据只有一条总原则：**声明必须有人读**。写了字段却没有任何生产路径消费它，等价于空支票，守门判红。

## 1. 术语

- **工具（Tool）**：可被模型调用的能力单元，注册进工具表后有名字、描述、入参 schema、危险档。
- **契约（ToolContract）**：挂在工具上的三组声明——形状（shape）、权限（permission）、结果预算（resultBudget）。
- **消费者（consumer）**：生产路径上真正读该字段的代码位置，必须能给到 `文件:行`。
- **棘轮（ratchet）**：按文件记录的存量违规计数锚点。只允许降低，不允许新增。
- **消费账（consumer ledger）**：字段 → 消费者 → 行为影响 → 测试锁 的表格，一处一份，不得分叉。
- **保留位（reserved slot）**：类型里有字段、但明确不做运行时消费的声明位。必须在消费账里点名并写理由。

## 2. 契约字段（v0.1）

### 2.1 形状 shape

| 字段 | 必填 | 值域 | 缺省语义 |
| --- | --- | --- | --- |
| `visibleToProvider` | 是 | boolean | —（必填） |
| `input` | 是 | `ToolShapeDescriptor` | —（必填） |
| `output` | 否 | `ToolShapeDescriptor` | 不校验出参 |
| `runtimeOnlyNotes` | 否 | string[] | 无额外约束 |

规则：

- `visibleToProvider === false` ⇒ 该工具不进 provider 投影（内部编排专用）。
- `input` 是**校验面与模型面同源的那一份**；模型可见 JSON Schema 由 `schema-projection.ts` 单向投影，不得有第二份。
- `input.properties` 里**禁止**放路由身份键（`ROUTING_IDENTITY_KEYS`，16 个）。它们由宿主在 closure/ctx 绑定，进 schema = 把投递定址交给模型。

### 2.2 权限 permission

| 字段 | 必填 | 值域 | 缺省语义 |
| --- | --- | --- | --- |
| `permissionKey` | 是 | string | — |
| `reason` | 是 | 非空 string | — |
| `riskLevel` | 是 | `read` / `write` / `dangerous` | — |
| `effectScope` | 是 | `none` / `workspace` / `repository` / `network` / `system` / `delegate-to-caller` / `ask-user` | — |
| `requiresApproval` | 是 | boolean | — |
| `alwaysAsk` | 否 | boolean | 不额外强制 |
| `confirmation` | 否（write/dangerous 必填，判据 TC5） | `explicit-flag` / `interactive` / `none`（`none` 必须带 reason） | read 档可不填 |
| `matchSources` | 否 | `tool-name` / `input` / `path` / `command` / `url` | 不参与内容规则 |
| `denyPrecedence` | 否 | `before-ask` / `after-static-allow` | 保留位（不做运行时消费） |
| `persistAllowance` | 否 | `permanent` / `session-only` / `never` | 保留位（不做运行时消费） |

规则：

- `effectScope` 是 `mayWriteWorkspace` / `touchesExternalWorld` 的唯一输入；认不出返回 `null`，**不静默降级**。
- `humanApprovalMandated` 是“要不要问人”的唯一投影出口；任何宿主不得再抄一份档名清单。
- `matchSources` 是**声明后才生效**：未声明来源的工具对 `来源:模式` 内容规则恒不命中；`tool-name:` 前缀等价裸名。

### 2.3 结果预算 resultBudget

| 字段 | 必填 | 值域 | 缺省语义 |
| --- | --- | --- | --- |
| `inlineLimitBytes` | 是 | 正整数 | — |
| `providerVisibleLimitBytes` | 是 | 正整数 | — |
| `policy` | 是 | `inline` / `truncate` / `artifact` | — |
| `preview` | 是 | `{ bytes, lines, from: 'head' \| 'tail' }` | — |
| `artifactRetention` | 否 | `turn` / `session` / `persistent` | 不落盘保留 |

规则：

- `inline` 不限、`truncate` 只预览不落盘、`artifact` 落盘回灌路径+预览；未知值降级 `artifact` 并记 `unimplemented`。
- 截断账目由 `buildToolResultTruncationRecord` 唯一构造：只记事实（两枚字节数 + 实际施加的策略），不记自述。

## 3. 三级状态机

一个字段从“写了”到“真生效”要过三关，缺一不算启用：

1. **声明（declared）**：类型上有字段，工具填了值，可编译。
2. **消费者（consumed）**：生产路径读它，能给到 `文件:行`，行为有变化（或明确零变更）。
3. **基线锁（locked）**：一条测试钉住行为，防回退。

未过第 2 关 ⇒ **保留位**：必须在消费账点名，写“为什么不做”。禁止把保留位说成已启用。

## 4. 守门判据（`check-tool-contract-declared.mjs`）

| 判据 | 内容 | 红 |
| --- | --- | --- |
| TC1 | 新增工具无契约（按文件棘轮锚点计） | 是 |
| TC2 | 契约声明被摘除 | 是 |
| TC3 | 已声明身份被摘除 | 是 |
| TC5 | `write` / `dangerous` 档无 `confirmation` | 是（按文件锚点） |
| flip-audit | `requiresApproval` / `alwaysAsk` 翻缺省审计 | 报数 |

守门自带 `--self-test`（当前 52 条判据自检）与镜像测试，防“判据自己被改坏”。

## 5. 一致性读数（conformance）

运行：`node scripts/tool-contract-conformance.mjs [--json]`

五项读数：

- `tools` — 注册工具数
- `missingContract` — 无契约工具数（目标 0）
- `ratchetMargin` — 棘轮余量（目标 0 或更低）
- `removedContracts` — 契约摘除数（目标 0）
- `flipAudit` — 翻缺省审计命中数（目标 0）

外加 `selfTest.pass / selfTest.fail`。任一非零 ⇒ 判定 `not-ok`，退出码 1。

### 5.1 三态与跨代（不允许把“没判”读成“通过”）

运行器只有三种判定：

- `ok` — 五项读数全零 + 自检 0 失败 + 守门退出码 0。
- `not-ok` — 任一读数非零（明确的红）。
- `unknown` — 守门**拒绝回答**（典型：本地正在执行的门体 blob 与被判修订的该路径 blob 不同代）。

`unknown` 时运行器不猜读数，转述守门原话（人话 + 出路），退出码 2。确知要按工作树门体判的可显式 `--worktree-body`；该模式读数**跨代失真**（新判据去判旧树），输出会标注“不得当发布结论”——失真读数只能用于自查，不能进发布账。

## 6. 兼容与版本

- 新增字段**必须可选**：既有工具不得因新字段而编译失败。
- 缺省语义**必须与引入前逐字节一致**（可见、不生效、零变更）；翻缺省是行为变更，必须单独一票。
- 字段增删改要 bump 版本；v0.1 起，`TOOL_*` 常量数组是唯一值域来源。

## 7. 采纳三步

1. 在工具上声明 `contract`（三组字段；write/dangerous 档补 `confirmation`）。
2. 跑 conformance：`node scripts/tool-contract-conformance.mjs`，五项读数 + 自检。
3. 把该字段的消费者写进消费账，并补一条基线测试（声明 → 消费者 → 锁）。

## 8. 非目标（v0.1 明确不做）

- 不定义跨语言运行时；v0.1 只管声明与判据。
- 不强制第三方工具填 `resultBudget`（会替其输出加一道裁剪）。
- 不做 `denyPrecedence` / `persistAllowance` 的运行时语义（保留位）。
- 不做“未声明即不可信”的运行时翻缺省（属第二阶段独立票）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
