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
 * 三条不变量,由 `scripts/tests/gate-failure-kind.test.mjs` 各钉一对:
 *  1. **崩溃不洗成通过**:`crash` 与 `red` 一样让批量以非零退出 —— 分流是为了**说清是什么**,
 *     不是为了放行。
 *  2. **中断不是结论**:75 / 128+N / 无码信号死 ⇒ `interrupt`,由 runner 原样向上传播(G-611 既有性质)。
 *  3. **判据自己的红照常算**:`❌ 发现 N 处违规` 这类输出**不含**崩溃指纹 ⇒ 必须落 `red`,
 *     否则这道门等于被关掉(把敞口洗成绿)。
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
 * @param {{status?: number|null, signal?: string|null, stderr?: string|null}} outcome
 * @returns {{kind:'pass'|'interrupt'|'crash'|'red', reason: string}}
 */
export function decideGateOutcome(outcome) {
  const status = outcome?.status
  const signal = outcome?.signal ?? null
  const stderr = typeof outcome?.stderr === 'string' ? outcome.stderr : ''
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

/** 崩溃清单汇总用的一句话(报告,不参与判定)。 */
export function crashAdvisory(crashCount) {
  return (
    `其中 ${crashCount} 道是**跑不起来(未判定)**而不是判红 —— 最常见成因是本检出没有安装依赖` +
    '(干净 worktree / 半装好的依赖树)。先跑**全量** `pnpm install`(不带 --filter,见 AGENTS §12e),' +
    '再复跑本批;把这些当"仓库里有缺陷"读会让人去修不存在的东西。'
  )
}

export const __test__ = { CRASH_MARKERS, decideGateOutcome, crashAdvisory }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
