#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 调度健康判据(2026-11-25 立)。
 *
 * 为什么需要它:本段亲历「自动链停摆 1.5 小时无人知」——
 *   IHUI-Attack-AutoBan 每 10 分钟跑,某天开始持续失败,
 *   Last Result 恒为 1,而所有哨兵都住在 autoban 里面 ⇒ 一起死、一起哑。
 *   调度层本身此前没有任何东西盯着 = 当前体系的单点盲区。
 *
 * 判四类真实失效:
 *   ① 失败        Last Result 是非零且不是「良性返回码」
 *   ② 从未运行    Boot 型任务在「开机晚于注册」之后仍显示 1999/11/30
 *   ③ 该跑没跑    周期型任务距上次运行超过 STALE_FACTOR × 间隔
 *   ④ 被禁用      Status=Disabled 且不是配置里标记的「有意停用」
 *
 * 三态 ok / breach / undetermined,语义与 prod-parity / self-integrity 同族,
 * 但状态集刻意不复用 —— 那边判「文件漂移」,这边判「调度失效」,不是同一个词。
 *
 * 本层纯函数零 IO,时间一律由调用方注入(opts.now) ⇒ 可测、可回放。
 */

export const SCHEDULER_STATE = Object.freeze({
  OK: 'ok',
  BREACH: 'breach',
  UNDETERMINED: 'undetermined',
})

/**
 * Windows Task Scheduler 的良性返回码。
 * 这些码非零但不表示失败;其中 267011(尚未运行)还要结合 schedule 再判一次。
 * 刻意不含 267010(DISABLED)——「已禁用」不是成功,它由 Status 单独判。
 */
export const BENIGN_RESULTS = Object.freeze([
  { code: 0, label: '成功' },
  { code: 267009, label: 'SCHED_S_TASK_RUNNING 正在运行' },
  { code: 267011, label: 'SCHED_S_TASK_HAS_NOT_RUN 尚未运行' },
  { code: 267012, label: 'SCHED_S_TASK_NO_MORE_RUNS 已无后续运行' },
  { code: 267016, label: 'SCHED_S_EVENT_TRIGGER 事件触发型' },
])

const BENIGN_CODES = new Set(BENIGN_RESULTS.map((r) => r.code))

/** 周期型任务:距上次运行超过 间隔×该倍数 即判过期。2.5 留出一次抖动余量。 */
export const STALE_FACTOR = 2.5

/** Windows 对「从未运行」填的哨兵时刻(本地时间 1999-11-30 0:00)的可接受容差。 */
export const NEVER_RUN_YEAR = 1999

function toMs(v) {
  if (v == null) return null
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Date.parse(String(v))
  return Number.isFinite(n) ? n : null
}

function isNeverRunStamp(ms) {
  if (ms == null) return false
  const d = new Date(ms)
  return d.getUTCFullYear() <= NEVER_RUN_YEAR
}

/**
 * 判一条任务。
 * @param {{name:string,lastResult:number,lastRun?:any,status?:string,trigger?:string,
 *          intervalMin?:number|null,registeredAt?:any,bootAt?:any,disabledIntent?:boolean}} entry
 * @param {{now?:number}} opts
 * @returns {{name:string,verdict:'ok'|'breach'|'warn'|'undetermined',reason:string}}
 */
export function classifyTask(entry, opts = {}) {
  const name = String(entry?.name || '(unnamed)')
  const now = toMs(opts.now) ?? Date.now()
  /* Number(null) 会静默变成 0 —— 那等于把「没取到」判成「成功」,必须先挡掉。 */
  if (!entry || entry.lastResult == null || !Number.isFinite(Number(entry.lastResult))) {
    return { name, verdict: 'undetermined', reason: '取不到 Last Result' }
  }
  const lastResult = Number(entry.lastResult)
  const status = String(entry.status || '')
  const trigger = String(entry.trigger || '')
  const intervalMin =
    Number.isFinite(Number(entry.intervalMin)) && Number(entry.intervalMin) > 0
      ? Number(entry.intervalMin)
      : null
  const lastRunMs = toMs(entry.lastRun)
  const registeredMs = toMs(entry.registeredAt)
  const bootMs = toMs(entry.bootAt)

  /* ⓪ 先判「有意停用」:配置登记过的任务,它 Disabled 是预期,
     此时 Last Result 留着停用前那次的旧码(可能是 1 或 -1073741510),
     若把返回码检查排前面就会把「按计划停掉的」反复点成故障。 */
  if (/disabled/i.test(status)) {
    if (entry.disabledIntent) return { name, verdict: 'ok', reason: '已禁用(配置标记为有意停用)' }
    return { name, verdict: 'warn', reason: 'Status=Disabled 且未标记为有意停用' }
  }

  /* ① 非良性返回码 ⇒ 失败。267011 走下面单独路径。 */
  if (!BENIGN_CODES.has(lastResult)) {
    return { name, verdict: 'breach', reason: `Last Result=${lastResult} 非良性返回码(失败)` }
  }

  /* ② 尚未运行:要分「还没到点」与「该跑没跑」。 */
  if (lastResult === 267011 || isNeverRunStamp(lastRunMs)) {
    const isBoot = /boot/i.test(trigger)
    if (isBoot) {
      /* 开机触发:开机早于注册 ⇒ 尚未经历下一次开机,正常 */
      if (registeredMs != null && bootMs != null && bootMs < registeredMs) {
        return { name, verdict: 'ok', reason: '开机触发型,开机早于注册,等下次开机' }
      }
      if (registeredMs != null && bootMs != null && bootMs > registeredMs) {
        return { name, verdict: 'breach', reason: '开机触发型,开机晚于注册却仍未运行(开机触发未生效)' }
      }
      return { name, verdict: 'undetermined', reason: '开机触发型,取不到开机时间或注册时间' }
    }
    /* 周期型:超过 2.5 个间隔还没跑过 ⇒ 该跑没跑 */
    if (intervalMin != null && registeredMs != null) {
      const ageMin = (now - registeredMs) / 60_000
      if (ageMin > intervalMin * STALE_FACTOR) {
        return {
          name,
          verdict: 'breach',
          reason: `周期型已注册 ${Math.round(ageMin)} 分钟仍未运行(间隔 ${intervalMin} 分钟)`,
        }
      }
      return { name, verdict: 'ok', reason: '周期型,注册未超过两个间隔,尚未到首轮' }
    }
    return { name, verdict: 'undetermined', reason: '尚未运行,但取不到间隔或注册时间' }
  }

  /* ④ 过期未跑:距上次运行超过 2.5 个间隔。 */
  if (intervalMin != null && lastRunMs != null) {
    const ageMin = (now - lastRunMs) / 60_000
    if (ageMin > intervalMin * STALE_FACTOR) {
      return {
        name,
        verdict: 'breach',
        reason: `距上次运行 ${Math.round(ageMin)} 分钟,间隔 ${intervalMin} 分钟(已过期)`,
      }
    }
  }

  return { name, verdict: 'ok', reason: '正常' }
}

/**
 * 汇总多条目。
 * @returns {{state:string,rows:object[],breaches:string[],warns:string[],
 *            undetermined:string[],total:number,reason:string}}
 */
export function judgeSchedulerHealth(entries, opts = {}) {
  const rows = (entries || []).map((e) => classifyTask(e, opts))
  const breaches = rows.filter((r) => r.verdict === 'breach').map((r) => r.name)
  const warns = rows.filter((r) => r.verdict === 'warn').map((r) => r.name)
  const undetermined = rows.filter((r) => r.verdict === 'undetermined').map((r) => r.name)

  let state = SCHEDULER_STATE.OK
  let reason
  if (breaches.length > 0) {
    state = SCHEDULER_STATE.BREACH
    reason = `${breaches.length}/${rows.length} 条任务失效: ${breaches.slice(0, 8).join('、')}`
  } else if (undetermined.length > 0) {
    state = SCHEDULER_STATE.UNDETERMINED
    reason = `${undetermined.length}/${rows.length} 条取不到判据`
  } else if (warns.length > 0) {
    reason = `${rows.length} 条任务健康,${warns.length} 条被禁用待确认`
  } else {
    reason = `${rows.length} 条任务全部健康`
  }
  return { state, rows, breaches, warns, undetermined, total: rows.length, reason }
}

/** 给每条 breach / warn 一句可执行的下一步。 */
export function remediationForScheduler(result) {
  const out = []
  for (const name of result?.breaches || []) {
    out.push(
      `${name}: schtasks /run /tn "\\${name}" 立即补跑;仍失败则 schtasks /query /tn "\\${name}" /fo LIST /v 核对 Last Result 与 Task To Run 实际路径`,
    )
  }
  for (const name of result?.warns || []) {
    out.push(
      `${name}: 已禁用但未标记有意停用;确认后要么启用,要么在 scripts/data/scheduler-roster.json 记 disabledIntent`,
    )
  }
  return out
}

export const __test__ = { toMs, BENIGN_CODES, NEVER_RUN_YEAR, STALE_FACTOR, isNeverRunStamp }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
