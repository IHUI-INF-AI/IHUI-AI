// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」的**唯一调度器**(goal-b49 W7 未竟 1 的调度腿)。
 *
 * 立因:端内 adapter(`apps/cli/src/tools/trash-prune.ts` 的 `pruneExpiredTrash`)与它那套
 * 「到期判定 / 双档上限 / 连败退休」的判据(`packages/shared/src/delete-guard/`)早就齐了,
 * 但**没有任何调度器** —— 只能人工敲,于是「回收站到期自动回收」这件事结构上永远不发生
 * (§0.9:造好没装车 = 没有)。本层就是那辆车。
 *
 * 三条不可漂:
 *  ① 本层**一行判据都不复算**:到期与否、该不该删、删多少、连败几次,全在共享层那份实现里;
 *     本层只问「什么时候跑」「结论怎么落日志」「什么时候才该寄信」(与 reapWorktrees 同一条
 *     归属纪律,判据单源在 `packages/shared/src/delete-guard/`)。
 *  ② 跨进程边界只有一个文件:`apps/cli/src/tools/trash-prune-entry.ts`。守护腿是裸 node 跑的
 *     .mjs,端内实现是 TS(§22 的架构契约表:工具层不得 import 端内实现),故用「spawn 一次
 *     tsx 进程读它打印的结论行」这道边界 —— 与 `scripts/auto-evolve.mjs` 派发品牌邮件同一形态。
 *  ③ 节流戳**只在有结论之后写**:没跑成 ⇒ 1 小时后重试;先写戳会把「整轮没跑成」记成
 *     「刚跑过」(2026-10-30 temp-scrub 同一处教训,不得再犯)。
 *
 * 到人通知只有一档:`gate=retired`(连败达上限、自动退休、从此不再自动删任何东西)。
 * 其余各档一律只落日志 —— 判机器状态的面不该占人通道(§12e),而「清掉了几个」更不是要人管的事。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveWorktree } from './gitdir.mjs'
import { log } from './git-guardian-log.mjs'

const WORKTREE = resolveWorktree()
const TICK_FILE = join(WORKTREE, '.ihui-agent', 'state', 'trash-expiry-sweep-tick.json')
/** 端内入口(跨进程边界那一个文件)。 */
const ENTRY_REL = join('apps', 'cli', 'src', 'tools', 'trash-prune-entry.ts')
/** tsx 入口:本仓既有形态是各包自带的 `node_modules/tsx`(见 scripts/auto-evolve.mjs)。 */
const TSX_CANDIDATES = [
  join('apps', 'cli', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  join('apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
]
/** 一天一轮:到期件的判据是「保留期已过」,晚一天发现不改变安全性。 */
const INTERVAL_MS = Number(process.env.IHUI_TRASH_EXPIRY_INTERVAL_MS || 24 * 60 * 60 * 1000)
/** 没跑成时的重试窗:跑不成的原因多半是端内依赖或环境,1 小时后再试比重排判据便宜。 */
const RETRY_MS = Number(process.env.IHUI_TRASH_EXPIRY_RETRY_MS || 60 * 60 * 1000)
/** 派生进程上限(守门 80:热路径派生一律带上限)。 */
const TIMEOUT_MS = Number(process.env.IHUI_TRASH_EXPIRY_TIMEOUT_MS || 120_000)

/** 节流判定(纯函数):取不到戳 ⇒ 视为「该跑了」(失效方向恒为「多跑一次」,不是「少跑」)。 */
export function trashExpiryDue(nowMs, tickMs, intervalMs = INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/**
 * 从端内入口的输出里取结论行(不重抄判据,只读它已经大声报出来的那一行)。
 * 三态:`state=clean|pruned|undetermined` + `gate=…` + 计数;没有结论行 ⇒ 未判定。
 */
export function parseTrashPruneReport(text) {
  const raw = String(text || '')
  const m =
    /^TRASH-PRUNE state=(clean|pruned|undetermined) gate=(\S+) manifests=(\d+) entries=(\d+) removed=(\d+) failed=(\d+) skipped=(\d+) bytes=(\d+)(?: overBudget=(\d+) streak=(-?\d+))?/m.exec(
      raw,
    )
  if (!m)
    return {
      judged: false,
      state: null,
      gate: null,
      removed: null,
      bytes: null,
      streak: null,
      reason: null,
    }
  const reasonLine = /^TRASH-PRUNE-(?:SKIP|FAIL) reason=(.*)$/m.exec(raw)
  return {
    judged: true,
    state: m[1],
    gate: m[2],
    manifests: Number(m[3]),
    entries: Number(m[4]),
    removed: Number(m[5]),
    failed: Number(m[6]),
    skipped: Number(m[7]),
    bytes: Number(m[8]),
    overBudget: m[9] === undefined ? null : Number(m[9]),
    streak: m[10] === undefined ? null : Number(m[10]),
    reason: reasonLine ? reasonLine[1] : null,
  }
}

/** 找 tsx 入口(本仓既有形态:各包自带 node_modules/tsx);找不到 ⇒ null(不猜)。 */
function resolveTsxEntry() {
  for (const rel of TSX_CANDIDATES) {
    const abs = join(WORKTREE, rel)
    if (existsSync(abs)) return abs
  }
  return null
}

/**
 * 派发一次到期清理并读结论。
 * 形态照 `git-guardian-worktree-reap.mjs`:显式 stdio(§12g)+ windowsHide(§5b)+ 有界超时(守门 80)。
 */
export function sweepTrashExpiry(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = INTERVAL_MS,
    retryMs = RETRY_MS,
    tickFile = TICK_FILE,
    logger = log,
    runner = null,
    notify = null,
  } = opts

  const entry = join(WORKTREE, ENTRY_REL)
  if (!existsSync(entry)) {
    logger(
      'ℹ️ 回收站到期清理:端内入口不在位(apps/cli/src/tools/trash-prune-entry.ts)⇒ 本轮跳过,不记为已清',
    )
    return { ran: false, why: '端内入口不在位' }
  }
  const tsx = resolveTsxEntry()
  if (tsx === null) {
    logger('ℹ️ 回收站到期清理:tsx 运行时不在位(各包 node_modules/tsx)⇒ 本轮跳过,不记为已清')
    return { ran: false, why: 'tsx 运行时不在位' }
  }

  let tick = null
  try {
    tick = JSON.parse(readFileSync(tickFile, 'utf8'))
  } catch {
    /* 没跑过 */
  }
  const lastAt = tick ? Date.parse(String(tick.attemptAt ?? '')) : NaN
  if (!trashExpiryDue(now, lastAt, intervalMs)) return { ran: false, why: '未到节流窗口' }

  const stamp = (ms, body) => {
    try {
      mkdirSync(dirname(tickFile), { recursive: true })
      writeFileSync(tickFile, JSON.stringify(body), 'utf8')
    } catch {
      /* 戳写失败只意味着下轮多跑一遍,不影响判定 */
    }
  }
  const stampRetry = () =>
    stamp(now - intervalMs + Math.min(retryMs, intervalMs), {
      attemptAt: new Date(now - intervalMs + Math.min(retryMs, intervalMs)).toISOString(),
      judged: false,
      state: 'unjudged',
      reason: '上一轮未跑成',
    })

  const call =
    typeof runner === 'function'
      ? { status: 0, stdout: String(runner() ?? ''), stderr: '' }
      : (() => {
          try {
            const out = execFileSync(process.execPath, [tsx, entry, '--workspace', WORKTREE], {
              cwd: WORKTREE,
              encoding: 'utf8',
              windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
              timeout: TIMEOUT_MS, // 守门 80:热路径派生一律带上限
              maxBuffer: 1 << 22,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
            return { status: 0, stdout: String(out || ''), stderr: '' }
          } catch (e) {
            return {
              status: typeof e?.status === 'number' ? e.status : null,
              stdout: String(e?.stdout || ''),
              stderr: String(e?.stderr || e?.message || ''),
            }
          }
        })()

  const p = parseTrashPruneReport(`${call.stdout}\n${call.stderr}`)
  if (!p.judged) {
    logger(
      `⚠️ 回收站到期清理未跑成(rc=${call.status}):` +
        `${String(call.stderr || call.stdout)
          .replace(/\s+/g, ' ')
          .slice(0, 160)}` +
        ' —— 未跑成不等于没有过期件,1 小时后重试(不改本守护退出码)',
    )
    stampRetry()
    return { ran: true, ok: false, why: '未跑成', status: call.status }
  }

  stamp(now, {
    attemptAt: new Date(now).toISOString(),
    judged: true,
    state: p.state,
    gate: p.gate,
    removed: p.removed,
    bytes: p.bytes,
    reason: p.reason,
  })

  if (p.state === 'pruned') {
    logger(
      `✅ 回收站到期清理:清掉 ${p.removed} 件(回收 ${p.bytes} 字节),到期判定与删除腿都在端内判据里`,
    )
  } else if (p.state === 'undetermined') {
    logger(
      `⚠️ 回收站到期清理:未判定(闸门 ${p.gate})——${p.reason ?? '原因未随结论行给出'}` +
        ' ⇒ 判不出就不删(fail-closed),不改本守护退出码',
    )
  } else if (p.gate !== 'retired') {
    logger(`ℹ️ 回收站到期清理:判过,零回收(闸门 ${p.gate},在册 ${p.entries} 件)`)
  }

  // 只有「自动退休」才到人:退休 = 从此不再自动删任何东西,磁盘不会再被回收,这是要人知道的事;
  // 其余各档(清掉了几个 / 判过零回收)都不该占人通道(§12e)。
  if (p.gate === 'retired' && typeof notify === 'function') {
    const detail =
      '回收站到期清理已自动退休(fail-closed:自此不再自动删任何东西,磁盘不会再被回收)。' +
      `原因:连续 ${p.streak === null ? '若干' : p.streak} 轮未判定 ⇒ 端内判据按连败上限退休(闸门 retired)。` +
      '可整改路径:①读 .ihui/delete-guard/expiry-run.json 看 streak/lastRunIso/retiredAtIso;' +
      '②修复回收站读取或 ACL 裁决问题;③修好后把该账目的 retiredAtIso 置空即复活' +
      '(账目形状见 packages/shared/src/delete-guard/types.ts)。' +
      '本条不要求收信人删任何文件(§5e-2:删除类动作不推回用户)。'
    try {
      notify('回收站到期清理已退休', detail, { dedupKey: 'trash-expiry-retired' })
    } catch (e) {
      logger(
        `⚠️ 回收站到期清理:退休通知发出失败(${String(e?.message ?? e).slice(0, 90)})——退休事实已落日志`,
      )
    }
  }

  return { ran: true, ok: true, ...p }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
