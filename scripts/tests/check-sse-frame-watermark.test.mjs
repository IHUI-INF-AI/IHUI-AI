// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-sse-frame-watermark.mjs(§22c 模式)。
 *
 * 判据本体(`OUTLET_FILE` / `LOCAL_FILE` / `READLOOP_FILE` / `OUTLET_MARKERS` /
 * `READLOOP_MARKERS` / `READLOOP_GATE_MARKER` / `READLOOP_WIRING_PATTERN` /
 * `countOccurrences` / `outletMarkersMissing` / `checkRealRepo`)全部从
 * `../check-sse-frame-watermark.mjs` 的 `__test__` 出口取,本文件不再声明第二份标记清单。
 *
 * 断言输入逐字取自真仓 HEAD(scripts/lib/face-reader.mjs 的 catBatch 现读):
 *   · packages/shared/src/sse/agent-events.ts(唯一出口)
 *   · packages/api-client/src/frame-watermark.ts(同形移植)
 *   · packages/api-client/src/client.ts(SSE 读环接线)
 *
 * 成对口径:
 *   S1 出口标记:HEAD 原文判"无缺失" / 逐个摘掉必判"缺这一个"(逐个都是承重的)/
 *   S2 countOccurrences 的正反与不重叠计数 /
 *   S3 读环接线:两个字符串彼此可分离(摘掉接线行 ⇒ 通路位归零而闸定义位不变),
 *      摘掉 import 行 ⇒ READLOOP_MARKERS 归零 /
 *   S4 端到 CLI(临时目录里的门副本 + HEAD 三件套原文):在位必绿,缺文件/缺标记必红并点名 /
 *   S5 阳性对照那一格(fromSeq 计数)确实会翻面 —— 这是本票立项时"看不见型缺陷"的防线 /
 *   S6 真仓工作树面:checkRealRepo() 的结论与 CLI 退出码同一答案。
 *
 * 一处已知不对称(如实登记,不掩盖):S5 用的那个字段名住在门体里、**没有**进 `__test__` 出口,
 * 所以这一条只能在本文件把它当"取证数据"写一次(不是判据清单);门体若哪天导出它,本条应改读出口。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-sse-frame-watermark.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-sse-frame-watermark.mjs'

const THREE = [gate.OUTLET_FILE, gate.LOCAL_FILE, gate.READLOOP_FILE]
const SPECS = THREE.map((r) => `HEAD:${r}`)
const READ = catBatch(REPO_ROOT, SPECS, { timeout: 120_000 })
const BLOBS = {}
for (let i = 0; i < THREE.length; i++) {
  const text = READ.get(SPECS[i])
  if (typeof text !== 'string') throw new Error(`HEAD 面取不到 ${THREE[i]} ⇒ 取证失败,不记绿`)
  BLOBS[THREE[i]] = text
}

/** 把一段 HEAD 原文里的某个标记全部摘掉(构造面变异,不落盘、不改门体)。 */
function stripMarker(text, marker) {
  return text.split(marker).join('')
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}

/** 临时目录里跑一份门副本(与被审门体逐字同源,只换 REPO_ROOT 指向的面)。 */
function scratchRepo(dir, { omit = null, outletMutate = null, localMutate = null, loopMutate = null } = {}) {
  const scriptsCopy = join(dir, 'scripts')
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, scriptsCopy, ['lib/scratch-dir.mjs'])
  for (const rel of THREE) {
    if (rel === omit) continue
    let text = BLOBS[rel]
    if (rel === gate.OUTLET_FILE && outletMutate) text = outletMutate(text)
    if (rel === gate.LOCAL_FILE && localMutate) text = localMutate(text)
    if (rel === gate.READLOOP_FILE && loopMutate) text = loopMutate(text)
    put(dir, rel, text)
  }
  return join(scriptsCopy, GATE_REL)
}

function runGate(scriptAbs, args = []) {
  try {
    const out = execFileSync(process.execPath, [scriptAbs, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e?.status === 'number' ? e.status : -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

test('S1 出口标记:HEAD 原文判"无缺失",逐个摘掉后必须恰好报出被摘的那一个', () => {
  assert.deepEqual(
    gate.outletMarkersMissing(BLOBS[gate.OUTLET_FILE]),
    [],
    'HEAD 的唯一出口被判缺标记 ⇒ 尺子与生产形态已经对不上',
  )
  for (const marker of gate.OUTLET_MARKERS) {
    const missing = gate.outletMarkersMissing(stripMarker(BLOBS[gate.OUTLET_FILE], marker))
    assert.ok(missing.includes(marker), `摘掉标记 ${marker} 后必须被点名,实得:${JSON.stringify(missing)}`)
    assert.ok(missing.length < gate.OUTLET_MARKERS.length, `摘掉一个标记却报出全部缺失(${JSON.stringify(missing)})⇒ 逐条归因失效`)
  }
  const empty = gate.outletMarkersMissing('export function unrelated() { return 1 }\n')
  assert.equal(empty.length, gate.OUTLET_MARKERS.length, '空壳文件必须一条不落地报缺,否则"在位"与"根本没判"同形')
})

test('S2 countOccurrences 既能数到真站,也对不存在的针归零,且计数不重叠', () => {
  const gateHits = gate.countOccurrences(BLOBS[gate.READLOOP_FILE], gate.READLOOP_GATE_MARKER)
  assert.ok(gateHits > 0, '读环里数不到水位闸标记 ⇒ 接线那一格是空的')
  const wiringHits = gate.countOccurrences(BLOBS[gate.READLOOP_FILE], gate.READLOOP_WIRING_PATTERN)
  assert.ok(wiringHits > 0, '读环里数不到 onLine 通路串 ⇒ 通路锁无从生效')
  assert.equal(gate.countOccurrences(BLOBS[gate.READLOOP_FILE], `${gate.READLOOP_GATE_MARKER}ZZ`), 0, '针加一位就必须归零,否则数的是别的东西')
  assert.equal(gate.countOccurrences('', gate.READLOOP_GATE_MARKER), 0, '空正文不得数出东西')
  const twice = `${gate.READLOOP_WIRING_PATTERN}\n${gate.READLOOP_WIRING_PATTERN}\n`
  assert.equal(gate.countOccurrences(twice, gate.READLOOP_WIRING_PATTERN), 2, '两处必须数成两处(数成 1 就是重叠窗口)')
})

test('S3 读环两个字符串彼此可分离:摘掉接线行只动通路位,摘掉 import 行只动接线位', () => {
  const loop = BLOBS[gate.READLOOP_FILE]
  const noWiring = stripMarker(loop, gate.READLOOP_WIRING_PATTERN)
  assert.notEqual(noWiring, loop, '通路串在 HEAD 读环里摘不动 ⇒ 断言对象不存在')
  assert.equal(gate.countOccurrences(noWiring, gate.READLOOP_WIRING_PATTERN), 0)
  assert.equal(gate.countOccurrences(noWiring, gate.READLOOP_GATE_MARKER), gate.countOccurrences(loop, gate.READLOOP_GATE_MARKER))
  const noImport = stripMarker(loop, gate.READLOOP_MARKERS[0])
  assert.notEqual(noImport, loop, 'READLOOP_MARKERS[0] 在 HEAD 读环里摘不动 ⇒ 断言对象不存在')
  for (const m of gate.READLOOP_MARKERS) {
    assert.ok(gate.countOccurrences(loop, m) > 0, `HEAD 读环必须含接线标记 ${m}`)
    assert.equal(gate.countOccurrences(noImport, m), 0, `摘掉 ${m} 后仍数得到 ⇒ 该标记在正文里另有分叉`)
  }
})

test('S4 端到 CLI(临时目录 + HEAD 三件套):在位必绿,缺出口文件/缺标记必红并点名', () => {
  const dir = mkScratch('sse-watermark-mirror-')
  try {
    const base = scratchRepo(dir)
    const green = runGate(base)
    assert.equal(green.code, 0, `HEAD 原文三件套必须判绿,实得 ${green.code}:${green.out}`)
    const dir2 = mkScratch('sse-watermark-nooutlet-')
    try {
      const g2 = scratchRepo(dir2, { omit: gate.OUTLET_FILE })
      const bad = runGate(g2)
      assert.equal(bad.code, 1, `唯一出口缺失必须红,实得 ${bad.code}:${bad.out}`)
      assert.ok(bad.out.includes(gate.OUTLET_FILE), `必须点名缺的是哪个文件:${bad.out}`)
    } finally {
      rmScratch(dir2)
    }
    for (const marker of gate.OUTLET_MARKERS) {
      const dir3 = mkScratch('sse-watermark-marker-')
      try {
        const g3 = scratchRepo(dir3, { outletMutate: (t) => stripMarker(t, marker) })
        const bad = runGate(g3)
        assert.equal(bad.code, 1, `摘掉出口标记 ${marker} 必须红,实得 ${bad.code}:${bad.out}`)
        assert.ok(bad.out.includes(marker), `判红必须点名缺的是哪个标记:${bad.out}`)
      } finally {
        rmScratch(dir3)
      }
    }
  } finally {
    rmScratch(dir)
  }
})

test('S5 阳性对照那一格有牙:把帧水位字段词汇抹掉必须翻成"看不见",而不是继续报绿', () => {
  const needle = 'fromSeq'
  const hits = gate.countOccurrences(BLOBS[gate.OUTLET_FILE], needle)
  assert.ok(hits > 0, `HEAD 出口里 ${needle} 已为 0 ⇒ 这一格失去对照物,先核对再改本条`)
  const dir = mkScratch('sse-watermark-positive-')
  try {
    const g = scratchRepo(dir, { outletMutate: (t) => stripMarker(t, needle) })
    const bad = runGate(g)
    assert.equal(bad.code, 1, `抹掉 ${needle} 后仍判绿 ⇒ "看不见型缺陷"这一格没人守:${bad.out}`)
    assert.ok(bad.out.includes(needle), `报告必须说清是哪一个字段看不见:${bad.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('S6 同形移植与真仓面:checkRealRepo 的结论与 CLI 退出码同一答案,且 api-client 那一格承重', () => {
  const local = BLOBS[gate.LOCAL_FILE]
  const sharedMarkers = gate.OUTLET_MARKERS.filter((m) => local.includes(m))
  assert.ok(
    sharedMarkers.length > 0,
    'api-client 同形移植文件里一条出口标记都不含 ⇒ HEAD 面本身就不在位,先核对再改本条',
  )
  const problems = gate.checkRealRepo()
  assert.ok(Array.isArray(problems), 'checkRealRepo 必须返回问题清单(空数组 = 绿,不是 undefined)')
  for (const p of problems) assert.equal(typeof p, 'string')
  const cli = runGate(join(SCRIPTS_DIR, GATE_REL))
  console.log(`    · 现读:checkRealRepo 问题 ${problems.length} 条 / CLI exit ${cli.code}`)
  assert.equal(
    problems.length === 0,
    cli.code === 0,
    `生产入口(${problems.length} 条)与 CLI 退出码(${cli.code})结论相反 ⇒ 有一面在说谎:${cli.out}`,
  )
  // 同形移植那一格是否承重:逐个出口标记从 LOCAL 文件里抹掉,至少要有一次把整跑翻红。
  let flipped = 0
  const tried = []
  for (const marker of sharedMarkers) {
    const dir = mkScratch('sse-watermark-local-')
    try {
      const g = scratchRepo(dir, { localMutate: (t) => stripMarker(t, marker) })
      const r = runGate(g)
      tried.push(`${marker}=>exit ${r.code}`)
      if (r.code === 1) flipped++
    } finally {
      rmScratch(dir)
    }
  }
  console.log(`    · 现读:同形移植承重性探测 ${tried.join(' / ')}`)
  assert.ok(flipped > 0, `从同形移植文件里抹掉任何出口标记都不会判红(${tried.join(' / ')})⇒ 那一格是装饰`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
