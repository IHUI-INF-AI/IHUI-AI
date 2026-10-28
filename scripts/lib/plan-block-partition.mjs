// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划文档「底稿面选取 + 归档候选分区」的**唯一宿主层**(2026-10-29 立)。
 *
 * 立层原因(不是重构癖):本层这三件东西原先住在 `scripts/archive-completed-tasks.mjs` 里,而那
 * 个归档器已随 2026-10-16「完成即删 / 存档机制退役」下令退场。但**活器物正借着它身上的这三个
 * 判据** —— `scripts/ledger-strip-open-rows.mjs` 顶部 import
 * `partitionPlanBlocks / resolvePlanBase / resolveRequestedFace`,而 `scripts/tests/` 下没有任何
 * ledger-strip 测试覆盖这条边 ⇒ 一旦把归档器 `git rm`,依赖面是 `ERR_MODULE_NOT_FOUND` 的静默断链。
 * 所以先把判据搬到它可以被删的地方,让"归档器无活消费者"成为可交付状态。
 *
 * 搬法:判据体**逐字搬运**,函数体、注释、返回形状、枝的排布一处未改。这里不是重写这一族判据的
 * 场合 —— 它带着本仓记过最多次的历史教训注释(为什么 default 必须是 head、为什么 undetermined
 * 不许退到磁盘),那些句子本身就是判据的一部分。
 *
 * 三条不许动的耦合(照搬时要看得见):
 *  ① `shouldArchive` 吃的是**模块级** `allMode` / `daysThreshold`,而它们由 `resolveDaysThreshold
 *     (process.argv.slice(2))` 算出 ⇒ `--days` / `--all` 的取值位连同它们一起迁。为什么不改成
 *     传参:改签名等于重写 `partitionPlanBlocks` 的形态,而 §0.6/§22c 要求同一件事只许一份实现、
 *     禁止为迁移而顺手重造判据。副作用面与迁移前**逐字相同**:本层与使用者同处一个进程,读到的是
 *     同一个 `process.argv`,即原先嵌在归档器模块体里读到的那一个。
 *  ② `resolvePlanBase` 的 `PLAN_REL` 必须是**相对单证**:git 只认正斜杠,而 `ROOT` 是工作树根,
 *     两者只差前缀;不一并搬就会在两处各留一份路径常量,而"两份路径常量"正是漂移的老入口。
 *  ③ 取材一律经 `./face-reader.mjs`(`catBatch` / `readWorktreeFile`),rev-parse 一律经
 *     `./bypass-git.mjs` 的 `git` 出口 —— 本层不承接任何"自己派生 git 读正文"的写法。
 *
 * 为什么不再留一份在归档器里:两处同一份 `partitionPlanBlocks` 就是本仓 S19 那条装车锁要判的事
 * ("日志说卡住 29 块、交给人工裁决的是另外 29 块"的自洽错位)。归档器改为 import + re-export。
 *
 * 对外面:除 `__test__` 外全是具名导出(§22d 兼容位:纯库无 CLI 入口,测试面直接 import 源脚本)。
 */
import { catBatch, readWorktreeFile } from './face-reader.mjs'
// rev-parse 走对象空间 plumbing 那一份(对象空间落地的 plumbing **只有一份**,2026-09-27 收口)。
import { git as plumbingGit } from './bypass-git.mjs'
// G-322:带值旗标的**唯一取值出口**(值必须存在且不以 `-` 开头,否则判死,绝不折回默认)。
import { requireFlagValue } from './flag-value.mjs'
// 「什么算一个已完成条目块」与「块体内有没有未勾选登记」的单一实现。
import { parseCompletedTaskBlocks, entryHasOpenRows } from './plan-task-headings.mjs'

/** 提交面上的相对路径(git 只认正斜杠;ROOT 是工作树根,两者只差前缀)。 */
export const PLAN_REL = 'PROJECT_PLAN.md'

// ─── 旗标面:`--days` / `--all` 的取值 ───────────────────────────────────────
// 见文件头 ①:这两个模块级常量本来由 `shouldArchive` 直接闭合捕获,故连同它们的取值判据一起迁。
const args = process.argv.slice(2)
export const allMode = args.includes('--all')

/**
 * `--days` 的取值判定(G-322:取值一律走 scripts/lib/flag-value.mjs 单源,本器不再自己算 `args[i + 1]`)。
 * 漏值 / 值被下一个旗标顶掉 ⇒ error(用法错,exit 2);`abc` 这类"token 合法但数值域不合法"
 * 也判死 —— 旧写法 `parseInt('abc')=NaN` 会让 `diff >= NaN` 恒假 ⇒ "一个也不搬"读起来像"确实没有到期项",
 * 而漏值(`--days` 打在结尾)被 `? :` 折回 0 = 把"我要按年龄节流"写成"关掉年龄节流"。
 * @returns {{days:number|null, error:string|null}}
 */
export function resolveDaysThreshold(argv) {
  const f = requireFlagValue(argv, '--days', { noun: '天数(非负整数)' })
  if (f.error) return { days: null, error: f.error }
  if (!f.present) return { days: 0, error: null }
  const n = Number(f.value)
  if (!Number.isInteger(n) || n < 0) {
    return { days: null, error: `--days 需要非负整数,实得:${JSON.stringify(f.value)}` }
  }
  return { days: n, error: null }
}
export const daysVerdict = resolveDaysThreshold(args)
export const daysThreshold = daysVerdict.error ? 0 : daysVerdict.days

/**
 * 底稿面:`head`(默认,= 被审面)/ `worktree`(人工取证逃生舱,或"根本没有被审面可比"时的自动退化)。
 * 值必须是这两个之一 —— 未知值**报错退出**,不得静默掉进默认档(那会让"我明明指定了另一面"
 * 与"脚本压根没认这个开关"在账面上长得一模一样)。
 *
 * `exitCode` 分两档(G-322):值给了但不在枚举里 = 既有用法错,沿用 1(测试 A3 钉着);
 * **压根没拿到值**(漏值 / 被下一旗标顶掉 / 空串)= 本票新增的吞值档,走 2「未判定」。
 * @returns {{face:string|null, error:string|null, exitCode:number|null}}
 */
export function resolveRequestedFace(argv) {
  const f = requireFlagValue(argv, '--plan-face', { noun: '面名(head|worktree)' })
  if (!f.present) return { face: null, error: null, exitCode: null }
  if (f.error) return { face: null, error: f.error, exitCode: 2 }
  if (f.value !== 'head' && f.value !== 'worktree') {
    return { face: null, error: `--plan-face 只接受 head|worktree,实得 ${JSON.stringify(f.value)}`, exitCode: 1 }
  }
  return { face: f.value, error: null, exitCode: null }
}

// ─── 分区判据的私有依赖(随 `shouldArchive` 一起迁,不在两处各留一份) ───────────
export function todayStr() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export function dateDiffDays(dateStr) {
  if (!dateStr) return Infinity // 无日期视为最新,不归档(除非 --all)
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date(todayStr() + 'T00:00:00')
  return Math.floor((now - target) / 86400000)
}

export function shouldArchive(task) {
  if (allMode) return true
  // **默认阈值 0 = 完成即归档**(2026-09-28 由 7 改,用户原话"2053 条应该全归档才对"):
  // 旧默认把"刚做完一周内"整段留在台账里,于是台账里 98% 的已完成行(实测 2008/2053)按规则
  // 一条都不动 —— 这不是节流,是把"归档"这个动作推迟到没人再看它的时候。
  // `--days N` 仍可回到"只搬满 N 天的"节奏(取证或降速时用)。
  if (!task.date) return daysThreshold <= 0 // 阈值为 0 时不需要年龄判据 ⇒ 无日期也搬;>0 时不猜生日
  return dateDiffDays(task.date) >= daysThreshold
}

/**
 * 把"已完成候选"分成**可搬**与**因体内还有活账所以不搬**两堆的唯一实现(2026-09-28 立)。
 *
 * 为什么必须抽出来:这条分区判据原先内联在 main() 里三行,而"为什么搬不走"是人工裁决与
 * 派单的输入 —— 让诊断出口另抄一遍筛选,两份迟早漂开(本仓最高频失效型),后果是"日志说
 * 卡住 29 块、交给代理裁决的是另一批 29 块"这种自洽却错位的清单。main() 与 --list-blocked
 * 现在都只调这一个函数。
 * @returns {{tasks:object[],candidates:object[],blocked:object[],movable:object[]}}
 */
export function partitionPlanBlocks(content) {
  const tasks = parseCompletedTaskBlocks(content)
  const candidates = tasks.filter(shouldArchive)
  const blocked = candidates.filter((t) => entryHasOpenRows(t.bodyLines))
  const movable = candidates.filter((t) => !entryHasOpenRows(t.bodyLines))
  return { tasks, candidates, blocked, movable }
}

/** 磁盘面的"取不到即 null",不把编码/权限错误伪装成"该文件不存在"(取材层原样抛 ⇒ 这里接成 null 前先判存在)。 */
export function readWorktreeFileOrNull(root) {
  try {
    return readWorktreeFile(root, PLAN_REL)
  } catch {
    return null
  }
}

// ─── 底稿面:被审面优先,取不到不猜 ───────────────────────────────────────
/**
 * 决定"这份计划文档的底稿取哪一面",输出三态之一:
 *   head      —— HEAD 面上确有该文件且正文取到(默认档,也是真实仓库里唯一的合法档)
 *   worktree —— 显式 `--plan-face worktree`,或"根本没有被审面可比"(非 git 仓 / HEAD 未诞生 /
 *               该文件尚未入库)。后者写盘不可能是"把别人已入库的行退回旧版",因为还没有入库行。
 *   none      —— 磁盘与被审面都取不到
 * **是 git 仓、HEAD 里确有该路径、却读不到正文(锁住 / 超时 / 对象损坏)⇒ { face:'undetermined' }** ——
 * 那一档绝不能退到磁盘:否则本票要根治的那一型会在最常见的故障形态下原地复活。
 */
export function resolvePlanBase({ root, requested }) {
  const headSpec = `HEAD:${PLAN_REL}`
  let repo = true
  let headCommit = null
  try {
    headCommit = plumbingGit(['rev-parse', '--verify', '--quiet', 'HEAD'], {
      root,
      allowFail: true,
    })
  } catch {
    repo = false
  }
  if (!repo || headCommit === null) {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null)
      return { face: 'none', text: null, why: '既不是可用的 git 仓,盘上也没有 PROJECT_PLAN.md' }
    return {
      face: 'worktree',
      auto: true,
      text: wt,
      parentText: null,
      why: '没有被审面可取(非 git 仓或 HEAD 尚未诞生)⇒ 退回工作树档:此支没有"别人已入库的行"可被写回',
    }
  }
  let headText = null
  let headAbsent = false
  try {
    const got = catBatch(root, [headSpec])
    headText = got.get(headSpec) ?? null
    if (headText === null) headAbsent = true
  } catch (e) {
    // 层抛 Undetermined = 仓在、面该有、就是读不到 ⇒ 无法判定(既不冒红也不记绿,更不偷偷改用盘)
    return { face: 'undetermined', text: null, why: `被审面取不到:${e.message}` }
  }
  if (headAbsent) {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null) return { face: 'none', text: null, why: 'HEAD 与磁盘都没有 PROJECT_PLAN.md' }
    return {
      face: 'worktree',
      auto: true,
      text: wt,
      parentText: null,
      why: `${PLAN_REL} 尚未进入 HEAD ⇒ 无已入库形态可被回退,退回工作树档`,
    }
  }
  if (requested === 'worktree') {
    const wt = readWorktreeFileOrNull(root)
    if (wt === null)
      return {
        face: 'undetermined',
        text: null,
        why: '指定了 --plan-face worktree 而盘上没有该文件',
      }
    return {
      face: 'worktree',
      explicit: true,
      text: wt,
      parentText: headText,
      headSha: headCommit,
      why: '人工取证逃生舱:刻意以磁盘副本为底稿(默认档是 HEAD)。零损失闸仍按父提交面判,不因逃生舱而放宽',
    }
  }
  return {
    face: 'head',
    text: headText,
    parentText: headText,
    headSha: headCommit,
    why: '被审面 HEAD blob(默认档)',
  }
}

/** §22d 兼容位:纯库无 CLI 入口,导出对象供测试直接 import(本模块全部具名导出已是公共面)。 */
export const __test__ = {
  PLAN_REL,
  allMode,
  daysThreshold,
  todayStr,
  dateDiffDays,
  shouldArchive,
  readWorktreeFileOrNull,
  resolveDaysThreshold,
  resolveRequestedFace,
  resolvePlanBase,
  partitionPlanBlocks,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
