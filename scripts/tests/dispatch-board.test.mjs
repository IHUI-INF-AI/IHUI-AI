#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * scripts/tests/dispatch-board.test.mjs — 排他切席板的镜像取证(§22c)。
 *
 * 判据**全部 import 源脚本的 __test__**,本文件不复制任何一条判据常量 ——
 * 第二份判据必然与第一份漂移,这是本仓 §0.6 立过的铁律(守门 191 也拦这一型)。
 *
 * 钉的是五格(每格都做了"摘掉即翻红"的变异自证):
 *  ① 不相交者同波、② 同目录不同文件**不许**算冲突(判据过严同样是"席位空转"的成因)、
 *  ③ 目录形态与其中文件必须互撞(尾斜杠不剥就认不出)、④ 热文件档串行、
 *  ⑤ 名额不足落 seat-cap 而不是"没活"(失效方向必须是"多问一次",不能是"少派一席")。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as BOARD } from '../dispatch-board.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

const cand = (line, ticketId, paths, hot = []) => ({
  line,
  ticketId,
  title: ticketId,
  paths,
  hot,
  dirtyHit: [],
  claim: null,
})

test('① 作用域不相交的两票落进同一波(并发的正面)', () => {
  const r = BOARD.buildWave(
    [cand(1, 'A', ['apps/api/src/x.ts']), cand(2, 'B', ['apps/web/src/y.tsx'])],
    { maxSeats: 6 },
  )
  assert.equal(r.wave.length, 2)
  assert.equal(r.dropped.length, 0)
})

test('② 同目录不同文件不算冲突(把这条判严就会凭空少派一席)', () => {
  const r = BOARD.buildWave(
    [cand(1, 'A', ['apps/api/src/x.ts']), cand(2, 'C', ['apps/api/src/z.ts'])],
    { maxSeats: 6 },
  )
  assert.deepEqual(
    r.wave.map((w) => w.ticketId),
    ['A', 'C'],
  )
  assert.equal(r.dropped.length, 0, '同目录不同文件被挡 ⇒ 判据过严(本镜像要喊的就是这一型)')
})

test('③ 目录形态与落在其下的文件互撞(剥尾斜杠后才认得出)', () => {
  const r = BOARD.buildWave(
    [cand(1, 'A', ['apps/api/src/x.ts']), cand(2, 'D', ['apps/api/'])],
    { maxSeats: 6 },
  )
  assert.equal(r.wave.length, 1, '目录⇄其内文件必须只进一席')
  assert.equal(r.dropped[0].ticketId, 'D')
  assert.equal(r.dropped[0].why, 'path-overlap')
})

test('④ 活文档族按"档族"串行(路径不同但同属 README 族也不并发写)', () => {
  const r = BOARD.buildWave(
    [cand(5, 'E', ['README.md'], ['README.md']), cand(6, 'F', ['README.ja.md'], ['README.md'])],
    { maxSeats: 6 },
  )
  assert.equal(r.wave.length, 1, '同档族必须只进一席')
  assert.equal(r.dropped[0].why, 'hot-file', `路径不相等而族相同 ⇒ 应归 hot-file,实得:${r.dropped[0]?.why}`)
})

test('⑤b 票面没写点名路径 ⇒ 不落波(不知道撞谁就不能发互斥合格证)', () => {
  const r = BOARD.buildWave([cand(1, 'A', ['a.ts']), cand(2, 'Z', [])], { maxSeats: 6 })
  assert.equal(r.wave.length, 1)
  assert.equal(r.dropped[0].why, 'scope-unknown')
  const spin = BOARD.spinVerdict({ dispatchFaceCount: 2, waveCount: 0, dropped: r.dropped, anchorMismatch: 0 })
  assert.equal(spin.state, 'needs-scope', '一枚都排不进且原因是缺作用域 ⇒ 点名要补作用域,不是"没活"')
})

test('⑤ 名额小于候选 ⇒ 其余落 seat-cap,空转归因不得读成"没活"', () => {
  const r = BOARD.buildWave(
    [cand(1, 'A', ['a.ts']), cand(2, 'B', ['b.ts']), cand(3, 'C', ['c.ts'])],
    { maxSeats: 1 },
  )
  assert.equal(r.wave.length, 1)
  assert.deepEqual(r.dropped.map((d) => d.why), ['seat-cap', 'seat-cap'])
  const spin = BOARD.spinVerdict({ dispatchFaceCount: 3, waveCount: 1, dropped: r.dropped, anchorMismatch: 0 })
  assert.equal(spin.red, false, '有席位在跑就不该判红')
})

test('⑥ 有可派票却一枚排不进 ⇒ spinning 判红(这才是要人重排的信号)', () => {
  const spin = BOARD.spinVerdict({
    dispatchFaceCount: 3,
    waveCount: 0,
    dropped: [{ why: 'path-overlap' }],
    anchorMismatch: 0,
  })
  assert.equal(spin.state, 'spinning')
  assert.equal(spin.red, true)
})

test('⑦ 派单面本就 0 枚 ⇒ 不判红(§12e:与提交内容无关的红只能逼人 --no-verify)', () => {
  const spin = BOARD.spinVerdict({ dispatchFaceCount: 0, waveCount: 0, dropped: [], anchorMismatch: 0 })
  assert.equal(spin.state, 'idle-no-backlog')
  assert.equal(spin.red, false)
})

test('⑧ 行号只做同轮取数键:正文前缀对不上必须点名剔除', () => {
  assert.equal(BOARD.prefixMatches('- [ ] G-9 甲案做法', '- [ ] G-9 乙案做法完全不同', { min: 20 }), false)
  assert.equal(
    BOARD.prefixMatches('- [ ] G-9 修法唯一 = 抽常量', '- [ ] G-9 修法唯一 = 抽常量再注入 primitive adapter', {
      min: 20,
    }),
    true,
  )
})

test('⑨ 唯一入口输出面取行:制表线段头必须认(ASCII 同认)', () => {
  const face = ['── 说明 ──', '── 2 行(判定面:HEAD blob)──', '  L6067  - [ ] **未闭环** 甲', '  L6826  - [ ] 首页读数'].join('\n')
  const got = BOARD.parseDispatchFace(face)
  assert.equal(got.ok, true, `段头没被认出:实得 ${JSON.stringify(got.reason)}`)
  assert.equal(got.declared, 2)
  assert.equal(got.rows.length, 2)
  assert.equal(got.rows[0].line, 6067)
  assert.match(got.rows[0].clipped, /未闭环/)
  const ascii = BOARD.parseDispatchFace('-- 1 行(判定面:HEAD blob)--\n  L7  - [ ] 乙')
  assert.equal(ascii.ok, true, 'ASCII 段头同样要认(不能只测一种写法)')
})

test('⑩ 段头取不到 ⇒ 未判定,绝不冒充"0 行=台账没活"(本器最贵的假绿)', () => {
  const a = BOARD.parseDispatchFace('随便一段散文\n没有段头')
  assert.equal(a.ok, false)
  assert.equal(a.rows.length, 0, '解析失败与"真的 0 行"都返回空数组,调用方只能靠 ok 分档')
  const b = BOARD.parseDispatchFace('── 9 行(判定面:HEAD blob)──\n  L10  - [ ] 甲')
  assert.equal(b.ok, false, '宣告 9 行只抠到 1 行 ⇒ 输出面形状变了,不许拿残板拼计划')
  const c = BOARD.parseDispatchFace('── 0 行(判定面:HEAD blob)──')
  assert.equal(c.ok, true, '段头自报 0 行是合法读数,与解析失败必须分家')
  assert.equal(c.rows.length, 0)
})

test('⑪ 盘容量读不出 ⇒ null,不得用 0 冒充"盘满"也不冒充"够"', () => {
  assert.equal(BOARD.freeGbOf(path.join(ROOT, 'definitely-not-a-path-ihui')), null)
  const real = BOARD.freeGbOf(ROOT)
  assert.ok(real === null || (Number.isFinite(real) && real > 0), `实得:${real}`)
})

test('⑫ 残缺/未知旗标一律 exit 2 面(静默退回默认是本仓登记过的失效型)', () => {
  assert.equal(BOARD.parseArgs(['--seats']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--seats=abc']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--bogus']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--staged']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--worktree']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--seats', '4']).issues.length, 0)
})

test('⑬ 直执行档:--self-test 真跑一次并取末行(接线锁,不是把判据再抄一遍)', () => {
  const out = execFileSync(process.execPath, [path.join('scripts', 'dispatch-board.mjs'), '--self-test'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).toString()
  assert.match(out, /\[dispatch-board\] self-test (\d+)\/(\d+) 通过/, `末行实得:${out.trim().slice(-160)}`)
  const m = /self-test (\d+)\/(\d+)/.exec(out)
  assert.ok(m, '没量到例数')
  assert.equal(Number(m[1]), Number(m[2]), `源脚本自检有未通过项:${out.trim().slice(-200)}`)
})

// ── 席位作用域台账(跨会话那一格的往返取证;夹具走正牌 scratch 根,不落仓库树) ──
test('⑭ claim 往返:他席装载为"已占"、本席自载排除、过期自动失效', () => {
  const dir = mkScratch('board-claim-')
  try {
    const now = new Date()
    const a = BOARD.appendSeatClaim(dir, { seat: 's1', ticket: 'G-1', paths: ['x/y.ts'], ttlMinutes: 60, nowIso: now.toISOString() })
    assert.equal(a.ok, true, `登记未落:${a.reason}`)

    const other = BOARD.loadSeatClaims(dir, { selfSeat: 's2' })
    assert.equal(other.claims.length, 1)
    assert.equal(BOARD.flattenSeatClaims(other.claims).get('x/y.ts'), 's1')

    const w = BOARD.buildWave([cand(1, 'A', ['x/y.ts'])], {
      maxSeats: 3,
      externalClaims: BOARD.flattenSeatClaims(other.claims),
    })
    assert.equal(w.wave.length, 0, '他席占着的地必须排不进')
    assert.equal(w.dropped[0].why, 'held-by-seat')

    const self = BOARD.loadSeatClaims(dir, { selfSeat: 's1' })
    assert.equal(self.claims.length, 0, '本席不该被自己的登记挡住(否则一登记就永远派不动第二票)')

    const later = BOARD.loadSeatClaims(dir, { nowMs: now.getTime() + 7 * 60 * 60 * 1000 })
    assert.equal(later.claims.length, 0, '超过 ttlMinutes 必须失效 —— 不然一席崩掉就把这块地永久占死')
  } finally {
    rmScratch(dir)
  }
})

test('⑮ release 只标 releasedAt 不删行(留出处),坏行点名不炸', () => {
  const dir = mkScratch('board-rel-')
  try {
    BOARD.appendSeatClaim(dir, { seat: 's9', ticket: 'G-9', paths: ['p/q.ts'] })
    const rel = BOARD.releaseSeatClaims(dir, { seat: 's9' })
    assert.equal(rel.ok, true)
    assert.equal(rel.released, 1)
    const text = readFileSync(BOARD.seatLedgerPath(dir), 'utf8')
    assert.match(text, /releasedAt/, '收席必须留痕')
    assert.match(text, /p\/q\.ts/, '收席不得把行删掉(证据留在出处)')

    const afterRelease = BOARD.loadSeatClaims(dir, {})
    assert.equal(afterRelease.claims.length, 0, '收席后必须立刻还地(行留着只是为了有出处)')

    BOARD.appendSeatClaim(dir, { seat: 's10', ticket: 'G-10', paths: ['r/s.ts'] })
    appendFileSync(BOARD.seatLedgerPath(dir), '{这行不是合法 JSON\n', 'utf8')
    const loaded = BOARD.loadSeatClaims(dir, {})
    assert.ok(loaded.malformed.length >= 1, `坏行必须点名,实得:${JSON.stringify(loaded.malformed)}`)
    assert.equal(loaded.claims.length, 1, '坏行不吞掉好行')
  } finally {
    rmScratch(dir)
  }
})

test('⑯ 缺 --scope 的登记当场拒(空作用域正是本器拒绝发合格证的那一格)', () => {
  assert.equal(BOARD.parseArgs(['--claim', 's1']).issues.length, 1)
  assert.ok(BOARD.parseArgs(['--claim']).issues.length >= 1, '缺席位名与缺作用域两条都必须报,不许静默退回')
  assert.ok(BOARD.parseArgs(['--release']).issues.length >= 1)
  assert.equal(BOARD.parseArgs(['--ttl-minutes', 'abc']).issues.length, 1)
  assert.equal(BOARD.parseArgs(['--claim', 's1', '--scope', 'a.ts', '--ttl-minutes', '30']).issues.length, 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
