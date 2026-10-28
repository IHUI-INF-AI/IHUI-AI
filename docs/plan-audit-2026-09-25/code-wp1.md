<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# WP-1 编码批次报告 — CLI 自动批准策略接入执行链

> 结论先行:**本票未由本会话写码。** 开工单写者检查通过,但会话进行中(几分钟内)另一并行会话
> 把我票面全部目标文件(`builtins.ts` / `terminal.ts`,连带 `command-safety.ts`)从 clean 改成 `M`,
> 且实现内容正是本票(含三层装车证明测试)。按 `RULES-FOR-CODERS.md`
> 「输出非空 ⇒ 该文件正被他人编辑,立即停止并在报告里说明,不得写」,本会话对受管文件**零写入**,
> 转为 §12b 协作收尾路径:独立复核他人实现 + 核实悬空指向 + 本报告。

## 1. 单写者检查时间线(取证)

| 时刻 | 命令 | 结果 |
| --- | --- | --- |
| 开工 | `git -c safe.directory=* status --porcelain -- <目标清单>` | 仅 `M apps/cli/tests/budget-note.test.ts`(禁改清单内他人文件),目标文件全 clean ⇒ 放行开工 |
| 复核(读码后) | 同上 + 分文件 | `M builtins.ts`、`M terminal.ts`、`M command-safety.ts` 出现;HEAD 已从票面 `199a00a9d53` 推进到 `11ded4071a7` |
| 收尾 | `git status --porcelain -- apps/cli/...` | 120 项在途,含并行会话**持续新增**(`?? tests/command-policy-wiring.test.ts`、`M tests/hooks-trust-gate.test.ts` 等,后者是收尾时才出现的)⇒ 对方仍在工作 |

本人全程未执行任何 git 写操作;本会话唯一落盘文件 = 本报告(`.ihui-agent/tmp/`,gitignored,非跟踪源文件,无需水印注入)。

## 2. 票面缺口在 HEAD 的复验(可直接采信)

`git show HEAD:apps/cli/src/tools/builtins.ts` / `terminal.ts`(HEAD=`11ded4071a7`,晚于票面 `199a00a9d53`,**旧判据仍在**):

改前(两处同型,builtins.ts:443-444 / terminal.ts:230-231):

```ts
const dangerousMatch = matchDangerousCommand(command);
if (dangerousMatch && !process.env.IHUI_YOLO) { …拦截… }
const readonlyAutoApproved = isReadonlyCommand(command);
```

`isAutoApprovableCommand` / `isAlwaysConfirmCommand`(`command-policy/evaluate.ts:386-400`)确无任何执行链调用方 ⇒ 票面"死代码"判断成立。

## 3. 并行会话在途实现(工作区未提交)的独立复核

改后(磁盘工作区,他人未提交):两处调用方统一改为

```ts
const gate = gateCommandExecution(command);
const blockMessage = describeCommandBlock(gate, !!process.env.IHUI_YOLO);
if (blockMessage) return { success: false, output: blockMessage };
if (!gate.autoApprovable) { …原 confirmDangerous 路径… }
```

新增闸门在 `command-safety.ts`:`gateCommandExecution` = 旧危险面 ∪ `evaluateCommand` 的 `alwaysConfirm`/`destructive`;`autoApprovable` = `isReadonlyCommand` 再减 alwaysConfirm/destructive 两档。

**约束边界对账(票面三条)**:
- 安全不回退:✅ 危险档无 YOLO 时文案逐字保留(`⚠ 危险命令被拦截:…请设置 IHUI_YOLO=1`),原判 dangerous 的全部输入仍被 `matchDangerousCommand`(结构化 danger ∪ 旧模式扫描)拦;`autoApprovable` 严格 ⊆ 旧 `isReadonlyCommand`。新增放行面 = 零。新增拦截面 = YOLO + alwaysConfirm 档(收紧,依据在 `syntax-table.ts` 的 `alwaysConfirm: true` 登记项:`git rebase`/`git push --delete`/`git rm`/`npm uninstall`/`kubectl delete`/`docker rm` 等)。
- `IHUI_YOLO` 既有语义:✅ YOLO 仍可越危险档(`describeCommandBlock` 第一分支 `dangerousPattern && !yolo`);仅对"永远需要确认"子集新增拦截,与票面"YOLO 一致语义"目标相符。
- 零 `any`:✅ 新增代码无 any(仅 `unknown`/显式类型;测试文件用 vitest)。

**接线证明** = `apps/cli/tests/command-policy-wiring.test.ts`(对方新建,未跟踪),四层:① 静态 import 行判定(两个调用方必须从 `command-safety.js` 取 `gateCommandExecution`+`describeCommandBlock`)② 行为(YOLO+alwaysConfirm 必拒)③ 反向对照(同命令不设 YOLO 走确认路径;普通危险档 YOLO 下照旧可越)④ 闸门组合唯一落点。**该测试当前实测 2 例红**(见 §5),属对方在途缺陷(其断言 `describeCommandBlock(gateCommandExecution('rm -rf /tmp/x'), true)` 应含"永远需要确认",实收 `null` —— 即 `rm -rf /tmp/x` 的 `alwaysConfirm` 期望与语法表现值不符,是"测试期望 vs 实现"待对齐,不是本会话改动引入)。

## 4. 悬空指向核实:`config/yolo.ts`

- `git ls-tree --name-only HEAD apps/cli/src/config/` = `cli.ts credentials.ts defaults.ts env.ts index.ts merge.ts`,**无 yolo.ts** ⇒ 悬空成立。
- 全 `apps/cli` 唯一引用:`apps/cli/src/commands/settings.ts:80` 注释
  `/** YOLO 逃生舱档位(与 IHUI_YOLO 环境变量、bypassPermissions 为 OR 语义,见 config/yolo.ts) */`。
- **建议改法(未动手,settings.ts 不在本票受影响文件清单)**:把 `见 config/yolo.ts` 改为
  `见 tools/command-safety.ts 的 gateCommandExecution/describeCommandBlock`(工作区口径)或
  `见 tools/command-safety.ts 的 matchDangerousCommand + IHUI_YOLO 读取处`(HEAD 口径,若他人改动最终未落地)。
  由主代理在合并两股改动后一次性修正。
- `settings.ts` 当前状态:未修改(clean),但被他人 import 链使用(`terminal.ts` 引 `loadSettings`),同样不得代改。

## 5. 验证命令实测输出(归因)

1. `pnpm --filter @ihui/cli typecheck`(在**含他人未提交改动**的工作区上跑):
   ```
   src/commands/agent.ts(1403,12): error TS2339: Property 'onToolLedgerSnapshot' does not exist on type 'RunToolLoopOptions'.
   [ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @ihui/cli@1.0.0 typecheck: `tsc --noEmit`
   Exit status 2
   ```
   归因:唯一错误在 `src/commands/agent.ts`(他人 M 文件,配合其未跟踪的 `src/stream-tool-ledger.ts`,在途半成品);
   **本票链上文件(builtins.ts / terminal.ts / command-safety.ts)0 错误**。非本会话产出。
2. `pnpm exec vitest run tests/command-policy-wiring.test.ts tests/command-policy.test.ts tests/command-safety.test.ts`(在 `apps/cli` 下;票面写的 `node --test` 对本包**不可用** —— cli 测试是 vitest 形态,`package.json` `test: vitest run`,故以权威入口 `pnpm exec vitest` 代跑,如实登记):
   ```
   Test Files  1 failed | 2 passed (3)
        Tests  2 failed | 171 passed (173)
   ```
   红的 2 例全在他人新建的 command-policy-wiring.test.ts(§3 所述 alwaysConfirm 期望值对账);
   既有 command-policy.test.ts / command-safety.test.ts 全绿。
3. `pnpm exec vitest run tests/terminal.test.ts`:
   ```
   Test Files  1 passed (1)
        Tests  16 passed (16)
   ```
4. `node scripts/watermark.mjs verify`:**未跑** —— 原因:本会话零新建 git 跟踪源文件(唯一落盘是 gitignored 报告),票面该步为条件项("若新建了文件")。

## 6. 已完成 / 剩余 / 卡点

- 已完成:票面缺口在 HEAD 复验(成立);并行实现的三约束对账(只收紧不放宽 ✅、YOLO 语义保持 ✅、零 any ✅);
  `config/yolo.ts` 悬空指向定位 + 修正建议;接线证明现状与 2 例红的精确定位;验证四组实测+归因。
- 剩余(交主代理裁决):
  1. 等并行会话收敛其 wiring 测试 2 例红(`rm -rf /tmp/x` 的 alwaysConfirm 语义对齐)并连同 builtins/terminal/command-safety 一起提交;
  2. `settings.ts:80` 注释的 `config/yolo.ts` 悬空指针按 §4 建议改一行(不在本票清单,需主代理加派或并入对方提交);
  3. 若主代理确认对方交付不完整、需本票重写,请**重新派单并在派单前确认目标文件 clean**。
- 卡点:单写者冲突(他人正写本票全部目标文件,且在途红)——按硬约束不得写,不存在"本可做完而偷懒没做"的项。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
