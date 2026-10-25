// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 判据面不可变护栏的**纯函数层**（2026-10-25 立）。
 *
 * 为什么要有这一层：护栏的判据至少有两处消费者 —— 提交侧尺子
 * `scripts/check-immutable-guard.mjs` 与镜像测试 `scripts/tests/check-immutable-guard.test.mjs`。
 * 两处各抄一份"什么算受保护面 / 什么算合法声明"必漂移（AGENTS §22c），所以判据只住这里，
 * 两边都 `import`（测试从 `__test__` 取的就是本文件的函数）。
 *
 * 设计方向（票面原文，照抄一次防走样）：
 *   护栏**不禁止**改判据面，而是让每次改动都必须**显式声明理由**
 *   （§0.10：失效方向 = 多要一次定向说明，绝不是多放一次跳门）。
 * ⇒ 本层只做四件事：
 *   ① 清单校验（`parseGuardList`）：形状坏 ⇒ 抛出/收集 problems，调用方折成 exit 2「未判定」，
 *      既不冒红也不记绿（§0.3 / §5c 的"台账形状坏 ⇒ 拒绝判定"同一条判序）；
 *   ② 面匹配（`matchProtected`）：精确 / 目录前缀（path 以 `/` 结尾）/ 段内 glob（含 `*`）；
 *   ③ trailer 解析（`parseExemptTrailer`）：`immutable-exempt: <≥10 字理由>`，逐行生效；
 *   ④ 判定（`judgeChanges` / `decide`）：触及 ∧ 无有效声明 ⇒ 红；清单到期 ⇒ 红；取不到输入 ⇒ 未判定。
 *
 * 本层零 IO、零 git、零 process：行为只能靠构造面证明（§22c），所以镜像测试不必赌本机状态。
 */

/** 受保护面清单的唯一路径（清单自身也在受保护面里，见清单 why）。 */
export const GUARD_DATA_REL = 'scripts/data/immutable-guard.json'

/** 合法改法的唯一声明形态。trailer 名只有一份，测试与门体都从这里取。 */
export const EXEMPT_TRAILER = 'immutable-exempt:'

/** 理由最小长度（字符数，不是字节）：中文按字算，`[...s].length`。 */
export const MIN_REASON_CHARS = 10

/** 受保护面的四类。kind 是分类不是匹配模式（匹配模式由 path 形态决定）。 */
export const PROTECTED_KINDS = Object.freeze(['gate-body', 'rule-doc', 'judgement-lib', 'gate-registry'])

/** 结论码 → 人话。输出层只查这一张表，不逐处拼字符串。 */
export const CODE_LABEL = Object.freeze({
  pass: '通过：本次改动未触及受保护面',
  declared: '通过：触及受保护面且提交信息已显式声明理由',
  undeclared: '判红：触及受保护面但提交信息里没有可用的 immutable-exempt: 声明',
  expired: '判红：受保护面清单里有 reviewBy 已到期的条目（清单腐烂，§0.7）',
  'list-bad': '未判定：受保护面清单形状坏（坏行/重复/非法 kind/reviewBy 不合法）',
  'list-empty': '未判定：受保护面清单枚举到 0 条（枚举到 0 个候选判死不记绿，§0.3）',
  'list-missing': '未判定：受保护面清单在被审面上不存在或取不到',
  'message-missing': '未判定：本次触及受保护面，但拿不到提交信息（结构上无法判"有没有声明"）',
  'face-missing': '未判定：被审面取不到改动清单（git 派生失败/父提交不存在）',
})

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 路径归一：反斜杠转正斜杠、去 `./` 前缀。**不**做大小写折叠（git 路径大小写敏感）。 */
export function normalizeRel(p) {
  if (typeof p !== 'string') return ''
  let s = p.replaceAll('\\', '/')
  while (s.startsWith('./')) s = s.slice(2)
  return s
}

/** `YYYY-MM-DD` 且是真实存在的日历日。 */
export function isValidDateStr(s) {
  if (typeof s !== 'string') return false
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [, y, mo, d] = m
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  return (
    dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(mo) - 1 && dt.getUTCDate() === Number(d)
  )
}

/** 本地日期（不是 UTC）：reviewBy 是给人看的日历日，跟着本机时区走。 */
export function todayStr(now = new Date()) {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

/** 到期 = reviewBy 严格早于今天（当天仍有效，避免"到期日当天全红"）。 */
export function isExpired(reviewBy, today = todayStr()) {
  return isValidDateStr(reviewBy) && isValidDateStr(today) && reviewBy < today
}

/** 段内 glob：只认 `*`（不跨 `/`），其余正则元字符一律转义。 */
export function globToRegExp(pattern) {
  const src = normalizeRel(pattern)
  let out = '^'
  for (const ch of src) {
    if (ch === '*') out += '[^/]*'
    else if ('\\^$+.()|{}[]?'.includes(ch)) out += `\\${ch}`
    else out += ch
  }
  return new RegExp(`${out}$`)
}

function pathProblem(p) {
  if (typeof p !== 'string' || p.length === 0) return 'path 不是非空字符串'
  if (p !== p.trim()) return 'path 首尾带空白'
  if (normalizeRel(p) !== p) return 'path 必须是正斜杠相对路径（反斜杠/./ 前缀一律不收）'
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return 'path 必须是仓库相对路径（绝对路径不收）'
  if (p.split('/').includes('..')) return 'path 不得含 `..`'
  if (p.includes('**')) return 'path 不支持 `**`（递归前缀请用目录形态，如 `scripts/lib/`）'
  if (p.includes('*') && p.endsWith('/')) return 'path 不能同时是前缀目录与 glob'
  return null
}

/**
 * 清单校验。**形状坏不猜**：坏行逐条收集进 `problems`，调用方折成 exit 2。
 * @param {string} text 清单 JSON 正文
 * @returns {{entries: Array<object>, problems: Array<{code:string,message:string}>, expired: Array<object>}}
 */
export function parseGuardList(text, { today = todayStr() } = {}) {
  const problems = []
  let rows
  try {
    rows = JSON.parse(String(text ?? ''))
  } catch (e) {
    return {
      entries: [],
      problems: [{ code: 'json-parse', message: `清单不是合法 JSON：${e.message}` }],
      expired: [],
    }
  }
  if (!Array.isArray(rows)) {
    return { entries: [], problems: [{ code: 'not-array', message: '清单顶层必须是数组' }], expired: [] }
  }
  const entries = []
  const seen = new Set()
  rows.forEach((row, i) => {
    const at = `第 ${i + 1} 行`
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      problems.push({ code: 'bad-entry', message: `${at} 不是对象` })
      return
    }
    const pathProblemText = pathProblem(row.path)
    if (pathProblemText) {
      problems.push({ code: 'bad-path', message: `${at} ${pathProblemText}` })
      return
    }
    if (seen.has(row.path)) {
      problems.push({ code: 'duplicate-path', message: `${at} path 重复登记：${row.path}` })
      return
    }
    if (!PROTECTED_KINDS.includes(row.kind)) {
      problems.push({
        code: 'bad-kind',
        message: `${at} kind=${JSON.stringify(row.kind)} 不在枚举内（${PROTECTED_KINDS.join(' / ')}）`,
      })
      return
    }
    if (typeof row.why !== 'string' || row.why.trim().length === 0) {
      problems.push({ code: 'bad-why', message: `${at} why 必须是非空说明（为什么受保护）` })
      return
    }
    if (!isValidDateStr(row.reviewBy)) {
      problems.push({ code: 'bad-review-by', message: `${at} reviewBy 必须是合法 YYYY-MM-DD` })
      return
    }
    seen.add(row.path)
    entries.push({
      path: row.path,
      kind: row.kind,
      why: row.why.trim(),
      reviewBy: row.reviewBy,
    })
  })
  const expired = entries.filter((e) => isExpired(e.reviewBy, today))
  return { entries, problems, expired }
}

/**
 * 面匹配。三种形态按 path 自身判：目录前缀（尾 `/`）、glob（含 `*`）、精确。
 * 命中按清单顺序返回**第一条**（清单顺序即优先级；同时命中多条时调用方仍能看到全部，
 * 因为 `judgeChanges` 逐路径只取首条 —— 这是刻意的：报告里一条路径一行，不刷屏）。
 * @returns {object|null}
 */
export function matchProtected(relPath, entries) {
  const rel = normalizeRel(relPath)
  if (!rel || !Array.isArray(entries)) return null
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string') continue
    const pat = normalizeRel(entry.path)
    let hit = false
    if (pat.endsWith('/')) hit = rel === pat.slice(0, -1) || rel.startsWith(pat)
    else if (pat.includes('*')) hit = globToRegExp(pat).test(rel)
    else hit = rel === pat
    if (hit) return entry
  }
  return null
}

/**
 * 解析提交信息里的 `immutable-exempt:` 声明。逐行生效、大小写不敏感（trailer 名本身）。
 * 有效理由 = trim 后 `[...reason].length >= MIN_REASON_CHARS`；不足的进 `problems` 点名，
 * **不**算有效声明 —— 但一条过短不会抹掉同提交里另一条合格声明（作者确实给了理由）。
 * @returns {{present:boolean, reasons:Array<{reason:string,chars:number}>, problems:Array<object>}}
 */
export function parseExemptTrailer(message) {
  const reasons = []
  const problems = []
  const re = new RegExp(`^\\s*${EXEMPT_TRAILER.replace(':', '\\s*:\\s*')}(.*)$`, 'i')
  for (const line of String(message ?? '').split(/\r?\n/)) {
    const m = re.exec(line)
    if (!m) continue
    const reason = m[1].trim()
    const chars = [...reason].length
    if (chars >= MIN_REASON_CHARS) reasons.push({ reason, chars })
    else {
      problems.push({
        code: 'reason-too-short',
        message: `immutable-exempt: 理由只有 ${chars} 个字符（要求 ≥${MIN_REASON_CHARS}）：「${reason}」`,
      })
    }
  }
  return { present: reasons.length + problems.length > 0, reasons, problems }
}

/**
 * 逐改动判命中。改名/复制（R/C）**两侧都判**：把受保护面搬走也是改判据面。
 * @param {{changes:Array<{status:string,path:string,oldPath?:string}>, entries:Array<object>, message?:string, today?:string}} input
 */
export function judgeChanges({ changes, entries, message = '', today = todayStr() }) {
  const hits = []
  const untouched = []
  for (const c of Array.isArray(changes) ? changes : []) {
    if (!c || typeof c.path !== 'string') continue
    const paths = c.status === 'R' || c.status === 'C' ? [c.oldPath, c.path].filter(Boolean) : [c.path]
    const local = []
    for (const p of paths) {
      const entry = matchProtected(p, entries)
      if (entry) local.push({ path: normalizeRel(p), status: c.status, entry })
    }
    if (local.length) hits.push(...local)
    else untouched.push(normalizeRel(c.path))
  }
  const exempt = parseExemptTrailer(message)
  const expired = (Array.isArray(entries) ? entries : []).filter(
    (e) => e && typeof e.reviewBy === 'string' && isExpired(e.reviewBy, today),
  )
  return { hits, untouched, exempt, expired }
}

/**
 * 三态判定（0 通过 / 1 判红 / 2 未判定）。顺序即语义：
 *   清单坏 ⇒ 2；清单空 ⇒ 2；清单到期 ⇒ 1（确定的腐烂，不依赖本次改动）；
 *   未触及 ⇒ 0；触及但拿不到消息 ⇒ 2；触及且有有效声明 ⇒ 0；触及无声明 ⇒ 1。
 * `message === null` 表示"结构上拿不到消息"（pre-commit 阶段的索引面），与"消息为空"不同。
 */
export function decide({ listProblems = [], entries = [], changes = [], message = null, today = todayStr() }) {
  const base = { hits: [], untouched: [], exempt: { present: false, reasons: [], problems: [] }, expired: [] }
  if (listProblems.length) return { ...base, exit: 2, code: 'list-bad', listProblems }
  if (!entries.length) return { ...base, exit: 2, code: 'list-empty', listProblems }
  const judged = judgeChanges({ changes, entries, message: message ?? '', today })
  const out = { ...judged, listProblems }
  if (judged.expired.length) return { ...out, exit: 1, code: 'expired' }
  if (!judged.hits.length) return { ...out, exit: 0, code: 'pass' }
  if (message === null) return { ...out, exit: 2, code: 'message-missing' }
  if (judged.exempt.reasons.length) return { ...out, exit: 0, code: 'declared' }
  return { ...out, exit: 1, code: 'undeclared' }
}

/**
 * 把 CLI 形态的 `--name-status -z` 输出解析成 changes。
 * 格式：`M\0path\0`；改名/复制：`R100\0old\0new\0`。状态首字母即字母（R100 → R）。
 */
export function parseNameStatusZ(stdout) {
  const parts = String(stdout ?? '').split('\u0000')
  const changes = []
  let i = 0
  while (i < parts.length) {
    const status = parts[i]
    if (!status) {
      i += 1
      continue
    }
    const letter = status[0]
    if (letter === 'R' || letter === 'C') {
      const oldPath = parts[i + 1]
      const newPath = parts[i + 2]
      if (newPath === undefined) break
      changes.push({ status: letter, oldPath, path: newPath })
      i += 3
    } else {
      const p = parts[i + 1]
      if (p === undefined) break
      changes.push({ status: letter, path: p })
      i += 2
    }
  }
  return changes
}

/**
 * 清单里每一项都必须能被匹配函数认出（反向牙的判据本体）：为本层与测试共用的自证。
 * 前缀项 → 造一个子路径；glob 项 → 把 `*` 换成 `probe`；精确项 → 原路径。
 * 匹配不上返回 `{entry, probe, ok:false}`，调用方据此判清单腐烂。
 */
export function probeEntry(entry) {
  const pat = normalizeRel(entry?.path ?? '')
  if (!pat) return { entry, probe: '', ok: false }
  let probe
  if (pat.endsWith('/')) probe = `${pat}__probe__.mjs`
  else if (pat.includes('*')) probe = pat.replaceAll('*', '__probe__')
  else probe = pat
  return { entry, probe, ok: matchProtected(probe, [entry]) !== null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
