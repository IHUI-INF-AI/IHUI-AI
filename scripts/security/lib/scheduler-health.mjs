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
 * 判五类真实失效:
 *   ① 失败        Last Result 是非零且不是「良性返回码」
 *   ② 从未运行    Boot 型任务在「开机晚于注册」之后仍显示 1999/11/30
 *   ③ 该跑没跑    周期型任务距上次运行超过 STALE_FACTOR × 间隔
 *   ④ 被禁用      Status=Disabled 且不是配置里标记的「有意停用」
 *   ⑤ 静默死亡    重复窗口到期(Duration 太短 / Next Run 为空)与触发锚点错位
 *                 ——「仪表全绿、任务已死」那一型,见 judgeRepetition / judgeCadence
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

/**
 * 重复型任务的「静默死亡」判据(2026-11-25 立,第二十二件)。纯函数。
 *
 * 立因是当天亲历的一次:**任务活得看起来完美,其实已经死了。**
 *   新建 `IHUI-Security-Evidence-Intake` 时写了 `<Repetition><Interval>PT2M</Interval>
 *   <Duration>P1D</Duration></Repetition>`,`StartBoundary` 又是当天 00:00 ⇒ 重复窗口 = 
 *   `[当天 00:00, 次日 00:00]`。跑到 23:58 之后再也没有下一次,`Next Run Time` 静默退回
 *   **`N/A`**,任务从此不再触发 —— 而 `Last Result` 一直是 0、`Status` 一直是 `Ready`、
 *   `Repeat: Every` 还照样显示 `0 Hour(s), 2 Minute(s)`。
 *   原有四类判据(失败/从未运行/该跑没跑/被禁用)一条都咬不住它:它没失败、跑过、没被禁用。
 *
 * 这一类失效的可怕之处在于**它没有任何副作用**:除了「不再有下一次」,所有仪表都正常。
 * 而这个信号恰恰不在原有采集里 —— `Repeat: Every` 有值、`Next Run Time` 也没人读。
 *
 * 三条判据(①② 命中即 breach;③ 判 warn —— 理由写在其所在分支里):
 *   ① **`<Duration>` 短于服役期** —— 重复窗口一定会到期。阈值 `MIN_DURATION_DAYS`,
 *      语义是「这个值必须远大于这台机器/这套服务的剩余寿命」;`P3650D`(10 年)合法,
 *      `P1D` / `PT1H` 这类必死。不写 `<Duration>` = 无终点 = 合法(本机其余 5 个哨兵的形态)。
 *   ② **`Next Run Time` 为空** —— 重复型任务连下一次都没有了,不管原因是什么都该报。
 *   ③ **`LogonType=InteractiveToken`** —— 实测 `id=101` + `2147943568`(`0x80070490`
 *      = Element not found):无人值守(锁屏 / RDP 断开)时拿不到该用户的交互会话令牌,
 *      「每小时在触发、每次都起不来」。纯控制台命令的哨兵必须用 S4U / SYSTEM。
 *
 * @param {{repeatEvery?:string, repeatDuration?:string, nextRun?:string, logonType?:string}} entry
 * @returns {{verdict:'ok'|'breach', reason:string}|null} `null` = 不是重复型任务,本维不适用
 */
export const MIN_DURATION_DAYS = 365

/** 把 `<Duration>` 的两种写法都认下来:ISO-8601(`P1D` / `PT2M` / `P3650D`)与显示式(`1 Day(s)`)。 */
export function parseDurationDays(v) {
  const s = String(v == null ? '' : v).trim()
  if (!s || /^(n\/a|none|disabled|不适用)$/i.test(s)) return null
  /* ISO-8601:只认天(PnD)与小时/分钟(PTnH / PTnM),足够覆盖 Task Scheduler 的用法 */
  const isoDay = s.match(/^P(\d+)D$/)
  if (isoDay) return Number(isoDay[1])
  const isoTime = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (isoTime) {
    const h = Number(isoTime[1] || 0)
    const m = Number(isoTime[2] || 0)
    if (h === 0 && m === 0) return null
    return (h * 60 + m) / 1440
  }
  /* 显示式:`3650 Day(s)` / `2 Hour(s)` */
  const dispDay = s.match(/(\d+)\s*Day\(s\)/i)
  if (dispDay) return Number(dispDay[1])
  const dispHour = s.match(/(\d+)\s*Hour\(s\)/i)
  if (dispHour) return Number(dispHour[1]) / 24
  return null
}

export function judgeRepetition(entry) {
  const every = String(entry?.repeatEvery ?? '').trim()
  if (!every || /^(n\/a|none|disabled)$/i.test(every)) return null

  const durRaw = String(entry?.repeatDuration ?? '').trim()
  const days = parseDurationDays(durRaw)
  if (days != null && days < MIN_DURATION_DAYS) {
    return {
      verdict: 'breach',
      reason: `Repetition 带 <Duration>${durRaw}(${days < 1 ? `${Math.round(days * 1440)} 分钟` : `${days} 天`})短于服役期 ⇒ 重复窗口到期后 Next Run Time 会静默变 N/A 并永久停摆;去掉 <Duration> 即为无限重复`,
    }
  }

  const next = String(entry?.nextRun ?? '').trim()
  if (!next || /^(n\/a|unknown)$/i.test(next)) {
    return {
      verdict: 'breach',
      reason: '重复型任务没有下一次运行时间(Next Run Time 为空)⇒ 已排不进队列,不会再自动触发',
    }
  }

  if (String(entry?.logonType ?? '').trim() === 'InteractiveToken') {
    /* 这一档刻意判 **warn** 而不是 breach(2026-11-25 实测校准)。
       本机现有 5 条 InteractiveToken 任务(WorkBuddy / Qoder / RefMove / Guardian-Leg)
       此刻全部 `Last Result=0`、几分钟前刚跑过、`Next Run Time` 也有值 —— 因为当前
       确实有交互会话在线。判 breach 就是拿「会话在不在」这种机器状态当判据,而它每轮
       都会变:人在线时全绿、人一走全红,恒红门只会逼人把这道判据关掉(§0.2)。
       真实语义是「会话一断就起不来」= 有失效风险但不是已失效 ⇒ warn。 */
    return {
      verdict: 'warn',
      reason: 'LogonType=InteractiveToken ⇒ 当前能跑(有交互会话),但锁屏/RDP 断开时取不到该用户令牌(实测 id=101 / 0x80070490),那一轮起不来;无人值守的哨兵应改 S4U 或 SYSTEM',
    }
  }

  return { verdict: 'ok', reason: '重复窗口无到期' }
}

/**
 * 「声明节律」与「实测触发锚点」对账(2026-11-26 立,第二十三件)。纯函数。
 *
 * 立因:上面那一维只对**带 Repetition 的任务**生效(`isRepeating()` 要求 `Repeat: Every`
 * 有值)。而 `\IHUI-AI auto-evolve` 2026-11-25 的真因是 **LogonTrigger** —— 若有人把它
 * 改回登录触发、且顺手去掉 Repetition(或改成「On demand only」),CSV 两列都会显示
 * `Disabled`,`isRepeating()` 直接跳过 ⇒ 这条任务在整道哨兵里**完全不可见**,
 * 而它的 `Last Result` 会一直是 0(手动补跑成功)。
 *
 * 只靠机器状态没法判「登录触发是不是本来就这样」—— 有些任务(DevStack、G-Root-Guardian)
 * 本来就是开机/登录型,判它们红就是恒红门(§0.2)。所以这一维靠**声明**:
 * `scripts/data/scheduler-roster.json` 的 `expectedCadence` 写明「这条必须无人值守按点跑」,
 * 判据只对在册的任务生效,清单外的任务本维不适用(返回 null,不冒充通过)。
 *
 * 三条:① 触发器必须是定时型(`TimeTrigger`/`CalendarTrigger`),否则 = 没人登录就不跑;
 *      ② 必须真有 Repetition,否则 = 只在首次起跳那一刻跑一次;
 *      ③ 实测 `<Interval>` 不得慢于声明的 1.5 倍(拉长 = 检测窗口变宽)。
 *
 * @param {{triggerKinds?:string[],expectedEveryMin?:number,expectedDailyAt?:string,
 *          repeatEvery?:string,intervalMin?:number}} entry
 * @returns {{verdict:'ok'|'breach'|'warn'|'undetermined',reason:string}|null}
 *          `null` = 该任务没登记声明节律,本维不适用
 */
export function judgeCadence(entry) {
  const everyMin = Number(entry?.expectedEveryMin)
  const dailyAt = String(entry?.expectedDailyAt ?? '').trim()
  const declared = (Number.isFinite(everyMin) && everyMin > 0) || Boolean(dailyAt)
  if (!declared) return null

  const kinds = Array.isArray(entry?.triggerKinds) ? entry.triggerKinds.map((k) => String(k)) : null
  if (!kinds || kinds.length === 0) {
    /* 取不到触发器定义 —— 不记绿也不冒红(§0.3),点名说清缺什么。 */
    return {
      verdict: 'undetermined',
      reason: '已登记声明节律,但取不到任务触发器定义(schtasks /query /xml 无输出或不可解析)',
    }
  }
  const timeKinds = kinds.filter((k) => k === 'TimeTrigger' || k === 'CalendarTrigger')

  if (dailyAt) {
    if (timeKinds.length > 0) return { verdict: 'ok', reason: `定时/日历触发(${kinds.join('+')})` }
    return {
      verdict: 'breach',
      reason: `声明每日 ${dailyAt} 跑,实际触发器只有 ${kinds.join('+')} ⇒ 不登录/不开机就不跑,也没有固定时刻`,
    }
  }

  if (timeKinds.length === 0) {
    return {
      verdict: 'breach',
      reason: `声明每 ${everyMin} 分钟无人值守跑,实际触发器只有 ${kinds.join('+')} ⇒ 只在事件那一刻起跳,没人登录就根本不跑(CSV 的 Next Run Time 会显示 N/A)`,
    }
  }
  const everyRaw = String(entry?.repeatEvery ?? '').trim()
  if (!everyRaw || /^(n\/a|none|disabled)$/i.test(everyRaw)) {
    return {
      verdict: 'breach',
      reason: `声明每 ${everyMin} 分钟跑,但任务没有 Repetition ⇒ 只在定时器首次起跳那一刻跑一次,之后不再循环`,
    }
  }
  const actual = Number(entry?.intervalMin)
  if (!Number.isFinite(actual) || actual <= 0) {
    return { verdict: 'undetermined', reason: '声明节律在册,但取不到 <Interval> 值' }
  }
  if (actual > everyMin * 1.5) {
    return {
      verdict: 'breach',
      reason: `实测间隔 ${actual} 分钟慢于声明 ${everyMin} 分钟(超 1.5 倍)⇒ 检测窗口被拉长`,
    }
  }
  /* 比声明更快不算问题(只会更早看见)。 */
  return { verdict: 'ok', reason: `定时型 ${actual} 分钟` }
}

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

  /* ①b 重复窗口自身已死(2026-11-25 立)。必须排在「尚未运行」与「过期未跑」之前:
     这两条都靠「距上次运行」量时间,而静默死亡的此刻距上次运行往往只有几分钟 ——
     仪表全绿、任务已死。判据必须在它刚开始死的这一轮就咬住。 */
  const rep = judgeRepetition(entry)
  if (rep && rep.verdict !== 'ok') {
    return { name, verdict: rep.verdict, reason: rep.reason }
  }

  /* ①c 触发锚点 vs 声明节律(2026-11-26 立,第二十三件)。同样必须排在「尚未运行/过期未跑」
     之前:登录触发型任务在有人登录时**看起来很新鲜**,靠「距上次运行」量不出来 ——
     它的失效只在「没人登录」时才显形,而那一刻没有人看表。判据只能对着声明对账。 */
  const cad = judgeCadence(entry)
  if (cad && cad.verdict !== 'ok') {
    return { name, verdict: cad.verdict, reason: cad.reason }
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
  const repeatHint =
    '若 Last Result=0 且 Status=Ready,再查 schtasks /query /tn "\\<name>" /xml:看 <Repetition> 是否带 <Duration>(短于服役期必死)、Next Run Time 是否已 N/A、触发器是否从 TimeTrigger 变成了 LogonTrigger/BootTrigger'
  for (const name of result?.breaches || []) {
    out.push(
      `${name}: schtasks /run /tn "\\${name}" 立即补跑;仍失败则 schtasks /query /tn "\\${name}" /fo LIST /v 核对 Last Result 与 Task To Run 实际路径;${repeatHint}`,
    )
  }
  for (const name of result?.warns || []) {
    out.push(
      `${name}: 已禁用但未标记有意停用;确认后要么启用,要么在 scripts/data/scheduler-roster.json 记 disabledIntent`,
    )
  }
  /* 判 undetermined 的条目也要给下一步:它等于「这一维没判」,最容易被当成绿。 */
  for (const name of result?.undetermined || []) {
    out.push(
      `${name}: 这一维未判定(取不到判据);查 schtasks /query /tn "\\${name}" /xml 能否输出,以及 scripts/data/scheduler-roster.json 的 expectedCadence 是否写错任务名`,
    )
  }
  return out
}

export const __test__ = {
  toMs,
  BENIGN_CODES,
  NEVER_RUN_YEAR,
  STALE_FACTOR,
  isNeverRunStamp,
  parseDurationDays,
  judgeRepetition,
  judgeCadence,
  MIN_DURATION_DAYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
