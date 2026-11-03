#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是判据自检器,机器读数必须走 stdout */
/**
 * check-gate-rot — 守门判据腐烂自检(O65 四期系列 · 第 3 期「进化回流」,2026-10-25 立)。
 *
 * 病理:守门注册表(scripts/guardian-runner.mjs)与判据单一真源(scripts/lib/judgement-libs.json)
 * 都是**手写清单**。脚本改名/删除/挪目录后清单不会自己跟着变 —— 条目指向一个不存在的路径时,
 * 运行时通常只是"这一项没跑/没生效",**不报错也不判红**(静默失效,与 gate-scope.mjs 头注
 * "改错会让门静默失效"同一族)。本器把"清单里点了名、盘上却没有"这一格变成可机读读数。
 *
 * 射程刻意收窄(宁漏不误报):
 *  - 只吃两处权威清单:注册表里 `script: '<name>'` 字段、judgement-libs.json 的路径数组;
 *  - 不扫注释/提示文案里的脚本名(那是散文,不是接线声明),不猜"大概是改名了"。
 *
 * 分档(§0.3:没判不许写成判过):
 *  - clean        exit 0  全部引用在盘上存在;
 *  - rot          exit 1  有引用指向不存在的路径(逐条点名 source/id/ref);
 *  - undetermined exit 2  清单本身读不到/形状变了/一枚引用都抽不出 ⇒ 判不了,不记绿。
 *  两档并存时 undetermined 优先(判不了的面比已判出的腐烂更需要人先看)。
 *
 * 修法边界:本器**只报不修**。judgement-libs.json 在 O6501 根护栏清单内(root-guard-manifest.json),
 * 自动改写会让部署环 fail-closed;正确路径是人看过读数后 `root-guard --unlock --target judgement-libs`
 * → 改清单 → `root-guard --seal`。
 *
 * 用法:node scripts/check-gate-rot.mjs [--json] [--suggest] [--root <path>] [--self-test]
 *      node scripts/check-gate-rot.mjs --ratchet [--baseline <file>] [--write-baseline]
 *
 * 差值档(2026-10-26 接线时补,治"存量腐烂天天喊、真新增反被淹"):`--ratchet` 只把
 * **相对基线新增**的腐烂算失败(exit 1);存量只报数(exit 0)。基线缺失/形状坏 ⇒ 不回落成
 * 空基线放行,而是把当下每条都算新增(失效方向 = 多喊一次,§0.10),并点名 `baseline=missing`;
 * 基线只能由人看读数后 `--write-baseline` 显式认账(不自动追认,否则新增腐烂第一次就被吞掉)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const SOURCES = Object.freeze([
  { name: 'guardian-registry', path: 'scripts/guardian-runner.mjs', kind: 'registry' },
  { name: 'judgement-libs', path: 'scripts/lib/judgement-libs.json', kind: 'libs' },
])

/** 差值档默认基线(机器状态件,不进提交链;仓外/state 落点见 §15b) */
export const DEFAULT_BASELINE = join(ROOT, '.ihui-agent', 'state', 'gate-rot-baseline.json')

const SCHEMA_VERSION = 1

export class RotShapeError extends Error {}

/**
 * 从注册表源码抽 `script:` 引用(带最近的 id)。
 * 只认缩进行首的字段行:`script:` 在 onFailHint 的散文里也出现过同形字样,行首约束 + 单一
 * 捕获组是唯一能把它和散文分开的机械判据(散文里的引用是 `node scripts/x.mjs` 形态)。
 */
export function extractRegistryRefs(src) {
  const refs = []
  let lastId = ''
  for (const line of String(src ?? '').split('\n')) {
    const idm = line.match(/^\s*id:\s*'([^']+)'/)
    if (idm) {
      lastId = idm[1]
      continue
    }
    const sm = line.match(/^\s*script:\s*'([^']+)'/)
    if (sm && sm[1].trim()) refs.push({ id: lastId || '(无 id)', ref: sm[1].trim() })
  }
  return refs
}

/** judgement-libs.json:必须是非空字符串数组;形状坏 ⇒ throw(调用方判未判定)。 */
export function parseLibRefs(text) {
  let arr
  try {
    arr = JSON.parse(String(text ?? ''))
  } catch (e) {
    throw new RotShapeError(`judgement-libs JSON 解析失败:${e?.message ?? e}`)
  }
  if (!Array.isArray(arr) || arr.length === 0) throw new RotShapeError('judgement-libs 必须是非空数组')
  const bad = arr.filter((x) => typeof x !== 'string' || !x.trim())
  if (bad.length) throw new RotShapeError(`judgement-libs 有非字符串/空条目 ${bad.length} 条`)
  return arr.map((x) => x.trim())
}

/** 引用 → 仓内相对路径。注册表只写 basename(同目录 scripts/);清单写仓相对路径。 */
export function resolveRef(ref) {
  const r = String(ref ?? '').replace(/\\/g, '/').trim()
  if (!r) return ''
  return r.startsWith('scripts/') ? r : `scripts/${r}`
}

/** 逐条判存在性(纯函数,exists 注入以便自检/镜像测试)。 */
export function checkRefs(refs, exists = existsSync) {
  const rot = []
  for (const item of Array.isArray(refs) ? refs : []) {
    const resolved = resolveRef(item.ref)
    if (!resolved) continue
    if (exists(resolved)) continue
    rot.push({ source: item.source, id: item.id ?? '', ref: item.ref, resolved })
  }
  return rot
}

/** 给出可执行的修法提示(只说人该怎么做,本器不动盘)。 */
export function suggestFix(rot, exists = existsSync) {
  const out = []
  for (const r of rot) {
    const base = r.resolved.split('/').pop()
    if (r.source === 'judgement-libs') {
      if (exists(`scripts/${base}`)) {
        out.push(`${r.resolved} → 改为 scripts/${base}(同名脚本在 scripts/ 根下;改前先 root-guard --unlock --target judgement-libs)`)
      } else {
        out.push(`${r.resolved} → 从 judgement-libs.json 摘除该条(脚本已不存在;改前先 root-guard --unlock --target judgement-libs)`)
      }
    } else {
      out.push(`${r.resolved} → 补回该判据脚本,或从 guardian-runner 注册表(#${r.id})摘除该项`)
    }
  }
  return out
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

/** 采集 + 判定(纯逻辑;读盘注入以便测试)。 */
export function audit(root = ROOT, readFile = readText, exists = existsSync) {
  const refs = []
  const undetermined = []
  const checked = { 'guardian-registry': 0, 'judgement-libs': 0 }

  for (const src of SOURCES) {
    const abs = join(root, src.path)
    let text
    try {
      text = readFile(abs)
    } catch (e) {
      undetermined.push({ source: src.name, why: `读不到(${src.path}):${e?.message ?? e}` })
      continue
    }
    if (src.kind === 'registry') {
      const got = extractRegistryRefs(text)
      if (got.length === 0) {
        undetermined.push({ source: src.name, why: '注册表一枚 script 引用都抽不出(格式已漂,不猜)' })
        continue
      }
      checked[src.name] = got.length
      for (const g of got) refs.push({ source: src.name, ...g })
    } else {
      let libs
      try {
        libs = parseLibRefs(text)
      } catch (e) {
        undetermined.push({ source: src.name, why: e.message })
        continue
      }
      checked[src.name] = libs.length
      for (const ref of libs) refs.push({ source: src.name, id: '', ref })
    }
  }

  const rot = checkRefs(refs, (p) => exists(join(root, p)))
  const overall = undetermined.length ? 'undetermined' : rot.length ? 'rot' : 'clean'
  return { checked, rot, undetermined, overall, suggest: suggestFix(rot, (p) => exists(join(root, p))) }
}

/**
 * 腐烂条目的稳定身份 = 来源 + 注册表 id + 解析后路径。
 * 刻意不含行号/时刻/扫描顺序:那三样每次重扫都会抖,进身份就变成"每次都算新增"。
 */
export function rotKeyOf(x) {
  return `${x?.source ?? '?'}|${x?.id || '-'}|${x?.resolved ?? x?.ref ?? '?'}`
}

/** 与基线做集合差:新增(要喊)/ 已修(基线有、本轮没有)分开报,存量只报数。 */
export function ratchetOf(rot, baselineKeys) {
  const base = new Set(Array.isArray(baselineKeys) ? baselineKeys : [])
  const current = new Set(rot.map(rotKeyOf))
  return {
    keys: [...current].sort(),
    newRot: rot.filter((x) => !base.has(rotKeyOf(x))),
    fixed: [...base].filter((k) => !current.has(k)).sort(),
  }
}

/**
 * 读基线。读不到/形状坏 ⇒ status='undetermined' 且 keys=[] —— 调用方据此把当下每条都算
 * 新增(方向:多喊一次),**绝不**回落成"空基线 ⇒ 全 known ⇒ 静默放行"。
 */
export function readBaseline(file, readFile = (p) => readFileSync(p, 'utf8')) {
  let doc
  try {
    doc = JSON.parse(readFile(file))
  } catch (e) {
    return { status: 'undetermined', keys: [], why: `基线读不到或非法 JSON(${file}):${e?.message ?? e}` }
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.keys)) {
    return { status: 'undetermined', keys: [], why: `基线形状坏(缺 keys 数组):${file}` }
  }
  return { status: 'ok', keys: doc.keys.filter((k) => typeof k === 'string' && k.trim()), at: doc.at ?? null }
}

/** 写基线(只有人显式 --write-baseline 才走这里;自动追认会把新增腐烂吞掉)。 */
export function writeBaseline(file, keys, { now = new Date() } = {}) {
  const dir = dirname(file)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  const uniq = [...new Set(keys.map(String))].sort()
  writeFileSync(file, `${JSON.stringify({ v: SCHEMA_VERSION, at: now.toISOString(), keys: uniq }, null, 1)}\n`, 'utf8')
  return { written: uniq.length, file }
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }

  t('注册表抽取:只认行首 script 字段并带 id', () => {
    const src = ["const checks = [", "  {", "    id: '7',", "    label: 'x',", "    script: 'check-a.mjs',", "  },", "]"].join('\n')
    const refs = extractRegistryRefs(src)
    if (refs.length !== 1) throw new Error(`抽到 ${refs.length} 条`)
    if (refs[0].id !== '7' || refs[0].ref !== 'check-a.mjs') throw new Error(JSON.stringify(refs[0]))
  })
  t('注册表抽取:散文里的 node scripts/x.mjs 不算引用', () => {
    const src = ["    onFailHint: [", "      '     1. node scripts/check-a.mjs  (定位)',", "    ],"].join('\n')
    if (extractRegistryRefs(src).length !== 0) throw new Error('把散文当引用')
  })
  t('清单解析:非数组/空/非字符串一律拒绝', () => {
    for (const bad of ['{}', '[]', '[1]', '[""]', 'not-json']) {
      let hit = false
      try {
        parseLibRefs(bad)
      } catch (e) {
        hit = e instanceof RotShapeError
      }
      if (!hit) throw new Error(`未拒绝:${bad}`)
    }
    const ok = parseLibRefs('["scripts/lib/a.mjs"]')
    if (ok[0] !== 'scripts/lib/a.mjs') throw new Error('合法清单解析错')
  })
  t('存在性判定:缺失进 rot、存在不进', () => {
    const exists = (p) => p === 'scripts/ok.mjs'
    const rot = checkRefs([
      { source: 'guardian-registry', id: '1', ref: 'ok.mjs' },
      { source: 'guardian-registry', id: '2', ref: 'gone.mjs' },
    ], exists)
    if (rot.length !== 1 || rot[0].resolved !== 'scripts/gone.mjs') throw new Error(JSON.stringify(rot))
  })
  t('修法提示:同名脚本在 scripts/ 根下 ⇒ 建议改路径;否则摘除', () => {
    const exists = (p) => p === 'scripts/git-lock.mjs'
    const rot = [
      { source: 'judgement-libs', ref: 'scripts/lib/git-lock.mjs', resolved: 'scripts/lib/git-lock.mjs' },
      { source: 'judgement-libs', ref: 'scripts/lib/nope.mjs', resolved: 'scripts/lib/nope.mjs' },
    ]
    const s = suggestFix(rot, exists)
    if (!s[0].includes('改为 scripts/git-lock.mjs')) throw new Error(s[0])
    if (!s[1].includes('摘除')) throw new Error(s[1])
  })
  t('全量读数:源读不到 ⇒ undetermined 优先', () => {
    const readFile = () => {
      throw new Error('ENOENT')
    }
    const r = audit('/x', readFile, () => true)
    if (r.overall !== 'undetermined') throw new Error(`overall=${r.overall}`)
    if (r.undetermined.length !== 2) throw new Error(`undetermined=${r.undetermined.length}`)
  })
  t('全量读数:引用全在 ⇒ clean', () => {
    const readFile = (p) => (p.includes('judgement-libs') ? '["scripts/lib/a.mjs"]' : "    id: '1',\n    script: 'a.mjs',")
    const r = audit('/x', readFile, () => true)
    if (r.overall !== 'clean') throw new Error(`overall=${r.overall}`)
  })

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test']) return selfTest()
  const root = typeof args.root === 'string' ? args.root : ROOT
  const baselineFile = typeof args.baseline === 'string' ? args.baseline : DEFAULT_BASELINE
  const r = audit(root)

  // 显式认账档:只有人看读数后才跑。自动追认 = 新增腐烂第一次就被吞掉(§0.10 反向失效)。
  if (args['write-baseline']) {
    if (r.overall === 'undetermined') {
      console.log(`❓ 未判定:${r.undetermined.map((u) => u.why).join(' / ')} ⇒ 拒绝写基线(判不了的面不得被认账)`)
      return 2
    }
    const w = writeBaseline(baselineFile, r.rot.map(rotKeyOf))
    console.log(`已写基线:${w.written} 条 ⇒ ${w.file}(此后 --ratchet 只拦新增)`)
    return 0
  }

  if (args.ratchet) {
    const base = readBaseline(baselineFile)
    const ratchet = ratchetOf(r.rot, base.keys)
    const state = r.overall === 'undetermined' ? 'undetermined' : ratchet.newRot.length ? 'new' : r.rot.length ? 'known' : 'clean'
    const payload = {
      v: SCHEMA_VERSION,
      overall: state,
      checked: r.checked,
      rot: r.rot,
      newRot: ratchet.newRot,
      fixed: ratchet.fixed,
      baseline: { file: baselineFile, status: base.status, count: base.keys.length, why: base.why ?? null },
      undetermined: r.undetermined,
    }
    if (args.json) {
      console.log(JSON.stringify(payload))
    } else {
      console.log(
        `GATE-ROT state=${state} known=${r.rot.length} new=${ratchet.newRot.length} fixed=${ratchet.fixed.length}` +
          `${base.status === 'ok' ? '' : ` baseline=${base.status}`}`,
      )
      for (const x of ratchet.newRot) console.log(`❌ 新增腐烂[${x.source}${x.id ? ` #${x.id}` : ''}]:${x.resolved}`)
      for (const k of ratchet.fixed) console.log(`✅ 已修(基线有、本轮无):${k}`)
      for (const u of r.undetermined) console.log(`❓ 未判定[${u.source}]:${u.why}`)
      if (state === 'known') console.log(`ℹ 存量腐烂 ${r.rot.length} 条只报数(差值档只拦新增;认账 --write-baseline,修法 --suggest)`)
      if (state === 'undetermined') console.log('❓ 有清单判不了,不记绿')
      if (base.status !== 'ok') console.log(`ℹ 基线${base.status === 'undetermined' ? '不可用' : base.status}:${base.why ?? baselineFile} ⇒ 当下腐烂一律按新增报出`)
    }
    return state === 'undetermined' ? 2 : state === 'new' ? 1 : 0
  }

  const payload = { v: SCHEMA_VERSION, overall: r.overall, checked: r.checked, rot: r.rot, undetermined: r.undetermined, suggest: r.suggest }
  if (args.json) {
    console.log(JSON.stringify(payload))
  } else {
    console.log(`守门判据腐烂自检:注册表 ${r.checked['guardian-registry']} 枚 / 判据库 ${r.checked['judgement-libs']} 枚`)
    for (const u of r.undetermined) console.log(`❓ 未判定[${u.source}]:${u.why}`)
    for (const x of r.rot) console.log(`❌ 腐烂[${x.source}${x.id ? ` #${x.id}` : ''}]:${x.resolved}`)
    if (args.suggest) for (const s of r.suggest) console.log(`  ↳ ${s}`)
    if (r.overall === 'clean') console.log('✅ 全部引用在盘上存在')
    if (r.overall === 'rot') console.log(`❌ 检出 ${r.rot.length} 条腐烂引用(本器只报不修,修法见 --suggest)`)
    if (r.overall === 'undetermined') console.log('❓ 有清单判不了,不记绿')
  }
  return r.overall === 'undetermined' ? 2 : r.overall === 'rot' ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  extractRegistryRefs,
  parseLibRefs,
  resolveRef,
  checkRefs,
  suggestFix,
  audit,
  rotKeyOf,
  ratchetOf,
  readBaseline,
  writeBaseline,
  DEFAULT_BASELINE,
  SOURCES,
  RotShapeError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
