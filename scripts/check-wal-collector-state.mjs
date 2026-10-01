// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 只读对账尺子:postgres_exporter 的 wal 采集器关闭状态(台账 G-471)。
//
// 它问两件事,合起来才是这条改动的完整承诺:
//   ① 版本化半边 —— `monitoring/postgres-exporter/collectors.json` 在被审面上是否**真的**声明了
//      "wal 这个采集器是关的"。这一半判的是"改动在不在仓里":一条只活在 nssm 服务配置里的处置,
//      换机/重装会静默回潮成每 15 秒一次 `pq: permission denied for function pg_ls_waldir`
//      (§5e「落进部署形态而没有入库源的脚本等于写进盲区」同型)。
//   ② 机器半边 —— 服务实际参数(registry 通道)与进程实际采集(/metrics 通道)是否与那份声明一致。
//      两条通道各判各的,任一条量不到都落「未判定」,绝不把"没判到"写成"没开"。
//
// 定级:**warn / 手动问责档 —— 尚未接入提交链**(刻意不接)。它判的是**机器运行时状态**
// (服务在不在、进程在采谁),提交者结构上满足不了 ⇒ 挂进提交链就是每台每次被逼 --no-verify、
// 连带链上全部守门作废(AGENTS §12e 同型)。因此本门**没有也不需要**紧急跳过变量,
// 也不在 scripts/guardian-runner.mjs 里注册 —— 由 scripts/tests/check-wal-collector-state.test.mjs
// 的接线方向锁钉住"哪天被接进去,那条测试必读红,须带着'为什么现在能接'的证据改测试"。
//
// 全程只读:不派生 nssm set、不重启服务、不改任何数据库权限、不写盘。
// 用法:
//   node scripts/check-wal-collector-state.mjs                 # 声明取 HEAD blob + 机器现读
//   node scripts/check-wal-collector-state.mjs --staged        # 声明取索引 blob(提交前自检)
//   node scripts/check-wal-collector-state.mjs --strict         # 有「未判定」即 exit 2(拒绝出合格证)
//   node scripts/check-wal-collector-state.mjs --json           # 机读面
//   node scripts/check-wal-collector-state.mjs --self-test      # 构造面自检(零副作用、不派生)
// 退出码:0 = ok 或(默认档的)未判定;1 = drift(声明与机器态不一致 / 声明不见了);2 = --strict 下有未判定,或本工具自身异常。
//
// 与守门 89 的口径:本头注用「尚未接入 / 手动问责档 / 刻意不接」描述现状,不是肯定式声称。

import { existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACE_LABEL, FACE_NOTE, Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
// 「怎么向 Windows 问一个服务的 Parameters」只许有一份实现 —— 这里复用守门 check-service-binary-paths
// 那一把尺子已经踩过的三个坑(注册表路径必须正斜杠、nssm/PS 输出可能是 UTF-16LE、多值参数不得只取首行)。
// 在本门再抄一份 buildRegistryScript 就是第二个真相(AGENTS §22c 同一条理由)。
import {
  REG_ENCODE_ERROR,
  REG_NO_PARAMS,
  __test__ as serviceKit,
  decodeNssm,
  decodeRegistryConfigBlob,
  parseRegistryOutput,
  pickPowerShell,
} from './check-service-binary-paths.mjs'

const { defaultDeps } = serviceKit

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DECLARATION_REL = 'monitoring/postgres-exporter/collectors.json'
export const DEFAULT_COLLECTOR = 'wal'
export const METRICS_TIMEOUT_MS = 2500
export const METRICS_BODY_CAP = 8 * 1024 * 1024
/** 三态是这门的全部价值:ok / drift / undetermined 绝不并桶。 */
export const OK = 'ok'
export const DRIFT = 'drift'
export const UNDET = 'undetermined'

/** 共用的 registry 通道在不在位(不在位就绝不能在本门里另写一份 PS 脚本)。 */
const HAS_SHARED_REGISTRY_CHANNEL = !!(defaultDeps && typeof defaultDeps.psRegistry === 'function')

// ---------------------------------------------------------------------------
// 纯函数层(测试直接 import;§22c:测试里不得再抄一份判据)
// ---------------------------------------------------------------------------

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : ''
}

/** 声明文本 → 结构化。坏 JSON / 缺字段一律落 undetermined,**不**读成"没关"也不读成"已关"。 */
export function parseDeclaration(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { kind: UNDET, reason: `版本化声明取不到(被审面上没有 ${DECLARATION_REL},或内容为空)⇒ 无法判"该采集器在版本化配置里确实是关的"` }
  }
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { kind: UNDET, reason: `版本化声明不是合法 JSON:${e?.message ?? e}(损坏既不算"没关",也不算"已关")` }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { kind: UNDET, reason: '版本化声明顶层不是对象' }
  const service = nonEmptyString(doc.service)
  if (!service) return { kind: UNDET, reason: '版本化声明缺 service 字段 ⇒ 尺子不知道去问哪个服务' }
  const raw = Array.isArray(doc.disabledCollectors) ? doc.disabledCollectors : []
  const entries = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const name = nonEmptyString(item.name)
    if (!name) continue
    const tokens = (Array.isArray(item.disableTokens) ? item.disableTokens : []).filter((t) => typeof t === 'string' && t.trim() !== '')
    entries.push({ name, tokens })
  }
  const me = doc.metricsExpectation && typeof doc.metricsExpectation === 'object' ? doc.metricsExpectation : {}
  const listen = nonEmptyString(doc.listenAddress)
  const metricsPath = nonEmptyString(me.path) || '/metrics'
  return {
    kind: OK,
    service,
    entries,
    metrics: {
      family: nonEmptyString(me.family),
      labelKey: nonEmptyString(me.collectorLabelKey) || 'collector',
      url: listen ? `http://${listen}${metricsPath}` : '',
    },
  }
}

/** 版本化半边:声明里必须有该采集器的关闭条目 + 可认的旗标 token。 */
export function judgeVersionedHalf(decl, collector) {
  if (!decl || decl.kind !== OK) return { state: UNDET, findings: [], notes: [decl?.reason ?? '声明未解析'] }
  const entry = decl.entries.find((e) => e.name === collector)
  if (!entry) {
    return {
      state: DRIFT,
      findings: [`版本化声明里没有采集器 "${collector}" 的关闭条目 ⇒ 这条处置又回到"只在机器上、不在仓里"的状态(本门立项要防的那一型)`],
      notes: [],
    }
  }
  if (entry.tokens.length === 0) {
    return { state: DRIFT, findings: [`声明里 "${collector}" 条目缺 disableTokens ⇒ 机器面上无从认出它,判据等于没有`], notes: [] }
  }
  return { state: OK, findings: [], notes: [`声明在位:"${collector}" 由 ${entry.tokens.join(' / ')} 关闭(服务 ${decl.service})`] }
}

/** 机器通道 A:注册表里的 nssm Parameters blob(registry 枚举行由共用实现解析)。 */
export function interpretRegistryChannel({ parsed, service, tokens, collector }) {
  if (!parsed) return { channel: 'registry', state: UNDET, reason: '注册表通道没有产出 ⇒ 未判定' }
  if (parsed.regMissing) return { channel: 'registry', state: UNDET, reason: '注册表 Services 根键取不到 ⇒ 未判定' }
  if (!parsed.sumSeen && parsed.totalServiceKeys === null) {
    return { channel: 'registry', state: UNDET, reason: '注册表枚举缺汇总行 ⇒ 无法区分"这台机没有服务"与"没跑到"' }
  }
  const want = String(service ?? '').toLowerCase()
  const row = (parsed.rows || []).find((r) => String(r.service ?? '').toLowerCase() === want)
  if (!row) {
    if ((parsed.unparsed || []).length > 0) {
      return { channel: 'registry', state: UNDET, reason: `注册表行有 ${parsed.unparsed.length} 条解不出(不能排除目标服务就在其中)⇒ 未判定` }
    }
    return {
      channel: 'registry',
      state: UNDET,
      reason: `服务 "${service}" 不在本机注册表枚举出的服务面里(共 ${parsed.rows?.length ?? 0} 行 nssm 托管服务)⇒ 本机不是监控宿主。这是"没判到",不是"没关"`,
    }
  }
  if (row.pb64 === REG_NO_PARAMS) {
    return {
      channel: 'registry',
      state: DRIFT,
      findings: [`服务 "${service}" 的 Parameters 键整块不在 ⇒ 机器上没有任何旗标,postgres_exporter 按默认值把 "${collector}" 采着(原故障形态)`],
      notes: [],
    }
  }
  const dec = decodeRegistryConfigBlob(row.pb64)
  if (dec.kind === 'error') {
    return { channel: 'registry', state: UNDET, reason: `服务 "${service}" 的参数 blob 解不出(REG_ENCODE_ERROR / 非法 base64)⇒ 未判定` }
  }
  const missing = (tokens || []).filter((t) => !String(dec.text ?? '').includes(t))
  if (missing.length === 0) {
    return { channel: 'registry', state: OK, findings: [], notes: [`机器参数在位:${missing.length === 0 ? tokens.join(' / ') : ''}`] }
  }
  return {
    channel: 'registry',
    state: DRIFT,
    findings: [`服务 "${service}" 的实际参数里没有 ${missing.join(' / ')} ⇒ 采集器 "${collector}" 在机器上被打开了(声明与机器态分叉)`],
    notes: [],
  }
}

/** 机器通道 B:/metrics 里 `pg_scrape_collector_success{collector="wal" …}` 的实际形态。 */
export function interpretMetricsChannel({ outcome, family, labelKey, collector }) {
  if (!outcome) return { channel: 'metrics', state: UNDET, reason: '指标通道未执行 ⇒ 未判定' }
  if (outcome.error) return { channel: 'metrics', state: UNDET, reason: `/metrics 取不到:${outcome.error}(量不到 ≠ 没有)` }
  if (typeof outcome.status === 'number' && (outcome.status < 200 || outcome.status >= 300)) {
    return { channel: 'metrics', state: UNDET, reason: `/metrics 回非 2xx(${outcome.status})⇒ 未判定` }
  }
  if (!family) return { channel: 'metrics', state: UNDET, reason: '声明缺 metricsExpectation.family ⇒ 指标通道判不了' }
  const body = String(outcome.body ?? '')
  const famSample = new RegExp(`^${escapeRe(family)}\\{`, 'm')
  if (!famSample.test(body)) {
    return { channel: 'metrics', state: UNDET, reason: `面上没有 ${family} 指标族 ⇒ 取到的可能不是 postgres_exporter(或它还没采过一轮),不作"确实没采"的结论` }
  }
  if (Number(outcome.truncated || 0) > 0) {
    return { channel: 'metrics', state: UNDET, reason: `响应体被截断(${outcome.truncated} 字节未读)⇒ "没有 wal 序列"这个结论不可靠,判未判定` }
  }
  const series = new RegExp(`^${escapeRe(family)}\\{[^}\\n]*${escapeRe(labelKey)}="${escapeRe(collector)}"[^}\\n]*\\}[ \\t]+([^\\s]+)`, 'm')
  const m = series.exec(body)
  if (!m) {
    return { channel: 'metrics', state: OK, findings: [], notes: [`指标族在位而 "${collector}" 无序列 ⇒ 机器实测该采集器未被采集,与声明一致`] }
  }
  const raw = m[1]
  const num = Number(raw)
  if (!Number.isFinite(num)) {
    return { channel: 'metrics', state: UNDET, reason: `${family}{${labelKey}="${collector}"} 的值「${raw}」读不出数 ⇒ 未判定` }
  }
  if (num === 0) {
    return {
      channel: 'metrics',
      state: DRIFT,
      findings: [`机器实测:${family}{${labelKey}="${collector}"} 0 —— 采集器仍在被采且每轮失败,这就是 G-471 的原故障形态`],
      notes: [],
    }
  }
  if (num === 1) {
    return {
      channel: 'metrics',
      state: DRIFT,
      findings: [`机器实测:${family}{${labelKey}="${collector}"} 1 —— 采集器仍启用,与版本化声明(应为关)不符`],
      notes: [],
    }
  }
  return { channel: 'metrics', state: UNDET, reason: `${family}{${labelKey}="${collector}"} = ${raw},既不是 0 也不是 1 ⇒ 未判定` }
}

/** 合流:任一**量到的**通道说分叉就是分叉;版本化半边没核过就不出 ok;机器通道全没量到 ⇒ 未判定。 */
export function combineStates({ versioned, channels }) {
  const list = Array.isArray(channels) ? channels : []
  const measured = list.filter((c) => c && c.state !== UNDET)
  const findings = [...(versioned?.state === DRIFT ? versioned.findings || [] : []), ...measured.flatMap((c) => c.state === DRIFT ? c.findings || [] : [])]
  const undet = [
    ...(versioned?.state === UNDET ? [versioned.notes?.[0] ?? '版本化半边未判定'] : []),
    ...list.filter((c) => c && c.state === UNDET).map((c) => `${c.channel}:${c.reason}`),
  ]
  if (findings.length > 0) return { state: DRIFT, findings, undet, notes: collectNotes(versioned, measured) }
  if (versioned?.state !== OK) return { state: UNDET, findings: [], undet, notes: collectNotes(versioned, measured) }
  if (measured.some((c) => c.state === OK)) return { state: OK, findings: [], undet, notes: collectNotes(versioned, measured) }
  return {
    state: UNDET,
    findings: [],
    undet: ['两条机器通道都没量到 ⇒ 只核了版本化半边,不出"声明与机器态一致"的结论'],
    notes: collectNotes(versioned, measured),
  }
}

function collectNotes(versioned, measured) {
  const out = []
  if (versioned?.notes?.length) out.push(...versioned.notes)
  for (const c of measured) if (c.notes?.length) out.push(`${c.channel}:${c.notes.join(' / ')}`)
  return out
}

/** 退出码口径:drift 恒 1;未判定默认 0(warn 级,少判一件事不是错误),--strict 才 2(拒绝出合格证)。 */
export function computeExitCode(state, strict) {
  if (state === DRIFT) return 1
  if (state === UNDET) return strict ? 2 : 0
  return 0
}

export function parseArgs(argv) {
  const args = (argv || []).slice()
  const out = { json: false, strict: false, selfTest: false, staged: false, worktree: false, badFlags: [] }
  for (const a of args) {
    if (a === '--json') out.json = true
    else if (a === '--strict') out.strict = true
    else if (a === '--self-test') out.selfTest = true
    else if (a === '--staged') out.staged = true
    else if (a === '--worktree') out.worktree = true
    else out.badFlags.push(a)
  }
  return out
}

/** 声明的取材面:缺省 HEAD blob,--staged 索引 blob,--worktree 只作人工逃生舱(两面旗同给由调用方判死)。 */
export function readDeclaration({ root, face, readWorktree = readWorktreeFile, rel = DECLARATION_REL, batchOverride = null }) {
  if (face === 'worktree') {
    try {
      return { text: readWorktree(root, rel) ?? null }
    } catch (e) {
      return { text: null, error: `工作树取声明失败:${e?.message ?? e}` }
    }
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const spec = prefix + rel
  let map
  try {
    // 层的读取入口必须是**真调用**(守门 118:引了 face-reader 却自己取内容 = half-wired)。
    // batchOverride 只给测试构造三面用,生产路径一律走这一行。
    map = batchOverride ? batchOverride(root, [spec]) : catBatch(root, [spec])
  } catch (e) {
    if (e instanceof Undetermined) return { text: null, error: `被审面整体取不到:${e.message}` }
    return { text: null, error: `git 取声明失败:${e?.message ?? e}` }
  }
  const v = map && typeof map.get === 'function' ? map.get(spec) : undefined
  return { text: typeof v === 'string' ? v : null }
}

// ---------------------------------------------------------------------------
// 执行层(默认 deps 才派生;测试注入替身)
// ---------------------------------------------------------------------------

/** GET 一个 URL,把"取不到"与"取到但内容为空"分成两件事。 */
export function httpGet(url, timeoutMs = METRICS_TIMEOUT_MS, cap = METRICS_BODY_CAP) {
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const finish = (v) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(v)
    }
    let req
    try {
      req = http.get(url, { timeout: timeoutMs }, (res) => {
        const chunks = []
        let size = 0
        let dropped = 0
        res.on('data', (c) => {
          size += c.length
          if (size <= cap) chunks.push(c)
          else dropped += c.length
        })
        res.on('end', () => finish({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), truncated: dropped }))
        res.on('error', (e) => finish({ error: `响应读取失败:${e?.message ?? e}` }))
      })
    } catch (e) {
      finish({ error: `派生请求异常:${e?.message ?? e}` })
      return
    }
    req.on('timeout', () => {
      try {
        req.destroy(new Error('timeout'))
      } catch {}
      finish({ error: `超时(${timeoutMs}ms)—— 未判定,不是"没有"` })
    })
    req.on('error', (e) => finish({ error: `请求失败:${e?.code || e?.message || e}` }))
    timer = setTimeout(() => finish({ error: `看门狗超时(${timeoutMs + 500}ms)` }), timeoutMs + 500)
    if (timer && typeof timer.unref === 'function') timer.unref()
  })
}

export const defaultMachineDeps = {
  platform: process.platform,
  exists: (p) => existsSync(p),
  registry: (bin) => defaultDeps.psRegistry(bin),
  metricsGet: (url) => httpGet(url, METRICS_TIMEOUT_MS),
  collector: DEFAULT_COLLECTOR,
}

/** 两条机器通道的派生(全程只读;任何一步问不到都落未判定并给原因)。 */
export async function readMachineChannels(decl, deps) {
  const channels = []
  const collector = deps.collector || DEFAULT_COLLECTOR
  const entry = decl && decl.kind === OK ? decl.entries.find((e) => e.name === collector) : null
  const tokens = entry ? entry.tokens : []
  // 通道 A:注册表 / PowerShell
  if (deps.platform !== 'win32') {
    channels.push({ channel: 'registry', state: UNDET, reason: `非 win32(platform=${deps.platform}):nssm 服务配置面在本机不存在 ⇒ 未判定` })
  } else if (!HAS_SHARED_REGISTRY_CHANNEL) {
    channels.push({ channel: 'registry', state: UNDET, reason: '没能复用共用的 registry 通道实现 ⇒ 未判定(禁止在本门另写一份 PS 脚本)' })
  } else {
    const bin = pickPowerShell(deps.exists)
    if (!bin) {
      channels.push({ channel: 'registry', state: UNDET, reason: 'PowerShell 解释器两个候选都不在位 ⇒ 未判定' })
    } else {
      const raw = deps.registry(bin.bin)
      if (raw?.spawnError) {
        const why = raw.spawnError === 'ETIMEDOUT' ? '派生超时' : raw.spawnError === 'ENOENT' ? '解释器不可执行' : raw.spawnError
        channels.push({ channel: 'registry', state: UNDET, reason: `注册表通道派生失败(${why})⇒ 未判定` })
      } else if (typeof raw?.code !== 'number' || raw.code !== 0) {
        channels.push({ channel: 'registry', state: UNDET, reason: `注册表通道退出码 ${raw?.code ?? '无'} ⇒ 未判定` })
      } else {
        const text = decodeNssm(Buffer.from(raw?.stdoutBuf ?? '')).text
        const parsed = parseRegistryOutput(text)
        // 旗标只从声明里取。声明没给 ⇒ 本通道判"未判定",**不得**在本门兜一个默认 token
        // (那等于在尺子里藏第二份真相,而声明与它分叉时读起来像"机器上没那个旗标")。
        const channel = tokens.length === 0
          ? { channel: 'registry', state: UNDET, reason: `声明里 "${collector}" 没给出 disableTokens ⇒ registry 通道无从在机器参数里认它` }
          : interpretRegistryChannel({ parsed, service: decl?.service ?? '', tokens, collector })
        channels.push(channel)
      }
    }
  }
  // 通道 B:/metrics
  if (!decl || decl.kind !== OK) {
    channels.push({ channel: 'metrics', state: UNDET, reason: '版本化声明没解析出来 ⇒ 指标通道连 URL 都拿不到' })
  } else if (!decl.metrics.url) {
    channels.push({ channel: 'metrics', state: UNDET, reason: '声明没有可用 listenAddress ⇒ 指标通道未配' })
  } else {
    const outcome = await deps.metricsGet(decl.metrics.url)
    channels.push(
      interpretMetricsChannel({ outcome, family: decl.metrics.family, labelKey: decl.metrics.labelKey, collector }),
    )
  }
  return channels
}

export async function main({ argv = [], root = ROOT, deps = defaultMachineDeps, readDec = readDeclaration } = {}) {
  const opts = parseArgs(argv)
  if (opts.selfTest) return { exitCode: selfTest(), text: '', json: null }
  if (opts.badFlags.length > 0) {
    return { exitCode: 2, text: `✖ 参数不认识:${opts.badFlags.join(' ')} —— 本工具自身的问题按「未判定」处理,不冒红也不记绿`, json: null }
  }
  const sel = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (sel.error) return { exitCode: 2, text: `✖ 面旗矛盾(未判定,不冒红也不记绿):${sel.error}`, json: null }
  const face = sel.face
  const got = readDec({ root, face })
  if (got.error) return { exitCode: 2, text: `✖ 被审面取不到声明(未判定,不记通过):${got.error}`, json: null }
  const decl = parseDeclaration(got.text)
  const collector = deps.collector || DEFAULT_COLLECTOR
  const versioned = judgeVersionedHalf(decl, collector)
  const channels = await readMachineChannels(decl, deps)
  const verdict = combineStates({ versioned, channels })
  const exitCode = computeExitCode(verdict.state, opts.strict)
  const report = {
    tool: 'check-wal-collector-state',
    ticket: 'G-471',
    face,
    faceLabel: FACE_LABEL[face],
    faceNote: FACE_NOTE[face],
    declaration: DECLARATION_REL,
    collector,
    service: decl?.service ?? null,
    state: verdict.state,
    exitCode,
    strict: !!opts.strict,
    findings: verdict.findings,
    undetermined: verdict.undet,
    notes: verdict.notes,
    channels: channels.map((c) => ({ channel: c.channel, state: c.state, reason: c.reason ?? null, findings: c.findings ?? [] })),
    levelNote: 'warn / 手动问责档 —— 尚未接入提交链(判的是机器运行时状态);没有紧急跳过变量,也不在 guardian-runner 里',
    undoHint: '撤销这条处置见声明里的 undoCommand(改完须重启该服务才生效,本工具不重启任何服务)',
  }
  return { exitCode, text: renderText(report), json: report }
}

export function renderText(r) {
  const L = []
  L.push(`wal 采集器状态对账(G-471)—— 判定面:${r.faceLabel}(${r.faceNote})`)
  L.push(`  版本化声明:${r.declaration}`)
  for (const n of r.notes) L.push(`  · ${n}`)
  for (const c of r.channels) {
    if (c.state === UNDET) L.push(`  ⚠ 未判定[${c.channel}]:${c.reason}`)
    else if (c.state === DRIFT) for (const f of c.findings) L.push(`  ✖ 分叉[${c.channel}]:${f}`)
    else L.push(`  ✅ 一致[${c.channel}]:${(c.findings && c.findings[0]) || '量到了,与声明一致'}`)
  }
  for (const u of r.undetermined) if (!r.channels.some((c) => String(u).startsWith(`${c.channel}:`))) L.push(`  ⚠ 未判定:${u}`)
  for (const f of r.findings) if (!r.channels.some((c) => (c.findings || []).includes(f))) L.push(`  ✖ ${f}`)
  if (r.state === OK) L.push(`✅ 结论:ok —— 版本化声明在位且至少一条机器通道实测一致(exit ${r.exitCode})`)
  else if (r.state === DRIFT) L.push(`✖ 结论:drift —— 声明与机器态分叉,或这条处置又不在了仓里(exit ${r.exitCode})`)
  else L.push(`⚠ 结论:未判定 —— ${r.undetermined.join(' | ') || '没有任何一维量到'}(exit ${r.exitCode};--strict 下这一型判 2,拒绝出合格证)`)
  L.push(`  ${r.levelNote}`)
  if (r.state === DRIFT) L.push(`  ${r.undoHint}`)
  return L.join('\n')
}

// ---------------------------------------------------------------------------
// 构造面自检(零副作用、不派生 PS/HTTP、不碰 git)
// ---------------------------------------------------------------------------

export function selfTest() {
  const cases = []
  const t = (name, cond) => cases.push({ name, pass: cond === true })
  const declText = (over = {}) => JSON.stringify({ service: 'ihui-pg-exporter', listenAddress: '127.0.0.1:9187', disabledCollectors: [{ name: 'wal', disableTokens: ['--no-collector.wal'] }], metricsExpectation: { family: 'pg_scrape_collector_success', collectorLabelKey: 'collector' }, ...over })
  const regLine = (svc, paramsArr) => `SVC|${svc}|app=C:\\\\nssm.exe|dir=|pb64=${Buffer.from(paramsArr.join('\n'), 'utf8').toString('base64')}|img=C:\\\\nssm.exe`
  const reg = (line) => parseRegistryOutput(`${line}\nSUM|1`)

  t('01 声明取不到 ⇒ 未判定(不读成"没关")', (() => judgeVersionedHalf(parseDeclaration(null), 'wal').state === UNDET)())
  t('02 坏 JSON ⇒ 未判定并点名原因', (() => { const d = parseDeclaration('{not json'); return d.kind === UNDET && /合法 JSON/.test(d.reason) })())
  t('03 声明在位且 wal 有旗标 ⇒ 版本化半边 ok', (() => judgeVersionedHalf(parseDeclaration(declText()), 'wal').state === OK)())
  t('04 阳性对照:声明里没有 wal 条目 ⇒ drift 并点名', (() => { const v = judgeVersionedHalf(parseDeclaration(declText({ disabledCollectors: [] })), 'wal'); return v.state === DRIFT && v.findings[0].includes('wal') })())
  t('05 声明有 wal 但缺 disableTokens ⇒ drift', (() => judgeVersionedHalf(parseDeclaration(declText({ disabledCollectors: [{ name: 'wal' }] })), 'wal').state === DRIFT)())
  t('06 机器参数含旗标 ⇒ registry 通道 ok', (() => interpretRegistryChannel({ parsed: reg(regLine('ihui-pg-exporter', ['--web.listen-address=127.0.0.1:9187', '--no-collector.wal'])), service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }).state === OK)())
  t('07 阳性对照:机器参数把旗标去掉 ⇒ drift 并点名缺的 token', (() => { const c = interpretRegistryChannel({ parsed: reg(regLine('ihui-pg-exporter', ['--web.listen-address=127.0.0.1:9187'])), service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }); return c.state === DRIFT && c.findings[0].includes('--no-collector.wal') })())
  t('08 服务不在枚举里 ⇒ 未判定,绝不读成"没关"', (() => { const c = interpretRegistryChannel({ parsed: reg('SVC|other|app=a|dir=|pb64=AAA=|img=x'), service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }); return c.state === UNDET && /没判到/.test(c.reason) })())
  t('09 Parameters 键整块不在(absent 哨兵)⇒ drift,不是未判定', (() => { const line = `SVC|ihui-pg-exporter|app=a|dir=|pb64=${REG_NO_PARAMS}|img=x`; return interpretRegistryChannel({ parsed: reg(line), service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }).state === DRIFT })())
  t('10 编码失败哨兵 ⇒ 未判定', (() => { const line = `SVC|ihui-pg-exporter|app=a|dir=|pb64=${REG_ENCODE_ERROR}|img=x`; return interpretRegistryChannel({ parsed: reg(line), service: 'ihui-pg-exporter', tokens: ['--no-collector.wal'], collector: 'wal' }).state === UNDET })())
  t('11 注册表根键缺失 ⇒ 未判定', (() => interpretRegistryChannel({ parsed: { rows: [], unparsed: [], totalServiceKeys: null, regMissing: true, sumSeen: false }, service: 's', tokens: ['x'], collector: 'wal' }).state === UNDET)())
  t('12 指标族在位而 wal 无序列 ⇒ metrics 通道 ok', (() => interpretMetricsChannel({ outcome: { status: 200, body: '# HELP pg_scrape_collector_success x\npg_scrape_collector_success{collector="bgwriter"} 1\n' }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }).state === OK)())
  t('13 阳性对照:wal 序列值 0 ⇒ drift(原故障形态)', (() => { const c = interpretMetricsChannel({ outcome: { status: 200, body: 'pg_scrape_collector_success{collector="wal"} 0' }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }); return c.state === DRIFT && /失败/.test(c.findings[0]) })())
  t('14 wal 序列值 1 ⇒ drift(仍启用,与声明不符)', (() => interpretMetricsChannel({ outcome: { status: 200, body: 'pg_scrape_collector_success{collector="wal"} 1' }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }).state === DRIFT)())
  t('15 面上没有该指标族 ⇒ 未判定(不作"确实没采")', (() => interpretMetricsChannel({ outcome: { status: 200, body: 'go_goroutines 12' }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }).state === UNDET)())
  t('16 请求失败 ⇒ 未判定并带原因', (() => { const c = interpretMetricsChannel({ outcome: { error: '连接被拒绝' }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }); return c.state === UNDET && /连接被拒绝/.test(c.reason) })())
  t('17 响应体截断时,"没有 wal 序列"不作 ok', (() => interpretMetricsChannel({ outcome: { status: 200, body: 'pg_scrape_collector_success{collector="x"} 1', truncated: 5 }, family: 'pg_scrape_collector_success', labelKey: 'collector', collector: 'wal' }).state === UNDET)())
  t('18 合流:版本化 ok + 一条机器通道 ok ⇒ ok', (() => combineStates({ versioned: { state: OK, findings: [], notes: [] }, channels: [{ channel: 'registry', state: UNDET, reason: 'r' }, { channel: 'metrics', state: OK, findings: [], notes: [] }] }).state === OK)())
  t('19 反向对照:两条机器通道都没量到 ⇒ 未判定,不出 ok', (() => combineStates({ versioned: { state: OK, findings: [], notes: [] }, channels: [{ channel: 'registry', state: UNDET, reason: '本机不是监控宿主' }, { channel: 'metrics', state: UNDET, reason: '连不上' }] }).state === UNDET)())
  t('20 合流:任一量到的通道分叉 ⇒ drift 优先', (() => combineStates({ versioned: { state: OK, findings: [], notes: [] }, channels: [{ channel: 'registry', state: OK, findings: [], notes: [] }, { channel: 'metrics', state: DRIFT, findings: ['x'], notes: [] }] }).state === DRIFT)())
  t('21 退出码:drift=1 / ok=0 / 未判定默认 0 而 --strict 2', (() => computeExitCode(DRIFT, false) === 1 && computeExitCode(OK, true) === 0 && computeExitCode(UNDET, false) === 0 && computeExitCode(UNDET, true) === 2)())
  t('22 旗标 token 取自声明而非写死(改声明即改判据)', (() => { const d = parseDeclaration(declText({ disabledCollectors: [{ name: 'wal', disableTokens: ['--custom-off=wal'] }] })); const e = d.entries.find((x) => x.name === 'wal'); return e.tokens[0] === '--custom-off=wal' && interpretRegistryChannel({ parsed: reg(regLine('ihui-pg-exporter', ['--custom-off=wal'])), service: 'ihui-pg-exporter', tokens: e.tokens, collector: 'wal' }).state === OK })())
  t('23 两面旗同给 ⇒ 判死(不猜面)', (() => { const s = selectFace({ staged: true, worktree: true, def: 'head' }); return s.face === null && !!s.error })())
  t('24 声明取材面:缺省走 HEAD: 前缀而 --staged 走索引 : 前缀(不得读磁盘)', (() => {
    const seen = []
    const fakeBatch = (root, revs) => { seen.push(...revs); return new Map(revs.map((r) => [r, declText()])) }
    const a = readDeclaration({ root: '/tmp', face: 'head', batchOverride: fakeBatch })
    const b = readDeclaration({ root: '/tmp', face: 'staged', batchOverride: fakeBatch })
    return a.text !== null && b.text !== null && seen[0] === `HEAD:${DECLARATION_REL}` && seen[1] === `:${DECLARATION_REL}`
  })())
  t('25 renderText 在未判定一行里报名字与原因', (() => { const r = { faceLabel: 'HEAD blob', faceNote: 'n', declaration: 'd', collector: 'wal', state: UNDET, exitCode: 0, findings: [], undetermined: ['本机不是监控宿主'], notes: [], channels: [{ channel: 'registry', state: UNDET, reason: '服务不在' }] }; const s = renderText(r); return /未判定/.test(s) && /本机不是监控宿主/.test(s) })())
  t('26 自检不得留"函数当断言"的恒绿(t 只认已求值布尔)', (() => { const c = []; const tt = (n, cond) => c.push({ n, pass: cond === true }); tt('x', () => false); return c[0].pass === false })())

  let bad = 0
  for (const c of cases) {
    if (!c.pass) {
      bad++
      console.log(`  ✖ ${c.name}`)
    } else {
      console.log(`  ✅ ${c.name}`)
    }
  }
  console.log(`自检:${cases.length - bad}/${cases.length} 通过${bad ? ` —— 失败 ${bad} 条` : ''}`)
  return bad === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const wantsJson = argv.includes('--json')
  main({ argv })
    .then(({ exitCode, text, json }) => {
      const body = wantsJson && json ? JSON.stringify(json, null, 2) : text
      if (body) process.stdout.write(String(body) + '\n')
      process.exitCode = exitCode
    })
    .catch((e) => {
      process.stderr.write(`本工具自身异常(未判定,不记为通过):${e?.stack ?? e?.message ?? String(e)}\n`)
      process.exitCode = 2
    })
}

export const __test__ = {
  parseDeclaration,
  judgeVersionedHalf,
  interpretRegistryChannel,
  interpretMetricsChannel,
  combineStates,
  computeExitCode,
  parseArgs,
  readDeclaration,
  readMachineChannels,
  renderText,
  main,
  selfTest,
  httpGet,
  defaultMachineDeps,
  DECLARATION_REL,
  DEFAULT_COLLECTOR,
  METRICS_TIMEOUT_MS,
  METRICS_BODY_CAP,
  OK,
  DRIFT,
  UNDET,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
