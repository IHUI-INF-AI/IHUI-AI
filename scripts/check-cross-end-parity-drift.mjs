// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子,需 console 输出结论 */
/**
 * check-cross-end-parity-drift.mjs — 跨端对齐"是否正在倒退"的只读漂移尺(不进提交链)
 *
 * 立因:本仓三条对齐链(web→RN 功能映射 / RN→小程序镜像 / 样式 token 派生)各有对账器,
 * 但**没有任何一处回答"这一轮比上一轮好了还是坏了"**。登记数只能靠人想起来去跑,
 * 于是 2026-10-24→25 一天里镜像从 26 涨到 84 这件事,只有翻提交才看得见。
 * 本尺把"涨/跌"变成机读结论 + 一份快照台账,供 git-guardian 巡检轮派发;
 * 倒退(镜像减少 / 登记表腐烂 / 账本文档与现读脱节)才报警,涨不报。
 *
 * 判据零复算(§0.6):三个数字全部**取自三道现成对账器的 --json 输出**
 *   · scripts/check-cross-end-screen-coverage.mjs --json  → 共享屏/已镜像/登记表条目/判红数
 *   · scripts/check-web-rn-screen-parity.mjs --json       → web 路由/aligned/unmapped/腐烂数
 *   · docs/engineering/rn-miniapp-parity-matrix.md        → 缺口账本文档自述的三个数
 * 本文件不重算任何一条判据,只做"上一轮快照 ↔ 本轮现读"的比较。
 *
 * 三态(§0.3):任一子对账器取不到结论 ⇒ state=undetermined(不记绿也不冒红);
 * 取到且有倒退维 ⇒ state=regressed;否则 ok。文档数字与现读不等 ⇒ 单列 docStale(可整改:重跑生成命令)。
 *
 * Usage:
 *   node scripts/check-cross-end-parity-drift.mjs            # 现读并打印
 *   node scripts/check-cross-end-parity-drift.mjs --json     # 机读
 *   node scripts/check-cross-end-parity-drift.mjs --record   # 同时把本轮写进快照台账(守护轮用)
 *   node scripts/check-cross-end-parity-drift.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const STATE_FILE = join(ROOT, '.ihui-agent', 'state', 'cross-end-parity-last.json')
const DOC_PATH = 'docs/engineering/rn-miniapp-parity-matrix.md'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const recordMode = argv.includes('--record')
const selfTest = argv.includes('--self-test')

/** 跑一道对账器取 JSON;非零退出也可能带完整结论(判红档),故 stdout 优先、状态另报 */
function runRuler(script, args = ['--json']) {
  const cmd = join(HERE, script)
  if (!existsSync(cmd)) return { ok: false, why: `尺子不在位:${script}` }
  try {
    const out = execFileSync(process.execPath, [cmd, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    try {
      return { ok: true, json: JSON.parse(out) }
    } catch {
      return { ok: false, why: `${script} 输出不是 JSON` }
    }
  } catch (e) {
    const out = String(e?.stdout ?? '')
    if (out.trim()) {
      try {
        return { ok: true, json: JSON.parse(out), status: e?.status ?? null }
      } catch {
        /* 落到下面 */
      }
    }
    return { ok: false, why: `${script} 跑不动:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** 从缺口账本文档自述行抽三个数(生成器写的是 `- 共享屏(真相源): **218**` 这种形) */
function docNumbers(md) {
  const pick = (label) => {
    // 标签里的括号是**字面量**(共享屏(真相源)),不转义会被当成分组 ⇒ 永远抽不到数。
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`-\\s*${esc}:\\s*\\*\\*(\\d+)\\*\\*`).exec(md || '')
    return m ? Number(m[1]) : null
  }
  return { sharedTotal: pick('共享屏(真相源)'), mirrored: pick('已被小程序显式镜像'), gaps: pick('缺口(未判定镜像)') }
}

/**
 * 比较纯函数:上一轮快照 ↔ 本轮现读。
 * 倒退维只有三族,逐条给"能整改的下一步"(§5e-1 可整改性准入):
 *   mirrored-decrease —— 镜像声明被撤 ⇒ 查是哪条标记/登记被删(门 128 R3 同判据)
 *   registry-rot      —— 登记表条目腐烂/判红 ⇒ 修登记或补标记(门 128 R1)
 *   map-rot           —— web↔RN 登记表腐烂 ⇒ 修 aligned 指向或补 reason(门 check-web-rn-screen-parity)
 *   doc-stale         —— 账本文档数字≠现读 ⇒ 重跑 report-rn-miniapp-gaps --write
 * 只比"本轮有没有变坏",不比绝对值大小,免得把正常增长判成异常。
 */
function judge({ coverage, webParity, doc, prev }) {
  const cur = {
    mirrored: coverage?.json?.stats?.mirroredShared ?? null,
    registryEntries: coverage?.json?.stats?.registryEntries ?? null,
    coverageRed: coverage?.json?.red?.length ?? null,
    mapRot: webParity?.json?.rot?.length ?? null,
    aligned: webParity?.json?.aligned ?? null,
    unmapped: webParity?.json?.unmapped ?? null,
    sharedTotal: coverage?.json?.stats?.sharedTotal ?? null,
  }
  const reasons = []
  const missing = []
  for (const [k, v] of Object.entries(cur)) if (v === null || v === undefined) missing.push(k)
  if (!coverage.ok) missing.push('coverage')
  if (!webParity.ok) missing.push('webParity')
  if (coverage.ok && webParity.ok && (cur.mirrored === null || cur.coverageRed === null)) {
    missing.push('coverage 字段名对不上(汇总行取不到数)')
  }
  if (missing.length > 0)
    return { state: 'undetermined', cur, reasons, missing, why: `取不到输入:${missing.join(',')}(不记绿也不冒红)` }

  if (cur.coverageRed > 0) reasons.push({ dim: 'registry-rot', detail: `门 128 判红 ${cur.coverageRed} 处` })
  if (cur.mapRot > 0) reasons.push({ dim: 'map-rot', detail: `web↔RN 登记表腐烂 ${cur.mapRot} 行` })

  if (prev && Number.isFinite(prev.mirrored) && cur.mirrored < prev.mirrored)
    reasons.push({ dim: 'mirrored-decrease', detail: `镜像声明 ${prev.mirrored} → ${cur.mirrored}(净减 ${prev.mirrored - cur.mirrored})` })

  const docCur = docNumbers(doc)
  const docMismatch =
    docCur.mirrored !== null && cur.mirrored !== null ? docCur.mirrored !== cur.mirrored : null
  if (docMismatch)
    reasons.push({
      dim: 'doc-stale',
      detail: `账本文档自述 ${docCur.mirrored},现读 ${cur.mirrored} ⇒ 重跑 node scripts/report-rn-miniapp-gaps.mjs --write ${DOC_PATH}`,
    })

  return {
    state: reasons.length > 0 ? 'regressed' : 'ok',
    cur,
    prev: prev ?? null,
    reasons,
    doc: docCur,
  }
}

function readPrev() {
  try {
    const o = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    return { mirrored: o?.cur?.mirrored ?? o?.mirrored ?? null, at: o?.at ?? null }
  } catch {
    return null
  }
}

function selfTestMain() {
  const cases = []
  const mk = (mirrored, reds, rot, aligned = 150, unmapped = 270) => ({
    ok: true,
    json: {
      stats: { mirroredShared: mirrored, registryEntries: 90, sharedTotal: 218 },
      red: new Array(reds).fill({ rule: 'R1' }),
      rot: new Array(rot).fill({ line: 1, why: 'x' }),
      aligned,
      unmapped,
    },
  })
  cases.push({
    name: 'T1 持平无腐烂 ⇒ ok',
    pass: judge({ coverage: mk(91, 0, 0), webParity: mk(91, 0, 0), doc: '- 已被小程序显式镜像: **91**', prev: { mirrored: 91 } }).state === 'ok',
  })
  cases.push({
    name: 'T2 镜像净减 ⇒ regressed/mirrored-decrease',
    pass: (() => {
      const j = judge({ coverage: mk(89, 0, 0), webParity: mk(89, 0, 0), doc: '', prev: { mirrored: 91 } })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'mirrored-decrease')
    })(),
  })
  cases.push({
    name: 'T3 门判红 ⇒ regressed/registry-rot(涨了也照样报红)',
    pass: (() => {
      const j = judge({ coverage: mk(120, 3, 0), webParity: mk(120, 0, 0), doc: '', prev: { mirrored: 91 } })
      return j.state === 'regressed' && j.reasons.some((r) => r.dim === 'registry-rot')
    })(),
  })
  cases.push({
    name: 'T4 文档数字与现读不等 ⇒ doc-stale(可整改,给出重跑命令)',
    pass: (() => {
      const j = judge({ coverage: mk(91, 0, 0), webParity: mk(91, 0, 0), doc: '- 已被小程序显式镜像: **79**', prev: { mirrored: 91 } })
      return j.reasons.some((r) => r.dim === 'doc-stale' && /report-rn-miniapp-gaps/.test(r.detail))
    })(),
  })
  cases.push({
    name: 'T5 子对账器跑不动 ⇒ undetermined,不记绿',
    pass: (() => {
      const j = judge({ coverage: { ok: false, why: 'x' }, webParity: mk(91, 0, 0), doc: '', prev: null })
      return j.state === 'undetermined' && j.missing.includes('coverage')
    })(),
  })
  cases.push({
    name: 'T6 无上一轮快照 ⇒ 不比涨跌,只判当场腐烂(拿 prev 缺失当"没倒退"是错的)',
    pass: (() => {
      const j = judge({ coverage: mk(91, 0, 0), webParity: mk(91, 0, 0), doc: '', prev: null })
      return j.state === 'ok' && j.prev === null
    })(),
  })
  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  }
  console.log(bad === 0 ? `SELF-TEST PASS ${cases.length}/${cases.length}` : `SELF-TEST FAIL ${bad}/${cases.length}`)
  process.exit(bad === 0 ? 0 : 1)
}

function main() {
  const coverage = runRuler('check-cross-end-screen-coverage.mjs')
  const webParity = runRuler('check-web-rn-screen-parity.mjs', ['--json', '--full'])
  const doc = (() => {
    try {
      return execFileSync('git', ['show', `HEAD:${DOC_PATH}`], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 1 << 22,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      return ''
    }
  })()
  const prev = readPrev()
  const result = judge({ coverage, webParity, doc, prev })
  result.at = new Date().toISOString()
  if (recordMode) {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(result, null, 2) + '\n', 'utf8')
    result.recorded = true
  }
  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`STATE=${result.state}`)
    console.log(
      `现读:镜像 ${result.cur?.mirrored ?? '?'} / 登记 ${result.cur?.registryEntries ?? '?'} / web aligned ${result.cur?.aligned ?? '?'} / unmapped ${result.cur?.unmapped ?? '?'}`,
    )
    if (result.why) console.log(`未判定原因:${result.why}`)
    for (const r of result.reasons || []) console.log(`· ${r.dim} —— ${r.detail}`)
  }
  process.exit(result.state === 'regressed' ? 1 : result.state === 'undetermined' ? 2 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (selfTest) selfTestMain()
  else main()
}

export const __test__ = { judge, docNumbers, DOC_PATH }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
