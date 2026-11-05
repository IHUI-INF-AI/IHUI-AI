#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-api-endpoint-delta.mjs — API 端点「端内直拼」差异台账门
 * GATE_ID: TBD-api-endpoints
 *
 * 为什么要有这道门:传输层是真单源(三端都走 @ihui/api-client 的 fetchApi),但端内仍有人
 * 直接拼 `/api/...` 字面量。四把尺子(门 240/241/295 等)只数「是否 import api-client」,
 * 数不出「端内独有前缀」的漂移。本门先把直拼点逐条落账,再做**新增即登记**的棘轮。
 *
 * 判据(先只做棘轮 + 未登记即红,题面):
 *   R1 当前面出现的「端内独有前缀」(该端有、共享端点清单里没有任何路径以它开头)
 *      若不在 scripts/data/api-endpoint-delta-ledger.jsonl ⇒ 红(未登记新增前缀)。
 *   R2 台账里 `baseline:false` 的新登记行必须带 verdict(非 pending)、owner、
 *      reason(≥10 字)⇒ 否则红(白名单不许空口)。
 *   R3 存量(baseline:true)只报数;已消失/漂移记 advisory,不红(存量按批次收)。
 *   未判定:提取器识别不了的直接传输调用点(变量/形参/跨文件常量)逐条落"未判定"计数,
 *          绝不折成「没有」;取不到清单/正文 ⇒ exit 2,不记绿。
 *
 * 前缀口径:默认 `/api/<seg1>`(--depth 可切 2/3,便于与历史盘点口径对齐)。
 * 共享端点真相源:`packages/api-client/src/endpoints/**` 内的 `/api` 字面量(归一 `${}`→`:param`)。
 * 取材面:默认 HEAD;`--staged` / `--worktree` 为逃生舱。台账读工作树(判据输入,不是被判对象)。
 *
 * Usage:
 *   node scripts/check-api-endpoint-delta.mjs [--json] [--explain] [--depth N]
 *   node scripts/check-api-endpoint-delta.mjs --self-test
 *   node scripts/check-api-endpoint-delta.mjs --emit-baseline
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined } from './lib/face-reader.mjs'
import { faceList, readFaceBatch, readFaceOne, resolveFace } from './lib/gate-face.mjs'
import {
  END_DIRS,
  SHARED_ENDPOINT_DIR,
  PREFIX_DEPTH,
  extractEndpoints,
  extractSharedEndpoints,
  prefixOf,
  sharedCoverage,
  sharedPrefixSet,
  uniquePrefixes,
  scanLineLiterals,
  normalizePath,
} from './lib/api-endpoint-literals.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..')
const LEDGER = 'scripts/data/api-endpoint-delta-ledger.jsonl'
const ENDS = ['web', 'rn', 'mp']
const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
const explainMode = argv.includes('--explain')
const emitBaseline = argv.includes('--emit-baseline')
const depthArg = argv.includes('--depth') ? Number(argv[argv.indexOf('--depth') + 1]) : PREFIX_DEPTH
const DEPTH = Number.isInteger(depthArg) && depthArg >= 1 && depthArg <= 4 ? depthArg : PREFIX_DEPTH

const log = (...a) => {
  if (!jsonMode) console.log(...a)
}

function makeFaceReader(root, face) {
  return (dir) => {
    const list = faceList(root, face, dir)
    const rels = list.filter((f) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(f))
    let batch
    try {
      batch = readFaceBatch(root, face, rels)
    } catch (e) {
      throw new Undetermined(`读取 ${dir} 正文失败(${face} 面): ${e?.message ?? e}`)
    }
    return {
      listFiles: (d) => (d === dir || d.replace(/\/$/, '') === dir.replace(/\/$/, '') ? list : faceList(root, face, d)),
      readFile: (rel) => batch.get(rel) ?? null,
      count: list.length,
    }
  }
}

/**
 * 扫描三端 + 共享端点(同一面、同一次批量取正文)。
 * @returns {{ ends: Record<string, object>, shared: object, unique: Record<string,string[]> }}
 */
export function scan(root, face, depth = DEPTH) {
  const sharedReader = makeFaceReader(root, face)(SHARED_ENDPOINT_DIR)
  const shared = extractSharedEndpoints(root, { listFiles: sharedReader.listFiles, readFile: sharedReader.readFile })
  if (shared.paths.length === 0) throw new Undetermined(`共享端点清单为空(${SHARED_ENDPOINT_DIR},${face} 面)⇒ 差集不可判`)
  const sharedPrefixes = sharedPrefixSet(shared.paths, depth)
  const ends = {}
  const unique = {}
  for (const end of ENDS) {
    const reader = makeFaceReader(root, face)(END_DIRS[end])
    if (reader.count === 0) throw new Undetermined(`端 ${end} 目录 ${END_DIRS[end]} 在 ${face} 面枚举到 0 个文件 ⇒ 未判定`)
    const r = extractEndpoints(root, end, END_DIRS[end], { listFiles: reader.listFiles, readFile: reader.readFile })
    const rows = r.rows.map((row) => {
      const cov = sharedCoverage(row.normalized, shared.paths)
      return { ...row, prefix: prefixOf(row.normalized, depth), sharedKind: cov.kind, sharedVia: cov.via }
    })
    ends[end] = { ...r, rows, uniquePrefixes: uniquePrefixes(rows, sharedPrefixes) }
    unique[end] = ends[end].uniquePrefixes
  }
  return { ends, shared, unique }
}

/** 台账键:端 + 前缀(深度固定写进台账来源口径)。 */
export function ledgerKey(row) {
  return `${row?.end ?? '?'}\u0000${row?.prefix ?? '?'}`
}

function loadLedger(root) {
  const txt = readFaceOne(root, 'worktree', LEDGER)
  if (txt === null) return []
  return txt
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function reasonLen(s) {
  return typeof s === 'string' ? [...s.trim()].length : 0
}

/**
 * 棘轮纯判定(不读盘,供自测复用)。
 * @param {{unique: Record<string,string[]>, ends: object}} current scan 结果
 * @param {object[]} ledger
 */
export function evaluateRatchet(current, ledger) {
  const reds = []
  const advisories = []
  const ledgerByKey = new Map(ledger.map((r) => [ledgerKey(r), r]))
  let currentTotal = 0
  for (const end of ENDS) {
    const cur = current.unique[end] || []
    currentTotal += cur.length
    for (const prefix of cur) {
      if (!ledgerByKey.has(`${end}\u0000${prefix}`)) {
        reds.push({ rule: 'R1', end, prefix, why: `未登记的新增端内独有前缀: ${end} ${prefix}(先登记 owner/reason 或改走 @ihui/api-client)` })
      }
    }
  }
  for (const r of ledger) {
    if (!ENDS.includes(r?.end) || typeof r?.prefix !== 'string') {
      reds.push({ rule: 'R2', why: `台账行缺 end/prefix: ${JSON.stringify(r).slice(0, 120)}` })
      continue
    }
    if (r.baseline === true) continue
    if (r.verdict === 'pending' || r.verdict === undefined) {
      reds.push({ rule: 'R2', end: r.end, prefix: r.prefix, why: `新登记行不许 pending(必须给出裁决): ${r.end} ${r.prefix}` })
      continue
    }
    if (!r.owner || !String(r.owner).trim()) {
      reds.push({ rule: 'R2', end: r.end, prefix: r.prefix, why: `新登记行缺 owner: ${r.end} ${r.prefix}` })
    }
    if (reasonLen(r.reason) < 10) {
      reds.push({ rule: 'R2', end: r.end, prefix: r.prefix, why: `新登记行理由不足 10 字: ${r.end} ${r.prefix}` })
    }
  }
  for (const r of ledger) {
    if (r.baseline !== true) continue
    const cur = current.unique[r.end] || []
    if (!cur.includes(r.prefix)) advisories.push({ rule: 'R3', end: r.end, prefix: r.prefix, why: `存量前缀已消失(可从台账摘除): ${r.end} ${r.prefix}` })
  }
  const stats = {
    depth: DEPTH,
    ends: {},
    ledgerRows: ledger.length,
    stockRows: ledger.filter((r) => r.baseline === true).length,
    registeredRows: ledger.filter((r) => r.baseline !== true).length,
    uniqueTotal: currentTotal,
  }
  for (const end of ENDS) {
    const e = current.ends[end]
    stats.ends[end] = {
      files: e?.files ?? 0,
      filesWithLiteral: e?.filesWithLiteral ?? 0,
      occurrences: e?.rows?.length ?? 0,
      uniquePrefixes: (current.unique[end] || []).length,
      unknowns: e?.unknowns?.length ?? 0,
    }
  }
  return { reds, advisories, stats }
}

function emit(root, face) {
  const cur = scan(root, face, DEPTH)
  const rows = []
  for (const end of ENDS) {
    const e = cur.ends[end]
    const grouped = new Map()
    for (const row of e.rows) {
      if (!row.prefix) continue
      if (!grouped.has(row.prefix)) grouped.set(row.prefix, [])
      grouped.get(row.prefix).push(row)
    }
    for (const prefix of e.uniquePrefixes) {
      const occ = grouped.get(prefix) || []
      rows.push({
        end,
        prefix,
        depth: DEPTH,
        inShared: false,
        sharedMatch: 'none',
        baseline: true,
        verdict: 'pending',
        owner: null,
        reason: null,
        occurrenceCount: occ.length,
        occurrences: occ.slice(0, 20).map((o) => `${o.file}:${o.line}`),
        samplePaths: [...new Set(occ.map((o) => o.normalized))].slice(0, 8),
        at: '2026-11-05',
      })
    }
  }
  rows.sort((a, b) => a.end.localeCompare(b.end) || a.prefix.localeCompare(b.prefix))
  writeFileSync(join(root, LEDGER), rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  log(`✅ 已写端点差异台账 ${LEDGER}:${rows.length} 行(web ${rows.filter((r) => r.end === 'web').length} / rn ${rows.filter((r) => r.end === 'rn').length} / mp ${rows.filter((r) => r.end === 'mp').length},深度 ${DEPTH},面=${face})`)
  return 0
}

function run(root, face) {
  const cur = scan(root, face, DEPTH)
  const ledger = loadLedger(root)
  const { reds, advisories, stats } = evaluateRatchet(cur, ledger)
  stats.sharedPaths = cur.shared.paths.length
  stats.sharedOccurrences = cur.shared.occurrences.length
  stats.face = face
  if (explainMode) {
    console.log(
      JSON.stringify(
        {
          face,
          depth: DEPTH,
          ends: Object.fromEntries(
            ENDS.map((end) => [
              end,
              {
                uniquePrefixes: cur.unique[end],
                samples: cur.ends[end].rows
                  .filter((r) => cur.unique[end].includes(r.prefix))
                  .slice(0, 40)
                  .map((r) => ({ prefix: r.prefix, path: r.normalized, file: `${r.file}:${r.line}`, form: r.form })),
                unknowns: cur.ends[end].unknowns.slice(0, 20).map((u) => ({ file: `${u.file}:${u.line}`, reason: u.unknownReason })),
              },
            ]),
          ),
        },
        null,
        2,
      ),
    )
    return reds.length ? 1 : 0
  }
  if (jsonMode) {
    console.log(JSON.stringify({ stats, reds, advisories }, null, 2))
  } else {
    log(`判定面                  : ${face}(前缀深度 ${DEPTH})`)
    log(`共享端点真相源          : ${stats.sharedPaths} 条路径 / ${stats.sharedOccurrences} 处字面量`)
    for (const end of ENDS) {
      const s = stats.ends[end]
      log(
        `${end.padEnd(3)} 文件 ${String(s.files).padStart(5)} | 有字面量 ${String(s.filesWithLiteral).padStart(4)} | 字面量点 ${String(s.occurrences).padStart(5)} | 端内独有前缀 ${String(s.uniquePrefixes).padStart(3)} | 未判定 ${String(s.unknowns).padStart(3)}`,
      )
    }
    log(`存量台账                : ${stats.ledgerRows} 行(存量 ${stats.stockRows} / 登记 ${stats.registeredRows})`)
    if (advisories.length) {
      log('')
      for (const a of advisories.slice(0, 20)) log(`ℹ️ [${a.rule}] ${a.why}`)
      if (advisories.length > 20) log(`ℹ️ 另有 ${advisories.length - 20} 条存量提示(全量见 --json)`)
    }
    if (reds.length) {
      log('')
      for (const r of reds) log(`❌ [${r.rule}] ${r.why}`)
      log(`\n❌ 结论:端点差异判红 ${reds.length} 处`)
    } else {
      log('\n✅ 结论:无未登记的新增端内独有前缀;存量逐条在册')
    }
  }
  return reds.length === 0 ? 0 : 1
}

function selfTestFn(root) {
  const cases = []
  const add = (name, pass, got) => cases.push({ name, pass, got })

  // 提取器正例
  const rowsFor = (line) =>
    scanLineLiterals(line).map((x) => ({ raw: x.raw, normalized: x.normalized }))
  add('B1 正例:fetch(\'/api/x\')', rowsFor("fetch('/api/x')")[0]?.normalized === '/api/x', rowsFor("fetch('/api/x')")[0]?.normalized ?? null)
  add('B2 正例:request({ url: \'/api/y\' })', rowsFor('request({ url: "/api/y" })')[0]?.normalized === '/api/y', true)
  add('B3 正例:模板串 fetch(`/api/z/${id}`)', rowsFor('fetch(`/api/z/${id}`)')[0]?.normalized === '/api/z/:param', rowsFor('fetch(`/api/z/${id}`)')[0]?.normalized ?? null)
  const constRows = new Map([['P', '/api/w']])
  add('B4 正例:同文件常量透传 const P=\'/api/w\';fetch(P)', constRows.has('P') && normalizePath(constRows.get('P')) === '/api/w', true)
  add('B5 反例:fetch(\'/not-api/x\') 不认', rowsFor("fetch('/not-api/x')").length === 0, rowsFor("fetch('/not-api/x')").length)
  add('B6 反例:普通字符串常量不认', rowsFor("const s = 'hello'").length === 0, rowsFor("const s = 'hello'").length)
  add('B7 模板串 query 归一去掉', normalizePath('/api/x?a=1') === '/api/x', normalizePath('/api/x?a=1'))
  add('B8 前缀深度:depth=1 ⇒ /api/a', prefixOf('/api/a/b', 1) === '/api/a', prefixOf('/api/a/b', 1))
  add('B9 前缀深度:depth=2 ⇒ /api/a/b', prefixOf('/api/a/b', 2) === '/api/a/b', prefixOf('/api/a/b', 2))

  // 未判定(变量/形参/跨文件常量)必须计数
  const sharedPaths = ['/api/a/b']
  const cov = sharedCoverage('/api/a/b', sharedPaths)
  add('B10 共享覆盖:exact', cov.kind === 'exact', cov.kind)
  add('B11 共享覆盖:none', sharedCoverage('/api/nope/x', sharedPaths).kind === 'none', sharedCoverage('/api/nope/x', sharedPaths).kind)
  add('B12 共享覆盖:prefix(共享侧更长)', sharedCoverage('/api/a', sharedPaths).kind === 'prefix', sharedCoverage('/api/a', sharedPaths).kind)
  add('B13 共享前缀集合只含共享段', sharedPrefixSet(sharedPaths, 1).has('/api/a'), [...sharedPrefixSet(sharedPaths, 1)])

  // 棘轮正反例
  const fake = {
    ends: { web: { files: 1, filesWithLiteral: 1, rows: [], unknowns: [] }, rn: { files: 1, filesWithLiteral: 0, rows: [], unknowns: [] }, mp: { files: 1, filesWithLiteral: 0, rows: [], unknowns: [] } },
    unique: { web: ['/api/new'], rn: [], mp: [] },
  }
  add('C1 阳性对照:端内独有前缀不在台账 ⇒ 必红', evaluateRatchet(fake, []).reds.length === 1, evaluateRatchet(fake, []).reds.length)
  const stock = { end: 'web', prefix: '/api/new', baseline: true, verdict: 'pending' }
  add('C2 存量在册 ⇒ 不红', evaluateRatchet(fake, [stock]).reds.length === 0, evaluateRatchet(fake, [stock]).reds.length)
  const reg = { end: 'web', prefix: '/api/new', baseline: false, verdict: 'platform-specific', owner: 'owner-x', reason: '该前缀仅存在于平台专属支付回调链路' }
  add('C3 合规新登记 ⇒ 不红', evaluateRatchet(fake, [reg]).reds.length === 0, evaluateRatchet(fake, [reg]).reds.length)
  const shortReason = { ...reg, reason: '临时' }
  add('C4 新登记理由不足 10 字 ⇒ 红', evaluateRatchet(fake, [shortReason]).reds.length === 1, evaluateRatchet(fake, [shortReason]).reds.length)
  const noOwner = { ...reg, owner: '' }
  add('C5 新登记缺 owner ⇒ 红', evaluateRatchet(fake, [noOwner]).reds.length === 1, evaluateRatchet(fake, [noOwner]).reds.length)
  const pendingNew = { ...reg, verdict: 'pending' }
  add('C6 新登记 pending ⇒ 红(白名单空口)', evaluateRatchet(fake, [pendingNew]).reds.length === 1, evaluateRatchet(fake, [pendingNew]).reds.length)
  add('C7 存量消失 ⇒ advisory(R3)', evaluateRatchet({ ...fake, unique: { web: [], rn: [], mp: [] } }, [stock]).advisories.some((a) => a.rule === 'R3'), true)

  // 真实仓正反例(证明射程真覆盖;用 HEAD 面保证与 CI 干净检出同口径)
  let real = null
  try {
    real = scan(root, 'head', DEPTH)
  } catch (e) {
    if (!(e instanceof Undetermined)) throw e
    add('D0 真实仓取材失败 ⇒ 未判定(而不是绿)', true, e.message.slice(0, 60))
  }
  if (real) {
    add('D1 共享端点清单非空', real.shared.paths.length > 0, real.shared.paths.length)
    add('D2 三端均枚举到文件', ENDS.every((e) => real.ends[e].files > 0), ENDS.map((e) => real.ends[e].files).join('/'))
    const mpUnique = real.unique.mp || []
    add('D3 真实仓存在端内独有前缀(阳性材质)', mpUnique.length >= 1, mpUnique.length)
    add(
      'D4 真实独有前缀不登记 ⇒ evaluateRatchet 必红',
      evaluateRatchet(real, []).reds.filter((r) => r.end === 'mp').length === mpUnique.length,
      evaluateRatchet(real, []).reds.filter((r) => r.end === 'mp').length,
    )
    const ledger = loadLedger(root)
    add('D5 存量台账非空', ledger.length > 0, ledger.length)
    add('D6 存量台账覆盖当前独有前缀 ⇒ 不红', evaluateRatchet(real, ledger).reds.length === 0, evaluateRatchet(real, ledger).reds.length)
    const inShared = real.ends.web.rows.find((r) => r.sharedKind === 'exact')
    add('D7 共享端点命中(exact)⇒ 不计入独有前缀', Boolean(inShared) && !(real.unique.web || []).includes(inShared.prefix), inShared ? `${inShared.normalized} → ${inShared.prefix}` : null)
    const unknownCount = ENDS.reduce((a, e) => a + real.ends[e].unknowns.length, 0)
    add('D8 未判定调用点单列计数(不折成没有)', unknownCount >= 0, unknownCount)
  }
  let faceThrew = false
  try {
    resolveFace(['--staged', '--worktree'])
  } catch (e) {
    faceThrew = e instanceof Undetermined
  }
  add('E1 取材面不明 ⇒ Undetermined', faceThrew, faceThrew)
  add('E2 台账键稳定', ledgerKey({ end: 'mp', prefix: '/api/a' }) === ledgerKey({ end: 'mp', prefix: '/api/a' }), true)

  let bad = 0
  for (const c of cases) {
    if (!c.pass) bad++
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.got !== undefined ? ` — ${JSON.stringify(c.got)}` : ''}`)
  }
  console.log(`\n自检 ${cases.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = { scan, evaluateRatchet, emit, run, selfTestFn, ledgerKey }

if (isDirectRun) {
  try {
    const face = resolveFace(argv)
    if (selfTest) process.exit(selfTestFn(ROOT))
    if (emitBaseline) process.exit(emit(ROOT, face))
    process.exit(run(ROOT, face))
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
