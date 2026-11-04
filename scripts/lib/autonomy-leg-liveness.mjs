// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-leg-liveness.mjs —— 自治腿「黑腿探测器」判据(纯函数,零 IO)
 *
 * 立因(2026-11-04 实测;这是同日两枚洞的共同成因,不是"再加一条尺子"):
 *   `check-autonomy-leg-health.mjs` 的 A1-A7 量的全是"这道工序在不在位、有没有被走到",
 *   没有一条量"这台机器按不按自己的节律真在动"。于是:
 *     · 号池容量哨兵盲了 19 小时(146 轮未判定)而 A 面全绿;
 *     · 部署反馈自学腿的派发戳停在 2026-11-02T16:05,对 20 分钟节律已经静默 ~36 小时,
 *       尺子照旧报 OK=7 DRIFT=0 UNJUDGED=0;
 *     · `user-feedback-export` 那枚戳在仓里**找不到任何生产者**(全仓 grep 0 命中),
 *       也没人知道它该不该动。
 *   安静失效的表现永远是"绿"。本器把"多久没动就算瞎"变成一条能跑、能点名、能到人的读数。
 *
 * 覆盖面自证(不靠人记得登记):候选集 = 落盘上所有 `*-dispatch-last.json`。
 *   登记了 ⇒ 按各自节律量;没登记 ⇒ 进 `unregistered` 档点名(绝不静默略过);
 *   登记了而戳不在 ⇒ 进 `rotting` 档(§0.7 清单腐烂判红)。三桶不并桶。
 *
 * 档位不复制生产侧节律的两种口径:登记表只存"名义节律 + 出处(env 变量名 + 归属函数 + 现读日期)",
 *   容忍窗一律由本器的策略(× 倍数,带下限)现算。倍数与下限的存在理由写在登记表 note 里。
 *   登记表条目 `verifiedAt` 超 `ROTATE_DAYS` ⇒ 进 `stale-verification` 档(逼人复确认,不许清单冻存)。
 *
 * 失效方向(§0.3 / §0.10):登记表读不到/形状坏 ⇒ **整维 unjudged**,不读成"没有黑腿";
 *   单枚戳读不到 ⇒ 该枚 unjudged 并点名,不按"没动=正常"处理;戳在未来(时钟失步)⇒ unjudged。
 *   任何情况下都不用 0 冒充"全部健康"。
 */

/** 名义节律之外再给的容忍倍数(覆盖守护重启窗 + "上一轮仍在跑⇒本轮静默退出"的让路趟)。 */
export const SILENCE_MULTIPLIER = 4
/** 容忍窗下限:5 分钟节律的腿静默 20 分钟常常只是守护抖了一下,不足够喊人。 */
export const MIN_SILENCE_MS = 2 * 60 * 60 * 1000
/** 登记表条目的存活期:超了就要求复确认(照 §0.7 豁免会到期同型)。 */
export const ROTATE_DAYS = 90
/**
 * "新登记还没首跑"的宽限:实测一趟 tick 链要 7-12 分钟,而派发腿在链尾;
 * 给到 24h 足够跨过一个完整周期(含守护重启/提交窗口让路)。宽限按条目 verifiedAt 计,
 * 自己会过期 ⇒ 不会变成永久盲区(§0.10:豁免必须带终态)。
 */
export const FIRST_RUN_GRACE_MS = 24 * 60 * 60 * 1000

/** 容忍窗 = max(名义节律 × 倍数, 下限)。名义节律坏 ⇒ null(调用方落 unjudged,不猜一个窗)。 */
export function silenceWindowMs(nominalIntervalMs) {
  if (!Number.isInteger(nominalIntervalMs) || nominalIntervalMs <= 0) return null
  return Math.max(nominalIntervalMs * SILENCE_MULTIPLIER, MIN_SILENCE_MS)
}

/**
 * 逐腿判定。
 * @param {object} p
 * @param {Array<{stamp:string,nominalIntervalMs:number,owner:string,envVar?:string,verifiedAt?:string}>} p.legs 登记表条目
 * @param {Record<string,{readable:boolean,attemptAtMs?:number}>} p.stamps 盘上实测(缺 ⇒ 该枚不存在)
 * @param {string[]} p.stampFilesOnDisk 盘上全部 `*-dispatch-last.json`(覆盖面自证的另一半)
 * @param {number} p.now
 * @returns {{state:string,rows:Array,summary:string}}
 */
export function classifyLegs({ legs, stamps, stampFilesOnDisk, now } = {}) {
  if (!Array.isArray(legs) || legs.length === 0) {
    return { state: 'unjudged', rows: [], summary: '登记表读不到或为空 ⇒ 不判,绝不读成"没有黑腿"' }
  }
  if (!Number.isInteger(now)) {
    return { state: 'unjudged', rows: [], summary: '当下时刻取不到 ⇒ 静默时长算不出,不判' }
  }
  const disk = Array.isArray(stampFilesOnDisk) ? stampFilesOnDisk : []
  const rows = []

  for (const leg of legs) {
    const id = String(leg?.stamp ?? '')
    const windowMs = silenceWindowMs(leg?.nominalIntervalMs)
    if (!id || windowMs === null) {
      rows.push({ id: id || '(无名条目)', state: 'unjudged', why: `名义节律不是正整数(${String(leg?.nominalIntervalMs)})⇒ 容忍窗算不出` })
      continue
    }
    const obs = stamps?.[id]
    if (!obs) {
      // 登记了而戳不在,分两种:**新登记还是一次都没跑过** vs **跑过之后没了**。
      // 前者是"挂上还没轮到"(首趟 tick 链实测要 7-12 分钟,一登记就判腐烂等于自造红),
      // 后者才是清单腐烂。拿条目自己的 verifiedAt 当"新登记"时钟,宽限会自己过期 ⇒
      // 不会变成永久盲区:超过 FIRST_RUN_GRACE_MS 仍无戳 ⇒ 照旧 rotting。
      const ver = Date.parse(String(leg.verifiedAt ?? ''))
      const inGrace = Number.isFinite(ver) && now - ver >= 0 && now - ver < FIRST_RUN_GRACE_MS
      if (inGrace) {
        rows.push({ id, state: 'pending', why: `登记未满 ${Math.round(FIRST_RUN_GRACE_MS / 3600_000)}h(verifiedAt=${leg.verifiedAt})⇒ 首跑可能还没轮到,暂不判腐烂`, windowMs })
      } else {
        rows.push({ id, state: 'rotting', why: `登记了但盘上没有这枚戳(${id})⇒ 清单腐烂或器物已被摘;要么补回要么摘条目`, windowMs })
      }
      continue
    }
    if (obs.readable === false) {
      rows.push({ id, state: 'unjudged', why: '戳读不到/形状坏 ⇒ 不读成"没动=正常"', windowMs })
      continue
    }
    const at = Number(obs.attemptAtMs)
    if (!Number.isFinite(at)) {
      rows.push({ id, state: 'unjudged', why: '戳里没有可解析的 attemptAt ⇒ 没判', windowMs })
      continue
    }
    const ageMs = now - at
    if (ageMs < 0) {
      rows.push({ id, state: 'unjudged', why: `戳在未来 ${Math.round(-ageMs / 60000)} 分钟 ⇒ 时钟失步,静默量不出`, windowMs })
      continue
    }
    const verified = Date.parse(String(leg.verifiedAt ?? ''))
    const verAge = Number.isFinite(verified) ? now - verified : null
    if (verAge !== null && verAge > ROTATE_DAYS * 86400_000) {
      rows.push({
        id,
        state: 'stale-verification',
        why: `条目已 ${Math.round(verAge / 86400_000)} 天没复确认(线 ${ROTATE_DAYS} 天)⇒ 现读名义节律仍对吗(${leg.envVar ?? '?'}/${leg.owner ?? '?'})`,
        windowMs,
        silentMin: Math.round(ageMs / 60000),
      })
      continue
    }
    rows.push({
      id,
      state: ageMs > windowMs ? 'dark' : 'ok',
      silentMin: Math.round(ageMs / 60000),
      windowMs,
      nominalMin: Math.round(leg.nominalIntervalMs / 60000),
      owner: leg.owner ?? '',
      why:
        ageMs > windowMs
          ? `名义节律 ${Math.round(leg.nominalIntervalMs / 60000)} 分钟,已静默 ${Math.round(ageMs / 60000)} 分钟(容忍窗 ${Math.round(windowMs / 60000)} 分钟)⇒ 这一腿现在没在动`
          : '',
    })
  }

  // 覆盖面自证:盘上有而登记表没有 ⇒ 一律点名,不许"没登记就当不存在"
  const known = new Set(legs.map((l) => String(l?.stamp ?? '')))
  for (const f of disk) {
    if (known.has(f)) continue
    rows.push({ id: f, state: 'unregistered', why: `盘上有这枚派发戳,但登记表里没有条目 ⇒ 谁在派它、该多久动一次,无人认领` })
  }

  const count = (s) => rows.filter((r) => r.state === s).length
  const bad = count('dark') + count('unregistered') + count('rotting') + count('stale-verification')
  const state = bad > 0 ? 'drift' : count('unjudged') > 0 ? 'unjudged' : 'ok'
  const summary =
    `腿 ${rows.length} 枚:dark=${count('dark')} unregistered=${count('unregistered')} ` +
    `rotting=${count('rotting')} stale=${count('stale-verification')} pending=${count('pending')} ` +
    `unjudged=${count('unjudged')} ok=${count('ok')}`
  return { state, rows, summary }
}

/** 只取需要到人的条目(dark/unregistered/rotting/stale-verification),按静默时长降序。 */
export function actionableRows(res) {
  const set = new Set(['dark', 'unregistered', 'rotting', 'stale-verification'])
  return (res?.rows ?? [])
    .filter((r) => set.has(r.state))
    .sort((a, b) => (b.silentMin ?? -1) - (a.silentMin ?? -1))
}

export const __test__ = { SILENCE_MULTIPLIER, MIN_SILENCE_MS, ROTATE_DAYS, FIRST_RUN_GRACE_MS, silenceWindowMs, classifyLegs, actionableRows }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
