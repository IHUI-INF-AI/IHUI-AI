<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-->
<!-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

# 工具契约字段消费账(2026-11-27)

> 票面:把 `packages/types/src/tool-contract.ts` 的契约字段从"声明"推进到"有真实消费者",
> 并让守门 `scripts/check-tool-contract-declared.mjs` 的读数是权威口径。
> 口径勘误:此前写的"HEAD 面 129 枚全部带契约"是**索引面**读数,已按三面实测改正。
> 三面实测 —— 索引面 122 处 `contract: {` 声明(129 枚全覆盖)/ 工作树 123 处(130 枚,含未入库的 `ptc-tool.ts`)/
> **HEAD 面只有 8 处声明、15 枚带契约、114 枚无契约**(存量违规 139 处由各文件计数锚点承载,棘轮只禁新增)。
> 也就是说:契约补齐停在索引与工作树,尚未进入 HEAD —— 本账第 1 节那张表的"消费"结论,对 HEAD 只覆盖那 15 枚。
> tsc EXIT=0,契约面四支测试 48 条全绿(23+6+5+14)。

## 1. 字段 → 消费者 → 行为影响

| 字段 | 消费者(文件:行) | 行为影响 | 测试锁 |
| --- | --- | --- | --- |
| `permission.requiresApproval` | `tools/permissions.ts` `decideWithMode`(165) + `tools/danger-gate.ts`(144-166) | **会改结论**:mode 矩阵的 `allow` 升 `ask`;`--allow-dangerous` 旁路对 mandated 工具被拒,报 `contract-approval-required` | `tool-contract-approval-baseline.test.ts` ① |
| `permission.alwaysAsk` | 同上(`humanApprovalMandated` 内) | 同上,且对 `bypassPermissions` 也强制问 | 基线 ② |
| `permission.effectScope` | 同上 + `utils/spec-drift.ts:583`(仅漂移报告) | 经 `humanApprovalMandated` 间接影响批准;spec-drift 只报告不决策 | 基线 ①,消费测试 ④ |
| `permission.permissionKey` | `tools/permissions.ts` `withPermissionKeyAliases` → 6 个调用点(`commands/agent.ts` 3 处、`tools/index.ts` 4 处) | 规则可用能力键(`fs.write`/`git.commit`)精确授权/拒绝,与工具名同等参与 deny>allow>ask;不改既有规则结论 | 消费测试 ⑥ |
| `permission.matchSources` | `tools/permissions.ts` `matchRulePattern`/`extractSourceValues`/`ruleMatches` → `checkPermissionRules`(6 个调用点) | **仅当规则写 `来源:模式` 且工具声明来源时生效**:`command:git commit*` 放行具体命令、`url:https://example.com*` 限域;未声明来源恒不命中,入参缺该项时 allow 面保留(assume-match)、deny 面不摘(assume-miss) | 消费测试 ⑦(6 条) |
| `shape.visibleToProvider` | `tools/index.ts` `toolsToProviderSchema`(2262 行过滤) | 显式 `false` 的工具不下发给 provider;缺省/无契约/第三方动态面一律保留 | `advertising-surface.test.ts` ④ |
| `resultBudget` | `commands/agent.ts:3440` → `tools/result-envelope/envelope-tool-result.ts` → `budgets.ts` | 真裁剪:`providerVisibleLimitBytes`→`maxChars`、`preview.bytes`→`previewChars`;`inlineLimitBytes` 刻意不投影(归 UI 侧) | 既有 `tool-result-budget-contract*.test.ts` |
| `resultBudget.policy` | `tools/result-envelope/budgets.ts:122-135` | `inline` 不限、`truncate` 只留预览不落盘、`artifact` 落盘并回灌路径+预览;未知值降级 `artifact` 并记 `unimplemented` | 既有 budget 测试 |
| `permission.confirmation` | 无运行时消费者 | 声明面;类型头注明令"既有工具不因本字段改行为" | 基线 ③ |
| `shape.input` | **零消费者(刻意)** | 投影唯一源是 `Tool.parameters` + `Tool.required`;接上会丢 properties | `advertising-surface.test.ts` ⑤ |
| `permission.denyPrecedence` / `permission.persistAllowance` | 全仓 0 处填写 | 保留位:前者是放宽 deny 优先级的安全边界、后者需"总是允许"的持久化面与 UI,均无运行时路径 | — |

## 2. 两格的处置理由

- **`shape.input` 不接投影**:投影唯一源是 `projectToolInputSchema(Tool.parameters, Tool.required)`
  (`packages/types/src/schema-projection.ts:348`)。契约里的 `shape.input` 是"形状自述",不是参数 schema
  的第二源;接上会让真实 properties 消失。`advertising-surface.test.ts` ⑤ 用 `parameters={path}` +
  `shape.input={poisoned}` 做了正反两向断言(该出现的是 path,不该出现的是 poisoned)。
- **`permissionKey` 已接线**:名单从"工具名 + 旧名"扩到"工具名 + 旧名 + 能力键",三类都是**精确匹配**
  (`anyNameMatches` 不解析通配),`deny > allow > ask` 的相对优先级不变;`withPermissionKeyAliases`
  在无键/键已在名单时原样返回,与不传逐字节等价。
- **`matchSources` 已接线(仅声明后生效)**:规则模式写成 `来源:模式`(如 `path:src/**`、`command:git commit*`、
  `url:https://example.com*`)时,只有**声明了该来源且入参能取出该来源值**的工具才参与匹配;
  未声明来源的工具对内容规则恒不命中——内容规则不会经工具名正则悄悄开闸。不传上下文的旧调用与改前逐字节同结论。
  `tool-name:` 前缀是唯一例外:工具名总是可得,写 `tool-name:foo` 等价裸名 `foo`(含尾部 `*` 通配),不要求声明。

## 3. 守门的抽取口径(129 是"工具数"的权威口径,不是"带契约数")

`scripts/check-tool-contract-declared.mjs` 有三条结构化判据,**只用来排除假阳性,不放宽真缺契约**:

1. `isTypeDeclarationBody` —— `export interface Tool` 的类型声明体不算工具;
2. `isDeadStubExecute` —— `gateRemoteHubTool` 里 `async () => ({ success: false, output: '' })` 的审批闸只读死桩不算工具
   (它的 execute 恒失败,注册也无人可达);
3. 第三方动态面 —— 非字面量名 + `approvalExemption` + `registrationOwner` 三件套**同时成立**才跳过
   (MCP 动态装配刻意不塞 contract:给第三方伪造 `resultBudget` 等于替其输出加裁剪)。

其余形态(工厂 `contractFor('read'|'write'|'dangerous')`、常量 `WRITE_CONTRACT`)都按"有契约"计入;
守卫自检 52 条(`--self-test`)含"字面量名带两轴仍算工具"的反例。

## 4. 复验命令

- 守门判 HEAD 面:`node scripts/check-tool-contract-declared.mjs`(129/114/棘轮 0/摘除 0;门体跨代时恒 UNDETERMINED=rc2,须先对齐门体)
- 守门判索引面:`node scripts/check-tool-contract-declared.mjs --staged`(129/0/棘轮 0/摘除 0/flip-audit 0)
- 守门自检:`node scripts/check-tool-contract-declared.mjs --self-test`(52/52)
- 镜像:`node --test scripts/tests/check-tool-contract-declared.test.mjs`(25/25)
- 契约面测试(在 `apps/cli` 目录):
  `node node_modules/vitest/vitest.mjs run tests/tool-permission-contract-consumed.test.ts tests/tool-contract-approval-baseline.test.ts tests/advertising-surface.test.ts`(27/27)
- 类型:在 `apps/cli` 目录 `node node_modules/typescript/bin/tsc --noEmit`(EXIT=0;`npx tsc` 在本机会因缓存损坏不可用)

## 5. 未解与后续

- `permission.denyPrecedence` / `permission.persistAllowance`:保留位——前者是放宽 deny 的安全边界、
  后者需"总是允许"的持久化面与 UI,全仓无此运行时路径;启用前需产品拍板。
- `ptc-tool.ts` 未入库:其相对导入 `ptc-executor.ts` / `tool-executor.ts` 均不在 HEAD,
  现在提交会破坏 HEAD 编译,归其作者随功能链一起入。
- `api-bridge.ts#api_delete` 与 `worktree-tools-exit.ts#exit_worktree` 保留 `requiresApproval: true`:
  前者走端点 RBAC,后者要求用户主动进入 worktree,是既有设计;基线锁按名单允许这两枚。
- `inlineLimitBytes` 不投影、`preview.from = tail` 未实现:均已在 `budgets.ts` 注释登记,属 UI 侧后续。

## 怎么跑

- 契约一致性读数:`node scripts/tool-contract-conformance.mjs`。三态 `ok` / `not-ok` / `unknown`——`unknown` 是守门跨代**拒绝回答**(退出码 2),不读成通过;跨代模式 `--worktree-body` 的读数失真,不进发布账。
- 端到端自测:`node --test scripts/tests/tool-contract-conformance.test.mjs`(4 条);全量脚本测试入口 `test:scripts` 会把它收进来。
- 规范正文:`docs/spec/tool-contract-protocol.md`(ITCP v0.1)。
- 守门:`node scripts/check-tool-contract-declared.mjs`(`--self-test` 52 条)。
