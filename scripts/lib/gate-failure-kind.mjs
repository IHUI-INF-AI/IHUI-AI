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
 * 四条不变量,由 `scripts/tests/gate-failure-kind.test.mjs` 各钉一对:
 *  1. **崩溃不洗成通过**:`crash` 与 `red` 一样让批量以非零退出 —— 分流是为了**说清是什么**,
 *     不是为了放行。
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
 * @param {{status?: number|null, signal?: string|null, stderr?: string|null, code?: string|null}} outcome
 *        `code` = 执行器合成错误的 `error.code`(兜底超时/输出超限);缺省/null 表示这次没有兜底介入。
 * @returns {{kind:'pass'|'interrupt'|'crash'|'red', reason: string}}
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
 */
export function crashNextStep(reason) {
  switch (fallbackCodeOfReason(reason)) {
    case 'ETIMEDOUT':
      return '单独复跑本门看它卡在哪;**不要**靠调大 GUARDIAN_GATE_TIMEOUT_MS 消红(那是削判据)'
    case 'ENOBUFS':
      return '单独复跑本门看它在刷什么输出;**不要**靠调大 20MB 上限消红(那是削判据)'
    default:
      return '先跑全量 pnpm install(不带 --filter)再复跑本批'
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
      `缺依赖型 ${dependencyOnly} 道:先跑**全量** \`pnpm install\`(不带 --filter,见 AGENTS §12e),再复跑本批`,
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
  decideGateOutcome,
  fallbackCodeOfReason,
  crashAdvisory,
  crashNextStep,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
