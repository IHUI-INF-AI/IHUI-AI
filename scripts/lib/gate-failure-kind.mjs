// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单道守门的**一次执行**该被读成什么 —— 纯函数、构造面可证。
 *
 * 立因(2026-09-29 实测):在干净检出(`git worktree add --detach`,**没有 node_modules**)里跑整批
 * `guardian-runner`,17 道 blocking 门"失败"。逐道在有依赖的主仓复跑 ⇒ 全部 rc=0;单跑其中一道
 * 读到的是 **`ERR_MODULE_NOT_FOUND` 崩溃堆栈**。也就是说 runner 把"**跑不起来**"和"**判据判红**"
 * 记成了同一件事(两者都是退出码 1),而汇总里只写"失败" —— 于是拿名单的人会把一次 import 失败
 * 读成"仓库里有 10 道语言包缺陷",去修一批根本不存在的东西(本仓定罪多次:假阳比漏报更贵)。
 *
 * 五条不变量,由 `scripts/tests/gate-failure-kind.test.mjs` 各钉一对:
 *  1. **崩溃不洗成通过**:`crash` 与 `red` 一样让批量以非零退出 —— 分流是为了**说清是什么**,
 *     不是为了放行。〔2026-10-25 实测:这一条在执行器末尾**曾长期不成立** —— 只有判红支会
 *     `process.exit(1)`,crash 支只 `failed++`,`GUARDIAN_GATE_TIMEOUT_MS=1` 把 111 道门打成未判定
 *     后批次照样 exit 0(连 push-gate 缓存都按"通过"写)。补牙在 executor 末尾,由镜像测试 F8
 *     的结构锁钉住;本文件只出结论,退出码归执行器。〕
 *  2. **中断不是结论**:75 / 128+N / 无码信号死 ⇒ `interrupt`,由 runner 原样向上传播(G-611 既有性质)。
 *  3. **判据自己的红照常算**:`❌ 发现 N 处违规` 这类输出**不含**崩溃指纹 ⇒ 必须落 `red`,
 *     否则这道门等于被关掉(把敞口洗成绿)。
 *  4. **被兜底机制弄死的 ⇒ 未判定,不是判红(§0.3"没判"绝不写成"判过")**:执行器的两道兜底(单门超时
 *     看门狗 SIGKILL、输出超 20MB 上限)合成的是**带 `code` 而没有 status/signal 的 Error**
 *     (`ETIMEDOUT` / `ENOBUFS`)。本函数此前只读 status/signal,于是这一族一路落到最后一行的
 *     `判据判红(exit null)` —— 2026-10-24 实测复现:门 30c `check-stale-copy.mjs` 被 300010ms 看门狗
 *     杀掉、零输出,全量档把它记进 failedGates(判红名单),汇总里既没有 crashedGates 也没有未判定段。
 *     它归进**已有的** `crash` 档(既不是 pass 也不是 red,不新造第四种结局),**后果一项不减**:调用方
 *     照旧 `failed++`、照旧进未判定清单、批量照旧非零退出、提交照旧被拦。
 *  5. **门自己按 §0.3 交付的「未判定」独成一档,不并进 red(2026-10-27 立)**:§0.3 给的版本扩散是
 *     「取不到输入 ⇒ exit 2 显式「未判定」并点名原因,**不记绿也不冒红**」。判据体已经能正确退出 2,
 *     但本模块此前只有 pass/red/crash/interrupt 四种结局 ⇒ exit 2 一路落到最后一行的
 *     `判据判红(exit 2)` ⇒ 进 failedGates(**判红名单**)⇒ 批量 exit(1)。形状上,「我读到了内容、
 *     它确实违规」与「我取不到输入、判不了」在汇总层长得一模一样 —— 正是 §12e/§12f 明令禁止的那一种:
 *     与本次提交内容无关的红会逼使用者 `--no-verify`,一次绕过 = 该枚提交上全部守门作废。
 *     第五档 `undetermined` 由此而来:**不计 failed、不进 failedGates**,但必须**逐道点名**,
 *     批量以同一枚 `UNDETERMINED_EXIT_CODE`(2)收口 —— **不记绿(≠0)也不冒红(≠1)**。
 *     见 detectUndetermined():两个条件缺一不可,只按退出码放行会把刻意用 exit 2 顶红的尺子洗绿。
 */

/** 崩溃指纹:Node 自己抛出来的、不是门打印的。全部锚在**错误码/固定措辞**上,不靠"看着像堆栈"。 */
const CRASH_MARKERS = Object.freeze([
  /ERR_MODULE_NOT_FOUND/,
  /ERR_UNKNOWN_BUILTIN_MODULE/,
  /Cannot find module '[^']*'/,
  /ReferenceError: \w+ is not defined/,
  /SyntaxError: /,
])

/**
 * 被兜底机制弄死的一族(执行器合成的 `error.code`,不是子门自己打印的)。
 * 键名与 `scripts/lib/guardian-executor.mjs` 的两处合成点逐字对应:
 *  - `ETIMEDOUT` 单门超时看门狗(2026-10-12 立)到点 SIGKILL 子进程;
 *  - `ENOBUFS`   stdout/stderr 超 20MB 上限被截(并行档合成;串行档由 spawnSync 自报同一个码)。
 * reason 只说"怎么没判成的",清偿动作走 `crashNextStep()` 单源,别处不另写一份措辞。
 */
const FALLBACK_KILL_CODES = Object.freeze({
  ETIMEDOUT: '被单门超时看门狗终止(未到点退出,无任何结论)',
  ENOBUFS: '输出超过 20MB 上限被截断(结论可能被截掉,不可采信)',
})

/**
 * §0.3 的「未判定」交付 —— **两个条件缺一不可**,理由是保守方向:
 *   ① 退出码 == 2 —— AGENTS §0.3 与 §5c 的三档口径(0 通过 / 1 判出红 / 2 未判定),不新造第四个数;
 *   ② stderr 里**门自己显式说了**「未判定」(与 CRASH_MARKERS 同构:认"某人说了",不猜)。
 * 只按 ① 放行会把刻意用 exit 2 **顶红**的尺子洗成绿 —— 本仓就有这种用法(AGENTS §6
 * `check:benchmark-delivery`:`--strict` 下"判不出"/"台账腐烂"/"仍存在且无豁免" ⇒ exit 2 顶红),
 * 把真违规改成绿是本方向最贵的失效,故 ② 是硬门槛;反之,① 不成立(exit 1 写着"未判定")
 * 也不能算,那是门体自己的口径错,该红就得红。
 */
export const UNDETERMINED_EXIT_CODE = 2

const UNDETERMINED_MARKERS = Object.freeze([/未判定/, /无法判定/])

/**
 * 是否属于"门自己按 §0.3 交付的未判定"。返回匹配到的那句话(点名用),不是则 null。
 */
export function detectUndetermined({ status, signal, stderr }) {
  if (status !== UNDETERMINED_EXIT_CODE) return null
  if (signal) return null // 有信号 ⇒ 已被上面的 interrupt 分支接走
  if (typeof stderr !== 'string') return null
  for (const re of UNDETERMINED_MARKERS) {
    const m = re.exec(stderr)
    if (m !== null) return m[0]
  }
  return null // exit 2 但没自称未判定 ⇒ 不当逃逸口,照旧判红
}

/**
 * @param {{status?: number|null, signal?: string|null, stderr?: string|null, code?: string|null}} outcome
 *        `code` = 执行器合成错误的 `error.code`(兜底超时/输出超限);缺省/null 表示这次没有兜底介入。
 * @returns {{kind:'pass'|'interrupt'|'crash'|'undetermined'|'red', reason: string}}
 */
export function decideGateOutcome(outcome) {
  const status = outcome?.status
  const signal = outcome?.signal ?? null
  const code = outcome?.code ?? null
  const stderr = typeof outcome?.stderr === 'string' ? outcome.stderr : ''
  // 兜底码排在"退出码 0"之前:子进程是被看门狗杀掉/输出被截断的,那么无论它留下什么 status,
  // 这一轮都**没有结论** —— 让它算 pass 就是把"没判"写成"判过"(§0.3),算 red 就是把"没判"写成
  // "这道门发现了缺陷"(本函数立因)。二者都不取,归 crash。
  if (typeof code === 'string' && FALLBACK_KILL_CODES[code] !== undefined)
    return { kind: 'crash', reason: FALLBACK_KILL_CODES[code] }
  if (status === 0 && !signal) return { kind: 'pass', reason: '退出码 0' }
  if (status === 75) return { kind: 'interrupt', reason: 'exit 75 临时失败' }
  if (typeof status === 'number' && status >= 128)
    return { kind: 'interrupt', reason: `exit ${status}(信号族码)` }
  if ((status === null || status === undefined) && signal)
    return { kind: 'interrupt', reason: `signal=${String(signal)}(无码信号死)` }
  for (const re of CRASH_MARKERS) {
    const m = re.exec(stderr)
    if (m !== null) return { kind: 'crash', reason: `跑不起来:${m[0]}` }
  }
  // 排在崩溃指纹**之后**:两者同时出现时按"跑不起来"处理(更严的那一档),失效方向恒为"多拦一道",不得反过来。
  const und = detectUndetermined({ status, signal, stderr })
  if (und !== null)
    return { kind: 'undetermined', reason: `取不到输入,门自己交付未判定(§0.3):${und}` }
  return { kind: 'red', reason: `判据判红(exit ${String(status)})` }
}

/**
 * reason → 兜底码的反查(措辞单源:清单里存的 reason 就是 FALLBACK_KILL_CODES 的原文,
 * 别处不得再用"看着像"的关键词自造分类)。取不到返回 null(= 这一条不是兜底弄死的)。
 */
export function fallbackCodeOfReason(reason) {
  if (typeof reason !== 'string') return null
  for (const [code, text] of Object.entries(FALLBACK_KILL_CODES)) {
    if (text === reason) return code
  }
  return null
}

/**
 * 未判定清单的清偿动作 —— 措辞唯一源(逐条打印与汇总各调一次,禁止别处再抄一份)。
 * 依赖型崩溃(模块找不到)才是 `pnpm install` 能治的;超时与输出超限**不是**,
 * 对它们喊装依赖就是本仓明令禁止的"文档写跑不通的出路"(§0.8)。
 * 两型兜底都不许把"调大旋钮"当出路(§12e 不得顺手削判据)。
 * 〔2026-10-29 补〕依赖型这一支必须连**串行化**一起给:本仓多个会话共写一棵树,而 `pnpm install`
 * 的写面就是 `node_modules` 本身(先清后链)。过去这里只写"跑全量 install",于是每个看见缺依赖的
 * 会话各开一枚 ⇒ 四枚并发互踩,实测把各端 `node_modules` 全部掏掉、根层 48 个包变成空目录,而
 * pnpm store 完好(不是下载失败)。**给出的出路本身成了新的故障源**,这一支后来必须是"先拿 build 锁
 * 再装、绝不并发"。
 */
export function crashNextStep(reason) {
  switch (fallbackCodeOfReason(reason)) {
    case 'ETIMEDOUT':
      return '单独复跑本门看它卡在哪;**不要**靠调大 GUARDIAN_GATE_TIMEOUT_MS 消红(那是削判据)'
    case 'ENOBUFS':
      return '单独复跑本门看它在刷什么输出;**不要**靠调大 20MB 上限消红(那是削判据)'
    default:
      return (
        '先取 build 锁(deploy-lock.mjs acquire --mode build)再跑全量 pnpm install(不带 --filter),' +
        '装完复跑本批;**禁止并发安装** —— 它写的就是 node_modules 本身(先清后链),并发会互踩成空目录'
      )
  }
}

/**
 * 崩溃清单汇总用的一句话(报告,不参与判定)。
 * 第二个参数收 crashedGates 的 reason 列表,只为把两类成因分开说 —— 判定早已在
 * decideGateOutcome 里做完,这里不改任何归类。
 */
export function crashAdvisory(crashCount, reasons = []) {
  const list = Array.isArray(reasons) ? [...reasons] : []
  const fallbackKilled = list.filter((r) => fallbackCodeOfReason(r) !== null).length
  const dependencyOnly = Math.max(0, Number(crashCount) - fallbackKilled)
  const parts = [
    `其中 ${crashCount} 道是**跑不起来(未判定)**而不是判红 —— 把它们当"仓库里有缺陷"读会让人去修不存在的东西`,
  ]
  if (dependencyOnly > 0)
    parts.push(
      `缺依赖型 ${dependencyOnly} 道:先取 build 锁再跑**全量** \`pnpm install\`(不带 --filter,见 AGENTS §12e),` +
        '装完复跑本批;**禁止并发安装**(2026-10-29 实测:多枚并发互踩 ⇒ 各端 node_modules 全丢、根层包成空目录,而 store 完好)',
    )
  if (fallbackKilled > 0)
    parts.push(
      `被兜底弄死型 ${fallbackKilled} 道(单门超时看门狗 / 输出超 20MB 上限):装依赖治不了它们,` +
        '逐条按上面的复现命令单独跑一次,看它到底卡在哪或刷什么输出;调大超时/上限不算出路(§12e)',
    )
  return parts.join('。') + '。'
}

export const __test__ = {
  CRASH_MARKERS,
  FALLBACK_KILL_CODES,
  UNDETERMINED_EXIT_CODE,
  UNDETERMINED_MARKERS,
  detectUndetermined,
  decideGateOutcome,
  fallbackCodeOfReason,
  crashAdvisory,
  crashNextStep,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
