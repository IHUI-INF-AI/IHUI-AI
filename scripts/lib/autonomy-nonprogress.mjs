// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-nonprogress.mjs —— 自治环「同票空转记忆」判据(纯函数,零 IO)
 *
 * 立因(2026-11-04 实测,不是"再加一层保险"):
 *   `failureStreakOf` 只数**连续**的 session-failed/session-timeout,遇到任何其他 action 即打断。
 *   而 2026-11-01 把发起腿级失败分型成 `runner-unavailable`(不计票连败 —— 那个分型本身是对的:
 *   调度器自己的腿断了不该封票)。两件事叠在一起留下一个没有终态的洞:
 *   票 B53 在 2026-10-31→11-03 三天里占了台账 209 行中的 **127 行**
 *   (session-failed 43 + runner-unavailable 36 + valve-observe-stop 21 + artifact-manifest-missing 8 …),
 *   两种失败交替出现 ⇒ 连败计数每次都被 reset ⇒ 阈值 3 永远够不着 ⇒ 从不封禁;
 *   而 `runOnce` 的候选序固定 ⇒ 每小时都把同一枚顶格票重新顶到队首,其余 5-6 枚可排期候选拿不到班次。
 *   结论:自治环当时不是在"自主开发",是在对一枚它救不活的票无限重试。
 *
 * 本器补的是**另一条轴**,不动封票那条(封票管的是"这张票是不是坏票";本器管的是
 * "这枚票已经吃掉了多少班次而无推进" —— 一个是问责,一个是调度公平):
 *   · attemptsSinceProgress:从台账尾部往回数,progress ⇒ 归零,non-progress ⇒ +1,
 *     其他(含无 ticketKey 的轮次行)⇒ 既不归零也不计数,一律跳过。
 *     刻意不沿用"遇到其他 action 就 break"的旧形,因为正是那个 break 造成了 reset 洞。
 *   · decideNonProgress:三档出口 try / rotate / park。rotate 把候选序让给它(治饿死),
 *     park 是**有终态的停手**(不再占班次,并在台账落一条可追责的点名),
 *     不是"再多试一轮试试"。失效方向恒为"多让一次班次给别人",绝不是"多放一次跳门"。
 */

/** 该票真推进了 ⇒ 空转计数归零。 */
export const PROGRESS_ACTIONS = Object.freeze([
  'session-ok',
  'dispatch-settled',
  'artifact-committed',
  'task-registered',
])

/** 占了班次却没推进(不分"谁的错")⇒ 计入空转。 */
export const NON_PROGRESS_ACTIONS = Object.freeze([
  'session-failed',
  'session-timeout',
  'runner-unavailable',
  'runner-undetermined',
  'artifact-manifest-missing',
  'artifact-commit-failed',
  // 整批落在判据面上被落账腿拒收:会话确实跑了、清单也写了,但**零推进**(没有任何文件进仓)。
  // 计入空转是有方向的收紧(不是放宽):不计,同一枚"非动判据面不可"的票会每小时白占一份日预算,
  // 把 B53 那型饿死在另一个入口上重演。
  'artifact-protected-face',
  'valve-observe-stop',
  'valve-unjudged-block',
])

/**
 * 从台账尾部往回取该票"距上次推进"的空转次数。
 * 只认 ticketKey 相等的行;PROGRESS ⇒ 立即归零返回 0;NON_PROGRESS ⇒ +1;其余 ⇒ 跳过继续往前数。
 * @param {Array<{ticketKey?:string,action?:string}>} ledger
 * @param {string} key
 * @returns {number}
 */
export function attemptsSinceProgress(ledger, key) {
  if (!Array.isArray(ledger) || !key) return 0
  let n = 0
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (!e || e.ticketKey !== key) continue
    const action = String(e.action ?? '')
    if (PROGRESS_ACTIONS.includes(action)) return n
    if (NON_PROGRESS_ACTIONS.includes(action)) n++
  }
  return n
}

/**
 * 四档出口。阈值由调用方从 gates 取(本器不写死机器档位)。
 * 阶梯刻意做成"每一档都有终态",不许出现"无限重试"或"无限静默停摆"任一极端:
 *   try      ⇒ 照派。
 *   rotate   ⇒ 本轮让位给空转更少的候选(治饿死),仍然会再被排到。
 *   cooldown ⇒ 跳到 `until` 之后再试一次(占班次的频率被压到每 parkCooldownHours 一次)。
 *   park     ⇒ 终局:达硬顶仍零推进 ⇒ 永久停占班次,只等"该键出现一次真推进"或人工处置,
 *              不再自动回升(回升 = 把无限重试换个马甲)。
 * 档位自相矛盾 ⇒ route='unjudged' 并点名,绝不猜一档接着跑(§0.3)。
 * @returns {{route:'try'|'rotate'|'cooldown'|'park'|'unjudged',attempts:number,why:string}}
 */
export function decideNonProgress({ attempts, rotateAt, parkAt, hardAt, cooldownHours, now = Date.now(), lastStoodAt } = {}) {
  const nums = { rotateAt, parkAt, hardAt }
  for (const [k, v] of Object.entries(nums)) {
    if (!Number.isInteger(v) || v < 1) {
      return { route: 'unjudged', attempts: Number.isInteger(attempts) ? attempts : 0, why: `阈值 ${k} 不是正整数(现值 ${String(v)})⇒ 不判` }
    }
  }
  if (!(parkAt > rotateAt && hardAt > parkAt)) {
    return { route: 'unjudged', attempts: Number.isInteger(attempts) ? attempts : 0, why: `档位必须严格递增 rotateAt(${rotateAt}) < parkAt(${parkAt}) < hardAt(${hardAt}) ⇒ 现值自相矛盾,不判` }
  }
  if (!Number.isInteger(cooldownHours) || cooldownHours < 1) {
    return { route: 'unjudged', attempts: Number.isInteger(attempts) ? attempts : 0, why: `cooldownHours 不是正整数(现值 ${String(cooldownHours)})⇒ 不判` }
  }
  if (!Number.isInteger(attempts) || attempts < 0) {
    return { route: 'unjudged', attempts: 0, why: `空转次数取不到(attempts=${String(attempts)})⇒ 未判定,按最保守的 rotate 走` }
  }
  if (attempts >= hardAt) {
    return { route: 'park', attempts, why: `同票累计空转 ${attempts} 次已达硬顶(${hardAt})⇒ 永久停占班次,等真推进或人工处置,不再自动回升` }
  }
  if (attempts >= parkAt) {
    const stood = Number.isFinite(lastStoodAt) ? lastStoodAt : null
    if (stood !== null && now - stood < cooldownHours * 3600_000) {
      const remainMin = Math.ceil((cooldownHours * 3600_000 - (now - stood)) / 60_000)
      return { route: 'cooldown', attempts, why: `空转 ${attempts} 次(线 ${parkAt})⇒ 冷却中,还差 ${remainMin} 分钟才再试一次` }
    }
    if (stood === null) {
      // 到冷却线却读不到上次冷却起点 ⇒ 当作"冷却已到期"放一次,并在 why 里点名(不是静默放行)
      return { route: 'try', attempts, why: `空转 ${attempts} 次 ≥ ${parkAt},但读不到上次冷却起点 ⇒ 本回合只放一次并点名(不冒充已冷却)` }
    }
    return { route: 'try', attempts, why: `空转 ${attempts} 次 ≥ ${parkAt} 且冷却已到期 ⇒ 再放一次(每次空转都会重新进入 ${cooldownHours}h 冷却)` }
  }
  if (attempts >= rotateAt) {
    return { route: 'rotate', attempts, why: `同票已空转 ${attempts} 次(线 ${rotateAt})⇒ 本轮让位给空转更少的候选` }
  }
  return { route: 'try', attempts, why: `同票空转 ${attempts} 次 < ${rotateAt} ⇒ 照派` }
}

/**
 * 空转明细按 action 归堆,给到人的邮件用(§5e-1:告警必须可整改 —— 只说"失败了 127 次"没法动)。
 * @returns {Array<{action:string,count:number}>} 按条数降序
 */
export function breakdownNonProgress(ledger, key) {
  if (!Array.isArray(ledger) || !key) return []
  const tally = new Map()
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (!e || e.ticketKey !== key) continue
    const action = String(e.action ?? '')
    if (PROGRESS_ACTIONS.includes(action)) break
    if (!NON_PROGRESS_ACTIONS.includes(action)) continue
    tally.set(action, (tally.get(action) || 0) + 1)
  }
  return [...tally.entries()].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count)
}

/**
 * 该票最近一次"停占班次"(cooldown/hold/park 留痕行)的时刻,用来算冷却是否到期。
 * 只看票自己的键;读不到 ⇒ null(调用方据此走"放一次并点名",不静默放行)。
 * @returns {number|null} epoch ms
 */
export function lastNonProgressHoldAt(ledger, key) {
  if (!Array.isArray(ledger) || !key) return null
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (!e || e.ticketKey !== key) continue
    if (String(e.action ?? '') === 'non-progress-hold') {
      const t = Date.parse(String(e.ts ?? ''))
      return Number.isFinite(t) ? t : null
    }
  }
  return null
}

export const __test__ = {
  PROGRESS_ACTIONS,
  NON_PROGRESS_ACTIONS,
  attemptsSinceProgress,
  decideNonProgress,
  breakdownNonProgress,
  lastNonProgressHoldAt,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
