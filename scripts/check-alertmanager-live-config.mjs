#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子的诊断输出就是它的交付物 */
// 立尺原因:monitoring/alertmanager/alertmanager.yml 自陈"未被加载";现役模板
// alertmanager.yml.tmpl;渲染件 alertmanager.rendered.yml 被 git 忽略 —— 本机实际加载了
// 哪份配置此前无人量过(AGENTS §5e:告警栈"在不在响"必须被量到)。
//
// 判据(三态,退出码 0/1/2,AGENTS §0.3):
//   0 一致     —— 投影维度逐维相等(生效面取自运行中 Alertmanager 的 GET /api/v2/status,
//                  即"它自己承认在跑的那份",不是磁盘猜测);
//   1 漂移     —— 任一维两侧都取得到而不等,逐维点名(≠ 行: 模板值 / 生效值);
//   2 未判定   —— 点名取不到的那一路:status API 连不上/非 JSON/无 config.original、
//                  模板读不到、任一面投影为 0 维(枚举到 0 判死不记绿)、维度在某一面取不到值。
// 两条"不得读成"的纪律:①"连不上"≠"没问题"(→2 并点名);②"没有渲染件"≠"没加载"
// (本尺不审渲染件:生效面直取运行实例;渲染件缺不缺与本判无关)。
//
// 取材口径(§0.4 同面同轮):模板读**工作区文件并与 HEAD blob 逐字对照**,两面不一致即
// 未判定(--worktree 仅人工逃生舱)。本尺是运行态探测尺子,**不接提交链**(判机器状态不进
// 提交链,§5e-1;若挂 pre-commit,Alertmanager 停机期就成 §12e 禁的恒红门)。
//
// 端口依据(2026-10-17 现读,文档不作本机事实):活进程 alertmanager.exe 命令行
// --web.listen-address=127.0.0.1:9093(Get-CimInstance Win32_Process 实测);换机/换端口
// 用 --url 或环境变量 ALERTMANAGER_STATUS_URL 显式覆盖。
// 生效面 webhook url 在 status API 中被 Alertmanager 官方掩为 <secret> ⇒ 该子维记
// "不可观测"不参与漂移;url 本体由 scripts/render-alertmanager-config.mjs 的
// assertBridgeOnlySurface 对模板面自证(本尺 import 复用,§22c 不复制判据)。
//
// 用法: node scripts/check-alertmanager-live-config.mjs [--url <status-url>] [--timeout-ms N] [--worktree]
//        node scripts/check-alertmanager-live-config.mjs --self-test
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertBridgeOnlySurface } from './render-alertmanager-config.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE_REL = 'monitoring/alertmanager/alertmanager.yml.tmpl'
const DEFAULT_URL = 'http://127.0.0.1:9093/api/v2/status'

// ── 迷你 YAML 子集解析(两面共用:模板手写块式 + flow 数组;生效面是 AM 重排块式,
//    序列可与键同缩进)。解析不动 ⇒ 调用方按"未判定"点名,绝不静默回落。 ──
function unquote(s) {
  const t = String(s).trim()
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1)
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return JSON.parse(t)
  if (t.includes('\\"')) return t.replace(/\\"/g, '"')
  return t
}
function stripComment(line) {
  let inS = false, inD = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "'" && !inD) inS = !inS
    else if (c === '"' && !inS) inD = !inD
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i)
  }
  return line
}
function splitFlow(inner) {
  const out = []
  let cur = '', q = null
  for (const c of inner) {
    if (q) { cur += c; if (c === q) q = null }
    else if (c === "'" || c === '"') { q = c; cur += c }
    else if (c === ',') { out.push(cur.trim()); cur = '' }
    else cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out.map((x) => unquote(x))
}
function parseFlowOrScalar(v) {
  const t = String(v).trim()
  if (t.startsWith('[')) return t.slice(1, t.lastIndexOf(']')).trim() === '' ? [] : splitFlow(t.slice(1, t.lastIndexOf(']')))
  if (t.startsWith('{')) return {}
  return unquote(t)
}

/** 返回解析出的文档;形状坏/有行没被消费 ⇒ throw(调用方折成"未判定",不折绿)。 */
export function parseYamlSubset(text) {
  const lines = []
  for (const raw of String(text).split(/\r?\n/)) {
    const noC = stripComment(raw)
    if (!noC.trim()) continue
    lines.push({ indent: noC.length - noC.trimStart().length, content: noC.trim() })
  }
  let i = 0
  const isDash = (L) => L.content === '-' || L.content.startsWith('- ')
  function parseBlock() {
    if (i >= lines.length) return null
    return isDash(lines[i]) ? parseSeq(lines[i].indent) : parseMap(lines[i].indent)
  }
  /** key 之下/同级(- 起始)的子块;与 AM marshal 的"序列与键同缩进"对齐 */
  function parseChild(keyIndent) {
    if (i >= lines.length) return null
    const L = lines[i]
    if (L.indent > keyIndent) return parseBlock()
    if (L.indent === keyIndent && isDash(L)) return parseSeq(keyIndent)
    return null
  }
  function parseSeq(ind) {
    const arr = []
    while (i < lines.length && lines[i].indent === ind && isDash(lines[i])) {
      const body = lines[i].content === '-' ? '' : lines[i].content.slice(2).trim()
      i++
      arr.push(parseItem(body, ind + 2))
    }
    return arr
  }
  function parseMap(ind) {
    const map = {}
    while (i < lines.length && lines[i].indent === ind && !isDash(lines[i])) {
      const kv = /^([^:]+):\s*(.*)$/.exec(lines[i].content)
      if (!kv) throw new Error(`无法解析的行(${i}):${lines[i].content}`)
      const key = kv[1].trim(), val = kv[2].trim()
      i++
      if (val === '') {
        const child = parseChild(ind)
        map[key] = child === null ? null : child
      } else map[key] = parseFlowOrScalar(val)
    }
    return map
  }
  function parseItem(body, itemIndent) {
    if (body === '') return parseBlock()
    const kv = /^([^:]+):\s*(.*)$/.exec(body)
    if (!kv) return unquote(body)
    const key = kv[1].trim(), val = kv[2].trim()
    const obj = {}
    obj[key] = val === '' ? (parseChild(itemIndent) ?? null) : parseFlowOrScalar(val)
    while (i < lines.length && lines[i].indent === itemIndent && !isDash(lines[i])) {
      const kv2 = /^([^:]+):\s*(.*)$/.exec(lines[i].content)
      if (!kv2) throw new Error(`无法解析的行(${i}):${lines[i].content}`)
      const k2 = kv2[1].trim(), v2 = kv2[2].trim()
      i++
      obj[k2] = v2 === '' ? (parseChild(itemIndent) ?? null) : parseFlowOrScalar(v2)
    }
    return obj
  }
  const doc = parseMap(0)
  if (i < lines.length) throw new Error(`解析未覆盖第 ${i} 行起的内容:${lines[i].content}(形状超出本尺子集,按未判定处理)`)
  return doc
}

// ── 投影:两面各取同一组维度;任何一维取不到 ⇒ undefined(调用方点名,不折绿不折红) ──
function dimOf(doc, path) {
  let cur = doc
  for (const seg of path) {
    if (cur == null) return undefined
    cur = cur[seg]
  }
  return cur
}
function normMatchers(list) {
  if (!Array.isArray(list)) return undefined
  return list.map((m) => String(m).replace(/\s+/g, '')).sort()
}
const byJson = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))
export function projectConfig(doc) {
  if (!doc || typeof doc !== 'object' || Object.keys(doc).length === 0) return null
  const route = dimOf(doc, ['route']) || {}
  const subroutes = (route.routes || []).map((r) => ({
    matchers: normMatchers(r.matchers),
    receiver: r.receiver,
    mute: Array.isArray(r.mute_time_intervals) ? r.mute_time_intervals.map(String).sort() : [],
  })).sort(byJson)
  const receivers = (doc.receivers || []).map((rcv) => ({
    name: rcv.name,
    hooks: (rcv.webhook_configs || []).map((w) => ({
      send_resolved: w.send_resolved === undefined ? undefined : String(w.send_resolved),
      max_alerts: w.max_alerts === undefined ? undefined : String(w.max_alerts),
      url: w.url === '<secret>' ? '<masked>' : w.url,
    })),
  })).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const inhibits = (doc.inhibit_rules || []).map((ir) => ({
    source: normMatchers(ir.source_matchers),
    target: normMatchers(ir.target_matchers),
    equal: (ir.equal || []).map(String).sort(),
  })).sort(byJson)
  const mutes = (doc.mute_time_intervals || []).map((m) => m.name).sort()
  return {
    'global.resolve_timeout': dimOf(doc, ['global', 'resolve_timeout']),
    'route.receiver': route.receiver,
    'route.group_by': Array.isArray(route.group_by) ? route.group_by.map(String).sort() : undefined,
    'route.group_wait': route.group_wait,
    'route.group_interval': route.group_interval,
    'route.repeat_interval': route.repeat_interval,
    'route.routes': subroutes.length ? subroutes : undefined,
    'receivers': receivers.length ? receivers : undefined,
    'mute_time_intervals': mutes.length ? mutes : undefined,
    'inhibit_rules': inhibits.length ? inhibits : undefined,
  }
}

export const DIM_ORDER = ['global.resolve_timeout', 'route.receiver', 'route.group_by', 'route.group_wait', 'route.group_interval', 'route.repeat_interval', 'route.routes', 'receivers', 'mute_time_intervals', 'inhibit_rules']

/** 逐维对账。一侧投影整体取不到 ⇒ 全维 undetermined;url 在生效面被掩 ⇒ 该子维不可观测(不比)。 */
export function compareProjections(tmpl, live) {
  const rows = []
  let hasDiff = false, hasUndetermined = false
  for (const name of DIM_ORDER) {
    const a = tmpl ? tmpl[name] : undefined
    const b = live ? live[name] : undefined
    if (a === undefined || b === undefined) {
      hasUndetermined = true
      rows.push({ dim: name, state: 'undetermined', why: `模板面=${a === undefined ? '取不到' : '有'} / 生效面=${b === undefined ? '取不到' : '有'}` })
      continue
    }
    let ta = a, tb = b, note = ''
    if (name === 'receivers') {
      const strip = (r) => r.map((x) => ({ ...x, hooks: (x.hooks || []).map((h) => ({ send_resolved: h.send_resolved, max_alerts: h.max_alerts })) }))
      ta = strip(a); tb = strip(b)
      if (a.some((r) => (r.hooks || []).some((h) => h.url === '<masked>'))) note = '(webhook url 被 status API 掩为 <secret> 不可观测;url 本体由 assertBridgeOnlySurface 对模板面自证)'
    }
    const eq = JSON.stringify(ta) === JSON.stringify(tb)
    if (!eq) hasDiff = true
    rows.push({ dim: name, state: eq ? 'equal' : 'drift', tmpl: JSON.stringify(a), live: JSON.stringify(b), note })
  }
  return { rows, hasDiff, hasUndetermined }
}

function gitHeadBlob(rel) {
  try {
    return execFileSync('git', ['-C', ROOT, 'show', `HEAD:${rel}`], { encoding: 'utf8', windowsHide: true, timeout: 8000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 << 20 })
  } catch { return null }
}

function fetchStatusJson(url, timeoutMs) {
  return new Promise((resolveP) => {
    let settled = false
    const done = (v) => { if (!settled) { settled = true; resolveP(v) } }
    try {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        let data = ''
        res.on('data', (c) => { data += c; if (data.length > 8e6) req.destroy() })
        res.on('end', () => {
          if (res.statusCode !== 200) return done({ err: `HTTP ${res.statusCode}` })
          try { done({ json: JSON.parse(data) }) } catch (e) { done({ err: `响应非 JSON: ${e.message}` }) }
        })
      })
      req.on('error', (e) => done({ err: `连不上(${e.code || e.message})` }))
      req.on('timeout', () => { req.destroy(); done({ err: `超时(${timeoutMs}ms)` }) })
    } catch (e) { done({ err: `请求异常: ${e.message}` }) }
  })
}

async function runCli(argv) {
  const opts = { url: process.env.ALERTMANAGER_STATUS_URL || DEFAULT_URL, timeoutMs: 6000, worktreeOnly: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') opts.url = argv[++i]
    else if (argv[i] === '--timeout-ms') opts.timeoutMs = parseInt(argv[++i], 10)
    else if (argv[i] === '--worktree') opts.worktreeOnly = true
    else { console.error(`✗ 未知选项 ${argv[i]}`); return 2 }
  }
  const tmplPath = join(ROOT, TEMPLATE_REL)
  if (!existsSync(tmplPath)) { console.error(`✗ 未判定:模板读不到 ${tmplPath}`); return 2 }
  const tmplWorktree = readFileSync(tmplPath, 'utf8')
  if (!opts.worktreeOnly) {
    const head = gitHeadBlob(TEMPLATE_REL)
    if (head === null) { console.error('✗ 未判定:HEAD blob 取不到(仓库状态异常),按 §0.4 不回落另一面'); return 2 }
    if (head !== tmplWorktree) { console.error('✗ 未判定:模板工作区副本与 HEAD blob 不一致(在飞编辑未入库),先落库或人工 --worktree 复跑'); return 2 }
  }
  let tmplDoc
  try { tmplDoc = parseYamlSubset(tmplWorktree) } catch (e) { console.error(`✗ 未判定:模板面解析失败: ${e.message}`); return 2 }
  try {
    const s = assertBridgeOnlySurface(tmplWorktree)
    console.log(`✓ 模板面结构自证(复用 render-alertmanager-config.assertBridgeOnlySurface):唯一 receiver=${s.receiver} 落 ${s.url},${s.subrouteCount} 条子路由`)
  } catch (e) { console.error(`✗ 漂移:模板面 bridge-only 结构自证不过: ${String(e.message).split('\n')[0]}`); return 1 }

  const got = await fetchStatusJson(opts.url, opts.timeoutMs)
  if (got.err) { console.error(`✗ 未判定:生效面取不到(${opts.url}): ${got.err} —— "连不上"不得读成"没问题"`); return 2 }
  const liveYaml = got.json?.config?.original
  if (!liveYaml) { console.error('✗ 未判定:status 响应里没有 config.original(Alertmanager 版本形态不符)'); return 2 }
  let liveDoc
  try { liveDoc = parseYamlSubset(liveYaml) } catch (e) { console.error(`✗ 未判定:生效面解析失败: ${e.message}`); return 2 }

  const projT = projectConfig(tmplDoc), projL = projectConfig(liveDoc)
  if (!projT) { console.error('✗ 未判定:模板面投影为 0 维(枚举到 0 判死不记绿)'); return 2 }
  if (!projL) { console.error('✗ 未判定:生效面投影为 0 维(同上)'); return 2 }
  const cmp = compareProjections(projT, projL)
  for (const r of cmp.rows) {
    if (r.state === 'equal') console.log(`= ${r.dim}: ${r.tmpl}${r.note}`)
    else if (r.state === 'drift') console.log(`≠ ${r.dim}: 模板=${r.tmpl} / 生效=${r.live}`)
    else console.log(`? ${r.dim}: ${r.why}`)
  }
  if (cmp.hasDiff) { console.log('✗ 漂移:上表以 ≠ 点名的维度两侧都取得到而不等;本尺零写入,改线上监控配置交人工判'); return 1 }
  if (cmp.hasUndetermined) { console.log('✗ 未判定:上表以 ? 点名的维度至少一侧取不到,不折成绿也不折成红'); return 2 }
  console.log(`✓ 一致:生效配置与 ${TEMPLATE_REL} 的 ${DIM_ORDER.length} 个投影维度逐维相等(生效面实测取自 ${opts.url})`)
  return 0
}

// ── --self-test:夹具成对(同形→0 漂移、改一维→点名该维、缺一块→未判定点名) ──
export const FIX_TMPL = `global:\n  resolve_timeout: 5m\nroute:\n  receiver: 'default-webhook'\n  group_by: ['alertname', 'service']\n  group_wait: 30s\n  group_interval: 5m\n  repeat_interval: 4h\n  routes:\n    - matchers: ['severity="critical"']\n      receiver: 'default-webhook'\n    - matchers: ['severity="warning"']\n      receiver: 'default-webhook'\n      mute_time_intervals:\n        - nightly-maintenance\nreceivers:\n  - name: 'default-webhook'\n    webhook_configs:\n      - url: 'http://127.0.0.1:9096/alert'\n        send_resolved: true\n        max_alerts: 0\nmute_time_intervals:\n  - name: nightly-maintenance\ninhibit_rules:\n  - source_matchers: ['severity="critical"']\n    target_matchers: ['severity="warning"']\n    equal: ['alertname', 'service']\n`
export const FIX_LIVE = `global:\n  resolve_timeout: 5m\nroute:\n  receiver: default-webhook\n  group_by:\n  - alertname\n  - service\n  continue: false\n  routes:\n  - receiver: default-webhook\n    matchers:\n    - severity="critical"\n    continue: false\n  - receiver: default-webhook\n    matchers:\n    - severity=\\"warning\\"\n    mute_time_intervals:\n    - nightly-maintenance\n  group_wait: 30s\n  group_interval: 5m\n  repeat_interval: 4h\nreceivers:\n- name: default-webhook\n  labels:\n    name: default-webhook\n  webhook_configs:\n  - send_resolved: true\n    http_config:\n      follow_redirects: true\n    url: <secret>\n    max_alerts: 0\n    timeout: 0s\ninhibit_rules:\n- source_matchers:\n  - severity="critical"\n  target_matchers:\n  - severity="warning"\n  equal:\n  - alertname\n  - service\nmute_time_intervals:\n- name: nightly-maintenance\n`

function runSelfTest() {
  const cases = []
  const ok = (label, cond) => cases.push([label, !!cond])
  let t, l
  try { t = parseYamlSubset(FIX_TMPL) } catch (e) { console.log(`✗ 夹具模板面解析失败: ${e.message}`); }
  try { l = parseYamlSubset(FIX_LIVE) } catch (e) { console.log(`✗ 夹具生效面解析失败: ${e.message}`); }
  ok('夹具:两面解析均成(≥5 顶层键)', t && l && Object.keys(t).length >= 5 && Object.keys(l).length >= 5)
  const pt = t ? projectConfig(t) : null, pl = l ? projectConfig(l) : null
  ok('投影:两侧均成且维度表 ≥8', pt && pl && DIM_ORDER.length >= 8)
  ok('投影:关键取值就位(repeat_interval=4h / send_resolved=true / max_alerts=0)', pt?.['route.repeat_interval'] === '4h' && JSON.stringify(pl?.receivers).includes('"send_resolved":"true"') && JSON.stringify(pt.receivers).includes('"max_alerts":"0"'))
  const cmp = compareProjections(pt, pl)
  ok('同形夹具(引号风格/键序/掩码差异)⇒ 零漂移', !cmp.hasDiff)
  ok('同形夹具 ⇒ 无未判定维', !cmp.hasUndetermined)
  const driftL = projectConfig(parseYamlSubset(FIX_LIVE.replace('repeat_interval: 4h', 'repeat_interval: 1h')))
  const c2 = compareProjections(pt, driftL)
  ok('改一维 ⇒ 判漂移且点名该维(只点名被改的那一维)', c2.hasDiff && c2.rows.filter((r) => r.state === 'drift').every((r) => r.dim === 'route.repeat_interval'))
  const missingL = projectConfig(parseYamlSubset(FIX_LIVE.replace('mute_time_intervals:\n- name: nightly-maintenance\n', '')))
  const c3 = compareProjections(pt, missingL)
  ok('生效面缺一块 ⇒ 未判定点名该维,不折红也不折绿', c3.hasUndetermined && !c3.hasDiff && c3.rows.some((r) => r.dim === 'mute_time_intervals' && r.state === 'undetermined'))
  ok('空文档 ⇒ 投影 null(枚举到 0 判死不记绿)', projectConfig(parseYamlSubset('  \n\n')) === null)
  const bad = compareProjections(null, pl)
  ok('一侧投影 null ⇒ 全维 undetermined 而非 equal', DIM_ORDER.every((d) => bad.rows.find((r) => r.dim === d).state === 'undetermined'))
  let threw = false
  try { parseYamlSubset('global:\n  resolve_timeout: 5m\n这一行没有键冒号形态\n') } catch { threw = true }
  ok('形状超出子集的行 ⇒ 抛错(由调用方折成未判定),不静默半解析', threw)
  let bad2 = 0
  for (const [label, pass] of cases) { if (!pass) bad2++; console.log(`${pass ? '✓' : '✗'} ${label}`) }
  console.log(`自检 ${cases.length - bad2}/${cases.length} 通过`)
  return bad2 ? 1 : 0
}

// ── §22c 出口:镜像测试直接 import,不复制判据 ──
export const __test__ = {
  TEMPLATE_REL,
  DEFAULT_URL,
  DIM_ORDER,
  unquote,
  stripComment,
  splitFlow,
  parseYamlSubset,
  projectConfig,
  compareProjections,
  FIX_TMPL,
  FIX_LIVE,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  void Promise.resolve()
    .then(() => runCli(argv))
    .then((rc) => process.exit(rc ?? 0))
    .catch((e) => { console.error(`❌ 尺子自身异常: ${e?.message ?? e}\n${e?.stack ?? ''}`); process.exit(2) })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
