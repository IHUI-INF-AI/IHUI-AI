// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 依赖漏洞修复线单一真相源(2026-11-24 立)。
 *
 * 为什么把版本表写进代码而不是查网:线上守门必须在断网/限流时也能判,
 * 且「哪个版本算安全」是**会变的机器事实**,散落在文档里必然漂移。
 * 表只登记有公开 CVE 且给出明确修复版本的发布线;表外的高版本按「已高于
 * 已知修复线」放行,表外的低版本一律不安全 —— 失效方向恒为「多要一次确认」。
 *
 * 数据来源(2026-11-24 核对):
 *   React  CVE-2025-55182 / 55183 / 55184 / 67779 / CVE-2026-23864
 *          → 19.0.4 / 19.1.5 / 19.2.4 起安全
 *   Next   CVE-2025-66478(React2Shell 下游) + 同批 DoS
 *          → 14.2.35 / 15.0.8 / 15.1.12 / 15.2.9 / 15.3.9 / 15.4.11 / 15.5.10 / 16.0.11 / 16.1.5
 */
export const NEXT_MIN_SAFE = Object.freeze({
  '13.3': '14.2.35',
  '13.4': '14.2.35',
  '13.5': '14.2.35',
  '14.0': '14.2.35',
  '14.1': '14.2.35',
  '14.2': '14.2.35',
  '15.0': '15.0.8',
  '15.1': '15.1.12',
  '15.2': '15.2.9',
  '15.3': '15.3.9',
  '15.4': '15.4.11',
  '15.5': '15.5.10',
  '16.0': '16.0.11',
  '16.1': '16.1.5',
})

export const REACT_MIN_SAFE = Object.freeze({
  '19.0': '19.0.4',
  '19.1': '19.1.5',
  '19.2': '19.2.4',
})

/** 解析 "16.4.6" / "^19.2.8" / "19.2.8-canary.1" 这类字符串;非法返回 null。 */
export function parseVersion(raw) {
  const s = String(raw ?? '').trim()
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(s)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: s }
}

/** 语义比较:返回 -1/0/1。任一非法时返回 null。 */
export function compareVersion(a, b) {
  const x = typeof a === 'string' ? parseVersion(a) : a
  const y = typeof b === 'string' ? parseVersion(b) : b
  if (!x || !y) return null
  for (const k of ['major', 'minor', 'patch']) {
    if (x[k] !== y[k]) return x[k] > y[k] ? 1 : -1
  }
  return 0
}

function tableToPairs(table) {
  return Object.entries(table)
    .map(([line, min]) => ({ line, min, parsed: parseVersion(min) }))
    .filter((x) => x.parsed)
    .sort((a, b) => compareVersion(a.parsed, b.parsed))
}

const NEXT_PAIRS = tableToPairs(NEXT_MIN_SAFE)
const REACT_PAIRS = tableToPairs(REACT_MIN_SAFE)

function judgeByTable(version, pairs, label) {
  const v = parseVersion(version)
  if (!v) return { safe: null, reason: `${label} 版本无法解析: ${String(version)}` }
  const line = `${v.major}.${v.minor}`
  const hit = pairs.find((p) => p.line === line)
  if (hit) {
    const cmp = compareVersion(v, hit.min)
    return cmp >= 0
      ? { safe: true, required: hit.min, reason: `${line} 线 ${v.raw} ≥ 修复线 ${hit.min}` }
      : { safe: false, required: hit.min, reason: `${line} 线 ${v.raw} < 修复线 ${hit.min}` }
  }
  const highest = pairs[pairs.length - 1]
  if (compareVersion(v, highest.min) >= 0) {
    return { safe: true, required: null, reason: `${v.raw} 已高于所有已知修复线(${highest.min})` }
  }
  const next = pairs.find((p) => compareVersion(v, p.min) < 0)
  return {
    safe: false,
    required: next ? next.min : highest.min,
    reason: `${v.raw} 不在已登记的安全发布线上,需升到 ${next ? next.min : highest.min}`,
  }
}

/** Next.js 版本判定。safe=true/false/null(无法判定)。 */
export function judgeNext(version) {
  return judgeByTable(version, NEXT_PAIRS, 'Next.js')
}

/** React 版本判定。 */
export function judgeReact(version) {
  return judgeByTable(version, REACT_PAIRS, 'React')
}

/** 给不达标版本生成升级计划(只生成命令,不执行 —— 生产升级必须走部署环)。 */
export function buildFixPlan({ next, react }) {
  const out = []
  const jn = next ? judgeNext(next) : null
  if (jn && jn.safe === false && jn.required) out.push(`pnpm --filter @ihui/web add next@${jn.required}`)
  const jr = react ? judgeReact(react) : null
  // react-dom 必须与 react 同版本,所以两者都取修复线,不用现装版本当目标。
  if (jr && jr.safe === false && jr.required) out.push(`pnpm --filter @ihui/web add react@${jr.required} react-dom@${jr.required}`)
  return out
}

export const __test__ = { parseVersion, compareVersion, judgeNext, judgeReact, buildFixPlan }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
