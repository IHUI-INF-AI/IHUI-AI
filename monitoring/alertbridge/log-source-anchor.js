// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 日志来源锚点(告警侧的唯一判据)—— G-472 的第二半
// =============================================================================
// 问题(台账 G-472 / G-471 实测形态):Loki 会把"别人发给它的查询语句"原样记进自己的
// querier INFO 行,再由 promtail 收进同一条流;而 postgres_exporter 的 wal 采集器每 15 秒
// 报一次 `source=collector.go msg="collector failed"`。于是任何"applogs 里出现关键字 X 就
// 告警"的日志型判据数到的是**监控自己引用自己**与**采集器噪声**,而不是真实业务错误 ——
// 症状是告警永远压不掉、且看起来像真故障。
//
// 根治分两半:
//   ① 采集侧(已落地 G-592):promtail 把监控自身另立一条流 `job=monitorlogs`;
//   ② 告警侧(本文件):到人链路按那一维分流 —— 采集器/监控自身造成的日志**只报不炸**,
//      不得与真实业务错误共用同一条到人告警。
//
// 为什么判据住在告警侧而不是复制一份名单:标签名与分区取值**一律现读**
// `monitoring/promtail/promtail-config.yml` 的产出(`static_configs[].labels`),
// 本文件不写死第二份名单(两处算同一件事必漂移,本仓记过多次)。两侧各自只带一行
// `LOG_SOURCE_ANCHOR:` 标记(producer 在 promtail,consumer 在 alerts.yml),由本文件的
// 同一个解析函数对账;任一侧改名 ⇒ 判"分流失明",而**绝不猜**。
//
// 失效方向刻意是"少压一条":判不出 ⇒ 全部照旧走到人告警(fail-open),并让
// `ihui_alertbridge_log_anchor_ok` 落 0 ⇒ alerts.yml 的 LogSourceSplitBlind 响。
// 反过来(判不出发"只报不炸")等于把真故障静默藏起来,那比原病更响。
//
// 出口纪律(AGENTS §5e):分流只改变"要不要炸到人",**不新增任何发信通道** ——
// 到人仍只有 Alertmanager → 本目录 bridge → notify-deploy-failure.ts 品牌邮件一条路。
// =============================================================================
'use strict'

const fs = require('fs')
const path = require('path')

/** 采集侧真相源(它同时是 producer 标记的载体) */
const PROMTAIL_REL = 'monitoring/promtail/promtail-config.yml'
/** 规则侧真相源(它同时是 consumer 标记的载体) */
const RULES_REL = 'monitoring/prometheus/alerts.yml'
/** 两侧共用的标记前缀:一行之内给出 label 与两档取值,解析只认这一种形状 */
const MARKER = 'LOG_SOURCE_ANCHOR'

/**
 * 标记行的形状(两侧逐字同形,由同一个函数解析):
 *   LOG_SOURCE_ANCHOR: page={job=~"api|ai-service|applogs"} report-only={job="monitorlogs"}
 * `page=` 后是"照旧到人"的分区集合,`report-only=` 后是"只报不炸"的分区集合。
 */
const MARKER_RE = /LOG_SOURCE_ANCHOR:\s*page=\{([a-zA-Z_][a-zA-Z0-9_]*)=~?"([^"]*)"\}\s+report-only=\{([a-zA-Z_][a-zA-Z0-9_]*)=~?"([^"]*)"\}/

/**
 * 现读 promtail 的 scrape_configs,量出"分区标签 → 该分区接住的 glob 与排除面"。
 * 只做本判据需要的 YAML 子集(不引第三方 YAML,借外部二进制/依赖都是本仓的既有禁区):
 *   - 只认 `static_configs:` 段里的 `labels:` 块(pipeline_stages 里那个 `- labels:` 是
 *     **阶段名**不是标签表,混读会把 `level:` 当分区值);
 *   - `__path__` / `__path_exclude__` 取原样字符串,花括号展开交给 coveredComponents()。
 */
function parsePartitions(text) {
  const lines = String(text || '').split(/\r?\n/)
  const partitions = []
  let inScrape = false
  let current = null
  let section = '' // '' | 'static' | 'pipeline'
  for (const raw of lines) {
    if (/^\S/.test(raw)) {
      inScrape = /^scrape_configs:\s*$/.test(raw)
      current = null
      section = ''
      continue
    }
    if (!inScrape) continue
    const job = raw.match(/^\s*-\s*job_name:\s*['"]?([^'"\s#]+)['"]?\s*$/)
    if (job) {
      current = { jobName: job[1], labels: {}, section: '' }
      partitions.push(current)
      section = ''
      continue
    }
    if (!current) continue
    if (/^\s+static_configs:\s*$/.test(raw)) { section = 'static'; continue }
    if (/^\s+pipeline_stages:\s*$/.test(raw)) { section = 'pipeline'; continue }
    if (section !== 'static') continue
    if (/^\s+labels:\s*$/.test(raw)) continue
    const kv = raw.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.+?)\s*$/)
    if (kv) current.labels[kv[1]] = kv[2].replace(/^['"]/, '').replace(/['"]$/, '')
  }
  return partitions
}

/** 把 `svc-{a,b}-nssm*.log` 这类花括号列表展开成组件名集合(只取本判据要的那一段) */
function coveredComponents(glob) {
  const out = new Set()
  if (!glob) return out
  const brace = String(glob).match(/\{([^}]*)\}/)
  if (brace) for (const one of brace[1].split(',')) out.add(one.trim())
  else {
    const single = String(glob).match(/logs\/svc-([A-Za-z0-9_.-]+?)(?:-\*|\*)?/)
    if (single) out.add(single[1])
  }
  return out
}

/** 解析一行标记 ⇒ {label, page[], self[]};形状不对返回 null */
function parseMarker(text) {
  const m = String(text || '').match(MARKER_RE)
  if (!m) return null
  const split = (s) => String(s).split('|').map((x) => x.trim()).filter(Boolean)
  return { label: m[1], page: split(m[2]), self: split(m[4]) }
}

/** 集合判据:逐字等值且顺序无关 */
function sameSet(a, b) {
  const x = [...new Set(a || [])].sort()
  const y = [...new Set(b || [])].sort()
  return x.length > 0 && x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * 把 producer 侧(promtail)的声明对账到它自己的采集面。
 * 四条都得成立,否则返回问题清单(调用方据此判"分流失明"):
 *   P1 标记行在位且两侧 label 同名(不同名 = 两侧在说两件事)
 *   P2 page / self 两档都不与对方相交(相交 = 同一批日志又炸又不炸)
 *   P3 声明的每个取值都真是 promtail 产出的分区值(名单过期 = 声明对着空气)
 *   P4 self 分区接住的组件,必须出现在应用侧分区的 `__path_exclude__` 里
 *      —— 这正是 G-592 那条"排除面必须与包含面同形"的机器版:不同形就意味着
 *        同一份监控日志既进 monitorlogs 又进 applogs,分流判据当场失去意义。
 */
function auditProducer(promtailText) {
  const problems = []
  const marker = parseMarker(promtailText)
  if (!marker) return { ok: false, problems: ['P1 producer 侧没有可解析的 LOG_SOURCE_ANCHOR 标记行'] }
  const partitions = parsePartitions(promtailText)
  const produced = new Map() // 分区标签名 -> Set(取值)
  const byValue = new Map() // 取值 -> 该分区的 labels(用于 P4)
  for (const p of partitions) {
    for (const [k, v] of Object.entries(p.labels)) {
      if (!produced.has(k)) produced.set(k, new Set())
      produced.get(k).add(v)
      if (k === marker.label) byValue.set(v, p.labels)
    }
  }
  if (!produced.has(marker.label)) problems.push(`P3 promtail 从未产出过标签 ${marker.label}`)
  if (sameSet(marker.page, marker.self)) problems.push('P2 page 与 report-only 两档相交或同为空')
  for (const v of [...marker.page, ...marker.self]) {
    if (!(produced.get(marker.label) || new Set()).has(v)) problems.push(`P3 声明的分区 ${marker.label}=${v} 不在 promtail 产出里`)
  }
  const selfPaths = []
  for (const v of marker.self) {
    const labels = byValue.get(v)
    // 属性名是 `__path__`(尾下划线是 promtail 的保留名写法),写成 labels.__path 会
    // 静默取到 undefined —— 本门第一次自跑就被这一格咬到:P4 报"没接住任何组件 glob"。
    if (labels && labels.__path__) selfPaths.push(labels.__path__)
  }
  const selfComponents = new Set()
  for (const g of selfPaths) for (const c of coveredComponents(g)) selfComponents.add(c)
  if (selfComponents.size === 0) problems.push('P4 report-only 分区没接住任何组件 glob(它是不是被摘了线?)')
  const appExcluded = new Set()
  for (const v of marker.page) {
    const labels = byValue.get(v)
    if (!labels) continue
    for (const c of coveredComponents(labels.__path_exclude__)) appExcluded.add(c)
  }
  for (const c of selfComponents) {
    if (!appExcluded.has(c)) problems.push(`P4 组件 ${c} 同时可能被应用侧收走(应用侧 __path_exclude__ 未同形)`)
  }
  return { ok: problems.length === 0, marker, problems }
}

/**
 * 纯函数版对账(零 IO)—— `resolveAnchor` 只是它的取文件包装。
 * 判据行为必须由构造面证明(本仓的既有取向:证明"取材面/改名"这类行为只能用
 * 纯函数 + 构造面,不得依赖仓库瞬时状态)。
 */
function resolveAnchorFromTexts(promtailText, rulesText) {
  if (typeof promtailText !== 'string') return { ok: false, problems: ['取不到 promtail 配置(无法判定,不猜)'] }
  if (typeof rulesText !== 'string') return { ok: false, problems: ['取不到告警规则(无法判定,不猜)'] }
  const producer = auditProducer(promtailText)
  if (!producer.ok) return { ok: false, problems: producer.problems }
  const consumer = parseMarker(rulesText)
  const problems = []
  if (!consumer) problems.push('C1 规则侧没有可解析的 LOG_SOURCE_ANCHOR 标记行(分流口径被摘线)')
  else {
    if (consumer.label !== producer.marker.label) problems.push(`C2 两侧标签名不同值:规则侧 ${consumer.label} vs 采集侧 ${producer.marker.label}`)
    if (!sameSet(consumer.self, producer.marker.self)) problems.push(`C3 report-only 分区两侧不同值:规则侧 [${consumer.self}] vs 采集侧 [${producer.marker.self}]`)
    if (!sameSet(consumer.page, producer.marker.page)) problems.push(`C4 到人分区两侧不同值:规则侧 [${consumer.page}] vs 采集侧 [${producer.marker.page}]`)
  }
  if (problems.length) return { ok: false, problems }
  return {
    ok: true,
    label: producer.marker.label,
    page: producer.marker.page,
    self: producer.marker.self,
  }
}

/**
 * 现读两侧文件并对账 ⇒ 告警侧可用的锚点表。
 * 任何一步判不出都返回 `{ ok:false, problems }` —— 调用方必须 fail-open(全部照旧到人),
 * 不得把"判不出"读成"这一族没有告警"。
 */
function resolveAnchor(repoRoot) {
  const read = (rel) => {
    try { return fs.readFileSync(path.join(repoRoot, ...rel.split('/')), 'utf8') } catch { return null }
  }
  return resolveAnchorFromTexts(read(PROMTAIL_REL), read(RULES_REL))
}

/**
 * 自写的规则文件结构校验(本机既无 js-yaml 也不引外部二进制 —— 与本仓
 * `scripts/tests/unattended-intake-workflow-two-state.test.mjs` 同一先例:"为一条测试引依赖不值,
 * 且引了会在别的机器上漂")。它判的是**让 promtool/Prometheus 直接拒收整份文件**的那几类形状错:
 *   Y1 单引号不成对 ⇒ YAML 标量把后半行(乃至下一行)吃进去
 *   Y2 每条规则必须齐 alert/expr/for/labels.severity/annotations.summary+description
 *   Y3 规则名全文件唯一(重名 = 一条规则盖住另一条,账面只看得见一个)
 *   Y4 分流失明的 gauge 在文件里恰好被读一次(0 次 = 判据没装车;>1 次 = 两份真相)
 * 返回问题清单,调用方据此判红。
 */
function validateAlertRules(text) {
  const problems = []
  const lines = String(text || '').split(/\r?\n/)
  const seen = new Map()
  let current = null
  const flush = () => {
    if (!current) return
    for (const need of ['expr', 'for', 'severity', 'summary', 'description']) {
      if (!current.has[need]) problems.push(`Y2 规则 ${current.name} 缺 ${need}`)
    }
  }
  lines.forEach((raw, i) => {
    const line = i + 1
    const quoteCount = String(raw).replace(/#.*$/, '').match(/'/g)
    // 注释行里的引号不参与配对(散文里一个 `'` 就成百地冒出来,判它等于造一台恒红尺子)
    if (!/^\s*#/.test(raw) && (raw.match(/'/g) || []).length % 2 !== 0) {
      problems.push(`Y1 第 ${line} 行单引号不成对: ${raw.trim().slice(0, 60)}`)
      void quoteCount
    }
    const alert = raw.match(/^\s*-\s+alert:\s*(\S+)\s*$/)
    if (alert) {
      flush()
      if (seen.has(alert[1])) problems.push(`Y3 规则名重复:${alert[1]}(第 ${seen.get(alert[1])} 行与第 ${line} 行)`)
      else seen.set(alert[1], line)
      current = { name: alert[1], has: {} }
      return
    }
    if (!current) return
    const key = raw.match(/^\s*(expr|for):\s/)
    if (key) current.has[key[1]] = true
    const label = raw.match(/^\s*severity:\s*(\S+)\s*$/)
    if (label) current.has.severity = true
    const ann = raw.match(/^\s*(summary|description):\s*/)
    if (ann) current.has[ann[1]] = true
  })
  flush()
  if (seen.size === 0) problems.push('Y0 规则文件里一条规则都没解析到(空扫不得算通过)')
  const gaugeReads = lines.filter((l) => l.includes('ihui_alertbridge_log_anchor_ok == 0')).length
  if (gaugeReads !== 1) problems.push(`Y4 分流失明 gauge 在规则里被读 ${gaugeReads} 次(应为恰好 1 次)`)
  return { ok: problems.length === 0, problems, ruleCount: seen.size }
}

/**
 * 一批告警 → { page, selfReportOnly }(纯函数,零 IO,零副作用)。
 * - 锚点判不出 ⇒ 全部进 page(少压一条 >> 多压一条);
 * - 只按 `labels[锚点标签]` 分流;取值不在任一档(含没有该标签)一律进 page ——
 *   今天所有指标型规则的 job 是抓取任务名(loki/promtail/alertbridge…),不会等于分区取值,
 *   所以本分流对现有告警的行为改变更为 0,它拦的是"新增日志型判据时把两族并成一条"。
 */
function splitAlertsByLogSource(alerts, anchor) {
  const list = Array.isArray(alerts) ? alerts : []
  if (!anchor || !anchor.ok) return { page: list, selfReportOnly: [] }
  const page = []
  const selfReportOnly = []
  for (const a of list) {
    const value = String((a && a.labels ? a.labels[anchor.label] : '') || '').trim()
    if (anchor.self.includes(value)) selfReportOnly.push(a)
    else page.push(a)
  }
  return { page, selfReportOnly }
}

module.exports = {
  MARKER,
  MARKER_RE,
  PROMTAIL_REL,
  RULES_REL,
  parsePartitions,
  parseMarker,
  coveredComponents,
  auditProducer,
  validateAlertRules,
  resolveAnchorFromTexts,
  resolveAnchor,
  splitAlertsByLogSource,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
