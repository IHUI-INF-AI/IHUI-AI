// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * feedback-loop — 端到端反馈闭环的可本机做实三段 CLI(2026-10-26 立,台账无编号行「端到端反馈闭环」)。
 *
 * 链路覆盖(边界写死,别把半条链吹成整条):
 *   ① 监控异常 → 自动建单/派单:消费仓内**既有只读尺子**的产出(源清单唯一真相源
 *      `scripts/data/feedback-loop-sources.json`),聚成候选 + 产出可直接喂 live-doc-edit 的登记块文本。
 *      **本器不写 PROJECT_PLAN.md**(登记入口唯一 = live-doc-edit,落地权归主席)。
 *   ② 过门:matchGate 判「该候选应归哪道门 / 是否已无出口」并点名;门清单 import
 *      `scripts/gate-grow.mjs` 的 readRegistry(§0.6 零复算,不改判据、不改注册表)。
 *   ③ 部署后指标比对:**只读** compareMetrics 尺子,前后快照均可由本器现采(--metrics=now)或喂夹具文件。
 *
 * 明确不做(残余交主席,不伪造):自动部署 / 自动回滚 / 自动改代码 —— 生产机面,本机无权。
 *
 * 副作用纪律:--dry-run(默认)**不得有任何写盘/写台账/写 git 动作**;唯一写面是
 * --emit-block <path> 与 --metrics-before/--metrics-after 快照,且落点必须在
 * `.ihui-agent/tmp/feedback-loop/` 内(§15),越界当场 exit 2。
 *
 * 用法:
 *   node scripts/feedback-loop.mjs                                  # dry-run
 *   node scripts/feedback-loop.mjs --json
 *   node scripts/feedback-loop.mjs --emit-block .ihui-agent/tmp/feedback-loop/block.md
 *   node scripts/feedback-loop.mjs --metrics-before <tmp 路径> --metrics-now
 *   node scripts/feedback-loop.mjs --self-test
 * 末行:FEEDBACK-LOOP sources=N candidates=N undetermined=N blocks=N
 * 退出码:0 判定完成 / 2 取不到输入(未判定,不记绿也不冒红,§0.3)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  loadSources,
  collectSignals,
  projectMetrics,
  matchGate,
  buildLoopTicket,
  compareMetrics,
  snapshotMetrics,
  fingerprintOf,
  SOURCES_REL,
  FeedbackLoopShapeError,
} from './lib/feedback-loop.mjs'
import { readRegistry } from './gate-grow.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP_REL = join('.ihui-agent', 'tmp', 'feedback-loop')
const TMP_DIR = join(ROOT, TMP_REL)
const REGISTRY_SELFTEST_CMD = ['node', 'scripts/gate-grow.mjs', '--self-test']

/** 唯一允许的写面:必须落在 .ihui-agent/tmp/feedback-loop/ 内(§15 临时件落点) */
function withinTmp(absPath) {
  const rel = relative(TMP_DIR, absPath)
  return (
    rel !== '' &&
    !rel.startsWith('..') &&
    !rel.includes(':') &&
    resolve(absPath) !== resolve(TMP_DIR)
  )
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readJsonl(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      /* 坏行跳过但整本账仍算读到 */
    }
  }
  return rows
}

/** 现读全部源的读数(唯一一次 IO;dry-run 与 emit 档共用,保证清单与内容同轮同面) */
export function gather({ root = ROOT, spawn = (...a) => spawnSync(...a), now = new Date() } = {}) {
  const cfg = loadSources({
    text: (() => {
      try {
        return readFileSync(join(root, SOURCES_REL), 'utf8')
      } catch {
        return ''
      }
    })(),
    now,
  })
  const payloads = []
  for (const src of cfg.sources) {
    let payload = null
    let why = null
    if (src.kind === 'json') {
      const v = readJson(join(root, src.path))
      payload = v
      if (v === null) why = `${src.id}:读不到或 JSON 坏(${src.path})`
    } else if (src.kind === 'jsonl') {
      const v = readJsonl(join(root, src.path))
      payload = v
      if (v === null) why = `${src.id}:读不到(${src.path})`
      else if (v.length === 0) why = `${src.id}:账本空账 ⇒ 枚举 0 行不记绿(${src.path})`
    } else if (src.kind === 'command') {
      const r = spawn(process.execPath, src.command.slice(1), {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: root,
        windowsHide: true,
        timeout: 120_000,
        encoding: 'utf8',
      })
      payload = r && r.status === 0 ? { stdout: String(r.stdout ?? '') } : null
      if (payload === null)
        why = `${src.id}:命令 rc=${r?.status ?? '?'}(不猜门数)${String(r?.stderr ?? '').slice(-120)}`
    }
    payloads.push({ src, payload, why })
  }
  return { cfg, payloads }
}

/** 从读数集算候选票 + 指标快照(纯计算;dry-run 与快照档共用同一份实现,§0.6) */
export function adjudicate({ cfg, payloads, registry, now = new Date() }) {
  const undetermined = []
  for (const p of payloads) {
    if (p.why) undetermined.push({ sourceId: p.src.id, why: p.why })
  }
  const signals = []
  for (const p of payloads) {
    const r = collectSignals(p.src, p.payload, { now, horizonHours: cfg.horizonHours })
    if (r.undetermined) undetermined.push({ sourceId: p.src.id, why: r.undetermined })
    signals.push(...r.signals)
  }
  const seen = new Set()
  const tickets = []
  for (const s of signals) {
    const gate = matchGate(s, registry?.status === 'ok' ? registry.entries : null, cfg.sources)
    const t = buildLoopTicket(s, { gate, now })
    if (seen.has(t.fingerprint)) continue
    seen.add(t.fingerprint)
    tickets.push(t)
  }
  const metrics = snapshotMetrics(
    payloads.map((p) => ({
      id: p.src.id,
      metrics: projectMetrics(p.src, p.payload, { now, horizonHours: cfg.horizonHours }),
    })),
  )
  return { tickets, undetermined, metrics }
}

function loadRegistry({ root, spawn }) {
  const st = spawn(process.execPath, REGISTRY_SELFTEST_CMD.slice(1), {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: root,
    windowsHide: true,
    timeout: 120_000,
    encoding: 'utf8',
  })
  if (st?.status !== 0) {
    return { status: 'undetermined', entries: [], why: `注册表自证未过 rc=${st?.status ?? '?'}` }
  }
  return readRegistry(root)
}

export function run({
  argv = [],
  io = console,
  root = ROOT,
  spawn = (...a) => spawnSync(...a),
  now = new Date(),
} = {}) {
  const dryRun = !argv.includes('--emit-block') && !argv.includes('--metrics-now')
  let gathered
  try {
    gathered = gather({ root, spawn, now })
  } catch (e) {
    io.error(`❌ 未判定:源清单不可用 —— ${e?.message ?? e}`)
    io.log('FEEDBACK-LOOP sources=0 candidates=0 undetermined=1 blocks=0')
    return 2
  }
  const { cfg, payloads } = gathered
  if (payloads.length === 0) {
    io.error('❌ 未判定:源清单里一枚可用源都没有(全部形状坏/到期剔除)')
    io.log('FEEDBACK-LOOP sources=0 candidates=0 undetermined=1 blocks=0')
    return 2
  }
  const registry = loadRegistry({ root, spawn })
  const { tickets, undetermined, metrics } = adjudicate({ cfg, payloads, registry, now })
  for (const p of cfg.problems) undetermined.push({ sourceId: p.id ?? '(清单)', why: p.why })
  if (registry.status !== 'ok') {
    undetermined.push({ sourceId: 'gate-registry', why: `过门段未判定:${registry.why}` })
  }

  if (argv.includes('--json')) {
    io.log(
      JSON.stringify(
        {
          at: now.toISOString(),
          sources: cfg.sources.length,
          registry: registry.status,
          candidates: tickets,
          undetermined,
          metrics,
          mode: dryRun ? 'dry-run' : 'emit',
        },
        null,
        2,
      ),
    )
  } else {
    io.log(`反馈闭环(前三段 + 比对尺子)模式=${dryRun ? 'dry-run(零写盘)' : 'emit'}`)
    for (const t of tickets) {
      io.log(
        `· [${t.status}] ${t.title} → ${t.gate.state}${t.gate.gates.length ? `(${t.gate.gates.map((g) => g.id).join('+')})` : ''}`,
      )
    }
    for (const u of undetermined) io.log(`? 未判定 ${u.sourceId}:${u.why}`)
    io.log(
      `候选 ${tickets.length} 枚 / 未判定 ${undetermined.length} 条 / 门注册表 ${registry.status}`,
    )
  }

  let blocks = 0
  const emitIdx = argv.indexOf('--emit-block')
  if (emitIdx >= 0) {
    const raw =
      argv[emitIdx + 1] && !String(argv[emitIdx + 1]).startsWith('--') ? argv[emitIdx + 1] : null
    if (!raw) {
      io.error('❌ --emit-block 需要路径参数')
      return 2
    }
    const abs = resolve(root, raw)
    if (!withinTmp(abs)) {
      io.error(`❌ 拒绝写盘:登记块唯一落点 ${TMP_REL}/,给定「${raw}」越界(§15)`)
      return 2
    }
    mkdirSync(dirname(abs), { recursive: true })
    const body = tickets.length
      ? tickets.map((t) => t.block).join('')
      : '<!-- 本轮 0 枚候选;此块不代表空台账有效,请连同 FEEDBACK-LOOP 末行一起看 -->\n'
    writeFileSync(
      abs,
      `<!-- feedback-loop 登记块(交主席走 live-doc-edit,本器不写 PROJECT_PLAN.md)@${now.toISOString()} -->\n${body}`,
      'utf8',
    )
    blocks = 1
    io.log(`已写登记块:${relative(ROOT, abs)}(${tickets.length} 枚候选)`)
  }
  const snapIdx = argv.indexOf('--metrics-now')
  if (snapIdx >= 0) {
    const raw =
      argv[snapIdx + 1] && !String(argv[snapIdx + 1]).startsWith('--') ? argv[snapIdx + 1] : null
    const abs = resolve(root, raw || join(TMP_REL, 'metrics-now.json'))
    if (!withinTmp(abs)) {
      io.error(`❌ 拒绝写盘:指标快照唯一落点 ${TMP_REL}/,给定「${raw}」越界(§15)`)
      return 2
    }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, JSON.stringify({ at: now.toISOString(), metrics }, null, 2), 'utf8')
    blocks += 1
    io.log(`已写指标快照:${relative(ROOT, abs)}`)
  }

  // 部署后比对:给了 before/after 任一夹具路径即现算(只读,判红权归人)
  const beforeIdx = argv.indexOf('--metrics-before')
  const afterIdx = argv.indexOf('--metrics-after')
  if (beforeIdx >= 0 || afterIdx >= 0) {
    const load = (i) => {
      const raw = argv[i + 1] && !String(argv[i + 1]).startsWith('--') ? argv[i + 1] : null
      if (!raw) return null
      const abs = resolve(root, raw)
      if (!withinTmp(abs)) return null
      return readJson(abs)?.metrics ?? null
    }
    const before = beforeIdx >= 0 ? load(beforeIdx) : null
    const after = afterIdx >= 0 ? load(afterIdx) : metrics
    const cmp = compareMetrics(before, after)
    io.log(`部署后指标比对:${cmp.state} —— ${cmp.why}`)
    for (const r of cmp.rows)
      io.log(`  - ${r.name}: ${r.before ?? '—'} → ${r.after ?? '—'} [${r.verdict}]`)
  }

  // §0.3:全部源取不到 ⇒ 未判定 exit 2;有一路读到即算判过(候选 0 枚也如实报)
  const readable = payloads.filter((p) => p.payload !== null).length
  if (readable === 0) {
    io.error('❌ 未判定:所有输入源此刻都取不到 ⇒ 不记绿也不冒红(§0.3)')
    io.log(
      `FEEDBACK-LOOP sources=${cfg.sources.length} candidates=${tickets.length} undetermined=${undetermined.length} blocks=${blocks}`,
    )
    return 2
  }
  io.log(
    `FEEDBACK-LOOP sources=${cfg.sources.length} candidates=${tickets.length} undetermined=${undetermined.length} blocks=${blocks}`,
  )
  return 0
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const srcJson = {
    id: 's1',
    kind: 'json',
    path: 'x.json',
    reviewBy: '2099-01-01',
    why: '测试源:必须≥10码点的定向说明',
    signalId: ['id'],
    signalDetail: ['detail'],
  }
  t('源清单:缺 sources 抛形状错', () => {
    try {
      loadSources({ text: '{}' })
      return false
    } catch (e) {
      return e instanceof FeedbackLoopShapeError
    }
  })
  t('源清单:空文本 ⇒ 抛(不当成没源)', () => {
    try {
      loadSources({ text: '' })
      return false
    } catch {
      return true
    }
  })
  t('源清单:未知 kind ⇒ 点名剔除不静默', () => {
    const r = loadSources({
      text: JSON.stringify({ horizonHours: 24, sources: [{ ...srcJson, kind: 'magic' }] }),
    })
    return r.sources.length === 0 && r.problems.length === 1
  })
  t('源清单:reviewBy 到期 ⇒ 源留用并点名腐烂', () => {
    const r = loadSources({
      text: JSON.stringify({ sources: [{ ...srcJson, reviewBy: '2020-01-01' }] }),
    })
    return r.sources.length === 1 && r.problems.some((p) => p.why.includes('已到期'))
  })
  t('源清单:path 与 command 同给 ⇒ 取材面唯一性判坏', () => {
    const r = loadSources({
      text: JSON.stringify({ sources: [{ ...srcJson, command: ['node', '-v'] }] }),
    })
    return r.sources.length === 0
  })
  t('json 源:findings ⇒ 每枚一条信号', () => {
    const r = collectSignals(srcJson, { findings: [{ id: 'P5', detail: '同步客户端不在' }] })
    return r.signals.length === 1 && r.undetermined === null
  })
  t(
    '取不到读数 ⇒ undetermined 点名(不记绿)',
    () => collectSignals(srcJson, null).undetermined !== null,
  )
  t('jsonl 源:whereEquals + 72h 窗外行不产候选', () => {
    const s = {
      ...srcJson,
      kind: 'jsonl',
      signalId: ['fingerprint'],
      signalDetail: ['why'],
      whereEquals: { action: 'register-failed' },
    }
    const r = collectSignals(
      s,
      [
        {
          ts: new Date().toISOString(),
          action: 'register-failed',
          fingerprint: 'a',
          why: '号池已满',
        },
        { ts: '2020-01-01T00:00:00Z', action: 'register-failed', fingerprint: 'b', why: '超窗' },
      ],
      { horizonHours: 72 },
    )
    return r.signals.length === 1 && r.signals[0].id === 'a'
  })
  t('坏源不吞好源:一枚 undetermined 不影响另一枚出信号', () => {
    const bad = collectSignals(srcJson, null)
    const good = collectSignals(srcJson, { findings: [{ id: 'P7', detail: '副本过期' }] })
    return bad.undetermined !== null && good.signals.length === 1
  })
  t('matchGate:注册表取不到 ⇒ undetermined(不判无出口)', () => {
    const r = matchGate({ sourceId: 's1', id: 'x', detail: 'y', domain: 's1' }, null, [srcJson])
    return r.state === 'undetermined'
  })
  t(
    'matchGate:注册表 0 条 ⇒ undetermined 判死',
    () => matchGate({ sourceId: 's1' }, [], [srcJson]).state === 'undetermined',
  )
  t('matchGate:命中 ⇒ matched 且带门号', () => {
    const reg = [{ id: '7', script: 'check-ops-patrol.mjs', label: '元运维' }]
    const r = matchGate({ sourceId: 's1', id: 'a', detail: 'd', domain: 's1' }, reg, [
      { ...srcJson, gateHints: ['ops-patrol'] },
    ])
    return r.state === 'matched' && r.gates[0].id === '7'
  })
  t('matchGate:0 命中 ⇒ no-exit 点名(不放宽关键词)', () => {
    const reg = [{ id: '7', script: 'check-else.mjs', label: '别的' }]
    const r = matchGate({ sourceId: 's1', id: 'a', detail: 'd', domain: 's1' }, reg, [
      { ...srcJson, gateHints: ['zzz-no-such'] },
    ])
    return r.state === 'no-exit' && r.why.includes('0 命中')
  })
  t('buildLoopTicket:块形含 {{NEXT_ID:G}} 且不带 PROJECT_PLAN 写动作', () => {
    const tk = buildLoopTicket(
      { sourceId: 's1', id: 'P5', detail: '网盘同步客户端不在' },
      { now: new Date('2026-10-26T00:00:00Z') },
    )
    return (
      tk.block.includes('{{NEXT_ID:G}}') &&
      tk.block.startsWith('- [ ]') &&
      tk.line.includes('登记@2026-10-26')
    )
  })
  t('buildLoopTicket:行内不留裸 12 位 hex(守门 117)', () => {
    const tk = buildLoopTicket({ sourceId: 's1', id: 'fd654f4fac2b', detail: 'x' })
    return !/\b[0-9a-f]{7,12}\b/.test(tk.line)
  })
  t(
    '指纹:同型异常(数字不同)折成一枚',
    () =>
      fingerprintOf({ sourceId: 'a', detail: '副本距今 8509 分钟' }) ===
      fingerprintOf({ sourceId: 'a', detail: '副本距今 12 分钟' }),
  )
  t(
    'compareMetrics:两侧缺值 ⇒ undetermined',
    () => compareMetrics(null, { a: 1 }).state === 'undetermined',
  )
  t('compareMetrics:findings 降 ⇒ improved', () => {
    const r = compareMetrics({ findings: 10 }, { findings: 2 }, { lowerIsBetter: ['findings'] })
    return r.state === 'improved'
  })
  t('compareMetrics:findings 升 ⇒ worsened(反向牙)', () => {
    const r = compareMetrics({ findings: 2 }, { findings: 10 }, { lowerIsBetter: ['findings'] })
    return r.state === 'worsened'
  })
  t('compareMetrics:单指标缺值 ⇒ 该行 undetermined 不并桶', () => {
    const r = compareMetrics({ a: 1, b: 2 }, { a: 1, b: null })
    return r.rows.find((x) => x.name === 'b').verdict === 'undetermined'
  })
  t('snapshotMetrics:跨源键不撞名', () => {
    const s = snapshotMetrics([
      { id: 'a', metrics: { n: 1 } },
      { id: 'b', metrics: { n: 2 } },
    ])
    return s['a.n'] === 1 && s['b.n'] === 2
  })
  t('projectMetrics:jsonl 计数只算地平线内(窗外不计)', () => {
    const s = {
      ...srcJson,
      kind: 'jsonl',
      metrics: [{ name: 'failed', countMatches: { disposition: 'failed' } }],
    }
    const now = new Date()
    const v = projectMetrics(
      s,
      [
        { ts: now.toISOString(), disposition: 'failed' },
        { ts: '2000-01-01T00:00:00Z', disposition: 'failed' },
        { ts: now.toISOString(), disposition: 'failed' },
      ],
      { now, horizonHours: 72 },
    )
    return v.failed === 2
  })
  t('projectMetrics:读数取不到 ⇒ 全 null(不冒充 0)', () => {
    const s = { ...srcJson, metrics: [{ name: 'f', pick: ['counts', 'findings'] }] }
    return projectMetrics(s, null).f === null
  })
  t('dims 源:verdict=ok 不产信号,breach 产', () => {
    const s = { ...srcJson, nestedDims: 'dims', verdictNotOk: true }
    const r = collectSignals(s, {
      dims: { 'leg-count': { verdict: 'ok' }, churn: { verdict: 'breach' } },
    })
    return r.signals.length === 1 && r.signals[0].id.endsWith('churn')
  })

  let pass = 0
  const failed = []
  for (const c of cases) {
    let ok = false
    try {
      ok = !!c.fn()
    } catch (e) {
      ok = false
      failed.push(`${c.name} ⇒ 抛 ${e?.message ?? e}`)
      continue
    }
    if (ok) pass += 1
    else failed.push(c.name)
  }
  for (const f of failed) console.log(`❌ ${f}`)
  console.log(`SELF-TEST ${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  try {
    if (argv.includes('--self-test')) process.exit(selfTest())
    process.exit(run({ argv }))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  run,
  gather,
  adjudicate,
  withinTmp,
  selfTest,
  TMP_REL,
  REGISTRY_SELFTEST_CMD,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
