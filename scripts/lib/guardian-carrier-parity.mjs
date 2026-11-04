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
const LEG_NAME_RE = /^(?:dispatch|sweep|heal|audit|ensure|converge|refresh|report|rotate|autoRegister)[A-Z]\w*$/
const TOP_FN_RE = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/

/** 从第 start 行往下找"下一个顶层函数声明"的行号,作为该函数体的末行(不含)。找不到 ⇒ 文件末。 */
function bodyEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    const m = TOP_FN_RE.exec(lines[i])
    if (m && m[1] !== lines[start - 1].replace(TOP_FN_RE, '$1')) return i + 1
  }
  return lines.length + 1
}

/**
 * 只看**形参表**判断"这像不像一个可被调度点裸调的腿"(不看法的名字,名字维在 isLegDefinition)。
 * 两件事必须分开:unclassified 那一档专门收"名字不合规但签名是腿"的,若把名字判据折进来,
 * 它按构造就永远是空集(2026-11-04 自己踩到,P12 就是为此而设)。
 */
export function hasLegSignature(line) {
  const m = TOP_FN_RE.exec(String(line ?? ''))
  if (!m) return false
  const rest = String(line).slice(m[0].length)
  const open = rest.indexOf('(')
  if (open < 0) return false
  let depth = 0
  let i = open
  for (; i < rest.length; i++) {
    const c = rest[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) break
    }
  }
  if (depth !== 0) return false
  const params = rest.slice(open + 1, i).trim()
  if (params === '') return true
  const parts = []
  let buf = ''
  let d = 0
  for (const c of params) {
    if ('([{'.includes(c)) d++
    else if (')]}'.includes(c)) d--
    if (c === ',' && d === 0) {
      parts.push(buf)
      buf = ''
    } else buf += c
  }
  if (buf.trim()) parts.push(buf)
  // "这一段是不是可选形参"要看**深度 0 处**有没有等号:
  //   `opts = {}` / `{ logger = log } = {}` ⇒ 深度 0 有 = ⇒ 可选(整参带默认)
  //   `{ title, desp, dryRun = false }`     ⇒ 等号全在花括号内(深度≥1)⇒ 整参必需 ⇒ 助手
  // 用 indexOf('=') 会把花括号里的默认值误读成"整参有默认",从而把助手判成腿。
  return parts.every((p) => {
    const s = p.trim()
    if (!s) return true
    if (s.startsWith('...')) return true // rest 形参天然可省
    let dd = 0
    for (let k = 0; k < s.length; k++) {
      const c = s[k]
      if ('([{'.includes(c)) dd++
      else if (')]}'.includes(c)) dd--
      else if (c === '=' && dd === 0 && s[k + 1] !== '=' && s[k - 1] !== '=') return true
    }
    return false
  })
}

/**
 * 哪些顶层函数算"腿"而不算"被复用的助手"。
 *
 * = 名字合腿前缀 且 签名是腿。判据取**定义处的签名**而不是调用点写法:腿的形参要么没有、
 * 要么全部带默认值;助手的形参是必需的结构体
 * (`function dispatchGuardMail({ title, desp, ... })` —— 无深度 0 等号,调用方必须交)。
 * 刻意不用"调用点是否语句位"来分:那个写法太脆(赋值、await、Promise.all 里都会破),
 * 而判据一脆就会**漏计成假绿** —— 那比多报一条危险得多。
 */
export function isLegDefinition(line) {
  const m = TOP_FN_RE.exec(String(line ?? ''))
  if (!m || !LEG_NAME_RE.test(m[1])) return false
  return hasLegSignature(line)
}

/** 收集 [from,to) 里被调用、且在 defs 里算"腿"的名字(仅语句/守卫位,注释行跳过)。 */

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
  // 哪些名字算"腿":在本文件里定义且签名说明它是腿(无必需形参);
  // **定义不在本文件的**(import 进来的)一律当腿算 —— 判据取不到签名时宁可多报,
  // 绝不因为"认不出来"就把一条真腿洗成不计(那是假绿,比误报贵)。
  const defs = new Map()
  for (let i = 0; i < lines.length; i++) {
    const m = TOP_FN_RE.exec(lines[i])
    if (m && !defs.has(m[1])) defs.set(m[1], hasLegSignature(lines[i]))
  }
  // 合前缀 + (定义在本文件则签名须像腿;取不到定义 ⇒ 保守当腿)
  const eligible = (n) => LEG_NAME_RE.test(n) && (defs.has(n) ? defs.get(n) : true)
  // 覆盖面自证:名字不合前缀约定、但**是顶层定义且签名说明它是腿**的,单列 unclassified 点名。
  // 立因(2026-11-04 实测):`devenvMigratePatrol({ logger = log } = {})` 是真周期腿,
  // 可名字不落在 dispatch|sweep|heal|audit|... 里 ⇒ 若它只挂在 main,A9 会**静默漏计成假绿**。
  // 漏计比误报贵,所以这一维必须存在:不合约定的名字不许被"认不出来"洗掉。
  const ANY_CALL_RE = /\b([a-z][A-Za-z0-9_]*)\s*\(/g
  const notValueSite = (line, idx) => {
    const before = line.slice(0, idx)
    return !/\b(?:const|let|var)\s+[\w{}[\],. ]+\s*=\s*$/.test(before) && !/\breturn\s+$/.test(before)
  }
  // unclassified 这一档额外要求"真在调度语句位":剥掉可选的 if(守卫)/await 后这一行正好以该调用开始。
  // 两档宽严不同是刻意的:
  //   · 合前缀的腿走宽判据 —— 宁可把它在表达式位也算上,也不能因为写法没落在语句位就**漏计一条真腿**(假绿最贵);
  //   · 不合前缀的走严判据 —— 这一档是新开的、专门收"没按命名约定"的符号,放宽会被
  //     `if (!taskActionOk(c))` / `return status()` 这类谓词淹没(实测冒出 4 条噪声,噪声会淹掉真信号)。
  const GUARD_PREFIX_RE = /^\s*(?:(?:else\s+)?if\s*\([^)]*\)\s*)?(?:await\s+)?/
  const isDispatchStatement = (line, idx) => {
    const stmtStart = (GUARD_PREFIX_RE.exec(line) || [''])[0].length
    return idx === stmtStart && notValueSite(line, idx)
  }
  const scanRegion = (from, to) => {
    const legs = new Set()
    const unclassified = new Set()
    for (let i = from - 1; i < Math.min(to - 1, lines.length); i++) {
      const line = lines[i]
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
      if (TOP_FN_RE.test(line)) continue
      let m
      ANY_CALL_RE.lastIndex = 0
      while ((m = ANY_CALL_RE.exec(line))) {
        const n = m[1]
        if (LEG_NAME_RE.test(n)) {
          if (!notValueSite(line, m.index)) continue
          if (eligible(n)) legs.add(n)
          continue
        }
        // 不合前缀:必须同时在调度语句位、且"本文件顶层定义 + 签名说明是腿",才进 unclassified
        // (嵌套的局部函数如 tick()、以及取不到定义的别处符号一律不列,免得拿噪声冒充读数)
        if (!isDispatchStatement(line, m.index)) continue
        if (defs.has(n) && defs.get(n)) unclassified.add(n)
      }
    }
    return { legs, unclassified }
  }
  const mainScan = scanRegion(mainAt + 1, mainEnd + 1)
  const daemonScan = scanRegion(daemonAt + 1, daemonEnd + 1)
  const mainSet = mainScan.legs
  const daemonSet = daemonScan.legs
  const unclassifiedDark = [...mainScan.unclassified].filter((n) => !daemonScan.unclassified.has(n)).sort()
  if (mainSet.size === 0 || daemonSet.size === 0) {
    return { state: 'unjudged', dark: [], darkCount: mainSet.size, mainCount: mainSet.size, daemonCount: daemonSet.size, why: `某一面枚举到 0 条腿(main=${mainSet.size} daemon=${daemonSet.size})⇒ 判据失效方向是多要一次说明,不读成"齐平"` }
  }
  const dark = [...mainSet].filter((n) => !daemonSet.has(n)).sort()
  const allDark = [...dark, ...unclassifiedDark.map((n) => `~${n}`)].sort()
  return {
    state: allDark.length > 0 ? 'drift' : 'ok',
    dark: allDark,
    darkCount: allDark.length,
    prefixDark: dark,
    unclassifiedDark,
    mainCount: mainSet.size,
    daemonCount: daemonSet.size,
    why: allDark.length
      ? `main 区 ${mainSet.size} 条 / daemon 常驻区 ${daemonSet.size} 条 ⇒ ${dark.length} 条只在一次性 main 里` +
        `${unclassifiedDark.length ? ` + ${unclassifiedDark.length} 条不合腿名前缀但按签名是腿(~ 前缀点名),同样只在 main 里` : ''},daemon 常驻时结构上跑不到`
      : `两承载面调用集已齐平(main=${mainSet.size} daemon=${daemonSet.size};unclassified=0)`,
  }
}

export const __test__ = { LEG_CALL_RE, LEG_NAME_RE, TOP_FN_RE, bodyEnd, hasLegSignature, isLegDefinition, judgeCarrierParity }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
