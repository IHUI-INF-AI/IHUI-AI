// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单门看门狗:把「排队/等锁」与「真正执行」分成两段计时(2026-11-07 立)。
 *
 * 病灶(实测原文):push 门日志 `[typecheck:full] 另一全量 typecheck 进行中(pid 39560),串行等待...`
 * 之后 `[T1] 300021ms` 被 300s 看门狗终止。那 300s 里有多少在等锁没人知道 —— 把**排队时间**
 * 当成**执行时间**,于是"别人忙"被读成"这道门跑不起来/代码有问题"。这不是判据。
 *
 * 协议(opt-in,仅台账登记 phaseProtocol 的门):子门拿到执行权后打一行
 * `#ihui-gate-phase:run-start`;执行器据此把计时起点移到该时刻。没有这一行 = 老语义
 * (全程算执行),未登记的门行为逐字不变。
 *
 * 两个独立结局,不许混:
 *   - runMs 超 runLimitMs ⇒ `ETIMEDOUT`(执行真超时,归"未判定/跑不起来");
 *   - waitMs 超 waitLimitMs ⇒ `BLOCKED_BY_CONCURRENCY`(可重试的未判定,不是这道门的结论)。
 *
 * 判据口径(2026-11-07 补,防把洞换个地方):
 *  - `waitMs` 覆盖「在排队、一行输出都没有」的情形 —— 等锁时子门可能确实什么都不打印;
 *    这是被判成"在等"的常态,不是异常。
 *  - `runMs` 只有在**确实观察到子门自己的输出**(即它打出 `run-start`)之后才可能非零。
 *    谁把 `run-start` 打早了(比如门一启动就打),等锁就会被重新算进 `runMs`,这个洞就白补。
 *  - 排队超限**不能**只凭"日志里没输出"就判 blocked:那会变成一块谁都能套的免责牌。
 *    只有拿到可验证事实 —— `wait-lock` 标记里的持锁 pid **存活**且心跳 `staleMs` **未过期**
 *    —— 才判 `BLOCKED_BY_CONCURRENCY`;拿不到证据一律按 `ETIMEDOUT`(卡死/跑不起来)。
 *
 * 反直觉证据(2026-11-07,别丢;写在 evidence[] 之外是为了让读代码的人先看到它):
 * 同一条 T1 门、同一棵树、同一份配置,空载真跑只要 **231.9s**;而另一次 300021ms 全花在
 * 「串行等待」(整份日志 56 行,7 行等锁、之后没有一行 pnpm/tsc 输出),批次里还记到过 493.5s。
 * 同一道门两次差一个数量级 ⇒ 差别来自**排队/竞争**,不是门本身变慢。所以「门慢 ⇒ 加预算」
 * 这个直觉被这组数据推翻:盲目抬高 timeoutMs 只会把别人的排队时间一并买进来,让失败得更晚、
 * 且仍然分不清是在等还是在跑。要动预算,先量 runMs,不是先量墙钟。
 *
 * 同型实例(2026-11-07,门 300,API 那批推送):**waitMs=465602 / runMs=17303**,整批 488s ——
 * 95.4% 的时间在排队,真跑只有 17.3s。这是"必须分段计时"的最强证据:只看墙钟会把一道 17 秒的门
 * 记成 8 分钟,并直接诱导"给它加预算";分段后两个数各自可核,也不会把等锁混进门的结论。
 */

export const RUN_START_MARKER = '#ihui-gate-phase:run-start'
export const WAIT_LOCK_MARKER = '#ihui-gate-phase:wait-lock'

// 例:`#ihui-gate-phase:wait-lock pid=39560 ts=1762400000000 staleMs=1200000`
const WAIT_LOCK_RE = /#ihui-gate-phase:wait-lock\s+pid=(\d+)\s+ts=(\d+)\s+staleMs=(\d+)/

function defaultIsPidAlive(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (e) {
    // EPERM = 进程存在但不归我管;只有 ESRCH 才算已死。
    return e?.code === 'EPERM'
  }
}

class GateWatchdogTimeout {
  constructor(code, message) {
    this.code = code
    this.message = message
  }
}

/**
 * @param {{
 *   phase?: boolean,            // 是否启用阶段协议(只有登记 phaseProtocol 的门才 true)
 *   runLimitMs?: number,        // 执行上限;非正数 = 不封顶(仅排障)
 *   waitLimitMs?: number,       // 排队/等锁独立上限;未启用阶段协议时忽略
 *   spawnedAt?: number,         // 子进程启动时刻
 *   now?: () => number,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 *   onExpire?: (t: {code: 'ETIMEDOUT'|'BLOCKED_BY_CONCURRENCY', message: string}) => void,
 * }} opts
 * @returns {{
 *   start: () => void,
 *   observe: (text: string) => boolean,
 *   finish: () => void,
 *   timing: (endedAt?: number) => {waitMs: number, runMs: number},
 *   runStarted: () => boolean,
 * }}
 */
export function createGatePhaseWatchdog(opts = {}) {
  const {
    phase = false,
    runLimitMs,
    waitLimitMs,
    spawnedAt = Date.now(),
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    isPidAlive = defaultIsPidAlive,
    onExpire = () => {},
  } = opts

  const runLimitValid = Number.isFinite(runLimitMs) && runLimitMs > 0
  const waitLimitValid = Number.isFinite(waitLimitMs) && waitLimitMs > 0

  let runStartAt = null
  let runTimer = null
  let waitTimer = null
  let closed = false
  let waitLock = null

  const expire = (code, message) => {
    if (closed) return
    onExpire(new GateWatchdogTimeout(code, message))
  }

  const armRun = () => {
    if (runTimer || !runLimitValid) return
    runTimer = setTimer(() => {
      expire('ETIMEDOUT', `守门脚本超时未退出(${runLimitMs}ms)`)
    }, runLimitMs)
  }

  /** 排队超限时唯一可采信的"在等"证据:持锁进程存活 + 心跳未过期。 */
  const verifyWaitEvidence = () => {
    if (!waitLock) return { ok: false, detail: '从未观察到 wait-lock 标记(不知道谁在持锁)' }
    const { pid, ts, staleMs } = waitLock
    if (!Number.isFinite(pid) || pid <= 0) return { ok: false, detail: `wait-lock pid 非法(${pid})` }
    if (!Number.isFinite(ts) || ts <= 0) return { ok: false, detail: 'wait-lock 心跳时间戳缺失' }
    const ageMs = now() - ts
    if (!(Number.isFinite(staleMs) && staleMs > 0) || ageMs >= staleMs) {
      return { ok: false, detail: `锁心跳已过期(${ageMs}ms ≥ staleMs=${staleMs})` }
    }
    if (!isPidAlive(pid)) return { ok: false, detail: `持锁进程 pid=${pid} 已不存活` }
    return { ok: true, detail: `持锁 pid=${pid} 存活且心跳未过期(${ageMs}ms < ${staleMs}ms)` }
  }

  const armWait = () => {
    if (!phase || !waitLimitValid) {
      armRun()
      return
    }
    waitTimer = setTimer(() => {
      // 已经打过 run-start 就不再是"排队超时";那一格归 runTimer。
      if (runStartAt !== null) return
      const proof = verifyWaitEvidence()
      if (proof.ok) {
        expire('BLOCKED_BY_CONCURRENCY', `排队等锁超限(${waitLimitMs}ms,blocked-by-concurrency;${proof.detail})`)
        return
      }
      // fail-closed:没有可验证的持锁事实 ⇒ 不判"在等",按卡死/跑不起来处理。
      expire(
        'ETIMEDOUT',
        `排队上限(${waitLimitMs}ms)已到,但无可验证的持锁证据(${proof.detail}) ⇒ 按卡死处理,不判 blocked-by-concurrency`,
      )
    }, waitLimitMs)
  }

  return {
    start() {
      armWait()
    },
    observe(text) {
      if (closed || !phase || typeof text !== 'string') return false
      let started = false
      if (text.includes(WAIT_LOCK_MARKER)) {
        const m = WAIT_LOCK_RE.exec(text)
        // 只认完整三字段;残缺标记不算证据(拿缺字段的"pid=0"去判在等就是免责牌)。
        if (m) waitLock = { pid: Number(m[1]), ts: Number(m[2]), staleMs: Number(m[3]) }
      }
      if (runStartAt === null && text.includes(RUN_START_MARKER)) {
        runStartAt = now()
        if (waitTimer) {
          clearTimer(waitTimer)
          waitTimer = null
        }
        armRun()
        started = true
      }
      return started
    },
    finish() {
      closed = true
      for (const t of [runTimer, waitTimer]) if (t) clearTimer(t)
      runTimer = null
      waitTimer = null
    },
    timing(endedAt = now()) {
      // 未启用阶段协议 = 老语义:全程算执行(未登记的门行为逐字不变)。
      if (!phase) return { waitMs: 0, runMs: endedAt - spawnedAt }
      // 启用了协议却始终没见 run-start(被排队上限掐掉/子门提前死):全部时间算排队。
      if (runStartAt === null) return { waitMs: endedAt - spawnedAt, runMs: 0 }
      return { waitMs: runStartAt - spawnedAt, runMs: endedAt - runStartAt }
    },
    runStarted() {
      return runStartAt !== null
    },
  }
}

export { GateWatchdogTimeout }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
