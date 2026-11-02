// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * session-transcript — 「会话全文落盘腿」的判据与拼装(2026-11-01 立)。
 *
 * 立因:调度台账原先只记 `exitCode / durationMs / tokens` 三枚读数,会话**说了什么、调了哪些工具、
 * 为什么零推进**一个字都不留。于是两枚 session-ok 各自 3.4s / 23s 就 end_turn、票行零推进,
 * 事故报告只能写"核该会话末轮实际动作"——可动作在哪没人知道。这不是缺一个日志文件,
 * 是缺**可归因的最小证据面**:没有它,A7 维的每一条 drift 都只能靠猜,而"猜"在 §0.3 里等于没判。
 *
 * 本文件只放**纯函数**(命名 / 脱敏 / 截断 / 轮转判据 / 正文拼装),不碰盘、不起进程。
 * 读盘与写盘留在 scripts/auto-evolve.mjs(写入)与 scripts/git-guardian.mjs(过期清理);
 * 两侧都 import 这里,**不得再拼第二份判据**(§22c:第二份必然漂移)。
 *
 * 四条设计约束(每条都有反面事故可指):
 *  ① **全文不等于原样**:会话输出里可能夹着 token / Bearer / 私钥块。落盘前按模式脱敏,
 *     且脱敏是 best-effort(命中即换、命中数入头部),不是"看起来干净就放行"。
 *  ② **截断必须留痕**:单份上限只为防爆盘,一旦截断必须在正文里明写"原文多少字节、中略多少",
 *     绝不静默丢 —— 静默丢日志正是本仓 GBK 事故的同族病(nssm stdout=cp936 时中文全变问号,
 *     而没人知道丢了)。
 *  ③ **轮转永不删最新一份**:按天数 + 条数双闸清理,但"最新的一份"无论多老都不删;
 *     取不到 mtime 的一律不删(未判定不猜,§0.3)。失效方向朝向"多留一份证据"。
 *  ④ **写盘失败不打断派发**:落盘是观测腿,不是执行腿。写不进去要**大声记账**
 *     (`transcript-write-failed`)并让本轮照常收尾 —— 但绝不记成"已落盘"。
 */

/** 全文落盘目录(相对仓根)。`.ihui-agent/*` 已被 .gitignore 忽略,证据不进版本库。 */
export const TRANSCRIPT_DIR = '.ihui-agent/state/session-transcripts'

/** 轮转默认值:14 天 / 500 份 / 单份 4 MiB。三者任一超限即清理,但最新一份永久豁免。 */
export const RETENTION_DEFAULT = Object.freeze({
  keepDays: 14,
  keepMax: 500,
  maxBytesPerFile: 4 * 1024 * 1024,
})

/** 文件名/目录名用的 slug:只留安全字符,过长的截断(票键 16 位十六进制本来就不会被截)。 */
export function sanitizeSlug(raw, { max = 40, fallback = 'na' } = {}) {
  const s = String(raw ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!s) return fallback
  return s.length <= max ? s : s.slice(0, max)
}

/** UTC 紧凑时间戳 `YYYYMMDDTHHmmssSSS`:无冒号/无点号(Windows 文件名安全),字典序 = 时间序。 */
export function compactStamp(at) {
  const d = at instanceof Date ? at : new Date(at)
  if (!Number.isFinite(d.getTime())) return null
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`
  )
}

/**
 * 相对仓根的落盘路径。`at` 取**会话开始时刻**(不是结束时刻):一轮长跑的归属时间应贴近派发,
 * 否则 45 分钟超时的会话会排到它后面那些短会话之后,时间序就骗人。
 *
 * 取名三要素齐备才可反查:时间戳(排序)、票键(反查是哪张票)、mode+action(反查结局)。
 * 任一缺失也不抛错 —— 用 `na` 兜底并把 bucket 降级,绝不因为日志命名把派发打崩。
 */
export function transcriptRelPathOf({ at, ticketKey, mode = 'dispatch', action = 'unknown' } = {}) {
  const stamp = compactStamp(at) ?? compactStamp(Date.now())
  const key = sanitizeSlug(ticketKey, { max: 24, fallback: 'nokey' })
  const m = sanitizeSlug(mode, { max: 16, fallback: 'na' })
  const a = sanitizeSlug(action, { max: 32, fallback: 'unknown' })
  return `${TRANSCRIPT_DIR}/${stamp}-${key}-${m}-${a}.log`
}

/** 该文件名是否是本腿的产物(清理器只删自己人,绝不误删同目录里别的东西)。 */
export function isTranscriptName(name) {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  return /^\d{8}T\d{9}-[A-Za-z0-9._-]+-[A-Za-z0-9._-]+-[A-Za-z0-9._-]+\.log$/.test(base)
}

/**
 * 凭据脱敏规则。**顺序有意义**:先长形态(JWT / PEM)后短形态,否则私钥块会先被
 * `key=value` 规则切碎,Bearer 里的 JWT 会只剩前缀。
 *
 * 失效方向:宁可多脱(把一段讲述凭据规则的文档文字也换掉),不可少脱 —— 少脱一次就是把
 * 明文凭据写进一个会被打包、被复制、被 AI 读进上下文的文件里。
 */
const REDACT_RULES = [
  {
    kind: 'private-key',
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    kind: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    kind: 'bearer',
    re: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{12,}={0,2}/gi,
  },
  {
    kind: 'api-key',
    re: /\b(?:sk|pk|rk|ghp|gho|ghs|ghu|xox[baprs])[-_][A-Za-z0-9_-]{12,}/g,
  },
  {
    kind: 'kv-secret',
    re: /\b((?:api[_-]?key|apikey|secret|password|passwd|pwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|auth[_-]?token)\s*[:=]\s*)(["']?)([^\s"',;&}\]]{8,})\2/gi,
    repl: (_m, head, q) => `${head}${q}«REDACTED:kv-secret»${q}`,
  },
  {
    kind: 'json-secret',
    re: /("(?:apiKey|api_key|secret|password|passwd|accessToken|refreshToken|clientSecret|token|authorization)"\s*:\s*")[^"]{8,}"/gi,
    repl: (_m, head) => `${head}«REDACTED:json-secret»"`,
  },
]

/**
 * 脱敏。返回 `{ text, hits }`,`hits` 只记**次数**不记原文(连脱敏前的片段都不留)。
 * `hits` 要进头部:`命中 0 次` 是"这份输出里没有凭据"的证据,不是"没跑脱敏"。
 */
export function redactSecrets(text) {
  let out = String(text ?? '')
  const hits = {}
  for (const rule of REDACT_RULES) {
    rule.re.lastIndex = 0
    let n = 0
    out = out.replace(rule.re, (...args) => {
      n += 1
      if (typeof rule.repl === 'function') return rule.repl(...args)
      // 保留前缀组(如 Bearer 的空格),其余换成标记 —— 让读者知道"这里原本有个凭据"。
      const head = typeof args[1] === 'string' ? args[1] : ''
      return `${head}«REDACTED:${rule.kind}»`
    })
    if (n > 0) hits[rule.kind] = n
  }
  return { text: out, hits }
}

/** 按字节切并回退到最近的换行边界:避免把一个 UTF-8 序列/一个汉字切成半个。 */
function sliceAtNewline(buf, from, to) {
  let end = to
  const window = 4096
  for (let i = to; i > Math.max(from, to - window); i -= 1) {
    if (buf[i] === 0x0a) {
      end = i + 1
      break
    }
  }
  return buf.subarray(from, end).toString('utf8')
}

/**
 * 单份上限截断(保留头尾)。截断必留痕:正文里明写原始字节、中略字节、上限值。
 * 头部 60% 尾巴 40% —— 头部有 prompt 与环境,尾巴有终态与 usage,中段多是可丢的流式增量。
 */
export function capTranscript(text, maxBytes = RETENTION_DEFAULT.maxBytesPerFile) {
  const s = String(text ?? '')
  const buf = Buffer.from(s, 'utf8')
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : RETENTION_DEFAULT.maxBytesPerFile
  if (buf.length <= limit) {
    return { text: s, truncated: false, originalBytes: buf.length, keptBytes: buf.length, limit }
  }
  const headBytes = Math.floor(limit * 0.6)
  const tailBytes = limit - headBytes
  const head = sliceAtNewline(buf, 0, headBytes)
  const tailStart = Math.max(0, buf.length - tailBytes)
  const tail = buf.subarray(tailStart).toString('utf8').replace(/^[^\n]*\n?/, '')
  const keptBytes = Buffer.byteLength(head, 'utf8') + Buffer.byteLength(tail, 'utf8')
  const notice = `\n…〔本份全文 ${buf.length} 字节,超过单份上限 ${limit} 字节,已中略 ${buf.length - keptBytes} 字节;` +
    `头 ${headBytes} 字节 + 尾 ${tailBytes} 字节原样保留 —— 这是**截断**不是"输出就这么多"〕…\n`
  return { text: `${head}${notice}${tail}`, truncated: true, originalBytes: buf.length, keptBytes, limit }
}

/**
 * 正文拼装。分段边界刻意写成固定横幅:事后 grep 单段(prompt 段 / stdout 段)不必先解析头部。
 *
 * `prompt` 必须入盘:派发提示词决定了会话"以为自己在干什么",它一轮一换且用后即删,
 * 不落盘就等于把最关键的输入丢了 —— 事故复盘时最容易搞错的就是"当时到底怎么交代的"。
 */
export function buildTranscript({
  at = new Date(),
  mode = 'dispatch',
  ticketKey = '',
  ticketLine = '',
  cmd = '',
  action = 'unknown',
  exitCode = null,
  durationMs = null,
  timedOut = false,
  signal = null,
  prompt = '',
  stdout = '',
  stderr = '',
  notes = '',
} = {}) {
  const redactedPrompt = redactSecrets(prompt)
  const redactedOut = redactSecrets(stdout)
  const redactedErr = redactSecrets(stderr)
  const allHits = {}
  for (const h of [redactedPrompt.hits, redactedOut.hits, redactedErr.hits]) {
    for (const [k, v] of Object.entries(h)) allHits[k] = (allHits[k] ?? 0) + v
  }
  const hitText = Object.keys(allHits).length === 0 ? '0' : Object.entries(allHits).map(([k, v]) => `${k}x${v}`).join(',')
  const head = [
    '# session transcript — 单轮会话全文(调度器落盘,勿手改)',
    '',
    `- ts(会话开始):${new Date(at instanceof Date ? at.getTime() : at).toISOString()}`,
    `- mode:${mode}`,
    `- action:${action || 'unknown'}`,
    `- ticketKey:${ticketKey || '—'}`,
    `- ticketLine:${String(ticketLine || '—').replace(/\s+/g, ' ').slice(0, 300)}`,
    `- exitCode:${exitCode === null || exitCode === undefined ? 'null' : exitCode}`,
    `- durationMs:${durationMs === null || durationMs === undefined ? 'null' : durationMs}`,
    `- timedOut:${timedOut === true}`,
    `- signal:${signal ?? 'null'}`,
    `- redacted:${hitText}`,
    `- cmd:${String(cmd || '—').replace(/\s+/g, ' ').slice(0, 600)}`,
    ...(notes ? [`- notes:${String(notes).replace(/\s+/g, ' ').slice(0, 600)}`] : []),
    '',
    '说明:正文三段(prompt / stdout / stderr)原样保留,仅凭据按 scripts/lib/session-transcript.mjs',
    '的 REDACT_RULES 脱敏;脱敏是 best-effort,`redacted:` 行给出命中次数(0 = 本份无凭据)。',
    '',
    '===== PROMPT(会话被交代了什么) =====',
    redactedPrompt.text,
    '',
    '===== STDOUT(事件流原样) =====',
    redactedOut.text,
    '',
    '===== STDERR =====',
    redactedErr.text,
    '',
  ].join('\n')
  return head
}

/**
 * 轮转判据(纯函数)。`entries` 形如 `[{ rel, mtimeMs }]`,由调用方从盘上取。
 *
 * 三档返回:
 *  - `keep` 保留;`drop` 该删(带 why);`undetermined` mtime 取不到 ⇒ **不删**。
 *  - 最新一份(`mtime` 最大)无论多老、无论条数是否超限都保留:它是"最近一次到底怎么死的"
 *    的唯一证据,清理器把它删掉就等于把自愈能力自己削掉一块。
 */
export function decideRetention(entries, { now = Date.now(), keepDays = RETENTION_DEFAULT.keepDays, keepMax = RETENTION_DEFAULT.keepMax } = {}) {
  const days = Number.isFinite(keepDays) && keepDays > 0 ? keepDays : RETENTION_DEFAULT.keepDays
  const max = Number.isFinite(keepMax) && keepMax > 0 ? Math.floor(keepMax) : RETENTION_DEFAULT.keepMax
  const dated = []
  const undetermined = []
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || typeof e.rel !== 'string') continue
    const t = Number(e.mtimeMs)
    if (!Number.isFinite(t)) {
      undetermined.push({ rel: e.rel, why: 'mtime 未判定 ⇒ 不删(不猜)' })
      continue
    }
    dated.push({ rel: e.rel, mtimeMs: t })
  }
  dated.sort((a, b) => b.mtimeMs - a.mtimeMs || String(a.rel).localeCompare(String(b.rel)))
  const cutoff = now - days * 86_400_000
  const keep = []
  const drop = []
  dated.forEach((e, i) => {
    if (i === 0) {
      keep.push(e.rel)
      return
    }
    if (i >= max) {
      drop.push({ rel: e.rel, why: `条数位次 ${i + 1} ≥ 上限 ${max}` })
      return
    }
    if (e.mtimeMs < cutoff) {
      drop.push({ rel: e.rel, why: `早于 ${days} 天前(${new Date(e.mtimeMs).toISOString()})` })
      return
    }
    keep.push(e.rel)
  })
  return { keep, drop, undetermined, cutoff, keepDays: days, keepMax: max }
}

export const __test__ = {
  sanitizeSlug,
  compactStamp,
  transcriptRelPathOf,
  isTranscriptName,
  redactSecrets,
  capTranscript,
  buildTranscript,
  decideRetention,
  REDACT_RULES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
