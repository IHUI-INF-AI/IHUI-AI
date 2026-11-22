// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * land-miniapp-style-tiers.test.mjs — 小程序落档器的镜像测试(§22c)
 *
 * 判据全部 import 源脚本(`rewriteCss` / `buildReverse`),本文件不复制正则或档值。
 * 钉四件事:①等值才改;②档外值不动;③幂等(改完再跑 0 处);④派生文件 app.css 不在射程。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectiblePaths, __test__ as ledgerT } from '../lib/cross-end-landing-ledger.mjs'
import { __test__ as land } from '../land-miniapp-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'land-miniapp-style-tiers.mjs')

const SPACING = { none: 0, '2xs': 2, xs: 4, 'xs-loose': 6, sm: 8, 'sm-loose': 10, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64 }
const TYPE = { badge: 10, caption: 11, label: 12, body: 14, strong: 15, title: 16, subtitle: 18, heading: 20, display: 24, 'display-lg': 30 }
const REV = land.buildReverse(SPACING, TYPE)

test('T1 等值命中才改:24rpx→md / 28rpx→body', () => {
  const a = land.rewriteCss('.a{padding:24rpx}', REV)
  assert.equal(a.out, '.a{padding: var(--spacing-md)}')
  assert.equal(a.changes, 1)
  const b = land.rewriteCss('.b{font-size:28rpx}', REV)
  assert.equal(b.out, '.b{font-size: var(--text-body)}')
})

test('T2 档外值一律不动(26rpx=13px 不在档表)', () => {
  const r = land.rewriteCss('.c{padding:26rpx}', REV)
  assert.equal(r.out, '.c{padding:26rpx}')
  assert.equal(r.changes, 0)
})

test('T3 line-height 不动:多个档可能共享同一行高,反查不是单值', () => {
  const r = land.rewriteCss('.d{line-height:40rpx}', REV)
  assert.equal(r.changes, 0)
})

test('T4 calc / 非 rpx 单位不动(只吃纯 <数>rpx)', () => {
  assert.equal(land.rewriteCss('.e{padding:calc(24rpx + 1px)}', REV).changes, 0)
  assert.equal(land.rewriteCss('.e2{padding:24px}', REV).changes, 0)
  assert.equal(land.rewriteCss('.e3{padding:24rpx 24%;}', REV).changes, 1, '空格分隔的多值时只换命中的那一段')
})

test('T5 幂等:改过的正文再跑必须 0 处', () => {
  const once = land.rewriteCss('.f{padding:24rpx;margin-top:16rpx;font-size:28rpx}', REV)
  assert.equal(once.changes, 3)
  const twice = land.rewriteCss(once.out, REV)
  assert.equal(twice.changes, 0, '不幂等 ⇒ 每轮都会造 diff')
  assert.equal(twice.out, once.out)
})

test('T6 同值多档取首个声明(档表声明序决定),并且是确定性的', () => {
  const r1 = land.buildReverse({ a: 8, b: 8 }, {})
  assert.equal(r1.spacing.get(8), 'a')
  const r2 = land.buildReverse({ b: 8, a: 8 }, {})
  assert.equal(r2.spacing.get(8), 'b')
})

test('T7 派生文件保护:app.css 必须在排除表里(手改会被 sync 洗掉)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /DERIVED_EXCLUDE\s*=\s*new Set\(\[[^\]]*apps\/miniapp-taro\/src\/app\.css/, 'app.css 必须显式排除')
})

test('T8 归属避让在位:工作树脏的文件必须跳过而不是覆盖', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /const dirty = ownershipDirtyPaths\(\{ root: ROOT \}\)/, '必须有归属检查(判据单源 lib/git-paths.mjs)')
  assert.match(src, /from '\.\/lib\/git-paths\.mjs'/, '归属判据必须 import 库出口,不得就地再写一份')
  assert.match(src, /held\.push\(f\)/, '脏文件必须进 held 而不是被改')
})

test('T9 本文件必须是测试本体,不是落档器的整文件副本', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const target = readFileSync(SCRIPT, 'utf8')
  assert.ok(target.length > self.length)
  const copyMarker = ['export', 'function', 'rewriteCss'].join(' ')
  assert.equal(self.includes(copyMarker), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T10 buildReverse 必须收 TYPE_STEPS 的真实对象形态(v.size)', () => {
  // 首版用 Number(v) 对 {size,lineHeight,weight} 得 NaN ⇒ 字号映射整表为空,而自检喂的是数字 ⇒ 假绿
  const r = land.buildReverse({ md: 12 }, { body: { size: 14, lineHeight: 20, weight: 400 } })
  assert.equal(r.type.get(14), 'body')
  const r2 = land.buildReverse({ md: 12 }, { body: 14 })
  assert.equal(r2.type.get(14), 'body', '数字形态也必须继续支持')
})

test('T11 字号面:只有 leading 覆盖时才换,且注释/档外值不动', () => {
  const rev = land.buildReverse({}, { body: { size: 14 }, label: { size: 12 } })
  const a = land.rewriteClassNameTokens('<View className="text-[length:28rpx] leading-[40rpx]" />', rev)
  assert.equal(a.changes, 1)
  assert.match(a.out, /text-body/)
  assert.equal(land.rewriteClassNameTokens('<View className="text-[length:28rpx]" />', rev).changes, 0, '无 leading 覆盖会改行高,不得换')
  assert.equal(land.rewriteClassNameTokens(`// className="text-[length:28rpx] leading-[40rpx]"
`, rev).changes, 0, '注释里的同形文本不动')
  assert.equal(land.rewriteClassNameTokens('<View className="text-[length:26rpx] leading-[40rpx]" />', rev).changes, 0, '档外值不猜')
  const idem = land.rewriteClassNameTokens(a.out, rev)
  assert.equal(idem.changes, 0, '幂等')
})

test('T12 档名必须转 kebab:TYPE_STEPS 的 displayLg ↔ CSS 变量 --text-display-lg', () => {
  const r = land.buildReverse({}, { displayLg: { size: 30 } })
  assert.equal(r.type.get(30), 'display-lg', '首版用了 camelCase 原键 ⇒ 产出 var(--text-displayLg),那是个不存在的变量')
})

// ─── 写盘凭据账本接线(2026-11-03,治 R1 无凭据 / R2 不可续跑;三端同形)────────────
// 判据零复制(§22c):oid 走 land.blobOidOf、读账本走 land.landedPathsOf、登记走
// land.registerLanding、核验走库的 collectiblePaths —— 本段只编排夹具,不复算任何判定。

function newRepo(prefix) {
  const dir = mkScratch(prefix)
  gitRaw(['init', '-q'], dir)
  return dir
}
function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  return abs
}
const agedIso = (minAgo = 10) => new Date(Date.now() - minAgo * 60_000).toISOString()

test('L1 整链证明:写完盘→登记(实测 oid)→账本恰 1 行→collectiblePaths 判成 collectible', () => {
  const dir = newRepo('land-miniapp-ledger-')
  try {
    put(dir, 'apps/miniapp-taro/src/pages/home/index.css', '.a{padding:var(--spacing-md)}\n')
    const res = land.registerLanding(['apps/miniapp-taro/src/pages/home/index.css'], { root: dir, at: agedIso(10) })
    assert.equal(res.ok, true)
    assert.equal(res.landing, 1)
    const lines = readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1, '一轮产出恰登记 1 行')
    const row = JSON.parse(lines[0])
    assert.equal(row.leg, land.LEG_NAME)
    assert.equal(row.path, 'apps/miniapp-taro/src/pages/home/index.css')
    assert.equal(row.blobOid, land.blobOidOf('apps/miniapp-taro/src/pages/home/index.css', { root: dir }), '登记的必须是写完盘后实测的 hash')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.equal(r.ok, true)
    assert.deepEqual(r.collectible.map((c) => c.path), ['apps/miniapp-taro/src/pages/home/index.css'], '跨器整链:写腿登记的 blob 凭据被收编侧逐字节认账')
    assert.deepEqual([r.contested.length, r.incomplete.length, r.ignored.length], [0, 0, 0])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L2 重放:同一产出第二轮不再重复登记(deduped)且 landedPathsOf 判为已落(⇒ 本轮 skipLanded)', () => {
  const dir = newRepo('land-miniapp-ledger-')
  try {
    put(dir, 'apps/miniapp-taro/src/pages/b/index.css', '.b{gap:var(--spacing-sm)}\n')
    const at = agedIso(10)
    const first = land.registerLanding(['apps/miniapp-taro/src/pages/b/index.css'], { root: dir, at })
    assert.equal(first.landing, 1)
    const again = land.registerLanding(['apps/miniapp-taro/src/pages/b/index.css'], { root: dir, at })
    assert.deepEqual({ landing: again.landing, deduped: again.deduped }, { landing: 0, deduped: 1 })
    const lines = readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1, '重放不得撑爆账本')
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.ok(lp.paths.has('apps/miniapp-taro/src/pages/b/index.css'), '已落集合含该路径 ⇒ --apply 轮整轮跳过(可续跑)')
    assert.match(readFileSync(SCRIPT, 'utf8'), /if \(landRound\.set\.has\(f\)\) \{\s*\n\s*landRound\.skipLanded\+\+/, '两条落档面(CSS/字号)的跳过腿都必须在位')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L3 登记后被人再改一行 ⇒ collectiblePaths 判成 contested,landedPathsOf 不再含它(凭据不是橡皮图章)', () => {
  const dir = newRepo('land-miniapp-ledger-')
  try {
    put(dir, 'apps/miniapp-taro/src/pages/c/index.css', '.c{margin:var(--spacing-xs)}\n')
    land.registerLanding(['apps/miniapp-taro/src/pages/c/index.css'], { root: dir, at: agedIso(10) })
    put(dir, 'apps/miniapp-taro/src/pages/c/index.css', '.c{margin:var(--spacing-xs)}\n/* 别席后来加了一行 */\n')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.deepEqual(r.collectible, [])
    assert.equal(r.contested.length, 1)
    assert.equal(r.contested[0].path, 'apps/miniapp-taro/src/pages/c/index.css')
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.equal(lp.paths.has('apps/miniapp-taro/src/pages/c/index.css'), false, 'blob 已漂 ⇒ 不认已落,下轮照旧尝试(失效方向=多做一遍)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L4 dry-run 档零登记:registerLanding([]) 不写一个字节也不造账本;生产写侧被 apply 守卫', () => {
  const dir = newRepo('land-miniapp-ledger-')
  try {
    put(dir, 'apps/miniapp-taro/src/pages/d/index.css', '.d{padding:var(--spacing-lg)}\n')
    const res = land.registerLanding([], { root: dir })
    assert.deepEqual(res, { ok: true, landing: 0, deduped: 0, rejected: [] })
    assert.equal(existsSync(ledgerT.ledgerPathFor(dir)), false, '没写盘就没有产出 ⇒ 一行都不许登记')
    assert.match(
      readFileSync(SCRIPT, 'utf8'),
      /if \(!\(apply && st\.batch\.length\)\) return out[\s\S]{0,200}?registerLanding\(st\.batch, \{ legs: enabledLegs \}\)/,
      '登记出口(closeLandingRound)必须被 apply 守卫(预演档结构上到不了),且把本轮腿集一起交出去',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L5 账本文件不存在 ⇒ landedPathsOf 只报 ok:false+空集合(调用方回落全量并标 ledger=unjudged),不崩不判死', () => {
  const dir = newRepo('land-miniapp-ledger-')
  try {
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, false)
    assert.match(lp.reason, /not-found/)
    assert.equal(lp.paths.size, 0)
    assert.match(readFileSync(SCRIPT, 'utf8'), /else st\.unjudged = true/, '读不到账本的出口是回落+标记,绝不 exit/判死')
    const trail = land.landingKeys({ ledgerUnjudged: true })
    assert.match(trail, / landing=0 /)
    assert.match(trail, /landingPath=\.ihui-agent\/state\/cross-end-landing\.jsonl/)
    assert.match(trail, /skipLanded=0 ledger=unjudged/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L6 同形锁:三枚 lander 的腿短名取自同名常量、leg 走 registerLanding 参数、landingKeys 逐字节同文', () => {
  const names = ['land-web-style-tiers', 'land-rn-style-tiers', 'land-miniapp-style-tiers']
  const bodies = []
  for (const n of names) {
    const text = readFileSync(join(ROOT, 'scripts', `${n}.mjs`), 'utf8')
    assert.match(text, new RegExp(`export const LEG_NAME = '${n}'`), `${n}: 腿短名必须逐字等于脚本文件名(guardian 派发名现读)`)
    assert.match(
      text,
      /const rowLegs = normalizeLegs\(legs\)\s*\n\s*const list = paths\.map\(\(p\) => \(\{\s*at,\s*leg,\s*path: p,\s*blobOid: blobOidOf\(p, \{ root \}\),\s*\.\.\.\(rowLegs \? \{ legs: rowLegs \} : \{\}\),\s*\}\)\)/,
      `${n}: 登记行的 leg/legs 必须取自 registerLanding 参数(默认 leg = LEG_NAME),三处同一形态`,
    )
    assert.match(
      text,
      /c\.leg === leg && legsCover\(c\.legs, legs\)/,
      `${n}: landedPathsOf 必须用库内 legsCover 判腿覆盖,不得各自复算`,
    )
    assert.match(text, /gitRaw\(\['hash-object', '--', rel\], root\)/, `${n}: 取 oid 必须与账本库 worktree 面同一把尺(face-reader gitRaw + hash-object)`)
    const m = text.match(/export function landingKeys\([\s\S]*?\n\}/)
    assert.ok(m, `${n}: 缺 landingKeys`)
    bodies.push(m[0])
  }
  assert.equal(bodies[1], bodies[0], '三枚的 landingKeys 实现必须逐字同文(防三处漂移)')
  assert.equal(bodies[2], bodies[0])
  assert.equal(land.LEG_NAME, 'land-miniapp-style-tiers')
})

// ─── 2026-11-13:工作树「HEAD 有、盘上没有」(staged deletion / 二进制)不得打崩器物 ───
// 立因:cover/index.css 被别席 staged 删除后,listCssFiles() 仍从 HEAD 枚举到它,
// readWorktreeFile() 返 null 而非抛 → maskComments(null) 返 '' → css.replace 抛 TypeError,
// 默认档整轮 exit 2「未判定」。守卫必须在两条主循环 + 两条 --apply 读回处都在位。
// 证伪标准:拿掉守卫,下面 T13/T14 必须在真实仓上立刻变红(exit 2),不许只靠查源码文本。

const MISSING_CSS = 'apps/miniapp-taro/src/__ihui_never_exists__.css'
const MISSING_TSX = 'apps/miniapp-taro/src/__ihui_never_exists__.tsx'

test('T13 CSS 面:工作树读不到的文件记 held 跳过,整轮仍可判定(不得崩在 null.replace)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--json', '--file', MISSING_CSS], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, `默认档必须可判定,stderr=${r.stderr}`)
  const j = JSON.parse(r.stdout.trim())
  assert.equal(j.held, 1, '失效方向只能是 held,绝不能把读不到伪装成 changes=0(§12e 恒绿门成因①)')
  assert.equal(j.changes, 0)
  assert.equal(j.scanned, 1)
})

test('T14 字号面:--font-safe 同样不得被 null 正文打崩', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--json', '--font-safe', '--file', MISSING_TSX], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, `字号面必须可判定,stderr=${r.stderr}`)
  const j = JSON.parse(r.stdout.trim())
  assert.equal(j.held, 1)
  assert.equal(j.changes, 0)
  assert.equal(j.scanned, 1)
})

test('T15 守卫承重且与 land-web 正典同形;纯函数喂 null 确实会抛 ⇒ 守卫不是摆设', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const web = readFileSync(join(ROOT, 'scripts', 'land-web-style-tiers.mjs'), 'utf8')
  const guard =
    /if \(src === null\) \{\s*\n\s*held\.push\(`\$\{f\}\(二进制\/不可读\)`\)\s*\n\s*continue\s*\n\s*\}/
  assert.equal(
    [...src.matchAll(new RegExp(guard.source, 'g'))].length,
    2,
    'CSS 面 + 字号面两条主读取循环都要有守卫',
  )
  assert.match(web, guard, '守卫形态必须与 land-web-style-tiers.mjs 正典逐字同形(§0.6)')
  const cleanGuard = /held\.push\(`\$\{f\}\(clean 后读不回\)`\)/g
  assert.equal([...src.matchAll(cleanGuard)].length, 2, '两条 --apply 的 clean 后读回也要守卫')
  // 承重复核:守卫一旦被删,纯函数立刻抛 TypeError ⇒ T13/T14 必红
  assert.throws(() => land.rewriteCss(null, REV), TypeError)
  assert.throws(() => land.rewriteClassNameTokens(null, REV), TypeError)
})
