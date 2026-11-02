// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-landing-ledger 镜像测试(§22c:判据一律 import 生产出口,本文件零复制判定)。
 *
 * 立因:守护 8 条跨端写盘腿的输出悬挂在工作树,收编侧要「验过才收」——账本在册 ∧
 * blob 逐字节相符 ∧ 已过静默期。本档把 collectiblePaths 的四条准入与三态失效方向
 * (少收不冒收、取不到=未判定不空集)逐格钉死,每枚否定结论都配阳性对照
 * (证明不是整把尺失灵)。
 *
 * 夹具纪律:临时 git 仓一律 mkScratch(§15b,不落仓库树内——守门 208);
 * git 派生一律走 face-reader.gitRaw(§12g 显式 stdio + 绝对路径 + safe.directory)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw, BARE_GIT_RE, bareGitCountOf } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  LEDGER_FIELDS,
  LEDGER_PATH,
  appendLanding,
  collectiblePaths,
  landingKeyOf,
  readLanding,
  __test__,
} from '../lib/cross-end-landing-ledger.mjs'

const LIB_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'cross-end-landing-ledger.mjs'),
  'utf8',
)

const OID_A = 'a'.repeat(40)
const OID_B = 'b'.repeat(40)
const QUIET = 3 * 60 * 1000

/** 独立临时 git 仓(不 commit 也够 hash-object/check-ignore 用)。 */
function newRepo() {
  const dir = mkScratch('cross-end-ledger-')
  gitRaw(['init', '-q'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}
function hash(dir, rel) {
  return String(gitRaw(['hash-object', '--', rel], dir)).trim().toLowerCase()
}
const agedIso = (minAgo = 10) => new Date(Date.now() - minAgo * 60_000).toISOString()

test('T1 四键齐备 + blob 相符 + 超静默 ⇒ collectible 恰 1 条,其余桶全空', () => {
  const dir = newRepo()
  try {
    put(dir, 'apps/demo/page.tsx', 'export const x = 1\n')
    const oid = hash(dir, 'apps/demo/page.tsx')
    const ap = appendLanding([{ at: agedIso(10), leg: 'sweepRn', path: 'apps/demo/page.tsx', blobOid: oid }], { root: dir })
    assert.deepEqual(ap, { appended: 1, rejected: [], deduped: 0 })
    const r = collectiblePaths(new Date(), { quietMs: QUIET, root: dir })
    assert.equal(r.ok, true)
    assert.deepEqual(r.collectible, [{ leg: 'sweepRn', path: 'apps/demo/page.tsx', blobOid: oid, ageMs: r.collectible[0].ageMs }])
    assert.ok(r.collectible[0].ageMs >= QUIET)
    assert.deepEqual([r.quiet.length, r.contested.length, r.incomplete.length, r.ignored.length], [0, 0, 0, 0])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T2 缺 blobOid ⇒ incomplete 点名该键且 collectible=0;同账另一枚齐备行仍命中(阳性对照)', () => {
  const dir = newRepo()
  try {
    put(dir, 'apps/demo/bad.tsx', 'x\n')
    put(dir, 'apps/demo/good.tsx', 'y\n')
    const goodOid = hash(dir, 'apps/demo/good.tsx')
    // 齐备行走生产 appendLanding 落账;缺键行只能手工追写原始行
    // (appendLanding 结构上写不进缺键行——那是 T7 的射程,不是这里的)。
    const first = appendLanding([{ at: agedIso(10), leg: 'sweepWeb', path: 'apps/demo/good.tsx', blobOid: goodOid }], { root: dir })
    assert.equal(first.appended, 1)
    const badRow = { at: agedIso(10), leg: 'sweepWeb', path: 'apps/demo/bad.tsx' }
    writeFileSync(__test__.ledgerPathFor(dir), `${JSON.stringify(badRow)}\n`, { flag: 'a', encoding: 'utf8' })
    const r = collectiblePaths(new Date(), { root: dir })
    assert.equal(r.incomplete.length, 1)
    assert.equal(r.incomplete[0].path, 'apps/demo/bad.tsx')
    assert.deepEqual(r.incomplete[0].missingFields, ['blobOid'])
    assert.deepEqual(r.collectible.map((c) => c.path), ['apps/demo/good.tsx'], '尺子没失灵:齐备那条照样收')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T3 守护写完后文件又被改一行 ⇒ contested 点名 expected/actual,collectible=0(防事故核心)', () => {
  const dir = newRepo()
  try {
    put(dir, 'apps/demo/page.tsx', 'export const x = 1\n')
    const before = hash(dir, 'apps/demo/page.tsx')
    put(dir, 'apps/demo/stable.tsx', 'stable\n')
    const stableOid = hash(dir, 'apps/demo/stable.tsx')
    appendLanding(
      [
        { at: agedIso(10), leg: 'healMirror', path: 'apps/demo/page.tsx', blobOid: before },
        { at: agedIso(10), leg: 'healMirror', path: 'apps/demo/stable.tsx', blobOid: stableOid },
      ],
      { root: dir },
    )
    put(dir, 'apps/demo/page.tsx', 'export const x = 1\n// 别席后来改了一行\n')
    const after = hash(dir, 'apps/demo/page.tsx')
    assert.notEqual(after, before)
    const r = collectiblePaths(new Date(), { root: dir })
    assert.equal(r.contested.length, 1)
    assert.equal(r.contested[0].path, 'apps/demo/page.tsx')
    assert.equal(r.contested[0].expectedOid, before)
    assert.equal(r.contested[0].actualOid, after)
    assert.deepEqual(r.collectible.map((c) => c.path), ['apps/demo/stable.tsx'], '只拦被改的那枚,未动的照收')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T4 未到静默期 ⇒ quiet,collectible=0;同账超静默行仍命中(阳性对照)', () => {
  const dir = newRepo()
  try {
    put(dir, 'apps/demo/a.tsx', 'a\n')
    put(dir, 'apps/demo/b.tsx', 'b\n')
    appendLanding(
      [
        { at: new Date().toISOString(), leg: 'sweepRn', path: 'apps/demo/a.tsx', blobOid: hash(dir, 'apps/demo/a.tsx') },
        { at: agedIso(30), leg: 'sweepRn', path: 'apps/demo/b.tsx', blobOid: hash(dir, 'apps/demo/b.tsx') },
      ],
      { root: dir },
    )
    const r = collectiblePaths(new Date(), { quietMs: QUIET, root: dir })
    assert.deepEqual(r.quiet.map((q) => q.path), ['apps/demo/a.tsx'])
    assert.equal(r.collectible.length, 1)
    assert.equal(r.collectible[0].path, 'apps/demo/b.tsx')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T5 账本不存在 / 空文件 ⇒ 双双 ok:false 且 reason 可区分,绝不返回 ok:true 空集', () => {
  const dir = newRepo()
  try {
    const miss = readLanding({ root: dir })
    assert.equal(miss.ok, false)
    assert.match(miss.reason, /not-found/)
    const c1 = collectiblePaths(new Date(), { root: dir })
    assert.equal(c1.ok, false)
    assert.match(c1.reason, /not-found/)

    const file = __test__.ledgerPathFor(dir)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '', 'utf8')
    const emp = readLanding({ root: dir })
    assert.equal(emp.ok, false)
    assert.match(emp.reason, /empty/)
    assert.doesNotMatch(emp.reason, /not-found/)
    const c2 = collectiblePaths(new Date(), { root: dir })
    assert.equal(c2.ok, false)
    assert.match(c2.reason, /empty/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T6 appendLanding 幂等:同键同 oid 追写两次 ⇒ 真文件只有 1 行(守护 30 分钟一轮不撑爆账本)', () => {
  const dir = newRepo()
  try {
    const row = { at: agedIso(10), leg: 'sweepMiniapp', path: 'pages/home/index.tsx', blobOid: OID_A }
    const first = appendLanding([row], { root: dir })
    assert.equal(first.appended, 1)
    const second = appendLanding([row], { root: dir })
    assert.deepEqual(second, { appended: 0, rejected: [], deduped: 1 })
    const lines = readFileSync(__test__.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1)
    // 同 path 不同 leg 各算一条(复合主键,不按 path 单键)
    const other = appendLanding([{ ...row, leg: 'healMirror' }], { root: dir })
    assert.equal(other.appended, 1)
    assert.equal(landingKeyOf({ leg: 'a', path: 'b' }), 'a\u0000b')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T7 appendLanding 拒缺键行 ⇒ rejected 带 reason 且不落盘;同批合格行照常写(对照)', () => {
  const dir = newRepo()
  try {
    const res = appendLanding(
      [
        { leg: 'sweepWeb', path: 'x.tsx', blobOid: OID_A },
        { at: agedIso(1), leg: 'sweepWeb', path: 'y.tsx', blobOid: 'not-hex' },
        { at: agedIso(1), leg: 'sweepWeb', path: 'z.tsx', blobOid: OID_B },
      ],
      { root: dir },
    )
    assert.equal(res.appended, 1)
    assert.equal(res.rejected.length, 2)
    assert.match(res.rejected[0].reason, /at/)
    assert.match(res.rejected[1].reason, /40 位十六进制/)
    const lines = readFileSync(__test__.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1)
    assert.match(lines[0], /z\.tsx/)
    // 全批都不合格 ⇒ 一个字节都不写(账本文件都不该存在)
    const dir2 = newRepo()
    try {
      const bad = appendLanding([{ leg: '', path: '', blobOid: '' }], { root: dir2 })
      assert.equal(bad.appended, 0)
      assert.equal(bad.rejected.length, 1)
      assert.equal(existsSync(__test__.ledgerPathFor(dir2)), false, '不合格批不得创建账本')
    } finally {
      rmScratch(dir2, { bestEffort: true })
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T8 gitignored 路径永不收(ignored 桶点名);同账未 ignore 行仍命中(对照)', () => {
  const dir = newRepo()
  try {
    put(dir, '.gitignore', 'ignored/\n')
    put(dir, 'ignored/tmp-page.tsx', 'g\n')
    put(dir, 'src/keep.tsx', 'k\n')
    appendLanding(
      [
        { at: agedIso(10), leg: 'sweepRn', path: 'ignored/tmp-page.tsx', blobOid: hash(dir, 'ignored/tmp-page.tsx') },
        { at: agedIso(10), leg: 'sweepRn', path: 'src/keep.tsx', blobOid: hash(dir, 'src/keep.tsx') },
      ],
      { root: dir },
    )
    const r = collectiblePaths(new Date(), { root: dir })
    assert.deepEqual(r.ignored.map((i) => i.path), ['ignored/tmp-page.tsx'])
    assert.deepEqual(r.collectible.map((c) => c.path), ['src/keep.tsx'])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T9 形状锁:LEDGER_FIELDS 恰为那 5 键;LEDGER_PATH 末段正确(常量比对,非工作树推导)', () => {
  assert.deepEqual([...LEDGER_FIELDS], ['at', 'leg', 'path', 'blobOid', 'landedSha'])
  assert.ok(LEDGER_PATH.endsWith(join('.ihui-agent', 'state', 'cross-end-landing.jsonl')))
})

test('T10 face 参数真换取材面:工作树被改但 HEAD blob 相符 ⇒ head 面收、worktree 面拦(成对)', () => {
  const dir = newRepo()
  try {
    put(dir, 'apps/demo/page.tsx', 'v1\n')
    gitRaw(['config', 'user.email', 't@example.invalid'], dir)
    gitRaw(['config', 'user.name', 'T'], dir)
    gitRaw(['add', 'apps/demo/page.tsx'], dir)
    gitRaw(['commit', '-q', '-m', 'seed'], dir)
    const headOid = String(gitRaw(['rev-parse', 'HEAD:apps/demo/page.tsx'], dir)).trim().toLowerCase()
    put(dir, 'apps/demo/page.tsx', 'v1\n// 工作树被别席改过\n')
    assert.notEqual(hash(dir, 'apps/demo/page.tsx'), headOid)
    appendLanding([{ at: agedIso(10), leg: 'portalConverge', path: 'apps/demo/page.tsx', blobOid: headOid }], { root: dir })
    const wt = collectiblePaths(new Date(), { root: dir })
    assert.equal(wt.collectible.length, 0)
    assert.equal(wt.contested.length, 1, 'worktree 面 blob 已漂 ⇒ contested')
    const hd = collectiblePaths(new Date(), { face: 'head', root: dir })
    assert.equal(hd.collectible.length, 1, 'HEAD 面 blob 逐字节相符 ⇒ 可收')
    assert.equal(hd.collectible[0].blobOid, headOid)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T11 纯判据构造面(§22c:直接用生产 __test__,不在测试里复算)', () => {
  assert.equal(__test__.parseLine('{"at":"x"}').at, 'x')
  assert.equal(__test__.parseLine('not-json'), null)
  assert.equal(__test__.parseLine('[1]'), null)
  assert.equal(__test__.isRowComplete({ at: 't', leg: 'l', path: 'p', blobOid: OID_A }), true)
  assert.deepEqual(__test__.missingFieldsOf({ at: 't', leg: 'l' }), ['path', 'blobOid'])
  assert.equal(__test__.ageMs({ at: 'garbage' }, 1000), null, '时刻解析不出 ⇒ null,不当 0 用')
  assert.ok(__test__.ageMs({ at: '1970-01-01T00:00:00.000Z' }, 60_000) === 60_000)
  assert.equal(__test__.pathShapeOk('apps/web/x.tsx'), true)
  assert.equal(__test__.pathShapeOk('apps\\web\\x.tsx'), false)
  assert.equal(__test__.pathShapeOk('../escape'), false)
  assert.equal(__test__.pathShapeOk('/abs/path'), false)
})

test('T12 形状锁:取材必须走 face-reader,库体内不得出现裸 git 派生或 process.cwd 定根', () => {
  assert.equal(bareGitCountOf(LIB_SRC), 0, `发现裸 git 派生:${[...LIB_SRC.matchAll(BARE_GIT_RE)].map((m) => m[0]).join(' | ')}`)
  assert.match(LIB_SRC, /from '\.\/face-reader\.mjs'/, '未 import face-reader ⇒ 等于自写一套 git 取材(§0.6)')
  assert.doesNotMatch(LIB_SRC, /process\.cwd\(\)/, 'ROOT 必须由 import.meta.url 推导(AGENTS §15)')
  assert.match(LIB_SRC, /pathToFileURL/, '§22d:isDirectRun 守卫必须用 pathToFileURL,禁手拼 file:///')
  // 失效方向自检:collectiblePaths 对未知面绝不猜
  assert.equal(collectiblePaths(new Date(), { face: 'nope', root: process.env.SYSTEMROOT ?? '.' }).ok, false)
})
// 水印由 scripts/watermark.mjs inject 追加(勿手改本行以下区域)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
