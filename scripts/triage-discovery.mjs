// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是分诊产出器,机器行必须走 stdout */
/**
 * triage-discovery — 感知层自动分诊器(第 1 期器件,2026-10-26 立,票面见 PROJECT_PLAN「第 1 期·感知层自动分诊器」)。
 *
 * 输入 = 尺子产出清单(JSON 数组 / JSONL / 竖线行文本 `source|fingerprint|summary`,
 * 每条含 来源尺子名 + 摘要 + 指纹)。输出 = 分诊三分类(fix-now / dispatchable / observe),
 * 并按 §1「台账只记真工作」门槛做三道防噪音闸:
 *  ① 来源白名单(scripts/data/triage-sources.json,初始只含守门 runner 红项与事故聚类)——
 *     白名单外的源**只计数不进入任何后续档**;
 *  ② 同源去重(按 `来源|指纹` 比对 .ihui-agent/state/triage-dedup.json 已登记集)——
 *     命中即跳过,不重复消耗配额;
 *  ③ 每日登记配额(默认 N=5,可由配置或 --quota 改)——只算 dispatchable 档;
 *     超限**只计数不落登记**,当日计数落 .ihui-agent/state/triage-YYYY-MM-DD.json。
 *
 * 分诊档(§1 门槛的三档交代):
 *  - fix-now      → 当场可修,不占登记配额(修完的证据进提交信息);
 *  - dispatchable → 可派单,生成 live-doc-edit 可用的 REPLACE_FILE 载荷模板并落 state 目录,
 *                   **本器不自动写台账**(登记动作留给人或调用方,避免噪音直写);
 *  - observe      → 观察类,只进 stdout/JSON 产出(交给 commit message),不登记。
 *  档位来源 = 条目自带 `triage` 字段(合法值覆盖一切),否则落来源白名单的 defaultTriage。
 *
 * 判据纪律(与 auto-triage / triage-incidents 同族):
 *  - 登记行带新鲜日期交代(`登记@日/器件;来源;证据`),整行过 `sanitizeHexRuns`
 *    —— 指纹是 hex 串,写进台账行会被守门 117 当短 sha 拒落,身份只住 state;
 *  - 取数面坏 ⇒ 未判定(exit 2)并把原因点名:配置坏 / 去重面 JSON 坏 / 当日配额面 JSON 坏,
 *    绝不把"读不懂"折成"没有历史";输入坏行逐条点名不连坐同批好行;
 *  - 幂等:同一 dispatchable 指纹被接过后写入去重集,再跑必命中 deduped,不会双占配额;
 *  - 不接线进提交链(guardian-runner 零改动),不 spawn live-doc-edit —— 只出模板。
 *
 * 用法:
 *   node scripts/triage-discovery.mjs --in <清单路径> [--config <path>] [--state-dir <dir>]
 *        [--quota N] [--dry-run] [--json]
 *   末行固定:TRIAGE-DISCOVERY accepted=A fixnow=F observe=O deduped=D rejected=R deferred=Q bad=B quota=U/N
 * 退出码:0 = 已判定(含 0 发现);2 = 未判定(输入/配置/去重面/配额面坏,或参数错);3 = 写盘失败。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { sanitizeHexRuns } from './lib/triage-doc-line.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_CONFIG = join(ROOT, 'scripts', 'data', 'triage-sources.json')
export const DEFAULT_STATE_DIR = join(ROOT, '.ihui-agent', 'state')
export const RESULT_PREFIX = 'TRIAGE-DISCOVERY'
export const DEFAULT_QUOTA = 5
export const TRIAGE_CLASSES = Object.freeze(['fix-now', 'dispatchable', 'observe'])
const SUMMARY_MAX = 160
const LINE_MAX = 400

/** 配置/状态面形状坏 —— 调用方必须落「未判定」,不得当空集处理(§0.3)。 */
export class DiscoveryShapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DiscoveryShapeError'
  }
}

/** 白名单配置形状锁:非空 sources、名字唯一、defaultTriage 在闭集内、配额正整数。 */
export function loadSourcesConfig(text) {
  let g
  try {
    g = JSON.parse(text)
  } catch (e) {
    throw new DiscoveryShapeError(`白名单配置非法 JSON:${e?.message ?? e}`)
  }
  if (!g || typeof g !== 'object' || Array.isArray(g)) throw new DiscoveryShapeError('形状坏:配置必须是 JSON 对象')
  if (g.dailyQuota !== undefined && (!Number.isInteger(g.dailyQuota) || g.dailyQuota <= 0)) {
    throw new DiscoveryShapeError(`形状坏:dailyQuota 必须是正整数(实得 ${JSON.stringify(g.dailyQuota)})`)
  }
  if (!Array.isArray(g.sources) || g.sources.length === 0) {
    throw new DiscoveryShapeError('形状坏:sources 必须是非空数组(白名单闭集,不搞万能放行)')
  }
  const seen = new Set()
  for (const [i, s] of g.sources.entries()) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new DiscoveryShapeError(`形状坏:sources[${i}] 必须是对象`)
    const name = typeof s.name === 'string' ? s.name.trim() : ''
    if (!name) throw new DiscoveryShapeError(`形状坏:sources[${i}].name 必须是非空字符串`)
    if (seen.has(name)) throw new DiscoveryShapeError(`形状坏:sources[${i}] 来源「${name}」重复登记`)
    seen.add(name)
    if (!TRIAGE_CLASSES.includes(s.defaultTriage)) {
      throw new DiscoveryShapeError(`形状坏:来源「${name}」defaultTriage 非法:${JSON.stringify(s.defaultTriage)}(闭集:${TRIAGE_CLASSES.join('/')})`)
    }
  }
  return g
}

/**
 * 输入清单解析:JSON 数组 → JSONL → 竖线行文本 `source|fingerprint|summary` 三形都吃。
 * 坏行单列(line + reason),不连坐好行(与 triage-incidents 同口径)。
 */
export function parseFindings(text) {
  const rows = []
  const bad = []
  const s = String(text ?? '').trim()
  if (!s) return { rows, bad: [{ line: 0, reason: '输入为空(空清单也要显式给,不静默当无发现)' }] }
  let doc = null
  try {
    doc = JSON.parse(s)
  } catch {
    doc = null
  }
  const push = (i, o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      bad.push({ line: i, reason: '条目必须是 JSON 对象' })
      return
    }
    const source = typeof o.source === 'string' ? o.source.trim() : ''
    const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
    const fingerprint = typeof o.fingerprint === 'string' ? o.fingerprint.trim() : ''
    if (!source || !summary || !fingerprint) {
      bad.push({ line: i, reason: '缺 source/summary/fingerprint 之一(尺子产出三要素不许猜)' })
      return
    }
    const row = { line: i, source, summary: summary.replace(/\s+/g, ' ').slice(0, SUMMARY_MAX), fingerprint }
    if (o.triage !== undefined) {
      if (!TRIAGE_CLASSES.includes(o.triage)) {
        bad.push({ line: i, reason: `triage 非法:${JSON.stringify(o.triage)}(闭集:${TRIAGE_CLASSES.join('/')})` })
        return
      }
      row.triage = o.triage
    }
    rows.push(row)
  }
  if (Array.isArray(doc)) {
    doc.forEach((o, i) => push(i + 1, o))
    return { rows, bad }
  }
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      if (line.startsWith('{')) {
        try {
          push(i + 1, JSON.parse(line))
        } catch (e) {
          bad.push({ line: i + 1, reason: `JSON 解析失败:${e?.message ?? e}` })
        }
        return
      }
      const parts = line.split('|')
      if (parts.length < 3) {
        bad.push({ line: i + 1, reason: '行文本需为 source|fingerprint|summary(三段起)' })
        return
      }
      push(i + 1, { source: parts[0], fingerprint: parts[1], summary: parts.slice(2).join('|') })
    })
  return { rows, bad }
}

/** 去重键:同源同指纹才算同一件事(跨源同指纹不并档,防一个源的登记吞掉另一源的真发现)。 */
export function dedupKeyOf(source, fingerprint) {
  return `${source}|${fingerprint}`
}

/** 去重面解析:JSON 坏 ⇒ throw(去重面不可信时不能保证幂等,必须落未判定)。 */
export function readDedupText(text) {
  let g
  try {
    g = JSON.parse(text)
  } catch (e) {
    throw new DiscoveryShapeError(`去重面 JSON 坏:${e?.message ?? e}`)
  }
  if (!g || typeof g !== 'object' || !Array.isArray(g.entries)) {
    throw new DiscoveryShapeError('形状坏:去重面必须是 {version, entries:[…]}')
  }
  return g
}

/** 当日配额面解析:JSON 坏 ⇒ throw(配额面不可信时超限照登的噪音事故就拦不住)。 */
export function readDailyStateText(text) {
  let g
  try {
    g = JSON.parse(text)
  } catch (e) {
    throw new DiscoveryShapeError(`当日配额面 JSON 坏:${e?.message ?? e}`)
  }
  if (!g || typeof g !== 'object' || !Number.isInteger(g.registered) || g.registered < 0) {
    throw new DiscoveryShapeError('形状坏:当日配额面必须带非负整数 registered')
  }
  return g
}

/** 本地日切(auto-triage 同口径:不用 UTC 串直接比本地日)。 */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 登记行(新鲜日期交代三选一之「登记@日」档)。
 * 指纹**不进文档**:hex 串会被守门 117 判短 sha,身份只住 state;整行再兜一次 sanitizeHexRuns。
 */
export function buildRegistrationLine({ source, summary, day }) {
  const s = String(summary ?? '').replace(/\s+/g, ' ').trim()
  const line = `- [ ] {{NEXT_ID:G}} [triage-discovery] ${s}(登记@${day}/triage-discovery;来源:${source};证据:${source} 尺子产出,指纹见 state 台账)`
  return sanitizeHexRuns(line).slice(0, LINE_MAX)
}

/**
 * dispatchable 档的 live-doc-edit REPLACE_FILE 载荷模板。
 * `before` 刻意留占位:整行改写档要求 before 在 HEAD **恰好命中 1 次**且总行数不变,
 * 本器不读台账、不猜锚点 —— 占位串永不命中,live-doc-edit 会按"0 命中"拒落(失败方向安全),
 * 由登记人现读台账后填锚点行,或改走插入档(LIVE_BLOCK_FILE)落同一行。
 */
export function buildReplaceTemplate({ source, summary, fingerprint, day }) {
  const after = buildRegistrationLine({ source, summary, day })
  return {
    v: 1,
    fingerprint,
    env: {
      LIVE_DOC: 'PROJECT_PLAN.md',
      LIVE_REPLACE_FILE: '<本模板文件路径>',
      LIVE_MSG: `docs(plan): triage-discovery 登记(${source};第 1 期感知层,O65)`,
    },
    payload: [
      {
        before: '<登记人现读台账后填:被改写行的逐字全文>',
        after,
      },
    ],
    hint: 'REPLACE_FILE 档总行数不变;若目标是新增登记行,把 after 单行改走 LIVE_BLOCK_FILE 插入档,本模板的 after 行逐字可用。',
  }
}

/**
 * 分诊主判据(纯函数,零盘零网络):白名单 → 去重 → 三分类 → 配额。
 * `dedupKeys` = 去重面已登记键集合(Set 或数组);`usedToday` = 当日配额面现读已用数。
 */
export function planTriage({ config, rows, dedupKeys = new Set(), usedToday = 0, quota, now = new Date() }) {
  const q = Number.isInteger(quota) && quota > 0 ? quota : config.dailyQuota ?? DEFAULT_QUOTA
  const byName = new Map(config.sources.map((s) => [s.name, s]))
  const seen = dedupKeys instanceof Set ? dedupKeys : new Set(dedupKeys)
  const day = localDay(now)
  const out = {
    day,
    quota: q,
    accepted: [],
    fixNow: [],
    observe: [],
    deduped: [],
    rejectedSource: [],
    quotaDeferred: [],
    bad: [],
  }
  let used = usedToday
  for (const r of rows) {
    const src = byName.get(r.source)
    if (!src) {
      out.rejectedSource.push({ source: r.source, fingerprint: r.fingerprint, summary: r.summary })
      continue
    }
    const key = dedupKeyOf(r.source, r.fingerprint)
    if (seen.has(key)) {
      out.deduped.push({ key, source: r.source, summary: r.summary })
      continue
    }
    const cls = r.triage ?? src.defaultTriage
    if (cls === 'fix-now') {
      out.fixNow.push({ source: r.source, fingerprint: r.fingerprint, summary: r.summary })
      continue
    }
    if (cls === 'observe') {
      out.observe.push({ source: r.source, fingerprint: r.fingerprint, summary: r.summary })
      continue
    }
    if (used >= q) {
      out.quotaDeferred.push({ source: r.source, fingerprint: r.fingerprint, summary: r.summary, why: `今日已登记 ${used}/${q}` })
      continue
    }
    used += 1
    seen.add(key)
    out.accepted.push({
      key,
      source: r.source,
      fingerprint: r.fingerprint,
      summary: r.summary,
      template: buildReplaceTemplate({ source: r.source, summary: r.summary, fingerprint: r.fingerprint, day }),
    })
  }
  out.registeredToday = used
  return out
}

const KNOWN_FLAGS = new Set(['--in', '--config', '--state-dir', '--quota', '--dry-run', '--json'])

function pathFlag(argv, flag, errors) {
  const r = requireFlagValue(argv, flag, { noun: '路径' })
  if (r.error) {
    errors.push(r.error)
    return null
  }
  return r.value
}

/** CLI 参数解析:未知旗标/吞值/非正整数一律 usage 错(调用方据此 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  const input = pathFlag(argv, '--in', errors)
  if (!input) errors.push('缺少 --in <尺子产出清单路径>(必填,本器不猜默认输入面)')
  const configPath = pathFlag(argv, '--config', errors)
  const stateDir = pathFlag(argv, '--state-dir', errors)
  const q = requireFlagValue(argv, '--quota', { noun: '正整数' })
  if (q.error) errors.push(q.error)
  let quota = null
  if (q.present) {
    if (!/^\d+$/.test(q.value) || Number(q.value) < 1) errors.push(`--quota 需要正整数,实得 ${JSON.stringify(q.value)}`)
    else quota = Number(q.value)
  }
  return {
    input,
    configPath,
    stateDir,
    quota,
    dryRun: argv.includes('--dry-run'),
    json: argv.includes('--json'),
    errors,
  }
}

function readOpt(path) {
  try {
    return { text: readFileSync(path, 'utf8') }
  } catch (e) {
    if (e?.code === 'ENOENT') return { text: null }
    return { error: e }
  }
}

export function main(argv = []) {
  const args = parseArgs(argv)
  if (args.errors.length > 0) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error('未判定:参数错误,未产生任何分诊结论')
    return 2
  }
  const now = new Date()
  const configPath = resolve(args.configPath ?? DEFAULT_CONFIG)
  const stateDir = resolve(args.stateDir ?? DEFAULT_STATE_DIR)
  const dedupPath = join(stateDir, 'triage-dedup.json')
  const dayPath = join(stateDir, `triage-${localDay(now)}.json`)

  const cfgRes = readOpt(configPath)
  if (cfgRes.error) {
    console.error(`未判定:白名单配置读不到 ${configPath}(${cfgRes.error?.code ?? cfgRes.error?.message})`)
    return 2
  }
  let config
  try {
    config = loadSourcesConfig(cfgRes.text)
  } catch (e) {
    console.error(`未判定:${e?.message ?? e}`)
    return 2
  }

  const inRes = readOpt(resolve(args.input))
  if (inRes.error || inRes.text === null) {
    console.error(`未判定:输入清单读不到 ${resolve(args.input)}(${inRes.error?.code ?? '缺失'})`)
    return 2
  }
  const parsed = parseFindings(inRes.text)

  const dedupRes = readOpt(dedupPath)
  if (dedupRes.error) {
    console.error(`未判定:去重面读不到 ${dedupPath}(${dedupRes.error?.code ?? dedupRes.error?.message})`)
    return 2
  }
  let dedup = { version: 1, entries: [] }
  if (dedupRes.text !== null) {
    try {
      dedup = readDedupText(dedupRes.text)
    } catch (e) {
      console.error(`未判定:去重面不可信,不能保证幂等 —— ${e?.message ?? e}`)
      return 2
    }
  }

  const dayRes = readOpt(dayPath)
  if (dayRes.error) {
    console.error(`未判定:当日配额面读不到 ${dayPath}(${dayRes.error?.code ?? dayRes.error?.message})`)
    return 2
  }
  let dayState = null
  if (dayRes.text !== null) {
    try {
      dayState = readDailyStateText(dayRes.text)
    } catch (e) {
      console.error(`未判定:配额面不可信,超限拦不住噪音 —— ${e?.message ?? e}`)
      return 2
    }
  }

  const plan = planTriage({
    config,
    rows: parsed.rows,
    dedupKeys: new Set(dedup.entries.map((e) => e.key)),
    usedToday: dayState?.registered ?? 0,
    quota: args.quota,
    now,
  })
  for (const b of parsed.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)

  if (!args.dryRun && plan.accepted.length > 0) {
    try {
      mkdirSync(stateDir, { recursive: true })
      for (const a of plan.accepted) {
        const safeFp = String(a.fingerprint).replace(/[^0-9a-zA-Z._-]/g, '').slice(0, 32) || 'x'
        a.payloadPath = join(stateDir, `triage-discovery-${plan.day}-${safeFp}.replace.json`)
        writeFileSync(a.payloadPath, JSON.stringify(a.template, null, 2), 'utf8')
      }
      const entries = [...dedup.entries]
      for (const a of plan.accepted) {
        entries.push({ key: a.key, source: a.source, fingerprint: a.fingerprint, at: now.toISOString(), summary: a.summary, payload: a.payloadPath })
      }
      writeFileSync(dedupPath, JSON.stringify({ version: 1, updatedAt: now.toISOString(), entries }, null, 2), 'utf8')
      writeFileSync(
        dayPath,
        JSON.stringify(
          {
            date: plan.day,
            quota: plan.quota,
            registered: plan.registeredToday,
            counts: {
              accepted: plan.accepted.length,
              fixNow: plan.fixNow.length,
              observe: plan.observe.length,
              deduped: plan.deduped.length,
              rejectedSource: plan.rejectedSource.length,
              quotaDeferred: plan.quotaDeferred.length,
              bad: parsed.bad.length,
            },
            updatedAt: now.toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      )
    } catch (e) {
      console.error(`写盘失败:${e?.message ?? e}(未声称成功)`)
      return 3
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ ...plan, bad: parsed.bad }, null, 2))
  } else {
    console.log(`分诊轮 ${plan.day}:输入 ${parsed.rows.length} 条,配额 ${plan.registeredToday}/${plan.quota}${args.dryRun ? '(dry-run 不落盘)' : ''}`)
    for (const a of plan.accepted) console.log(`  → dispatchable:${a.source} ${a.summary}${a.payloadPath ? ` ⇒ 模板 ${a.payloadPath}` : ''}`)
    for (const f of plan.fixNow) console.log(`  ✚ fix-now:${f.source} ${f.summary}`)
    for (const o of plan.observe) console.log(`  · observe:${o.source} ${o.summary}`)
    for (const d of plan.deduped) console.log(`  ⏭ deduped:${d.source} ${d.summary}`)
    for (const r of plan.rejectedSource) console.log(`  ⛔ 白名单外:${r.source} ${r.summary}`)
    for (const q of plan.quotaDeferred) console.log(`  ⏸ 配额满待明日:${q.source} ${q.summary}(${q.why})`)
  }
  console.log(
    `${RESULT_PREFIX} accepted=${plan.accepted.length} fixnow=${plan.fixNow.length} observe=${plan.observe.length} deduped=${plan.deduped.length} rejected=${plan.rejectedSource.length} deferred=${plan.quotaDeferred.length} bad=${parsed.bad.length} quota=${plan.registeredToday}/${plan.quota}`,
  )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  TRIAGE_CLASSES,
  DEFAULT_QUOTA,
  RESULT_PREFIX,
  DEFAULT_CONFIG,
  DEFAULT_STATE_DIR,
  DiscoveryShapeError,
  loadSourcesConfig,
  parseFindings,
  dedupKeyOf,
  readDedupText,
  readDailyStateText,
  localDay,
  buildRegistrationLine,
  buildReplaceTemplate,
  planTriage,
  parseArgs,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
