// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 需求/异常自动发现器 · 离线归类核(纯判据,2026-10-26 立)。
//
// 票面(HEAD:PROJECT_PLAN.md「需求/异常自动发现器」):消费 api_logs / Grafana 告警 /
// 用户反馈入口,由 agent 自动聚类生成可派单改进项写入台账(复用 plan-task 器物)。
// 本文件只做**离线聚类**:输入是已按 `scripts/data/incident-signal-contract.json`
// 导出的信号数组,不连库、不调 Grafana、不读时钟 —— 真实取数由后续席位接线。
//
// 三类边界(全部有意为之,改动前先读票面):
// ① 禁 traceId / 时刻 / 原始计数进键(§守门 224 同族纪律):同一缺陷换时间、换 trace、
//    换实例、换计数必须落同一键,否则"每次都像新缺陷",台账被同一件事刷屏。
// ② 低样本不派单(§1 台账只记真工作):低于阈值的簇落 `dispatchable:false` 并在 `why`
//    里写明为什么不算真工作,由人读,不靠机器猜。
// ③ 窗口锚点 = 批次内最新时刻,不是 Date.now() —— 纯函数必须可重放:同一份输入任何
//    机器任何时候跑出同一结果。离线分析一批历史信号时"现在几点"没有意义。
//
// 单一真相源(S0.6):
// - 允许值枚举与 owner 映射住在契约 JSON,不在本文件抄第二份;
// - 消息归一的顺序敏感规则复用 `auto-triage.mjs` 的 `normalizeSignature`(同一缺陷的
//   不同请求收敛到同一签名这件事仓内只许一份实现);
// - 窗口计算只有 `windowOf` 一处,`clusterSignals` 与 CLI 的报表都问它。
//
// 不接线:本文件不注册进 `guardian-runner.mjs`,不进提交链,不写台账。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeSignature } from '../auto-triage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 输入契约的唯一落点(生产方与消费方共用;改契约先改它)。 */
export const CONTRACT_PATH = join(HERE, '..', 'data', 'incident-signal-contract.json')

/** 契约/参数/输入形状坏 —— 调用方必须落「未判定」,不得当空集处理(§0.3)。 */
export class IncidentShapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'IncidentShapeError'
  }
}

/** 归一化后仍带占位符就算"有实义文本"的判据:把占位符剥掉后至少剩 4 个实义字符。 */
const PLACEHOLDER_RE = /:(?:n|uuid|ts|hash|url)/g

/** 裸大写 token 里这些不是错误码(它们是协议/通用词,当码用会把整族错误并成一桶)。 */
const CODE_STOPWORDS = new Set([
  'HTTP', 'HTTPS', 'API', 'URL', 'URI', 'JSON', 'SQL', 'GET', 'POST', 'PUT', 'PATCH',
  'DELETE', 'HEAD', 'OPTIONS', 'ERROR', 'ERRORS', 'TRACE', 'WARN', 'INFO', 'DEBUG', 'FATAL',
])

const AT_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/
const UUID_SEG_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_SEG_RE = /^[0-9a-f]{8,}$/i

/**
 * 读并校验输入契约。形状坏 / 读不到 ⇒ 抛 `IncidentShapeError`(调用方落未判定)。
 * 不做缓存:契约只有几 KB,而缓存会让"改完契约还在用旧枚举"这种漂移看不见。
 */
export function loadContract(readFile = (p) => readFileSync(p, 'utf8')) {
  let doc
  try {
    doc = JSON.parse(readFile(CONTRACT_PATH))
  } catch (e) {
    throw new IncidentShapeError(`输入契约不可读:${CONTRACT_PATH}(${e?.message ?? e})`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new IncidentShapeError('契约根必须是对象')
  if (!Number.isInteger(doc.version) || doc.version < 1) throw new IncidentShapeError('契约 version 必须是正整数')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(doc.reviewBy ?? ''))) {
    throw new IncidentShapeError('契约 reviewBy 必须是 YYYY-MM-DD(到期须重审,不是永不过期)')
  }
  const fields = doc.fields
  if (!fields || typeof fields !== 'object') throw new IncidentShapeError('契约缺 fields')
  for (const name of ['source', 'kind', 'severity']) {
    const en = fields[name]?.enum
    if (!Array.isArray(en) || en.length === 0 || !en.every((v) => typeof v === 'string' && v !== '')) {
      throw new IncidentShapeError(`契约 fields.${name}.enum 必须是非空字符串数组`)
    }
  }
  for (const name of doc.required ?? []) {
    if (!fields[name]) throw new IncidentShapeError(`契约 required 点名的字段 ${name} 未在 fields 里定义`)
  }
  const minSev = doc.dispatch?.minSeverity
  if (!fields.severity.enum.includes(minSev)) {
    throw new IncidentShapeError(`契约 dispatch.minSeverity(${minSev})不在 severity 枚举内`)
  }
  for (const src of fields.source.enum) {
    if (typeof doc.owners?.[src] !== 'string' || doc.owners[src] === '') {
      throw new IncidentShapeError(`契约 owners 缺 source=${src} 的归属映射(候选行必须能指名建议归属)`)
    }
  }
  return doc
}

/** 归一化 route:去协议/主机/query/hash,数字/UUID/长 hex 段折占位,方法名大写保留。 */
export function normalizeRoute(route) {
  let s = String(route ?? '').trim()
  let method = ''
  const m = s.match(/^(get|post|put|patch|delete|head|options)\s+(.+)$/i)
  if (m) {
    method = `${m[1].toUpperCase()} `
    s = m[2]
  }
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  s = s.split(/[?#]/)[0].toLowerCase()
  const segs = s
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ':n'
      if (UUID_SEG_RE.test(seg)) return ':uuid'
      if (HEX_SEG_RE.test(seg)) return ':hex'
      return seg
    })
  return `${method}/${segs.join('/')}`
}

/**
 * 从消息里抽错误码:优先 `code=`/`status=`/`errno=` 形态,再退裸大写 token(≥5 字符、
 * 非协议词)。抽不到返回 null —— 调用方退消息归一,绝不拿"随便一个词"当身份。
 */
export function errorCodeOf(message) {
  const s = String(message ?? '')
  const kv = s.match(/\b(?:code|status|errno)\s*[=:]\s*([A-Za-z][A-Za-z0-9_.-]{1,39})/i)
  if (kv) return kv[1].toUpperCase()
  const upper = s.match(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[A-Z][A-Z0-9]{4,})\b/)
  if (upper && !CODE_STOPWORDS.has(upper[1])) return upper[1]
  return null
}

/** 归一消息是否还剩实义文本(只剩 `:n :uuid` 这类占位符 ⇒ 无法指名承载面)。 */
export function hasMeaningfulShape(shape) {
  return String(shape ?? '')
    .replace(PLACEHOLDER_RE, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
    .length >= 4
}

/** 稳定语义身份键:source|kind|route[:code] ⇒ 退 code ⇒ 退归一消息。禁止 traceId/时刻/计数。 */
export function identityOf(signal) {
  const head = `${signal.source}|${signal.kind}`
  const routeKey = signal.route ? `route:${normalizeRoute(signal.route)}` : ''
  const code = errorCodeOf(signal.message)
  if (routeKey) return code ? `${head}|${routeKey}|code:${code}` : `${head}|${routeKey}`
  if (code) return `${head}|code:${code}`
  return `${head}|msg:${normalizeSignature(signal.message)}`
}

/**
 * 逐字段校验一条信号。返回 `{ok:true,signal}` 或 `{ok:false,error}` —— 调用方把坏行
 * 单列计数,绝不吞掉同批好行(§0.3:取不到/判不了的那一条点名,不连坐)。
 */
export function validateSignal(raw, contract = loadContract()) {
  const fail = (error) => ({ ok: false, error })
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail('信号必须是 JSON 对象')
  const f = contract.fields
  for (const key of contract.required) {
    if (!(key in raw)) return fail(`缺必填字段 ${key}`)
  }
  const at = raw.at
  if (typeof at !== 'string' || !AT_RE.test(at)) return fail('at 必须是带时区的 ISO-8601 时刻(如 2026-10-26T10:00:00Z)')
  if (!Number.isFinite(Date.parse(at))) return fail(`at 不是可解析的时刻:${at}`)
  for (const name of ['source', 'kind', 'severity']) {
    if (!f[name].enum.includes(raw[name])) {
      return fail(`${name} 不在契约枚举内:${JSON.stringify(raw[name])}(允许:${f[name].enum.join('/')})`)
    }
  }
  const msgMax = f.message?.maxLength ?? 2000
  if (typeof raw.message !== 'string' || raw.message.trim() === '') return fail('message 必须是非空字符串')
  if (raw.message.length > msgMax) return fail(`message 超长 ${raw.message.length} > ${msgMax}`)
  const optional = {}
  for (const [key, max] of [['traceId', f.traceId?.maxLength ?? 128], ['route', f.route?.maxLength ?? 300]]) {
    if (!(key in raw) || raw[key] === undefined) continue
    const v = raw[key]
    if (typeof v !== 'string' || v.trim() === '') return fail(`${key} 出现时必须是非空字符串`)
    if (v.length > max) return fail(`${key} 超长 ${v.length} > ${max}`)
    optional[key] = v
  }
  const signal = {
    at: new Date(Date.parse(at)).toISOString(),
    source: raw.source,
    kind: raw.kind,
    severity: raw.severity,
    message: raw.message,
    ...optional,
  }
  return { ok: true, signal }
}

/**
 * 窗口锚定(`windowOf`):以批次内**最新时刻**为锚向前取 windowMinutes。
 * 这是"纯函数"的关键一步 —— 不读 Date.now(),同一输入永远同一结果。
 */
export function windowOf(signals, windowMinutes) {
  const ts = signals.map((s) => Date.parse(s.at)).filter((n) => Number.isFinite(n))
  if (ts.length === 0) return { referenceAt: null, startAt: null, windowMinutes, inWindow: [], outOfWindow: [] }
  const max = Math.max(...ts)
  const start = max - windowMinutes * 60_000
  const inWindow = []
  const outOfWindow = []
  for (const s of signals) {
    const t = Date.parse(s.at)
    if (Number.isFinite(t) && t >= start) inWindow.push(s)
    else outOfWindow.push(s)
  }
  return {
    referenceAt: new Date(max).toISOString(),
    startAt: new Date(start).toISOString(),
    windowMinutes,
    inWindow,
    outOfWindow,
  }
}

/**
 * 簇门槛的唯一读法:契约 `dispatch.minCountBySource[source]` 优先,其次 `dispatch.minCount`。
 *
 * 立因(2026-10-29 实证):契约 v2 起就写了 `dispatch.minCountBySource.deploy_outcome = 1`,
 * 全仓却无一处读它 —— deploy-feedback 自持字面量 1、clusterSignals 自持字面量 3、triage-incidents
 * 自持 CLI 默认 3,契约那句「门槛表只此一份,消费方不得自持第二份」形同虚设。改契约门槛时
 * 消费方不会跟着动,静默漂移。本函数把门槛收敛成一处:契约怎么定,判据就怎么走。
 * 两处皆缺 ⇒ 抛(调用方落未判定),不猜阈值。
 */
export function minCountForSource(source, contract) {
  const bySrc = contract?.dispatch?.minCountBySource
  if (bySrc && typeof bySrc === 'object' && !Array.isArray(bySrc)) {
    const v = bySrc[source]
    if (v !== undefined) {
      if (!Number.isInteger(v) || v < 1) {
        throw new IncidentShapeError(
          `契约 dispatch.minCountBySource.${source} 必须是正整数(实得 ${JSON.stringify(v)})`,
        )
      }
      return { minCount: v, basis: `dispatch.minCountBySource.${source}` }
    }
  }
  const base = contract?.dispatch?.minCount
  if (Number.isInteger(base) && base >= 1) return { minCount: base, basis: 'dispatch.minCount' }
  throw new IncidentShapeError(
    `契约 dispatch 段缺 minCount 且缺 minCountBySource.${source} ⇒ 门槛不可判定(不猜阈值)`,
  )
}

function assertClusterParams(minCount, windowMinutes) {
  if (!Number.isInteger(minCount) || minCount < 1) throw new IncidentShapeError(`minCount 必须是正整数(实得 ${minCount})`)
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
    throw new IncidentShapeError(`windowMinutes 必须是正数(实得 ${windowMinutes})`)
  }
}

/**
 * 核心:按稳定语义身份聚类。
 *
 * `signals` 必须是**已通过 validateSignal** 的数组(本函数是纯判据,不替你决定坏行怎么处置;
 * 坏行必须由调用方单列,传进来非法形状即抛错 —— 静默丢弃会让"判不了"伪装成"没有")。
 *
 * opts:
 *  - minCount       显式覆盖门槛(正整数);不给则按契约 dispatch.minCountBySource[source]/minCount
 *  - windowMinutes  窗口长度,锚点 = 批次内最新时刻(默认 60)
 *  - contract       已校验的契约(默认现场读;测试可注入)
 *
 * 返回按「可派单优先 → 计数降序 → 键升序」排序的簇数组:
 *  `{clusterKey, count, firstAt, lastAt, sample, dispatchable, why, severity, source, kind, route, code}`
 */
export function clusterSignals(signals, opts = {}) {
  if (!Array.isArray(signals)) throw new IncidentShapeError('signals 必须是数组')
  // 门槛来源:显式入参优先(排障/演练通道),否则逐簇问契约 —— 不自持第二份数字表。
  const explicitMinCount = opts.minCount ?? null
  const windowMinutes = opts.windowMinutes ?? 60
  assertClusterParams(explicitMinCount ?? 1, windowMinutes)
  const contract = opts.contract ?? loadContract()
  const sevEnum = contract.fields.severity.enum
  const minSevRank = sevEnum.indexOf(contract.dispatch.minSeverity)

  const checked = []
  signals.forEach((s, i) => {
    const v = validateSignal(s, contract)
    if (!v.ok) throw new IncidentShapeError(`第 ${i} 条信号形状坏:${v.error}(坏行须由调用方先行单列,不得混入聚类)`)
    checked.push(v.signal)
  })

  const win = windowOf(checked, windowMinutes)
  const buckets = new Map()
  for (const s of win.inWindow) {
    const key = identityOf(s)
    const ts = Date.parse(s.at)
    const cur = buckets.get(key) ?? {
      clusterKey: key,
      source: s.source,
      kind: s.kind,
      route: s.route ? normalizeRoute(s.route) : null,
      code: errorCodeOf(s.message),
      count: 0,
      firstTs: ts,
      lastTs: ts,
      sample: s.message,
      severity: s.severity,
      sevRank: sevEnum.indexOf(s.severity),
    }
    cur.count += 1
    if (ts < cur.firstTs) {
      cur.firstTs = ts
      cur.sample = s.message
    }
    if (ts > cur.lastTs) cur.lastTs = ts
    const rank = sevEnum.indexOf(s.severity)
    if (rank > cur.sevRank) {
      cur.sevRank = rank
      cur.severity = s.severity
    }
    buckets.set(key, cur)
  }

  const clusters = [...buckets.values()].map((b) => {
    const reasons = []
    // 门槛逐簇问契约(同簇同 source ⇒ 同门槛);显式入参只作覆盖。
    const gate = explicitMinCount
      ? { minCount: explicitMinCount, basis: 'opts.minCount(显式覆盖)' }
      : minCountForSource(b.source, contract)
    if (b.count < gate.minCount) {
      reasons.push(`样本 ${b.count} < 阈值 ${gate.minCount}(契约 ${gate.basis};窗口 ${windowMinutes} 分钟)⇒ 观察类,不足以证明是持续缺陷,写进台账只会多一条没人能动手的行`)
    }
    if (b.sevRank < minSevRank) {
      reasons.push(`最高档 ${b.severity} 低于可派单门槛 ${contract.dispatch.minSeverity} ⇒ 观察类(该档没有必须有人动手的动作)`)
    }
    const shape = normalizeSignature(b.sample)
    if (!b.route && !b.code && !hasMeaningfulShape(shape)) {
      reasons.push('归一后消息只剩占位符、且无 route/错误码 ⇒ 取证类,指不出承载面')
    }
    const dispatchable = reasons.length === 0
    return {
      clusterKey: b.clusterKey,
      count: b.count,
      firstAt: new Date(b.firstTs).toISOString(),
      lastAt: new Date(b.lastTs).toISOString(),
      sample: String(b.sample).slice(0, 240),
      dispatchable,
      why: dispatchable
        ? `样本 ${b.count} ≥ 阈值 ${gate.minCount}(${gate.basis}),最高档 ${b.severity} ≥ 门槛 ${contract.dispatch.minSeverity},身份 ${b.clusterKey} 可指名承载面`
        : reasons.join('；'),
      severity: b.severity,
      source: b.source,
      kind: b.kind,
      route: b.route,
      code: b.code,
    }
  })
  clusters.sort(
    (a, b) =>
      Number(b.dispatchable) - Number(a.dispatchable) ||
      b.count - a.count ||
      a.clusterKey.localeCompare(b.clusterKey),
  )
  return clusters
}

export const __test__ = {
  AT_RE,
  CODE_STOPWORDS,
  normalizeRoute,
  errorCodeOf,
  hasMeaningfulShape,
  identityOf,
  validateSignal,
  windowOf,
  clusterSignals,
  minCountForSource,
  loadContract,
  IncidentShapeError,
  CONTRACT_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
