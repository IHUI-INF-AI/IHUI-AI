// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guardian-carrier-parity.mjs —— 守护「承载面齐平」判据(纯函数,零 IO)
 *
 * 立因(2026-11-04 实测;这是本仓自治环最大的一格,且此前**没有任何尺子在量**):
 *   git-guardian 有两个执行体:2 分钟计划任务跑 main()(一次性),nssm 服务 IHUI-GIT-GUARD 跑
 *   `--daemon`(常驻,10s tick)。二者抢同一把"轮级锁"。设计注释写得很清楚:
 *     · daemon 侧:"daemon 从启动起一直持有轮级锁…所有副作用都在锁内"(startHeartbeatGuardianLock);
 *     · main 侧:"上一轮巡检仍在跑(pid=…,held)⇒ 本轮静默退出"(未取得锁就 return)。
 *   ⇒ 只要 daemon 活着,main() 每两分钟起来一次、每两分钟让路一次,一小时内零轮次落地
 *     (实测近 3h:静默退出 6 条报名行 = 30 分钟一条的节流 ⇒ 真实趟数 ~90,完成行 0)。
 *   而有一批腿**只挂在 main() 里**。现读:main 区调用 94 个、daemon 区 49 个,
 *   只在 main 里的 = **46 条**,含 deploy-feedback / deploy-outcome-intake / e2e-autofill
 *   (部署自学族)、sweepStaleClosedRows / sweepStaleClaimMarks / sweepBannedBuckets(活文档卫生)、
 *   sweepExposedCredentialRotation(凭据轮换)、sweepDanglingCommitAutotag(丢提交备份)、
 *   healCrossEndMirror / healI18nBundleLeg / healStaleDistLeg(派生件自愈)。
 *   `check-autonomy-leg-health.mjs` 的 A8 是同一天装上的,它独立量到 dark=3 —— 正是这 46 里的三格;
 *   也就是说这族里剩下的 43 条也一直在同样的静默里,只是还没到被戳记看出来的程度。
 *
 * 本器不修执行路径(动 14k 行的守护调度面属于"影响共享生产态"的动作,得逐条裁决),
 * 它只把"有多少条腿根本不在常驻承载面上"变成一个每次现读、能点名、能到人的读数,
 * 并给迁移工作一个验收尺:迁移一条,计数减一。
 *
 * 取材纪律(§0.4):被审面取不到 ⇒ unjudged。分区判定失败(找不到 main / startDaemon 边界)
 *   ⇒ unjudged,绝不"扫整文件当两个区"—— 那会把计数洗成 0 冒充齐平。
 * 刻意按**函数边界**划区而不是按行号:行号一次 append 就挪位(本仓已多次因此把判据读瞎)。
 */

const LEG_CALL_RE = /\b((?:dispatch|sweep|heal|audit|ensure|converge|refresh|report|rotate|autoRegister)[A-Z]\w*)\s*\(/g
const TOP_FN_RE = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/

/** 从第 start 行往下找"下一个顶层函数声明"的行号,作为该函数体的末行(不含)。找不到 ⇒ 文件末。 */
function bodyEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    const m = TOP_FN_RE.exec(lines[i])
    if (m && m[1] !== lines[start - 1].replace(TOP_FN_RE, '$1')) return i + 1
  }
  return lines.length + 1
}

/** 收集 [from,to) 区间里被调用到的腿名(不含定义本身)。 */
function callsIn(lines, from, to) {
  const s = new Set()
  for (let i = from - 1; i < Math.min(to - 1, lines.length); i++) {
    const line = lines[i]
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
    if (TOP_FN_RE.test(line)) continue
    let m
    LEG_CALL_RE.lastIndex = 0
    while ((m = LEG_CALL_RE.exec(line))) s.add(m[1])
  }
  return s
}

/**
 * @param {{source:string, minDarkWarn?:number}} p
 * @returns {{state:'ok'|'drift'|'unjudged', dark:Array, darkCount:number, mainCount:number, daemonCount:number, why:string}}
 */
export function judgeCarrierParity({ source } = {}) {
  const text = String(source ?? '')
  if (!text.trim()) return { state: 'unjudged', dark: [], darkCount: 0, mainCount: 0, daemonCount: 0, why: '被审面取不到 git-guardian 源 ⇒ 不判(绝不扫别的面顶替)' }
  const lines = text.split(/\r?\n/)
  const mainAt = lines.findIndex((l) => /^(?:export\s+)?async\s+function\s+main\s*\(/.test(l))
  const daemonAt = lines.findIndex((l) => /^(?:export\s+)?function\s+startDaemon\s*\(/.test(l))
  if (mainAt < 0 || daemonAt < 0) {
    return { state: 'unjudged', dark: [], darkCount: 0, mainCount: 0, daemonCount: 0, why: `找不到分区边界(main=${mainAt} startDaemon=${daemonAt})⇒ 划不出两个承载面,不判` }
  }
  const mainEnd = daemonAt > mainAt ? daemonAt : bodyEnd(lines, mainAt + 1)
  const daemonEnd = bodyEnd(lines, daemonAt + 1)
  if (mainEnd <= mainAt || daemonEnd <= daemonAt) {
    return { state: 'unjudged', dark: [], darkCount: 0, mainCount: 0, daemonCount: 0, why: '函数体边界异常(mainEnd/startDaemonEnd 关系不对)⇒ 不判' }
  }
  const mainSet = callsIn(lines, mainAt + 1, mainEnd + 1)
  const daemonSet = callsIn(lines, daemonAt + 1, daemonEnd + 1)
  if (mainSet.size === 0 || daemonSet.size === 0) {
    return { state: 'unjudged', dark: [], darkCount: mainSet.size, mainCount: mainSet.size, daemonCount: daemonSet.size, why: `某一面枚举到 0 条腿(main=${mainSet.size} daemon=${daemonSet.size})⇒ 判据失效方向是多要一次说明,不读成"齐平"` }
  }
  const dark = [...mainSet].filter((n) => !daemonSet.has(n)).sort()
  return {
    state: dark.length > 0 ? 'drift' : 'ok',
    dark,
    darkCount: dark.length,
    mainCount: mainSet.size,
    daemonCount: daemonSet.size,
    why: dark.length ? `main 区 ${mainSet.size} 条 / daemon 常驻区 ${daemonSet.size} 条 ⇒ ${dark.length} 条只在一次性 main 里,daemon 常驻时结构上跑不到` : `两承载面调用集已齐平(main=${mainSet.size} daemon=${daemonSet.size})`,
  }
}

export const __test__ = { LEG_CALL_RE, TOP_FN_RE, bodyEnd, callsIn, judgeCarrierParity }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
