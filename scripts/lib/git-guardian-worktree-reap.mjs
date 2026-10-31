// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree **自动回收**的唯一调度器(判据与执行 = `scripts/agent-worktree.mjs --reap --apply`)。
 *
 * 立因(2026-10-30,机主"要彻底根治/杜绝"):原始症状是陈旧 linked worktree 只增不减,被编辑器
 * SCM 当成独立仓列出,变更数合计成 10K/20K 徽标。`agent-worktree.mjs --reap` 早就有六道安全闸
 * (批准落点 `.worktrees/` ∧ 分支 `wt/*` ∧ 非 locked ∧ 工作区干净 ∧ HEAD 已并入 main ∧ 空闲 ≥ 阈值),
 * 但**没有任何调度器** —— 又一次"判据在、工具在、没人跑"(守门 64/70/81/115/138 同族)。
 * 本层把它挂进每 2 分钟的健康轮次,自带 24h 节流。
 *
 * 三条不可漂:
 *  ① 本层**不重抄**任何回收判据 —— 名字/落点/合并/脏/lock 全在 `agent-worktree.mjs` 那一份实现里;
 *     这里只问"什么时候跑"和"把结论落到日志"(与 scrubTempFixtures 同一条归属纪律)。
 *  ② 派生参数固定为 `--reap --apply --older-than <阈值>`,**不带 `--tag-lost`** ⇒ 未并入 main 的检出
 *     结构上只会被跳过,不存在"静默删掉独有提交"这条路径(§12h:合并决策权归人)。
 *  ③ 失败不占满节流窗:没跑成 ⇒ 1 小时后重试;tick 只在**有结论**后写(2026-10-30 temp-scrub
 *     "失败也写 24h 戳"同一处错误不得再犯)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveWorktree } from './gitdir.mjs'
import { log } from './git-guardian-log.mjs'

const WORKTREE = resolveWorktree()
const REAP_TICK = join(WORKTREE, '.ihui-agent', 'state', 'worktree-reap-tick.iso')
/** 一天一轮足够:候选的前提是"空闲 ≥ 阈值(默认 7 天)",晚发现一天不改变安全性。 */
const REAP_INTERVAL_MS = Number(process.env.IHUI_WORKTREE_REAP_INTERVAL_MS || 24 * 60 * 60 * 1000)
/** 空闲阈值(天)。只影响"够不够老",不影响任何安全闸;`.worktrees` 之外与未合并的永不触碰。 */
const REAP_MIN_IDLE_DAYS = Number(process.env.IHUI_WORKTREE_REAP_MIN_IDLE_DAYS || 7)
const REAP_TIMEOUT_MS = Number(process.env.IHUI_WORKTREE_REAP_TIMEOUT_MS || 120_000)
const REAP_RETRY_MS = Number(process.env.IHUI_WORKTREE_REAP_RETRY_MS || 60 * 60 * 1000)

/** 节流判定(纯函数):取不到戳 ⇒ 视为**该跑了**(与 tempScrubDue 同一条失效方向)。 */
export function worktreeReapDue(nowMs, tickMs, intervalMs = REAP_INTERVAL_MS) {
  if (!Number.isFinite(tickMs)) return true
  return nowMs - tickMs >= intervalMs
}

/**
 * 从回收器的人类报告里取结论(不重抄判据,只读它已经大声报出来的结论)。
 * 三态:`✅ 回收 N 个(,失败 M 个)?` / `ℹ 无回收候选` / 其它(rc≠0、崩在半路)⇒ 未判定。
 */
export function parseReapReport(text) {
  const s = String(text || '')
  if (/ℹ 无回收候选/.test(s)) return { judged: true, removed: 0, failed: 0 }
  const m = /✅ 回收 (\d+) 个(?:,失败 (\d+) 个)?/.exec(s)
  if (m) return { judged: true, removed: Number(m[1]), failed: Number(m[2] || 0) }
  return { judged: false, removed: null, failed: null }
}

export function reapWorktrees(opts = {}) {
  const {
    now = Date.now(),
    intervalMs = REAP_INTERVAL_MS,
    minIdleDays = REAP_MIN_IDLE_DAYS,
    tickFile = REAP_TICK,
    logger = log,
    runner = null,
  } = opts
  const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-worktree.mjs')
  if (!existsSync(script)) {
    logger('ℹ️ worktree 回收:回收器不在位(scripts/agent-worktree.mjs)⇒ 本轮跳过,不记为已回收')
    return { ran: false, why: '回收器不在位' }
  }
  let lastTick = NaN
  try {
    lastTick = Date.parse(String(readFileSync(tickFile, 'utf8')).trim())
  } catch {
    /* 没跑过 */
  }
  if (!worktreeReapDue(now, lastTick, intervalMs)) return { ran: false, why: '未到节流窗口' }
  const stamp = (ms) => {
    try {
      mkdirSync(dirname(tickFile), { recursive: true })
      writeFileSync(tickFile, new Date(ms).toISOString(), 'utf8')
    } catch {
      /* 戳写失败只意味着下轮多跑一遍,不影响判定 */
    }
  }
  const stampRetry = () => stamp(now - intervalMs + Math.min(REAP_RETRY_MS, intervalMs))
  const call =
    typeof runner === 'function'
      ? runner()
      : (() => {
          try {
            const out = execFileSync(
              process.execPath,
              [script, '--reap', '--apply', '--older-than', String(minIdleDays)],
              {
                cwd: WORKTREE,
                encoding: 'utf8',
                windowsHide: true, // §5b:漏此参数在计划任务/守护下必弹控制台窗
                timeout: REAP_TIMEOUT_MS, // 守门 80:热路径派生一律带上限
                maxBuffer: 1 << 22,
                stdio: ['ignore', 'pipe', 'pipe'],
              },
            )
            return { status: 0, stdout: String(out || ''), stderr: '' }
          } catch (e) {
            return {
              status: typeof e.status === 'number' ? e.status : 2,
              stdout: String(e.stdout || ''),
              stderr: String(e.stderr || e?.message || ''),
            }
          }
        })()
  const p = parseReapReport(`${call.stdout}\n${call.stderr}`)
  if (!p.judged) {
    logger(
      `⚠️ worktree 回收未跑成(rc=${call.status}):` +
        `${String(call.stderr || call.stdout).replace(/\s+/g, ' ').slice(0, 160)}` +
        ' —— 未跑成不等于没有陈旧检出,1 小时后重试(不改本守护退出码)',
    )
    stampRetry()
    return { ran: true, ok: false, why: '未跑成', status: call.status }
  }
  stamp(now)
  if (p.failed) {
    logger(
      `⚠️ worktree 回收:成功 ${p.removed} 个、失败 ${p.failed} 个(失败的多为被编辑器占用的检出,现场已原样保留)`,
    )
    return { ran: true, ok: true, partial: true, ...p }
  }
  if (p.removed) {
    logger(
      `✅ worktree 自动回收:${p.removed} 个(仅"干净 + 已并入 main + 空闲 ≥ ${minIdleDays} 天";` +
        '独有提交/脏/locked/.worktrees 之外一律保留)',
    )
  }
  return { ran: true, ok: true, ...p }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
