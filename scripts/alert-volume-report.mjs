#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警与跳门总量量算仪(**只读**,不修任何东西)。
 *
 * 为什么缺这一格(2026-09-27 实测,AGENTS §12f):
 *   一天之内三道 blocking 检查红在**已入库**代码上,后果不是"少一项检查",而是每次提交都被迫
 *   `--no-verify`,链上约 180 道检查对每次提交全部作废 —— 而账面全绿。发现手段只有"自己的提交被挡了",
 *   所以**修好三道也只是修好恰好被看到的那三道**。邮件侧同一台机当天出现"凌晨 4 点一小时寄 16 封"
 *   的风暴(根因:去重签名里嵌了每轮自增的计数),但**没有任何一处能回答"这周到底寄了多少封、都是谁寄的"**。
 *   缺的就是这台总量量算仪。
 *
 * 它刻意**不是**守门:文件名不以 `check|scan|guard` 开头,守门 89 / 118 结构上看不见它(这是预期 ——
 * 它是人读的体检报告,不进提交链,在提交链上它是零调度器)。它的不变量由自己那把尺子钉:
 *   - `--self-test`(临时夹具,成对正反例)
 *   - 镜像测试 `scripts/tests/alert-volume-report.test.mjs`(§22c:只 import 判据,**不复制实现**)
 * 先例:`scripts/c-disk-breakdown.mjs`(同为"量算仪 + 自带尺子",都不做任何删除/写入)。
 *
 * 三条不可动摇的口径:
 *   1. **量不到必须喊"未判定"并给原因,绝不静默算 0**(参照 `check-c-drive-pollution.mjs` 的
 *      registered/unregistered/undetermined 三态、`c-disk-breakdown.mjs` 的"量不到不得伪装成结论")。
 *      文件不存在 / 注册表取不到 / 日志被尾部截断 / JSON 解不出 —— 每一支都有独立计数并报名。
 *   2. **绝不解码中文**。`deploy/win/deploy-loop.log` 实测是 **GBK 与 UTF-8 混合**、且部分字节已被替换成
 *      `efbfbd`(双重损坏),任何单码解码都会把中文变乱码;而用中文模式串 grep 会"零命中"并让人判成
 *      "一封没寄"(2026-09-27 真发生过一次假零)。判据一律只用 **ASCII 关键字 + 时间戳前缀**。
 *   3. **不打印邮件正文里的任何内容**:风暴点名只给时间戳 + ASCII 关键字 + 签名短哈希;签名索引里的
 *      片段是逐字符筛出的**纯 ASCII**(中文整段丢弃),邮箱本地段已掩码。
 *
 * 用法:node scripts/alert-volume-report.mjs [--json] [--self-test] [--hours N] [--days N] [--staged]
 *   --staged 只影响"门号→脚本"反查取哪一面的注册表(索引优先),默认取 HEAD。
 * 退出码:0 = 报告已产出(有风暴也是 0 —— 它是量算仪,不是判据,不阻断任何东西);
 *         1 = `--self-test` 有失败例;2 = 脚本自身异常(取数层抛出,不是业务结论)。
 * **本脚本不写盘、不发消息、不重启服务、不跑构建。**(唯一的写路径在 `selfTest()` 里,经
 * `scripts/lib/scratch-dir.mjs` 落仓库外临时区;镜像测试有源码锁钉住这一点。)
 */
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/** 四个数据源 + 一份注册表,路径全部由脚本自身位置推导(§15,不写死盘符)。 */
const SRC = {
  deployLog: join(ROOT, 'deploy', 'win', 'deploy-loop.log'),
  alertState: join(ROOT, 'deploy', 'win', '.alert-notify-state.json'),
  dedupeState: join(ROOT, '.workbuddy', 'notify-dedupe-state.json'),
  attest: join(ROOT, '.workbuddy', 'safe-commit-attestation.jsonl'),
  runner: 'scripts/guardian-runner.mjs', // 注册表按"被审面"取,不读滞后的工作树副本
}

/** 尾部读取上限:真仓日志现读约 21 MB,给足余量;超了就只读尾部并如实报"前面没看见"。 */
const MAX_LOG_BYTES = 64 * 1024 * 1024
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
/** 风暴判据:同一件事(签名归一后同键)在此窗口内 ≥2 封。 */
const STORM_WINDOW_MS = HOUR
const STORM_MIN = 2

const HOUR_KEY = (ms) => new Date(ms).toISOString().slice(0, 13)
const DAY_KEY = (ms) => new Date(ms).toISOString().slice(0, 10)

/** `[2026-09-27 04:46:07 +00:00]` —— 只认这一种形状;解不出的行落"无时间戳"计数,不参与判据。 */
const TS_RE = /^\[(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*([+-]\d{2}):?(\d{2}))?\]/
/**
 * 剥掉所有 `[...]` 前缀后的第一个全大写 ASCII 词 = 关键字(MAIL / ALERT / BLOCKED-WIP / SKIP / …)。
 * `^\s*` 不是洁癖:真行形如 `[ts] [deploy] [ts] MAIL  …`,时间戳右括号到 `[deploy]` 之间**必有一个空格**,
 * 不认这个空格会让本判据对**整个日志**失明( mails 恒 0)—— 自检 S2 就是抓这一手的。
 */
const KW_RE = /^\s*(?:\[[^\]]*\]\s*)*([A-Z][A-Z0-9_-]{1,24})(?=\s|$)/

/** 纯 ASCII 片段:非 ASCII 字符**连同 mojibake 一起**丢弃,只留可打印 ASCII;邮箱本地段掩码。 */
export function asciiFragment(raw, max = 60) {
  const only = String(raw).replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim()
  return maskLocalPart(only).slice(0, max)
}

/** `abc@dom` → `***@dom`:收件地址的本地段不参与"是哪件事"的识别,更不得整份进报告。 */
export function maskLocalPart(s) {
  return String(s).replace(/[\w.+-]+(?=@[\w.-]+\.\w+)/g, '***')
}

/**
 * 签名的归一形态 —— **数字(含小数/千分位)一律折成单个 `#`**。
 * 为什么必须有这一步:2026-09-27 那台风暴的根因就是"去重签名里嵌了每轮自增的计数",于是同一件事
 * 在账面上长成 N 个不同签名,去重与统计同时失效。量算仪若按原文分组,就是**用同一条错误口径去量
 * 那个错误**,必然报出"没有风暴"。折掉数字后才谈得上"同一件事"。
 */
export function normalizeSig(rest) {
  return String(rest)
    .replace(/\s+/g, ' ')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .trim()
}

/** 短哈希当签名 ID:报告里只出现它,原文不外泄。 */
export function sigId(sig) {
  return createHash('sha1').update(sig, 'latin1').digest('hex').slice(0, 10)
}

/** 一行日志 → `{ms, keyword, rest}` | null。 */
export function parseLogLine(line) {
  const m = TS_RE.exec(line)
  if (!m) return null
  const [, d, hh, mm, ss, tzH, tzM] = m
  const tz = tzH === undefined ? '+00:00' : `${tzH}:${tzM || '00'}`
  const ms = Date.parse(`${d}T${hh}:${mm}:${ss}${tz}`)
  if (!Number.isFinite(ms)) return null
  const rest = line.slice(m[0].length)
  const k = KW_RE.exec(rest)
  return { ms, keyword: k ? k[1] : null, rest: k ? rest.slice(k[0].length) : rest }
}

/**
 * 发信面量算。**返回三态**:判到了什么 / 没判到什么 + 原因。
 * @param {string} text latin1 解出的日志尾部(字节保真;中文不解码)
 */
export function scanMailLog(text, { nowMs, hours = 24, days = 7 }) {
  const lines = text.split(/\r?\n/)
  const mails = []
  const alerts = []
  let timestamped = 0
  let untimestamped = 0
  let keywordless = 0
  const keywordCounts = {}
  let lastTsMs = null
  for (const line of lines) {
    if (!line) continue
    const p = parseLogLine(line)
    if (!p) {
      untimestamped++
      continue
    }
    timestamped++
    if (lastTsMs === null || p.ms > lastTsMs) lastTsMs = p.ms
    if (!p.keyword) {
      keywordless++
      continue
    }
    keywordCounts[p.keyword] = (keywordCounts[p.keyword] || 0) + 1
    if (p.keyword === 'MAIL') {
      const sig = normalizeSig(p.rest)
      mails.push({ ms: p.ms, sig, id: sigId(sig), ascii: asciiFragment(p.rest) })
    } else if (p.keyword === 'ALERT') {
      alerts.push({ ms: p.ms })
    }
  }
  const windows = {
    [`${hours}h`]: windowStats(mails, alerts, nowMs - hours * HOUR, nowMs, 'hourly'),
    [`${days}d`]: windowStats(mails, alerts, nowMs - days * DAY, nowMs, 'daily'),
  }
  return {
    mails,
    alerts,
    totals: { lines: lines.length, timestamped, untimestamped, keywordless, mail: mails.length, alertSkipped: alerts.length },
    keywordCounts,
    windows,
    lastTsMs,
  }
}

function windowStats(mails, alerts, fromMs, toMs, bucketKind) {
  const inWin = mails.filter((e) => e.ms >= fromMs && e.ms <= toMs)
  const alertSkipped = alerts.filter((e) => e.ms >= fromMs && e.ms <= toMs).length
  const bySig = new Map()
  const buckets = new Map()
  for (const e of inWin) {
    bySig.set(e.id, (bySig.get(e.id) || 0) + 1)
    const key = bucketKind === 'hourly' ? HOUR_KEY(e.ms) : DAY_KEY(e.ms)
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  const asciiOf = new Map(inWin.map((e) => [e.id, e.ascii]))
  return {
    fromMs,
    toMs,
    mailCount: inWin.length,
    alertSkipped,
    distinctSignatures: bySig.size,
    bySignature: [...bySig.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([id, n]) => ({ id, n, ascii: asciiOf.get(id) ?? '' })),
    ...(bucketKind === 'hourly' ? { hourly: [...buckets.entries()].sort(byKey) } : { daily: [...buckets.entries()].sort(byKey) }),
    storms: findStorms(inWin),
  }
}

const byKey = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

/**
 * 风暴判据:同一签名在 `windowMs` 内 ≥ `min` 封。
 * 滑窗取**极大簇**(簇内成员不再参与下一簇),免得 16 封产出一堆重叠报告。
 */
export function findStorms(entries, { windowMs = STORM_WINDOW_MS, min = STORM_MIN } = {}) {
  const bySig = new Map()
  for (const e of entries) {
    if (!bySig.has(e.id)) bySig.set(e.id, [])
    bySig.get(e.id).push(e)
  }
  const out = []
  for (const [id, list] of bySig) {
    const sorted = [...list].sort((a, b) => a.ms - b.ms)
    let i = 0
    while (i < sorted.length) {
      let j = i
      while (j + 1 < sorted.length && sorted[j + 1].ms - sorted[i].ms < windowMs) j++
      const n = j - i + 1
      if (n >= min) {
        out.push({
          id,
          count: n,
          ascii: sorted[i].ascii,
          spanMs: sorted[j].ms - sorted[i].ms,
          // 只给时间戳与关键字:不得打印邮件正文里的任何内容
          lines: sorted.slice(i, j + 1).map((e) => ({ ts: new Date(e.ms).toISOString(), keyword: 'MAIL' })),
        })
        i = j + 1
      } else i++
    }
  }
  return out.sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1))
}

/**
 * 跳门面:`.workbuddy/safe-commit-attestation.jsonl` 是跳门次数的**唯一真值来源**(AGENTS §12f)。
 * 坏行单独计数并报行号 —— 解不出的行**不得**被算成"没有跳过",也不得混进总数。
 */
export function parseAttestation(text, { nowMs, hours = 24, days = 7 }) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const entries = []
  const badLines = []
  lines.forEach((l, i) => {
    let o
    try {
      o = JSON.parse(l)
    } catch (e) {
      badLines.push({ n: i + 1, err: String((e && e.message) || e).slice(0, 80) })
      return
    }
    if (o === null || typeof o !== 'object' || Array.isArray(o)) {
      badLines.push({ n: i + 1, err: `顶层不是对象(实得 ${Array.isArray(o) ? 'array' : String(o).slice(0, 20)})` })
      return
    }
    const ms = Date.parse(String(o.ts ?? ''))
    entries.push({
      ms: Number.isFinite(ms) ? ms : null,
      kind: typeof o.kind === 'string' ? o.kind : '(缺 kind)',
      ranFullBatch: o.ranFullBatch === true,
      ranFullBatchMissing: typeof o.ranFullBatch !== 'boolean',
      failedGates: Array.isArray(o.failedGates) ? o.failedGates.map(String) : [],
      failedGatesMissing: !Array.isArray(o.failedGates),
      declaredFiles: Array.isArray(o.declaredFiles) ? o.declaredFiles : [],
    })
  })
  const aggregate = (list) => {
    const kinds = {}
    const byGate = new Map()
    let noBatch = 0
    for (const e of list) {
      kinds[e.kind] = (kinds[e.kind] || 0) + 1
      if (!e.ranFullBatch) noBatch++ // 字段缺席也按"没跑完整批"计 —— 宁可多问一句,不把"没记"当"跑过"
      for (const g of e.failedGates) byGate.set(g, (byGate.get(g) || 0) + 1)
    }
    return {
      skips: list.length,
      kinds,
      noBatchCount: noBatch,
      gates: [...byGate.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([id, n]) => ({ id, n })),
    }
  }
  const dated = entries.filter((e) => e.ms !== null)
  const inWin = (spanMs) => dated.filter((e) => e.ms >= nowMs - spanMs && e.ms <= nowMs)
  return {
    entries,
    totals: {
      lines: lines.length,
      parsed: entries.length,
      badLines: badLines.length,
      undated: entries.length - dated.length,
      ranFullBatchFieldMissing: entries.filter((e) => e.ranFullBatchMissing).length,
      failedGatesFieldMissing: entries.filter((e) => e.failedGatesMissing).length,
    },
    badLines,
    tsRange: dated.length ? [Math.min(...dated.map((e) => e.ms)), Math.max(...dated.map((e) => e.ms))] : null,
    all: aggregate(entries),
    windows: { [`${hours}h`]: aggregate(inWin(hours * HOUR)), [`${days}d`]: aggregate(inWin(days * DAY)) },
  }
}

/**
 * 注册表 id → script 反查。**本文件不硬编码门号清单**(豁免/编号清单必然腐烂,本仓反复记过)。
 * 逐条目扫:`id:` 开一条,其后第一个 `script:` 归它;没有 script 的条目记 null ——
 * 而不是位置错位认领邻门(那等于把别人的门说成我的,反查结论直接错)。
 * 两种引号形态都要认:双引号 id 对一切按单引号解析注册表的判据隐身(本仓真踩过)。
 */
export function parseRegistry(text) {
  const re = /^[ \t]{4}(id|script):\s*(['"])([^'"]*)\2/gm
  const map = new Map()
  const dupIds = []
  let cur = null
  const close = () => {
    if (cur !== null && !map.has(cur)) map.set(cur, null)
  }
  let m
  while ((m = re.exec(text))) {
    const field = m[1]
    const val = m[3]
    if (field === 'id') {
      close()
      if (map.has(val)) dupIds.push(val)
      cur = val
    } else if (field === 'script' && cur !== null && !map.has(cur)) {
      map.set(cur, val)
      cur = null // 本条已闭合;后面再出现 script 说明解析走偏,宁可留 null 也不错位认领
    }
  }
  close()
  return { map, entries: map.size, dupIds: [...new Set(dupIds)] }
}

/**
 * 注册表面:默认读 **HEAD**,`--staged` 读**索引**;一条规格取不到才退到另一面,并在结论里报名。
 * 为什么不能读工作树:`guardian-runner.mjs` 的磁盘副本常年滞后 HEAD(2026-09-26 实测少 3 道门),
 * 按磁盘反查会把"刚注册的门"报成"找不到 id"——那是尺子坏了,不是世界缺门。
 */
export function loadRegistry(root, face = 'head') {
  const specs = face === 'staged' ? [`:${SRC.runner}`, `HEAD:${SRC.runner}`] : [`HEAD:${SRC.runner}`, `:${SRC.runner}`]
  let blobs
  try {
    blobs = catBatch(root, specs)
  } catch (e) {
    const reason = e instanceof Undetermined ? e.message : String((e && e.message) || e)
    return { ok: false, reason: `注册表 git 取材失败(${face}): ${reason.slice(0, 160)}` }
  }
  for (const spec of specs) {
    const text = blobs.get(spec)
    if (!text) continue
    const usedFace = spec.startsWith('HEAD') ? 'HEAD' : '索引'
    const r = parseRegistry(text)
    if (r.entries === 0)
      return { ok: false, reason: `注册表(${usedFace} 面)解析到 0 条 id/script 对 ⇒ 判"尺子失效",不得据此说"没有门"` }
    return { ok: true, face: usedFace, ...r }
  }
  return { ok: false, reason: `注册表在 ${specs.join(' / ')} 两个面都取不到` }
}

/** 部署环同签名状态(repeatNo 现值)。签名含中文 ⇒ 只出短哈希与 ASCII 片段。 */
export function interpretAlertState(raw) {
  if (raw === null)
    return { state: 'absent', reason: '同签名状态文件不存在(该链尚未跑过,或生产者未落盘)⇒ repeatNo 未判定,不得读成"0 次重复"' }
  if (raw.bad) return { state: 'unparseable', reason: raw.bad }
  const o = raw.value
  if (o === null || typeof o !== 'object') return { state: 'unparseable', reason: `形态不是对象(实得 ${typeof o})` }
  const sig = typeof o.sig === 'string' ? normalizeSig(o.sig) : ''
  return {
    state: 'ok',
    repeatNo: Number.isFinite(Number(o.repeatNo)) ? Number(o.repeatNo) : null,
    sigTs: o.sigTs ?? null,
    sigFirstTs: o.sigFirstTs ?? null,
    sigId: sig ? sigId(sig) : '(无 sig 字段)',
    sigAscii: sig ? asciiFragment(o.sig, 60) : '',
  }
}

/** 发信出口按标识去重台账:**不存在 ≠ 零发信**。 */
export function interpretDedupe(raw, { nowMs }) {
  if (raw === null)
    return {
      state: 'absent',
      reason: '台账文件不存在 ⇒ 尚未有人用 --alert-id 寄出过(未启用)。这一格未判定:不得读成"零发信",也不得读成"去重没生效"',
    }
  if (raw.bad) return { state: 'unparseable', reason: raw.bad }
  const o = raw.value
  if (o === null || typeof o !== 'object' || Array.isArray(o))
    return { state: 'unparseable', reason: `台账形态不是对象(实得 ${Array.isArray(o) ? 'array' : typeof o})` }
  const ids = Object.keys(o)
  const fresh = ids.filter((k) => {
    const ts = Number(o[k] && o[k].ts)
    return Number.isFinite(ts) && nowMs - ts <= 4 * HOUR
  })
  const noTs = ids.filter((k) => !Number.isFinite(o[k] && Number(o[k].ts)))
  return { state: 'ok', entries: ids.length, within4h: fresh.length, malformedTs: noTs.length, ids: ids.slice(0, 20) }
}

/** 读文本尾部(latin1:字节保真,中文不解码)。截断必须回报,否则"7d 计数 0"会被读成事实。 */
export function readTextTail(path, maxBytes = MAX_LOG_BYTES) {
  if (!existsSync(path)) return { ok: false, reason: `不存在:${path}` }
  let size
  try {
    size = statSync(path).size
  } catch (e) {
    return { ok: false, reason: `stat 失败:${e.message}` }
  }
  const len = Math.min(size, maxBytes)
  const skip = size - len
  const buf = Buffer.alloc(len)
  let fd
  let got = 0
  try {
    fd = openSync(path, 'r')
    while (got < len) {
      const n = readSync(fd, buf, got, len - got, skip + got)
      if (n <= 0) break
      got += n
    }
  } catch (e) {
    return { ok: false, reason: `读失败:${e.message}` }
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        /* 关闭失败不改结论 */
      }
    }
  }
  let text = buf.slice(0, got).toString('latin1')
  let droppedHead = 0
  if (skip > 0) {
    const nl = text.indexOf('\n')
    droppedHead = nl < 0 ? text.length : nl + 1
    text = text.slice(droppedHead) // 尾部切片头一条必是半行,丢掉而不是判成"无时间戳行"
  }
  const headBytesLost = skip + droppedHead
  return { ok: true, text, sizeBytes: size, scannedBytes: got, truncated: headBytesLost > 0, headBytesLost }
}

function readJsonFile(path) {
  if (!existsSync(path)) return null
  let raw
  try {
    raw = readFileSync(path, 'latin1')
  } catch (e) {
    return { bad: `读取失败:${e.message}` }
  }
  try {
    return { value: JSON.parse(raw) }
  } catch (e) {
    return { bad: `JSON 解不出:${String((e && e.message) || e).slice(0, 120)}` }
  }
}

function rel(p) {
  const r = String(p).split('\\').join('/')
  const root = ROOT.split('\\').join('/')
  return r.startsWith(root + '/') ? r.slice(root.length + 1) : r
}

// ─────────────────────────────────────────────────────────────
// 汇总(两档输出共用这一份结论)
// ─────────────────────────────────────────────────────────────

function buildReport(o) {
  const { nowMs, hours, days } = o
  const coverage = []

  const mail = o.mailRead.ok ? scanMailLog(o.mailRead.text, { nowMs, hours, days }) : null
  coverage.push(
    o.mailRead.ok
      ? {
          source: `发信日志 ${rel(o.mailPath)}`,
          state: o.mailRead.truncated ? 'partial' : 'covered',
          note: o.mailRead.truncated
            ? `只读了尾部 ${o.mailRead.scannedBytes} B(前面 ${o.mailRead.headBytesLost} B 未看)⇒ 更早的窗口若为 0 属未判定`
            : `全文 ${o.mailRead.sizeBytes} B 已读`,
        }
      : { source: `发信日志 ${rel(o.mailPath)}`, state: 'undetermined', note: o.mailRead.reason },
  )

  const att = o.attRead.ok ? parseAttestation(o.attRead.text, { nowMs, hours, days }) : null
  coverage.push(
    o.attRead.ok
      ? {
          source: `跳门台账 ${rel(o.attPath)}`,
          state: 'covered',
          note: `${att.totals.parsed} 条已解析 / 坏行 ${att.totals.badLines} / 无有效 ts ${att.totals.undated}(坏行与无 ts 都不计入任何计数,也不等于"没跳过")`,
        }
      : { source: `跳门台账 ${rel(o.attPath)}`, state: 'undetermined', note: o.attRead.reason },
  )

  // 门号 → 复现命令(注册表现读,无硬编码清单)
  const gateRows = []
  const unresolvedGates = []
  if (att) {
    for (const g of att.all.gates) {
      const script = o.registryOk ? o.registryMap.get(g.id) : undefined
      if (script) gateRows.push({ ...g, script, repro: `node scripts/${script} --staged` })
      else {
        gateRows.push({ ...g, script: null, repro: null })
        unresolvedGates.push(g.id)
      }
    }
  }
  coverage.push(
    o.registryOk
      ? {
          source: `门注册表 ${SRC.runner}(${o.registryFace} 面)`,
          state: 'covered',
          note:
            `${o.registryEntries} 条 id→script 现读` +
            (o.registryDup.length ? `;重复 id:${o.registryDup.join(',')}(只报名,定级属守门 89)` : '') +
            (unresolvedGates.length ? `;台账里这些 id 在该面找不到:${unresolvedGates.join(',')}` : ''),
        }
      : { source: `门注册表 ${SRC.runner}`, state: 'undetermined', note: o.registryReason },
  )

  const st = interpretAlertState(o.alertRaw)
  coverage.push(
    st.state === 'ok'
      ? { source: `同签名状态 ${rel(o.alertPath)}`, state: 'covered', note: `repeatNo=${st.repeatNo}` }
      : { source: `同签名状态 ${rel(o.alertPath)}`, state: 'undetermined', note: st.reason },
  )
  const dd = interpretDedupe(o.dedupeRaw, { nowMs })
  coverage.push(
    dd.state === 'ok'
      ? { source: `去重台账 ${rel(o.dedupePath)}`, state: 'covered', note: `${dd.entries} 个标识` }
      : { source: `去重台账 ${rel(o.dedupePath)}`, state: 'undetermined', note: dd.reason },
  )

  const undetermined = coverage.filter((c) => c.state === 'undetermined')
  const hKey = `${hours}h`
  const dKey = `${days}d`
  const summary = {
    mailTotal24h: mail ? mail.windows[hKey].mailCount : null,
    mailTotal7d: mail ? mail.windows[dKey].mailCount : null,
    alertSkippedTotal: mail ? mail.totals.alertSkipped : null,
    skipTotalAllTime: att ? att.all.skips : null,
    skipTotal24h: att ? att.windows[hKey].skips : null,
    skipTotal7d: att ? att.windows[dKey].skips : null,
    noBatchTotal: att ? att.all.noBatchCount : null,
    stormClusters24h: mail ? mail.windows[hKey].storms.length : null,
    sourcesCovered: coverage.filter((c) => c.state === 'covered').length,
    sourcesUndetermined: undetermined.length,
  }
  return { nowMs, hours, days, mail, att, st, dd, gateRows, coverage, summary, unreadable: undetermined.map((c) => `${c.source}: ${c.note}`) }
}

// ─────────────────────────────────────────────────────────────
// 人读档
// ─────────────────────────────────────────────────────────────

function renderHuman(rep) {
  const L = []
  const p = (s = '') => L.push(s)
  const hKey = `${rep.hours}h`
  const dKey = `${rep.days}d`

  p(`告警与跳门总量量算仪(只读)—— 现读 ${new Date(rep.nowMs).toISOString()}`)
  p()
  p('① 发信面 —— 判据 = ASCII 关键字 + 时间戳;中文一律不解码(log 实测 GBK/UTF-8 混合)')
  if (!rep.mail) {
    p('  未判定:发信日志取不到 ⇒ 下面所有计数都是 null,不是"一封没寄"。')
  } else {
    for (const key of [hKey, dKey]) {
      const w = rep.mail.windows[key]
      p(`  [近 ${key}] MAIL=${w.mailCount} 封 / ${w.distinctSignatures} 个签名 / ALERT(同签名被去重跳过)=${w.alertSkipped} 行`)
      for (const r of w.bySignature) {
        p(`      ${String(r.n).padStart(4)} 封  sig=${r.id}  ${r.ascii ? `ascii='${r.ascii}'` : '(无 ASCII 片段可打印)'}`)
      }
      const buckets = w.hourly || w.daily || []
      if (buckets.length) {
        const rows = buckets.slice(-14).map(([k, v]) => `${k}=${v}`)
        p(`      ${w.hourly ? '按小时' : '按日'}分布(尾 ${rows.length} 段):${rows.join(' ')}`)
      }
      if (w.storms.length) {
        const total = w.storms.reduce((s, x) => s + x.count, 0)
        p(`      ⚠️ 疑似告警风暴 ${w.storms.length} 簇 / 合计 ${total} 封(判据:同一签名 60 分钟内 ≥2 封;签名已折数字 ⇒ "同一件事")`)
        p('        处置:查该告警的去重签名里是否嵌了会自增的量(2026-09-27 同型根因);禁止用"加发信上限"消音(§5e)')
      }
      for (const s of w.storms.slice(0, 6)) {
        p(`      · sig=${s.id} ${s.count} 封 / 跨 ${(s.spanMs / MINUTE).toFixed(0)} 分钟`)
        for (const ln of s.lines.slice(0, 8)) p(`          ${ln.ts}  ${ln.keyword}`)
        if (s.lines.length > 8) p(`          …另 ${s.lines.length - 8} 封(计数已含,不再逐条列)`)
      }
      if (w.storms.length > 6) p(`      …另 ${w.storms.length - 6} 簇(计数与合计已含,列前面 6 簇)`)
    }
    const kw = Object.entries(rep.mail.keywordCounts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    if (kw.length) p(`  关键字计数(本次读到的全部行):${kw.map(([k, v]) => `${k}=${v}`).join(' ')}`)
    const t = rep.mail.totals
    p(`  行账:${t.lines} 行 = 带时间戳 ${t.timestamped}(其中无关键字 ${t.keywordless})+ 无时间戳 ${t.untimestamped}`)
    if (t.timestamped === 0) p('  ⚠️ 一行带时间戳的都没解出 ⇒ 要么日志为空,要么时间戳形状变了;此时 0 封不是事实,是尺子失效')
    if (rep.mail.lastTsMs) {
      const ageH = (rep.nowMs - rep.mail.lastTsMs) / HOUR
      p(`  最后一条带时间戳的行距今 ${ageH.toFixed(1)}h${ageH > 6 ? ' ⇒ 生产者可能停摆:窗口内 0 不等于无告警' : ''}`)
    }
  }
  const st = rep.st
  p(st.state === 'ok' ? `  部署环同签名状态:repeatNo=${st.repeatNo} sig=${st.sigId} sigTs=${st.sigTs}` : `  部署环同签名状态:未判定 —— ${st.reason}`)
  const dd = rep.dd
  p(dd.state === 'ok' ? `  发信出口去重台账:${dd.entries} 个标识(4h 内活跃 ${dd.within4h},ts 不可解 ${dd.malformedTs})` : `  发信出口去重台账:未判定 —— ${dd.reason}`)

  p('')
  p('② 跳门面 —— `.workbuddy/safe-commit-attestation.jsonl`(跳门次数的唯一真值来源)')
  if (!rep.att) {
    p('  未判定:台账取不到 ⇒ "0 次跳门"这个结论今天给不出。')
  } else {
    const a = rep.att
    p(`  全量:${a.all.skips} 次;其中 ranFullBatch=false(一批检查**全没跑**就跳了,比跳门更严重)= ${a.all.noBatchCount} 次`)
    p(`  近 ${hKey}:${a.windows[hKey].skips} 次 / 近 ${dKey}:${a.windows[dKey].skips} 次`)
    p(`  kind 分布(全量):${fmtKinds(a.all.kinds)}`)
    if (a.totals.badLines || a.totals.undated)
      p(`  ⚠️ 坏行 ${a.totals.badLines} 条 / 无有效 ts ${a.totals.undated} 条 —— 都不进任何计数(把没判写成判过是本仓最高频失效型)`)
    if (a.totals.ranFullBatchFieldMissing || a.totals.failedGatesFieldMissing)
      p(`  ⚠️ 字段缺席:ranFullBatch ${a.totals.ranFullBatchFieldMissing} 条 / failedGates ${a.totals.failedGatesFieldMissing} 条 —— 缺席按"没跑完整批/无门可归因"处理并在此报名`)
    if (a.all.noBatchCount) {
      for (const e of a.entries.filter((x) => !x.ranFullBatch && x.ms !== null).slice(-5))
        p(`    ranFullBatch=false @ ${new Date(e.ms).toISOString()} kind=${e.kind} gates=[${e.failedGates.join(',')}]`)
    }
    p(rep.gateRows.length ? '  按门聚合(门号→脚本现读注册表,不硬编码清单):' : '  按门聚合:台账里没有任何 failedGates 记录(这是读数,不得读成"没有门红过")')
    for (const g of rep.gateRows)
      p(
        `    ${String(g.id).padEnd(8)} × ${String(g.n).padStart(3)}  ${g.repro ?? '未判定:注册表本次不可读或该 id 不在注册面(门可能被摘线/挪号)'}`,
      )
  }

  p('')
  p('③ 覆盖总结 —— 读了哪些 / 哪些没读到(未判定一律报名并给原因)')
  for (const c of rep.coverage) p(`  [${stateCn(c.state)}] ${c.source} —— ${c.note}`)
  p('  未覆盖清单(射程边界,不是待办遗漏):')
  for (const u of NOT_COVERED) p(`    - ${u}`)
  p(
    `  结论计数:mailTotal24h=${rep.summary.mailTotal24h} mailTotal7d=${rep.summary.mailTotal7d} ` +
      `alertSkippedTotal=${rep.summary.alertSkippedTotal} skipTotalAllTime=${rep.summary.skipTotalAllTime} ` +
      `skipTotal24h=${rep.summary.skipTotal24h} skipTotal7d=${rep.summary.skipTotal7d} ` +
      `noBatchTotal=${rep.summary.noBatchTotal} stormClusters24h=${rep.summary.stormClusters24h} ` +
      `sourcesCovered=${rep.summary.sourcesCovered} sourcesUndetermined=${rep.summary.sourcesUndetermined}`,
  )
  p('')
  p('(本工具只读:未写文件、未发消息、未重启服务、未跑构建。修复动作在各"处置"行,不由它代做。)')
  return L.join('\n')
}

const stateCn = (s) => (s === 'covered' ? '已覆盖' : s === 'partial' ? '部分覆盖' : '未判定')

function fmtKinds(kinds) {
  const e = Object.entries(kinds)
  return e.length ? e.map(([k, v]) => `${k}=${v}`).join(' ') : '(无)'
}

/** 射程边界必须**报名**,不得只报数(本仓"报数不报名"记过多次:守门 70/76/81 同族)。 */
const NOT_COVERED = [
  '其他生产者写的日志:alert-bridge、IHUI-MONITOR、git-guardian 的派发、blue-green workflow 的邮件 —— 本工具只读 deploy-loop.log 一份',
  '被轮转/被删/被清空的旧日志:窗口内计数只反映文件现存部分',
  '手工 `git commit --no-verify`(不经 safe-commit 就不写台账 ⇒ 账面一次都没跳,现实可能跳了)',
  '邮件是否真的到达:只有日志侧留痕,SMTP/Resend 的回执不在这个面内',
  'MAIL 行的"已送达 vs 发送失败":中文正文不解码,ASCII 判据分不开这两型(所以 MAIL 计的是"发信动作留痕")',
  '不经这两把状态文件的发信写手(例如自拼 Send-MailMessage 的脚本;通道卫生属守门 81 那一维)',
  '风暴的"同一件事"按签名归一后判定,跨签名但语义同一的重复(换了措辞的同一条告警)看不见',
]

// ─────────────────────────────────────────────────────────────
// 装配(真实取数;所有入参可注入,--self-test 因此是纯 hermetic 的)
// ─────────────────────────────────────────────────────────────

function collect(opts = {}) {
  const root = opts.root ?? ROOT
  const mailPath = opts.mailPath ?? SRC.deployLog
  const attPath = opts.attPath ?? SRC.attest
  const alertPath = opts.alertPath ?? SRC.alertState
  const dedupePath = opts.dedupePath ?? SRC.dedupeState
  let registry = opts.registry
  if (!registry) {
    const face = Array.isArray(opts.argv) ? (opts.argv.includes('--staged') ? 'staged' : 'head') : process.argv.includes('--staged') ? 'staged' : 'head'
    registry = loadRegistry(root, face)
  }
  return buildReport({
    nowMs: opts.nowMs ?? Date.now(),
    hours: opts.hours ?? 24,
    days: opts.days ?? 7,
    mailRead: opts.mailRead ?? readTextTail(mailPath),
    mailPath,
    attRead: opts.attRead ?? readTextTail(attPath),
    attPath,
    alertRaw: 'alertRaw' in opts ? opts.alertRaw : readJsonFile(alertPath),
    alertPath,
    dedupeRaw: 'dedupeRaw' in opts ? opts.dedupeRaw : readJsonFile(dedupePath),
    dedupePath,
    registryOk: registry.ok === true,
    registryMap: registry.map || new Map(),
    registryFace: registry.face,
    registryEntries: registry.entries || 0,
    registryDup: registry.dupIds || [],
    registryReason: registry.reason || '(未报原因)',
  })
}

// ─────────────────────────────────────────────────────────────
// --self-test:成对正反例。写盘只发生在本函数内,且只落 scratch 出口。
// ─────────────────────────────────────────────────────────────

async function selfTest() {
  const { mkdirSync, writeFileSync, rmSync } = await import('node:fs')
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const { TextDecoder } = await import('node:util')
  let pass = 0
  let fail = 0
  const t = (name, fn) => {
    try {
      fn()
      pass++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      fail++
      console.log(`  ❌ ${name} —— ${String((e && e.message) || e).slice(0, 220)}`)
    }
  }
  const box = mkScratch('avr-')
  const write = (relp, content) => {
    const f = join(box, relp)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, content)
    return f
  }
  const okRead = (text) => ({ ok: true, text, sizeBytes: text.length, scannedBytes: text.length, truncated: false, headBytesLost: 0 })

  try {
    // 真 GBK 字节:现采自 [System.Text.Encoding]::GetEncoding(936).GetBytes(...)
    //   d3cabcfe b8e6beaf d2d1b7a2 bcfdd6c1 = 邮件告警已发送至 ; c0f7c5c6 c4a3d0cd = 品牌模型
    const gbkLine = Buffer.concat([
      Buffer.from('[2026-09-27 04:00:00 +00:00] [deploy] [04:00:00 +00:00] MAIL  ', 'latin1'),
      Buffer.from('d3cabcfeb8e6beafd2d1b7a2bcfdd6c1', 'hex'),
      Buffer.from(' x@y.example.com (', 'latin1'),
      Buffer.from('c0f7c5c6c4a3d0cd', 'hex'),
      Buffer.from(')', 'latin1'),
    ])
    const gbkText = gbkLine.toString('latin1')

    t('S1 中文模式串在真 GBK 日志上必得**假零**,而 ASCII 判据看得见', () => {
      const asGbk = new TextDecoder('gbk').decode(gbkLine)
      // 断言"这批字节确实解成了成串汉字",不断言具体字形:WHATWG 的 GBK 索引表与代码页 936 在个别
      // 码位上本就不同(实测 0xD6C1 在 Node 里解成「箭」而非「送」)。拿字形当断言 = 把测试环境写进判据。
      const body = asGbk.slice(asGbk.indexOf('MAIL  ') + 6, asGbk.indexOf('x@y')).trim()
      const cjk = [...body].filter((c) => c >= '一' && c <= '鿿')
      if (cjk.length < 6) throw new Error(`夹具没解出成串汉字(实得 ${cjk.length} 个)⇒ 阳性对照失效`)
      if (gbkText.includes(body)) throw new Error('latin1 下竟能中文命中,夹具无效')
      const r = scanMailLog(gbkText, { nowMs: Date.parse('2026-09-27T05:00:00Z') })
      if (r.mails.length !== 1) throw new Error(`ASCII 判据应量到 1 封,实得 ${r.mails.length}`)
      if (/[\u0080-\uffff]/.test(r.mails[0].ascii)) throw new Error('ASCII 片段里出现了非 ASCII(= 中文/乱码)')
    })

    t('S2 风暴判据有牙:同一件事 1 小时内 ≥2 封必点名', () => {
      const log = [
        '[2026-09-27 04:02:22 +00:00] [deploy] [04:02:22 +00:00] MAIL  same alert x@y.com (tag)',
        '[2026-09-27 04:03:45 +00:00] [deploy] [04:03:45 +00:00] MAIL  same alert x@y.com (tag)',
        '[2026-09-27 04:40:42 +00:00] [deploy] [04:40:42 +00:00] MAIL  same alert x@y.com (tag)',
      ].join('\n')
      const r = scanMailLog(log, { nowMs: Date.parse('2026-09-27T05:00:00Z') })
      const storms = r.windows['24h'].storms
      if (storms.length !== 1) throw new Error(`应 1 个风暴簇,实得 ${storms.length}`)
      if (storms[0].count !== 3) throw new Error(`簇内应 3 封,实得 ${storms[0].count}`)
      for (const ln of storms[0].lines) if (ln.keyword !== 'MAIL' || !ln.ts) throw new Error('点名行必须带时间戳与关键字')
    })

    t('S3 反向对照:同件事但每小时一封不得被喊成风暴', () => {
      const log = [0, 1, 2, 3]
        .map((i) => `[2026-09-27 0${i}:00:00 +00:00] [deploy] [0${i}:00:00 +00:00] MAIL  same alert x@y.com (tag)`)
        .join('\n')
      const r = scanMailLog(log, { nowMs: Date.parse('2026-09-27T05:00:00Z') })
      if (r.windows['24h'].mailCount !== 4) throw new Error(`MAIL 行数不对,实得 ${r.windows['24h'].mailCount}`)
      if (r.windows['24h'].storms.length !== 0) throw new Error('把常态节奏喊成风暴 = 报告失去可信度')
    })

    t('S4 签名归一必须折掉自增计数(否则量风暴就用的是酿成风暴的那把错尺子)', () => {
      const log = [
        '[2026-09-27 04:10:00 +00:00] [deploy] [04:10:00 +00:00] MAIL  sent 0.7h ago total 3 x@y.com',
        '[2026-09-27 04:20:00 +00:00] [deploy] [04:20:00 +00:00] MAIL  sent 1h ago total 9 x@y.com',
      ].join('\n')
      const r = scanMailLog(log, { nowMs: Date.parse('2026-09-27T05:00:00Z') })
      if (r.windows['24h'].distinctSignatures !== 1) throw new Error(`数字未归一 ⇒ 同一件事裂成 ${r.windows['24h'].distinctSignatures} 个签名`)
      if (r.windows['24h'].storms.length !== 1) throw new Error('归一后应识别为风暴')
      const n = normalizeSig('sent 1,024 B 0.7h ago')
      if (n !== 'sent # B #h ago') throw new Error(`归一形态不对:${n}`)
    })

    t('S5 ranFullBatch=false 必须单独计数(比跳门更严重,不得只并进 skip 总数)', () => {
      const text = [
        JSON.stringify({ ts: '2026-09-27T01:00:00.000Z', kind: 'not-ours', ranFullBatch: true, failedGates: ['104'], declaredFiles: ['a.ts'] }),
        JSON.stringify({ ts: '2026-09-27T02:00:00.000Z', kind: 'unattributed', ranFullBatch: false, failedGates: [], declaredFiles: ['b.ts'] }),
      ].join('\n')
      const a = parseAttestation(text, { nowMs: Date.parse('2026-09-27T03:00:00Z') })
      if (a.all.skips !== 2) throw new Error(`总跳门应 2,实得 ${a.all.skips}`)
      if (a.all.noBatchCount !== 1) throw new Error(`ranFullBatch=false 应 1,实得 ${a.all.noBatchCount}`)
      if (a.windows['24h'].noBatchCount !== 1) throw new Error('窗口档没算这一维')
    })

    t('S6 三个源都取不到时必须报 null/未判定,而不是 0', () => {
      const miss = readTextTail(join(box, 'nope', 'absent.jsonl'))
      if (miss.ok) throw new Error('不存在的路径却报 ok ⇒ 它下面的 0 会被读成"没跳过"')
      if (!/不存在/.test(miss.reason)) throw new Error(`未判定理由不明确:${miss.reason}`)
      const rep = collect({
        nowMs: Date.parse('2026-09-27T03:00:00Z'),
        mailRead: miss,
        mailPath: join(box, 'nope', 'absent.log'),
        attRead: miss,
        attPath: join(box, 'nope', 'absent.jsonl'),
        alertRaw: null,
        dedupeRaw: null,
        registry: { ok: false, reason: '夹具不提供注册表' },
      })
      if (rep.summary.skipTotalAllTime !== null) throw new Error('台账取不到却报出了跳门数')
      if (rep.summary.mailTotal24h !== null || rep.summary.mailTotal7d !== null) throw new Error('日志取不到却报出了发信数')
      if (rep.summary.sourcesUndetermined < 5) throw new Error(`五个源都没读到,却只报 ${rep.summary.sourcesUndetermined} 条未判定`)
      const human = renderHuman(rep)
      if (!/未判定/.test(human)) throw new Error('人读档没喊未判定')
    })

    t('S7 去重台账不存在 = "尚未启用",不是"零发信"', () => {
      const d = interpretDedupe(null, { nowMs: Date.parse('2026-09-27T03:00:00Z') })
      if (d.state !== 'absent') throw new Error('形态不对')
      if (!/不得读成"零发信"/.test(d.reason)) throw new Error(`理由没写清失效方向:${d.reason}`)
      if (interpretDedupe({ bad: 'JSON 解不出:x' }, { nowMs: 1 }).state !== 'unparseable') throw new Error('坏 JSON 不得被当 absent')
      const ok = interpretDedupe({ value: { 'a|b': { ts: Date.parse('2026-09-27T02:00:00Z') }, bad: {} } }, { nowMs: Date.parse('2026-09-27T03:00:00Z') })
      if (ok.state !== 'ok' || ok.entries !== 2 || ok.within4h !== 1 || ok.malformedTs !== 1) throw new Error(`台账读数不对:${JSON.stringify(ok)}`)
    })

    t('S8 注册表反查:认两种引号;无 script 的条目记 null 而不是错位认领邻门', () => {
      const text = [
        'const checks = [',
        "  {\n    id: '104',\n    script: 'check-prod-bundle-shadow.mjs',\n    mode: 'blocking',",
        "  {\n    id: \"35\",\n    mode: 'blocking',",
        "  {\n    id: '36',\n    script: 'check-miniapp-tokens-sync.mjs',",
        '  }\n]\n',
      ].join('\n')
      const r = parseRegistry(text)
      if (r.map.get('104') !== 'check-prod-bundle-shadow.mjs') throw new Error('单引号 id 没解析到')
      if (r.map.get('35') !== null) throw new Error(`无 script 的条目必须 null,实得 ${r.map.get('35')} —— 错位认领=把别人的门说成我的`)
      if (r.map.get('36') !== 'check-miniapp-tokens-sync.mjs') throw new Error('双引号 id 之后那条被吃掉 ⇒ 反查漏一格')
    })

    t('S9 注册面解出 0 条必须判"尺子失效",不得报"没有门"', () => {
      if (parseRegistry('const checks = []\n').entries !== 0) throw new Error('夹具不对')
      const rep = collect({
        nowMs: Date.parse('2026-09-27T03:00:00Z'),
        mailRead: okRead(''),
        mailPath: join(box, 'empty.log'),
        attRead: okRead(JSON.stringify({ ts: '2026-09-27T01:00:00.000Z', kind: 'mine', ranFullBatch: true, failedGates: ['777'] }) + '\n'),
        attPath: join(box, 'a.jsonl'),
        alertRaw: null,
        dedupeRaw: null,
        registry: { ok: false, reason: '解析到 0 条 ⇒ 尺子失效' },
      })
      const row = rep.gateRows.find((g) => g.id === '777')
      if (!row || row.repro !== null) throw new Error('注册表坏了却给出了复现命令')
      if (!rep.unreadable.some((u) => /注册表/.test(u))) throw new Error('注册表坏了必须点名')
    })

    t('S10 台账坏行/无 ts 单独计数,不得算进跳门数也不得静默丢弃', () => {
      const text = '{oops\n' + JSON.stringify({ kind: 'mine', ranFullBatch: true, failedGates: [] }) + '\n' + JSON.stringify({ ts: '2026-09-27T01:00:00.000Z', kind: 'mine', ranFullBatch: true, failedGates: [] }) + '\n'
      const a = parseAttestation(text, { nowMs: Date.parse('2026-09-27T03:00:00Z') })
      if (a.totals.badLines !== 1) throw new Error(`坏行应 1,实得 ${a.totals.badLines}`)
      if (a.badLines[0].n !== 1) throw new Error('坏行没报名(行号)')
      if (a.totals.undated !== 1) throw new Error(`无 ts 应 1,实得 ${a.totals.undated}`)
      if (a.windows['24h'].skips !== 1) throw new Error('无 ts 的行被算进了窗口计数')
      if (a.all.skips !== 2) throw new Error('全量档应含无 ts 行')
    })

    t('S11 两档同形:--json 可 parse,且人读档必须原样带出每个结论计数', () => {
      const rep = collect({
        nowMs: Date.parse('2026-09-27T05:00:00Z'),
        mailRead: okRead([gbkText, '[2026-09-27 04:30:00 +00:00] [deploy] [04:30:00 +00:00] ALERT dup skipped'].join('\n')),
        mailPath: join(box, 'gbk.log'),
        attRead: okRead(JSON.stringify({ ts: '2026-09-27T01:00:00.000Z', kind: 'not-ours', ranFullBatch: true, failedGates: ['104'] }) + '\n'),
        attPath: join(box, 'a.jsonl'),
        alertRaw: { value: { sig: 'git merge 失败 3 次', repeatNo: 7, sigTs: '2026-09-27T04:00:00Z' } },
        alertPath: join(box, 'st.json'),
        dedupeRaw: null,
        dedupePath: join(box, 'dd.json'),
        registry: { ok: true, face: '夹具', map: new Map([['104', 'check-prod-bundle-shadow.mjs']]), entries: 1, dupIds: [] },
      })
      const back = JSON.parse(JSON.stringify(rep))
      const human = renderHuman(rep)
      if (back.summary.mailTotal24h !== 1) throw new Error('json 档 MAIL 计数错')
      if (back.summary.skipTotalAllTime !== 1) throw new Error('json 档跳门计数错')
      if (back.summary.alertSkippedTotal !== 1) throw new Error('json 档 ALERT 去重计数错')
      for (const [k, v] of Object.entries(back.summary)) {
        if (!human.includes(`${k}=${v}`)) throw new Error(`人读档缺 ${k}=${v} ⇒ 两档可以各说各话`)
      }
      if (!/sig=[0-9a-f]{10}/.test(human)) throw new Error('签名短哈希点名缺失')
      if (/(git merge 失败|品牌模型|邮件告警)/.test(human)) throw new Error('报告泄出了中文原文(签名/告警名),违反只打时间戳+关键字')
      if (/[\w.+-]+@/.test(human.replace(/\*\*\*@/g, ''))) throw new Error('邮箱本地段未掩码')
      if (!human.includes('node scripts/check-prod-bundle-shadow.mjs --staged')) throw new Error('复现命令没给到 ⇒ 报告读完不知道该跑什么')
    })

    t('S12 时间戳形状:无 tz 按 UTC;非法日期落 null;半行不得冒充"无时间戳行"', () => {
      const ok = parseLogLine('[2026-09-27 04:00:00] [deploy] MAIL  x')
      if (!ok || ok.keyword !== 'MAIL') throw new Error('无 tz 形态没解析')
      if (ok.ms !== Date.parse('2026-09-27T04:00:00Z')) throw new Error('无 tz 必须按 UTC')
      if (parseLogLine('no timestamp here MAIL x')) throw new Error('无时间戳行不得算成判据输入')
      if (parseLogLine('[2026-13-45 99:99:99 +00:00] MAIL  x')) throw new Error('非法时间必须落 null,否则 NaN 会污染窗口比较')
      const r = readTextTail(write('tail.log', 'zzz'))
      if (!r.ok || r.truncated) throw new Error('小文件不该被判截断')
    })

    t('S13 夹具落点在仓库外(§26:仓库内 git 夹具会向上逃逸到真仓;os.tmpdir 可能钉在 C 盘)', () => {
      const rootS = ROOT.split('\\').join('/')
      if (box.split('\\').join('/').startsWith(rootS + '/')) throw new Error('夹具落进了仓库树')
      if (!process.env.IHUI_SCRATCH_DIR && !/DevEnv/.test(box)) throw new Error(`夹具没走 scratch-dir 出口:${box}`)
    })

    t('S14 真实夹具文件可读回,且字节保真(取数层用路径而不是内存样本;顺带钉住"写 Buffer ≠ 写字符串")', () => {
      // 这里刻意传 Buffer 而不是 gbkText:writeFileSync(串) 会按 UTF-8 重编码,GBK 字节当场变成另一种东西。
      const f = write('real/deploy-loop.log', gbkLine)
      const r = readTextTail(f)
      if (!r.ok) throw new Error(`取数层报未判定:${r.reason}`)
      if (r.text.length !== gbkLine.length) throw new Error(`字节没保真:${r.text.length} vs ${gbkLine.length}`)
      if (r.truncated) throw new Error('小文件被判成截断 ⇒ 真实报告里的 0 会被错标成未判定')
    })
  } finally {
    rmScratch(box)
  }
  console.log(`\nself-test:${pass} 通过 / ${fail} 失败 / 共 ${pass + fail} 例`)
  if (fail > 0) process.exitCode = 1
  return { pass, fail }
}

// ─────────────────────────────────────────────────────────────
// §22d 双形态入口守卫(import 本模块不得触发取数与打印)
// ─────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest().catch((e) => {
      console.error(`self-test 异常:${(e && e.stack) || e}`)
      process.exit(2)
    })
  } else {
    try {
      const flagNum = (name, dflt) => {
        const i = argv.indexOf(`--${name}`)
        const v = i >= 0 ? Number(argv[i + 1]) : NaN
        return Number.isFinite(v) && v > 0 ? v : dflt
      }
      const rep = collect({ argv, hours: flagNum('hours', 24), days: flagNum('days', 7) })
      if (argv.includes('--json')) console.log(JSON.stringify(rep, null, 2))
      else console.log(renderHuman(rep))
    } catch (e) {
      console.error(`脚本自身异常(取数层抛错,不是业务结论):${(e && e.stack) || e}`)
      process.exit(2)
    }
  }
}

export const __test__ = {
  parseLogLine,
  scanMailLog,
  findStorms,
  parseAttestation,
  parseRegistry,
  loadRegistry,
  interpretAlertState,
  interpretDedupe,
  readTextTail,
  asciiFragment,
  maskLocalPart,
  normalizeSig,
  sigId,
  buildReport,
  collect,
  renderHuman,
  selfTest,
  NOT_COVERED,
  SRC,
  ROOT,
  STORM_WINDOW_MS,
  MAX_LOG_BYTES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
