// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fix-rn-color-literals.mjs × cross-end-landing-ledger 的镜像测试(2026-11-03 立,§22c)。
 *
 * 钉什么(与另七条跨端写盘腿同族,尤其 scripts/tests/land-rn-style-tiers.test.mjs 的 L1–L6):
 *  · 整链证明:本 leg 的生产登记出口写完一文件 ⇒ 账本恰好 +1 行,同夹具里 collectiblePaths
 *    判成 collectible —— 取 oid 与收编侧必须同一条尺,否则永远 contested;
 *  · 可续跑:重放同产出 ⇒ appended=0 ∧ deduped=1 ∧ landedPathsOf 判已落(⇒ skipLanded);
 *  · 防事故:登记后再改一行 ⇒ contested ∧ 不再判已落(凭据不是橡皮图章);
 *  · 只读档零登记:空批一个字节不写(账本文件都不建)+ 真跑一次无写旗的器物,真账本字节不变;
 *  · 账本读不到 ⇒ landedPathsOf 报 ok:false+空集合,调用方回落全量并标 ledger=unjudged,不崩不判死;
 *  · 形状锁:leg 短名出处(guardian-runner 现读的 script 名)/ 取 oid 形态 / 登记调用点被 --apply
 *    守卫 / landedBatch.push 排在 writeFileSync + watermark inject **之后**(inject 前实测的 oid
 *    与盘上最终态不等 ⇒ 收编侧永远 contested)/ landingKeys 与三枚 lander 逐字同文。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内 —— 守门 208);判据零复制(§0.6),
 * 本文件只编排夹具,oid/读账/登记一律 import 生产出口。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectiblePaths, readLanding, __test__ as ledgerT } from '../lib/cross-end-landing-ledger.mjs'
import { __test__ as leg, LEG_NAME } from '../fix-rn-color-literals.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const ROOT = resolve(SCRIPTS, '..')
const SCRIPT = join(SCRIPTS, 'fix-rn-color-literals.mjs')
const RUNNER = join(SCRIPTS, 'guardian-runner.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const { blobOidOf, landedPathsOf, registerLanding, landingKeys } = leg

/** 器物自己的落点目录里的一个相对路径(与真射程同形,只是夹具)。 */
const DEMO = 'packages/app/src/screens/ColorDemo.tsx'
const AGED = (minAgo = 10) => new Date(Date.now() - minAgo * 60_000).toISOString()

function newRepo() {
  const dir = mkScratch('fixrn-ledger-')
  gitRaw(['init', '-q'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}

test('整链证明:写完盘→登记(写完才实测 oid)→账本恰 1 行→collectiblePaths 判成 collectible', () => {
  const dir = newRepo()
  try {
    put(dir, DEMO, "import { rnCssLight } from '@ihui/design-tokens'\nexport const s = { backgroundColor: rnCssLight.black50 }\n")
    const res = registerLanding([DEMO], { root: dir, at: AGED(10) })
    assert.equal(res.ok, true)
    assert.equal(res.landing, 1, `landing 应恰 1:实得 ${JSON.stringify(res)}`)
    assert.equal(res.rejected.length, 0)
    const rd = readLanding({ root: dir })
    assert.equal(rd.ok, true)
    assert.equal(rd.lines.length, 1, '一轮产出恰登记 1 行')
    assert.equal(readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean).length, 1, '真文件字节数与库读法一致')
    const row = rd.lines[0]
    assert.equal(row.leg, LEG_NAME, '登记的 leg 必须是本 leg 短名(复合主键的一半)')
    assert.equal(row.path, DEMO)
    assert.equal(row.blobOid, blobOidOf(DEMO, { root: dir }), '登记的必须是写完盘后实测的 hash')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.equal(r.ok, true)
    assert.deepEqual(r.collectible.map((c) => c.path), [DEMO], '跨器整链:写腿登记的 blob 凭据被收编侧逐字节认账')
    assert.equal(r.collectible[0].leg, LEG_NAME)
    assert.deepEqual([r.contested.length, r.incomplete.length, r.ignored.length], [0, 0, 0])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('重放同产出 ⇒ landing=0 ∧ deduped=1 ∧ 账本仍 1 行 ∧ landedPathsOf 判已落(⇒ 本轮 skipLanded)', () => {
  const dir = newRepo()
  try {
    put(dir, DEMO, 'const a = 1\n')
    const at = AGED(10)
    const first = registerLanding([DEMO], { root: dir, at })
    assert.equal(first.landing, 1)
    const again = registerLanding([DEMO], { root: dir, at })
    assert.deepEqual({ landing: again.landing, deduped: again.deduped }, { landing: 0, deduped: 1 })
    assert.equal(readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean).length, 1, '重放不得撑爆账本')
    const lp = landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.ok(lp.paths.has(DEMO), '本 leg 在册 ∧ blob 未漂 ⇒ --apply 轮整枚跳过(可续跑)')
    assert.match(SRC, /if \(landedSet\.has\(rel\)\) \{\s*\n\s*skipLanded \+= 1/, '主循环的跳过腿必须在位')
    assert.match(SRC, /landingKeys\(\{ landing, deduped: landingDedup, rejected: landingRejected, skipLanded, ledgerUnjudged, landingErr \}\)/, 'skipLanded 必须进结论行')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('登记后再被改一行 ⇒ contested ∧ landedPathsOf 不再含它(凭据不是橡皮图章)', () => {
  const dir = newRepo()
  try {
    put(dir, DEMO, 'const z = 1\n')
    registerLanding([DEMO], { root: dir, at: AGED(10) })
    put(dir, DEMO, 'const z = 1\n// 别席后来加了一行\n')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.deepEqual(r.collectible, [], 'blob 已被改动 ⇒ 一条不放')
    assert.equal(r.contested.length, 1)
    assert.equal(r.contested[0].path, DEMO)
    assert.equal(r.contested[0].leg, LEG_NAME)
    const lp = landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.equal(lp.paths.has(DEMO), false, 'blob 已漂 ⇒ 不认已落,下轮照旧尝试(失效方向=多做一遍)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('只读档零登记:空批一个字节不写(账本都不建)+ 真跑无写旗的器物,真账本字节不变', () => {
  const dir = newRepo()
  try {
    put(dir, DEMO, 'const w = 1\n')
    const res = registerLanding([], { root: dir })
    assert.deepEqual(res, { ok: true, landing: 0, deduped: 0, rejected: [] })
    assert.equal(existsSync(ledgerT.ledgerPathFor(dir)), false, '没写盘就没有产出 ⇒ 一行都不许登记')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  // 真档对照:不带写旗跑一次器物本体(HEAD 面只读),真账本要么仍不存在、要么逐字节不变
  const ledger = join(ROOT, '.ihui-agent', 'state', 'cross-end-landing.jsonl')
  const before = existsSync(ledger) ? readFileSync(ledger, 'utf8') : null
  const stdout = execFileSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true, // §5b 派生进程纪律
    timeout: 5 * 60 * 1000, // 守门 80
    maxBuffer: 1 << 22,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g
  })
  assert.match(String(stdout), /\[fix-color-literals\] 只读档\(未写盘\)/, '只读档必须真跑完(不是静默退出)')
  assert.match(String(stdout), / landing=0 landingPath=\.ihui-agent\/state\/cross-end-landing\.jsonl skipLanded=0/, '只读档结论行必须自证零登记')
  const after = existsSync(ledger) ? readFileSync(ledger, 'utf8') : null
  assert.equal(after, before, '只读档不得往账本写一个字节')
})

test('账本不存在 ⇒ landedPathsOf 只报 ok:false+空集合(调用方回落全量并标 ledger=unjudged),不崩不判死', () => {
  const dir = newRepo()
  try {
    put(dir, DEMO, 'x\n')
    const lp = landedPathsOf({ root: dir })
    assert.equal(lp.ok, false)
    assert.match(lp.reason, /not-found/)
    assert.equal(lp.paths.size, 0)
    assert.match(SRC, /else ledgerUnjudged = true/, '读不到账本的出口是回落+标记,绝不 exit/判死')
    const trail = landingKeys({ ledgerUnjudged: true })
    assert.match(trail, / landing=0 /)
    assert.match(trail, /landingPath=\.ihui-agent\/state\/cross-end-landing\.jsonl/)
    assert.match(trail, /skipLanded=0 ledger=unjudged/)
    const errTrail = landingKeys({ landing: 1, landingErr: 'EACCES: permission denied' })
    assert.match(errTrail, /landing=1 .* landingError=EACCES:_permission_denied/, '失败必须把 landingError 写进结论行(§0.3)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('形状锁:登记调用点被 --apply 守卫,且实测 oid 排在写盘 + 水印注入之后', () => {
  assert.match(
    SRC,
    /if \(argv\.includes\('--apply'\) && landedBatch\.length\) \{[\s\S]{0,220}?registerLanding\(landedBatch\)/,
    '登记必须挂在 --apply ∧ 本批真写了盘之后(只读/预演档结构上到不了)',
  )
  const w = SRC.indexOf('writeFileSync(p, r.src')
  const inj = SRC.indexOf("'inject', p")
  const push = SRC.indexOf('landedBatch.push(rel)')
  assert.ok(w > 0 && inj > 0 && push > 0, `三个锚点都必须存在:write=${w} inject=${inj} push=${push}`)
  assert.ok(push > inj && push > w, 'landedBatch.push 必须排在 writeFileSync 与 watermark inject 之后 —— 登记的是盘上最终字节')
  assert.match(SRC, /gitRaw\(\['hash-object', '--', rel\], root\)/, '取 oid 必须与库内 worktree 面同一把尺(face-reader gitRaw + hash-object)')
  assert.match(SRC, /from '\.\/lib\/cross-end-landing-ledger\.mjs'/, '落账/读账必须 import 库出口')
  assert.doesNotMatch(SRC, /function appendLanding|function readLanding|function collectiblePaths/, '不得在本腿重写库判据(§0.6)')
  assert.ok(leg.LEDGER_REL === join('.ihui-agent', 'state', 'cross-end-landing.jsonl').replace(/\\/g, '/'), 'landingPath 读数必须与库的 ledgerPathFor 同源')
})

test('同形锁:leg 短名 = guardian-runner 现读派发名,landingKeys 与三枚 lander 逐字同文', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const m = /script:\s*'fix-rn-color-literals\.mjs'/.exec(runner)
  assert.ok(m, '守门 255 的登记条目必须以 script: 自报名(腿短名的出处)')
  assert.equal(LEG_NAME, 'fix-rn-color-literals', '腿短名 = 派发的那枚文件名去掉 .mjs,不得自立新名')
  for (const n of ['land-web-style-tiers', 'land-rn-style-tiers', 'land-miniapp-style-tiers']) {
    const text = readFileSync(join(SCRIPTS, `${n}.mjs`), 'utf8')
    const mine = /export function landingKeys\([\s\S]*?\n\}/.exec(SRC)?.[0]
    const theirs = /export function landingKeys\([\s\S]*?\n\}/.exec(text)?.[0]
    assert.ok(mine && theirs, `${n}: 缺 landingKeys`)
    assert.equal(mine, theirs, `${n} 的 landingKeys 必须与本腿逐字同文(八条腿一个机读形态)`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
