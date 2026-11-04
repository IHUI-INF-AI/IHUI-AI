<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B1 落地:删除保护链(回收站 + 批量两阶段护栏)

- 首行保全@开工:HEAD=`4fe208a71c20d5b3fcca68d40daa7d7a2185bee4`(2026-11-05 现读)
- 打算动的文件(白名单):
  - 新建 `packages/shared/src/delete-guard/`(纯判据层)
  - 新建 `apps/cli/tests/delete-guard.test.ts`
  - 修改 `apps/cli/src/tools/file-edit.ts`、`file-batch-edit.ts`、`worktree.ts` 的删除相关分支
- 不碰:`scripts/**`、i18n JSON、`sandbox/**`、PROJECT_PLAN.md、AGENTS.md;不 commit/push。

## 一、现场读数

- 对侧证据(W1-workbuddy-main.md §2 表 #7/#9、§3 行 ①,已先读原文再动手):回收站后端(独立 exe + shim 重定向)
  + 批量两阶段护栏 check/approve,参数族 阈值 20 / 锁 2000ms / 陈旧锁 5min / 回合态 TTL 7d / 样本 5 / 显示上限 9999,
  状态目录 + 重放文件 + 报告路径三件分离。
- 本仓现状复跑确认(动手前现读):`worktree.ts` 原 :229 `fs.rmSync(recursive,force)`(实读另见 :322 `cleanupWorktree`
  同型一处)、`file-batch-edit.ts` 原 :132/:368/:479 三处 unlink、`file-edit.ts` 原 :535 `fs.unlinkSync`
  ⇒ 全部无回收站、无批量阈值、无 approve 相。
- 索引面他席在飞:`packages/shared/src/attribution/index.ts` 与 `apps/cli/src/skills/packaging/index.ts` 被别席标删
  (`D`),typecheck 里 `skill-package.ts` 那串错误即来自该在飞删除,与本票无关、未触碰。

## 二、落了什么

### 判据层(新建 `packages/shared/src/delete-guard/`,8 文件,零 `node:` 内建、零 IO)
- `types.ts`:三态 `GuardVerdict`(clean|blocked|undetermined)、`DeleteCandidate`、`BulkDeleteScanTicket`、
  `TrashManifest` 形态、`DigestFn` 注入点。
- `constants.ts`:对方参数族具名复现(阈值 20 / 锁窗 2000ms / 陈旧锁 5min / 凭据 TTL 7d / 样本 5 / 显示上限 9999)。
- `threshold.ts`:阈值判定;超越点 = `expectedCount` 交叉核对(枚举少于声称 ⇒ undetermined,清单与内容必须同面)。
- `two-phase.ts`:`canonicalizeScan` 规范形 + check 相签发凭据(凭据 = 本次扫描结果 sha 对账输入,非口头保证)+
  approve 相重扫逐字节对账(缺失/过期/不一致 ⇒ blocked;digest 坏/重扫取不到 ⇒ undetermined)+ `evaluateBulkDelete` 总入口。
- `lock.ts`:`decideLock` 四态(acquired|busy|stale-reclaimed|undetermined);时钟回拨不猜锁生死(§0.3)。
- `verdict.ts`:`aggregateGuardVerdict` 判序 undetermined > blocked > clean;空判定集不记 clean。
- `recycle.ts`:回收站条目压平命名(单射转义,`a/b.txt` 与 `a__b.txt` 不撞名)、id 段防穿越判据、
  manifest 形态校验、恢复出口查找判据(全纯,真实搬运留端内)。
- `index.ts`:唯一出口 + 纯度纪律头注。

### 消费点接线(端内 adapter,IO 全在 apps/cli)
- `file-batch-edit.ts`:新增整段 adapter(digest=sha256、回收站搬运、状态目录/重放文件/报告 jsonl 三件分离落点,
  均在 `.ihui/` 既有纪律下)。`batch_edit` 在 **checkpoint 创建与任何写盘之前**插入两阶段护栏:
  blocked/undetermined ⇒ 直接返回、零副作用;达阈值须回传 `bulkApproveTicket`(完整凭据 JSON 或 scanId 重放,
  重放件取不到 ⇒ undetermined)。`applyOp` delete 腿改「先复制进回收站→再删原文件」;事务自建文件的回滚 unlink 不进回收站(无用户前像,注释点名)。
- `file-edit.ts`:`delete_file` 的 `fs.unlinkSync` ⇒ `recycleDeleteSingleFile`(同层判定 + 回收搬运 + 独立 manifest;
  失败即抛 ⇒ 原文件未动、如实报错)。
- `worktree.ts`:`remove()` 与 `cleanupWorktree()` 的 rmSync 兜底腿前置尝试 `stashDirToTrash`(同盘 rename 可逆、留 manifest);
  **rename 失败(Windows 句柄占用,即本兜底腿存在的原因)照旧回落 `fs.rmSync`——兜底腿一字未摘**。
- `packages/shared/package.json`:补 `./delete-guard` 与 `./delete-guard/*` 两条 exports 映射(白名单外最小必要改动:
  不登记 exports 则判据层结构上不可被任何端 import = 死码;未动其余键)。

### 测试(新建 `apps/cli/tests/delete-guard.test.ts`,15 例)
- ① 阈值正反对照(19⇒clean / 20⇒blocked);② approve 相缺失 ⇒ 20 个文件逐一断言仍在位、无 checkpoint 目录、
  报告/回收站零落地(副作用未发生);③ undetermined 不记绿(null 候选/枚举不足声称数/digest 抛错/重放件被拿掉,
  含空判定集聚合);④ 形状锁:delete-guard 目录逐文件禁 `from 'node:'`/`require(`/`process.`/`fs.`;
  另含 approve 全链路(凭据放行→回收站 manifest→`restoreTrashEntry` 逐字节还原→report.jsonl 单独成件)、
  scanId 重放、delete_file 单文件回收+恢复、worktree 目录整搬回收 + rmSync 兜底腿存续形状锁、四态锁、压平单射。

## 三、验证末行现读

- `cd apps/cli && npx vitest run tests/delete-guard.test.ts` ⇒ `Test Files 1 passed (1) / Tests 15 passed (15)`(Duration 7.80s)
- 回归既有删除面:`npx vitest run tests/file-edit.test.ts tests/hunk-tracker-integration.test.ts` ⇒ `2 passed (2) / 29 passed (29)`
- `npx tsc --noEmit -p apps/cli/tsconfig.json`:触及面零错误(过滤 `skill-package` 后输出为空;该行全部 7 条错误
  来自别席在飞的 `skills/packaging/index.ts` 标删,见第一节)。
- 水印:9 个新建文件全部 `watermark.mjs inject`;prettier 复跑后 `verify` 点名 12 个触及文件
  ⇒ `覆盖 12/12 … 残迹 0 / 损坏 0 / 仅隐写 0`「纳入口径的文件均已携带完整溯源水印」。

## 四、未竟(逐条带解锁条件)

1. **回收站容量/老化清扫未装** —— 解锁条件:需要一张可派单票定 TTL/容量档并挂 guardian 巡检轮(本票白名单不含 `scripts/**`,不能新增派发腿)。
2. **对方 #7「Shell 层 rm 重定向」未复现** —— 那是外部 shell shim(安全边界在 OS 层);本票边界明令不得碰 `sandbox/**` 且不得新增第三条护栏通道,解锁条件 = 机主拍板是否给 CLI 子进程 shell 装同款 shim。
3. **护栏未接交互式 confirmDangerous 审批流** —— 现 blocked 时直接拒绝并出声(测试②钉住);若要做「当场问人再放行」需改 `ToolContext` 审批面,清单外。
4. **`restore` 未做成会话工具** —— 恢复出口现为函数级(`restoreTrashEntry`)+ 测试钉住;立 CLI 工具面需登记 `tools/index.ts` 注册表(白名单外)。
5. **`worktree.ts` 回收站搬运在 git 元数据仍指向旧路径时依赖 prune** —— 已由既有 prune 腿覆盖,但跨盘(rename 抛 EXDEV)场景直接落 rmSync 兜底、无回收站;解锁条件 = 需要 .worktrees 与仓同盘的机器事实核验,属另一票。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
