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
  // exit 0 但整班一次写盘都没成功(2026-11-04 立)。此前它被记成 `session-ok` 并进 PROGRESS_ACTIONS
  // ⇒ 阶梯每轮都被"成功"归零 ⇒ 一张永远推不动的票可以无限占班次而不 rotate、不 park。
  // 实测形态:9/9 次 session-ok 的 transcript 写类工具命中为 0,`artifact-committed` 至今为 0。
  'session-no-write',
  // exit=3 = CLI 自己的 `no_progress` 终态(整班无工具调用 + 空正文,补救一次后仍未推进)。
  // 2026-11-05 立:此前它被 stderr 里一行诊断劫持成 `runner-unavailable`(实测四臂同色:
  // rc=0/1/3/null 都判 undetermined),于是"零推进"这件事在阶梯里根本不存在,而 41 条台账
  // 把责任全推给调度器自己的腿。分型改对之后,这一档必须进空转集:它确实吃掉了班次。
  // 但它不走连败封票(那是"票坏不坏"那条轴),两轴不互相替换。
  'session-no-progress',
  // 整批落在判据面上被落账腿拒收:会话确实跑了、清单也写了,但**零推进**(没有任何文件进仓)。
  // 计入空转是有方向的收紧(不是放宽):不计,同一枚"非动判据面不可"的票会每小时白占一份日预算,
  // 把 B53 那型饿死在另一个入口上重演。
  'artifact-protected-face',
  'valve-observe-stop',
  'valve-unjudged-block',
  // 2026-11-04 由"发射集 vs 分档集"对账补上的五枚(此前 23 枚发射动作里 8 枚是票级却两档都不在,
  // 计数器直接跳过 ⇒ 同一枚票可以每小时白占一份日预算而永不封票 —— 与 B53 那型同一条病,只是入口不同):
  //  · artifact-manifest-invalid 清单写了但形状坏/票键不符/路径不安全 ⇒ 整批不落(零进仓)
  //  · artifact-manifest-stale   清单里没有一个文件真有改动 ⇒ 零进仓
  //  · mint-failed               凭据供值失败,`return` 在 dispatchSession **之前** ⇒ 不产生 session 行,不会双计
  //  · template-empty            模板未配置:只占队首一枚、一轮一次
  //  · valve-block               enforce 档命中停机类,`continue` 在派发之前 ⇒ 同样不产生 session 行
  'artifact-manifest-invalid',
  'artifact-manifest-stale',
  'mint-failed',
  'template-empty',
  'valve-block',
])

/**
 * 票级但不计入空转的动作,必须逐枚写明理由(§0.7:豁免必须"验过才免"且能被看见)。
 * 这张表与上面两档同源性由 `scripts/tests/autonomy-action-coverage.test.mjs` 钉住:
 * 那把锁从 `auto-evolve.mjs` 源码里收割全部发射串,任何一枚不属于三档之一即判红 ⇒
 * "又冒出一枚没人分档的动作"这件事从此不可能悄悄发生。
 * 每条理由必须 ≥10 字,且理由只能是"会双计/没占班次/终局另有机制/自身账",
 * 不许出现"先这样"式空话。
 */
export const ACTION_EXEMPTIONS = Object.freeze({
  'valve-allow': {
    reason: '放行标记,紧随其后必有 session-* 行被计 ⇒ 再计一次就是双计',
    site: 'auto-evolve.mjs decideValveDispatch',
  },
  'valve-unjudged': {
    reason: '闸判不了但照派(非 enforce 档),紧随的 session 行才是那一次班次',
    site: 'auto-evolve.mjs decideValveDispatch',
  },
  'dryrun-ticket': {
    reason: 'dry-run 不真派、不占日预算,计进去等于把预演当消耗',
    site: 'auto-evolve.mjs dispatchSession',
  },
  'artifact-preview': {
    reason: 'dry-run 落账预演,结构上没有真提交发生 ⇒ 不算占了班次',
    site: 'auto-evolve.mjs landTicketArtifacts',
  },
  quarantined: {
    reason: '封票本身已是终局(48h 不派),再计空转会把同一件事扣两遍并掩盖封票读数',
    site: 'auto-evolve.mjs 派发循环',
  },
  'non-progress-hold': {
    reason: '阶梯自己写的账(冷却/让位留痕),计入即自增计数,机制会自己把自己抬到 park',
    site: 'auto-evolve.mjs 空转阶梯',
  },
  'non-progress-parked': {
    reason: '阶梯终局留痕,同上;终局行绝不能成为继续累加的输入',
    site: 'auto-evolve.mjs 空转阶梯',
  },
  'nonprogress-unjudged': {
    reason: '阶梯自己取不到输入时的留痕,计入即"用判不动的轮次证明自己判得动"',
    site: 'auto-evolve.mjs 空转阶梯',
  },
  // 由并集展开出来的、结构上不会作为动作串发射的一枚(state=ok 时落账腿走 artifact-committed):
  // 列在这里是为了让"并集里新增一个 state 而忘了分档"这件事必须由锁来判红,而不是静默漏计。
  'artifact-manifest-ok': {
    reason: 'state=ok 不发射动作串,推进由 artifact-committed 记账 ⇒ 这一枚结构上不可达',
    site: 'auto-evolve.mjs landTicketArtifacts',
  },
  // 以下四枚是**轮级**留痕:`record` 时不带 ticketKey,而 attemptsSinceProgress 先按票过滤,
  // 结构上看不见它们 ⇒ 不计数的理由是"不属于任何一枚票",不是"可以不登记"。
  'runner-preflight-ready': {
    reason: '轮级在位探测通过留痕,不带 ticketKey ⇒ 按票计数器看不见它',
    site: 'auto-evolve.mjs 派发前闸',
  },
  'runner-preflight-template-empty': {
    reason: '轮级:模板空(dry-run 档)的探测留痕,不带 ticketKey,不占任何一枚票的班次',
    site: 'auto-evolve.mjs 派发前闸',
  },
  'runner-preflight-missing': {
    reason: '轮级:执行体不在位 ⇒ 整轮熔断喊人(归 runner-unavailable 那条腿处置),不按票扣',
    site: 'auto-evolve.mjs 派发前闸',
  },
  'runner-preflight-undetermined': {
    reason: '轮级:仓根取不到判不出在位 ⇒ 本轮不派并点名,不冒充票级空转',
    site: 'auto-evolve.mjs 派发前闸',
  },
  // 自我面闸的两枚(2026-11-05 立):它们**带 ticketKey**(要说清是哪张票没派成)但打
  // `informational:true` ⇒ 阶梯按标记跳过。不跳过的后果很具体:多会话共树下盘上副本常年不等于
  // HEAD,若这两行照计空转,每张票都会在几个班次内被推到 park —— 那是"环境常态"伪装成"票干不动",
  // 与 runner-unavailable 那型同一个洞(不计连败却计空转)。
  'runner-face-stale-disk': {
    reason: '盘上这份缺 HEAD 已有判据(有席从旧基线改调度器)⇒ 停派一轮,属环境常态,不计该票空转',
    site: 'auto-evolve.mjs 自我面闸',
  },
  'runner-face-undetermined': {
    reason: '自我面三面之一取不到 ⇒ 未判定不派,不冒充票级空转(§0.3)',
    site: 'auto-evolve.mjs 自我面闸',
  },
  // 占班次/轮级这一族:不属于任何一枚票(行内无 ticketKey,或它只是"将要派"的标记)。
  // 登记在此是为了让覆盖锁能证明"不计数"是有理由的决定,而不是又一次静默漏计。
  dispatched: {
    reason: '日预算的占班次标记,紧随的 session-* 行才是那一次的结果 ⇒ 再计就是双计',
    site: 'auto-evolve.mjs 派发循环',
  },
  'budget-exhausted': {
    reason: '轮级:日预算耗尽的收尾留痕,不带 ticketKey,不属于任何一枚票的空转',
    site: 'auto-evolve.mjs 预算闸',
  },
  'no-whitelist-hit': {
    reason: '轮级:本轮无一枚命中白名单的收尾读数,与具体票无关',
    site: 'auto-evolve.mjs 白名单闸',
  },
  'no-ticket': {
    reason: '轮级:本轮候选为空的收尾读数,不属于任何一枚票',
    site: 'auto-evolve.mjs 派单面',
  },
  'all-held-nonprogress': {
    reason: '轮级:候选全被空转记忆扣住的收尾读数(扣的每一枚已在各自票上计过)',
    site: 'auto-evolve.mjs 空转阶梯',
  },
  'decision-undetermined': {
    reason: '轮级:判期模型没给结论 ⇒ 按静态序兜底,与票的空转无关',
    site: 'auto-evolve.mjs 判期闸',
  },
  'probe-ok': {
    reason: '轮级:发起通路自检的通过留痕,不是任何一枚票的班次',
    site: 'auto-evolve.mjs probe',
  },
  'probe-fail': {
    reason: '轮级:通路自检失败(熔断喊人),归 A2/逃逸阀处置,不按票扣',
    site: 'auto-evolve.mjs probe',
  },
  'probe-undetermined': {
    reason: '轮级:通路自检判不出(仓根取不到),不记成功也不按票扣',
    site: 'auto-evolve.mjs probe',
  },
})

/**
 * 票级的模板发射点:锁必须把值并集展开成具体串再对账(不展开就会漏判)。
 * 只登记**票级**(行里带 ticketKey)的两处;`runner-preflight-${state}` 那族是轮级留痕
 * (行里没有 ticketKey),`attemptsSinceProgress` 的按票过滤天然看不见它们,不参与本锁。
 */
export const TEMPLATE_ACTION_SITES = Object.freeze({
  'artifact-manifest-${state}': {
    source: 'lib/ticket-artifacts.mjs',
    unionVar: 'ARTIFACT_MANIFEST_STATES',
  },
  'valve-${action}': { source: 'auto-evolve.mjs decideValveDispatch', unionVar: 'VALVE_ACTIONS' },
  // 第三族是轮级留痕(行内没有 ticketKey,按票计数器结构上看不见),但**照样得分档**:
  // 分档要写的理由就是"为什么不计数",而不是"可以不写"——不写的后果正是这次对账抓出来的 23 枚。
  'runner-preflight-${state}': { source: 'lib/autonomy-runner.mjs', unionVar: 'PREFLIGHT_STATES' },
})

/** 发射动作的分档:progress / non-progress / exempt / 未分档(未分档即锁的红)。 */
export function actionBucketOf(action) {
  if (PROGRESS_ACTIONS.includes(action)) return 'progress'
  if (NON_PROGRESS_ACTIONS.includes(action)) return 'non-progress'
  if (Object.prototype.hasOwnProperty.call(ACTION_EXEMPTIONS, action)) return 'exempt'
  return 'unclassified'
}

/**
 * 从台账尾部往回取该票"距上次推进"的空转次数。
 * 只认 ticketKey 相等的行;PROGRESS ⇒ 立即归零返回 0;NON_PROGRESS ⇒ +1;其余 ⇒ 跳过继续往前数。
 * @param {Array<{ticketKey?:string,action?:string,mode?:string,informational?:boolean}>} ledger
 * @param {string} key
 * @returns {number}
 */
/**
 * 该票可参与阶梯的留痕行,**从尾往前**逐条给。三道卫生过滤在这里做一次,不给两个调用者各抄一遍(§0.6):
 *  - `mode==='dryrun'` 直接跳过:预演不占班次,拿它扣真票的空转数 = dry-run 跑一晚上把票 park 光。
 *  - `informational===true` 跳过:同一次班次的诊断留痕(2026-11-04 发射端收口,§8 未闭环第 9 条)。
 *    旧形是 `auto-evolve.mjs` 一轮内对同一票落两行(派发结果的 `res.action` 与发起腿分型的
 *    `runner-unavailable`,ts 相差数毫秒)⇒ rotate4/park8 实际 2/4 轮就触顶。现由发射端给第一行
 *    打标记、只让 `runner-unavailable` 计一次;本层按标记跳过,不重写历史行(旧账没有该标记,照旧各算一次)。
 * 刻意**不按 `ts` 折叠**:夹具与真实数据里同毫秒多行都存在,折叠会把 6 条既有阶梯用例一起打掉,
 * 还把真正该修的发射位置盖掉 —— 本枚第一次就是这么改的,已回退。
 */
function* ticketRowsNewestFirst(ledger, key) {
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i]
    if (!e || e.ticketKey !== key) continue
    if (e.mode === 'dryrun') continue
    if (e.informational === true) continue
    yield e
  }
}

export function attemptsSinceProgress(ledger, key) {
  if (!Array.isArray(ledger) || !key) return 0
  let n = 0
  for (const e of ticketRowsNewestFirst(ledger, key)) {
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
export function decideNonProgress({
  attempts,
  rotateAt,
  parkAt,
  hardAt,
  cooldownHours,
  now = Date.now(),
  lastStoodAt,
} = {}) {
  const nums = { rotateAt, parkAt, hardAt }
  for (const [k, v] of Object.entries(nums)) {
    if (!Number.isInteger(v) || v < 1) {
      return {
        route: 'unjudged',
        attempts: Number.isInteger(attempts) ? attempts : 0,
        why: `阈值 ${k} 不是正整数(现值 ${String(v)})⇒ 不判`,
      }
    }
  }
  if (!(parkAt > rotateAt && hardAt > parkAt)) {
    return {
      route: 'unjudged',
      attempts: Number.isInteger(attempts) ? attempts : 0,
      why: `档位必须严格递增 rotateAt(${rotateAt}) < parkAt(${parkAt}) < hardAt(${hardAt}) ⇒ 现值自相矛盾,不判`,
    }
  }
  if (!Number.isInteger(cooldownHours) || cooldownHours < 1) {
    return {
      route: 'unjudged',
      attempts: Number.isInteger(attempts) ? attempts : 0,
      why: `cooldownHours 不是正整数(现值 ${String(cooldownHours)})⇒ 不判`,
    }
  }
  if (!Number.isInteger(attempts) || attempts < 0) {
    return {
      route: 'unjudged',
      attempts: 0,
      why: `空转次数取不到(attempts=${String(attempts)})⇒ 未判定,按最保守的 rotate 走`,
    }
  }
  if (attempts >= hardAt) {
    return {
      route: 'park',
      attempts,
      why: `同票累计空转 ${attempts} 次已达硬顶(${hardAt})⇒ 永久停占班次,等真推进或人工处置,不再自动回升`,
    }
  }
  if (attempts >= parkAt) {
    const stood = Number.isFinite(lastStoodAt) ? lastStoodAt : null
    if (stood !== null && now - stood < cooldownHours * 3600_000) {
      const remainMin = Math.ceil((cooldownHours * 3600_000 - (now - stood)) / 60_000)
      return {
        route: 'cooldown',
        attempts,
        why: `空转 ${attempts} 次(线 ${parkAt})⇒ 冷却中,还差 ${remainMin} 分钟才再试一次`,
      }
    }
    if (stood === null) {
      // 到冷却线却读不到上次冷却起点 ⇒ 当作"冷却已到期"放一次,并在 why 里点名(不是静默放行)
      return {
        route: 'try',
        attempts,
        why: `空转 ${attempts} 次 ≥ ${parkAt},但读不到上次冷却起点 ⇒ 本回合只放一次并点名(不冒充已冷却)`,
      }
    }
    return {
      route: 'try',
      attempts,
      why: `空转 ${attempts} 次 ≥ ${parkAt} 且冷却已到期 ⇒ 再放一次(每次空转都会重新进入 ${cooldownHours}h 冷却)`,
    }
  }
  if (attempts >= rotateAt) {
    return {
      route: 'rotate',
      attempts,
      why: `同票已空转 ${attempts} 次(线 ${rotateAt})⇒ 本轮让位给空转更少的候选`,
    }
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
  // 与 attemptsSinceProgress 同一套行过滤(dry-run 跳过、同 ts 折一次):
  //  escalation 邮件的分档数必须和阶梯用的数是同一个口径,否则"邮件说 3 次、判定说 6 次"。
  for (const e of ticketRowsNewestFirst(ledger, key)) {
    const action = String(e.action ?? '')
    if (PROGRESS_ACTIONS.includes(action)) break
    if (!NON_PROGRESS_ACTIONS.includes(action)) continue
    tally.set(action, (tally.get(action) || 0) + 1)
  }
  return [...tally.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
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
  ACTION_EXEMPTIONS,
  TEMPLATE_ACTION_SITES,
  actionBucketOf,
  attemptsSinceProgress,
  decideNonProgress,
  breakdownNonProgress,
  lastNonProgressHoldAt,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
