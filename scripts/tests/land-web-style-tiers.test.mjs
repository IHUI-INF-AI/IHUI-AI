// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * land-web-style-tiers.test.mjs — web 落档器的镜像测试(§22c)
 *
 * 判据全部 import 源脚本(`__test__` 的 `rewriteSource` / `MAP` / `findClassRegions` / `inScope`),
 * 本文件不复制正则,也不复制映射表的档值。
 *
 * 钉八件事:
 *   ① 四组等值映射各自命中;
 *   ② 表外档(text-base / lg / 3xl / 任意值)一律不动;
 *   ③ 变体前缀 `sm:` / `hover:` / `md:` 保留,只换后缀;
 *   ④ 颜色档 `text-sm-foreground` / 更长的 `text-smaller` 不被误伤;
 *   ⑤ className **之外**的同形文本不动(注释 / 普通字符串 / 测试断言 / 其它属性);
 *   ⑥ 幂等(改完再跑 0 处);
 *   ⑦ 归属避让在位(dirtySet / held 分支的结构断言);
 *   ⑧ 权重锁档只改"已有 font-* 伴随"的类名串。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { collectiblePaths, __test__ as ledgerT } from '../lib/cross-end-landing-ledger.mjs'
import { __test__ as land } from '../land-web-style-tiers.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'land-web-style-tiers.mjs')

/** 期望值从 MAP 推,不在此处再写一份映射(第二份必然漂移)。 */
const to = (key) => `text-${land.MAP[key]}`

test('T1 四组等值映射各自命中', () => {
  for (const key of Object.keys(land.MAP)) {
    const r = land.rewriteSource(`<a className="text-${key}" />`)
    assert.equal(r.out, `<a className="${to(key)}" />`)
    assert.equal(r.changes, 1, `text-${key} 必须命中`)
    assert.equal(r.byGroup[key], 1)
  }
  assert.deepEqual(Object.keys(land.MAP).sort(), ['2xl', 'sm', 'xl', 'xs'], '映射表只许这四档(text-base/lg/3xl 不得混入)')
})

test('T2 表外档一律不动(text-base / lg / 3xl / 任意值)', () => {
  const src = '<a className="text-base text-lg text-3xl text-[10px] text-2xs" />'
  const r = land.rewriteSource(src)
  assert.equal(r.out, src)
  assert.equal(r.changes, 0)
})

test('T3 变体前缀保留、只换后缀', () => {
  const r = land.rewriteSource('<a className="sm:text-sm hover:text-xl md:text-2xl dark:text-xs" />')
  assert.equal(r.out, `<a className="sm:${to('sm')} hover:${to('xl')} md:${to('2xl')} dark:${to('xs')}" />`)
  assert.equal(r.changes, 4)
})

test('T4 颜色档与更长的类名不误伤', () => {
  const src = '<a className="text-sm-foreground text-xs-muted text-smaller text-xl-alt text-2xlX" />'
  assert.equal(land.rewriteSource(src).changes, 0, '前后紧邻 [A-Za-z0-9_-] 一律不算完整类名')
})

test('T5 className 之外的同形文本不动(注释 / 普通串 / 断言 / 其它属性)', () => {
  const src = [
    '// className="text-sm" 老写法',
    '/* className="text-xl" */',
    "const label = 'text-sm'",
    "expect(node).toHaveClass('text-2xl')",
    "const variants = { 'text-xs': 'small' }",
    '<X wrapperClassName="text-sm" bodyClassName="text-xs" />',
    '{/* className="text-2xl" */}',
    '<a className="text-sm" />',
  ].join('\n')
  const r = land.rewriteSource(src)
  assert.equal(r.changes, 1, '整个文件只该有 className 那一处被改')
  assert.match(r.out, /\/\/ className="text-sm" 老写法/, '行注释不动')
  assert.match(r.out, /\/\* className="text-xl" \*\//, '块注释不动')
  assert.match(r.out, /const label = 'text-sm'/, '普通字符串不动')
  assert.match(r.out, /toHaveClass\('text-2xl'\)/, '测试断言不动')
  assert.match(r.out, /\{ 'text-xs': 'small' \}/, '普通对象键不动')
  assert.match(r.out, /wrapperClassName="text-sm"/, '非 className 属性不在射程')
  assert.match(r.out, /\{\/\* className="text-2xl" \*\/\}/, 'JSX 注释不动')
  assert.equal(r.out.split('\n').pop(), `<a className="${to('sm')}" />`, '真 className 改写')
})

test('T6 三种 className 形态都命中(单引号 / 模板串 / cn 实参),自闭合标签不干扰', () => {
  const src =
    "<a className={'text-sm'} /><b className={`flex text-xl`} /><c className={cn('text-xs', ok && 'text-2xl')} />"
  const r = land.rewriteSource(src)
  assert.equal(
    r.out,
    `<a className={'${to('sm')}'} /><b className={\`flex ${to('xl')}\`} /><c className={cn('${to('xs')}', ok && '${to('2xl')}')} />`,
  )
  assert.equal(r.changes, 4)
})

test('T7 幂等:改过的正文再跑必须 0 处', () => {
  const once = land.rewriteSource('<a className="flex text-sm items-center sm:text-xs" />')
  assert.equal(once.changes, 2)
  const twice = land.rewriteSource(once.out)
  assert.equal(twice.changes, 0, '不幂等 ⇒ 每轮都会造 diff')
  assert.equal(twice.out, once.out)
})

test('T8 射程:测试 / 夹具 / 生成物 / 声明文件不进候选', () => {
  assert.equal(land.inScope('apps/web/src/components/a.tsx'), true)
  assert.equal(land.inScope('apps/web/app/(main)/page.tsx'), true)
  assert.equal(land.inScope('apps/web/src/components/__tests__/a.test.tsx'), false)
  assert.equal(land.inScope('apps/web/e2e/x.spec.ts'), false)
  assert.equal(land.inScope('apps/web/src/lib/ui-routes.generated.ts'), false)
  assert.equal(land.inScope('apps/web/src/types.d.ts'), false)
  assert.equal(land.inScope('apps/web/app/globals.css'), false)
})

test('T9 权重锁档:只有"已有 font-* 权重"的类名串才改(权重恒等口径)', () => {
  const src = '<a className="font-semibold text-xl" /><b className="text-xl" /><c className="text-sm md:font-bold" />'
  const locked = land.rewriteSource(src, { requireWeightCompanion: true })
  assert.equal(locked.out, `<a className="font-semibold ${to('xl')}" /><b className="text-xl" /><c className="${to('sm')} md:font-bold" />`)
  assert.equal(locked.changes, 2)
  assert.equal(locked.skippedNoWeight, 1, '无权重伴随的那一处必须计入跳过')
  assert.equal(land.rewriteSource(src).changes, 3, '不锁档时三处都改')
})

test('T10 归属避让在位:工作树脏的文件必须跳过而不是覆盖', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /const dirty = dirtySet\(\)/, '必须有归属检查')
  assert.match(src, /if \(dirty\.has\(f\)\) \{\s*\n\s*held\.push\(f\)/, '脏文件必须进 held 而不是被改')
  assert.match(src, /held\.push\(f\)[\s\S]*?continue/, 'held 之后必须 continue,不许继续写盘')
})

test('T11 水印流程在位:clean → 改写 → inject → verify,verify 失败回滚原字节', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const clean = src.indexOf("watermark('clean', f)")
  const inject = src.indexOf("watermark('inject', f)", clean)
  const verify = src.indexOf("watermark('verify', f)", inject)
  assert.ok(clean > 0 && inject > clean && verify > inject, '四步顺序必须是 clean → inject → verify')
  assert.match(src, /original = readFileSync\(abs\)/, '必须先留原字节')
  assert.match(src, /writeFileSync\(abs, original\)/, '失败必须回滚原字节')
})

test('T12 本文件是测试本体,不是落档器的整文件副本', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const target = readFileSync(SCRIPT, 'utf8')
  assert.ok(target.length > self.length)
  const copyMarker = ['export', 'function', 'rewriteSource'].join(' ')
  assert.equal(self.includes(copyMarker), false)
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
  const dir = newRepo('land-web-ledger-')
  try {
    put(dir, 'apps/web/src/x.tsx', '<a className="text-body" />\n')
    const res = land.registerLanding(['apps/web/src/x.tsx'], { root: dir, at: agedIso(10) })
    assert.equal(res.ok, true)
    assert.equal(res.landing, 1)
    const lines = readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1, '一轮产出恰登记 1 行')
    const row = JSON.parse(lines[0])
    assert.equal(row.leg, land.LEG_NAME)
    assert.equal(row.path, 'apps/web/src/x.tsx')
    assert.equal(row.blobOid, land.blobOidOf('apps/web/src/x.tsx', { root: dir }), '登记的必须是写完盘后实测的 hash')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.equal(r.ok, true)
    assert.deepEqual(r.collectible.map((c) => c.path), ['apps/web/src/x.tsx'], '跨器整链:写腿登记的 blob 凭据被收编侧逐字节认账')
    assert.deepEqual([r.contested.length, r.incomplete.length, r.ignored.length], [0, 0, 0])
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L2 重放:同一产出第二轮不再重复登记(deduped)且 landedPathsOf 判为已落(⇒ 本轮 skipLanded)', () => {
  const dir = newRepo('land-web-ledger-')
  try {
    put(dir, 'apps/web/src/y.tsx', '<b className="text-label" />\n')
    const at = agedIso(10)
    const first = land.registerLanding(['apps/web/src/y.tsx'], { root: dir, at })
    assert.equal(first.landing, 1)
    const again = land.registerLanding(['apps/web/src/y.tsx'], { root: dir, at })
    assert.deepEqual({ landing: again.landing, deduped: again.deduped }, { landing: 0, deduped: 1 })
    const lines = readFileSync(ledgerT.ledgerPathFor(dir), 'utf8').split('\n').filter(Boolean)
    assert.equal(lines.length, 1, '重放不得撑爆账本')
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.ok(lp.paths.has('apps/web/src/y.tsx'), '已落集合含该路径 ⇒ --apply 轮整轮跳过(可续跑)')
    assert.match(readFileSync(SCRIPT, 'utf8'), /if \(landedSet\.has\(f\)\) \{\s*\n\s*skipLanded\+\+/, '主循环的跳过腿必须在位')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L3 登记后被人再改一行 ⇒ collectiblePaths 判成 contested,landedPathsOf 不再含它(凭据不是橡皮图章)', () => {
  const dir = newRepo('land-web-ledger-')
  try {
    put(dir, 'apps/web/src/z.tsx', '<c className="text-body" />\n')
    land.registerLanding(['apps/web/src/z.tsx'], { root: dir, at: agedIso(10) })
    put(dir, 'apps/web/src/z.tsx', '<c className="text-body" />\n// 别席后来加了一行\n')
    const r = collectiblePaths(new Date(), { root: dir })
    assert.deepEqual(r.collectible, [])
    assert.equal(r.contested.length, 1)
    assert.equal(r.contested[0].path, 'apps/web/src/z.tsx')
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, true)
    assert.equal(lp.paths.has('apps/web/src/z.tsx'), false, 'blob 已漂 ⇒ 不认已落,下轮照旧尝试(失效方向=多做一遍)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L4 dry-run 档零登记:registerLanding([]) 不写一个字节也不造账本;生产写侧被 apply 守卫', () => {
  const dir = newRepo('land-web-ledger-')
  try {
    put(dir, 'apps/web/src/w.tsx', '<d className="text-body" />\n')
    const res = land.registerLanding([], { root: dir })
    assert.deepEqual(res, { ok: true, landing: 0, deduped: 0, rejected: [] })
    assert.equal(existsSync(ledgerT.ledgerPathFor(dir)), false, '没写盘就没有产出 ⇒ 一行都不许登记')
    assert.match(
      readFileSync(SCRIPT, 'utf8'),
      /if \(apply && landedBatch\.length\) \{[\s\S]{0,200}?registerLanding\(landedBatch\)/,
      '登记调用必须被 apply 守卫(预演档结构上到不了)',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('L5 账本文件不存在 ⇒ landedPathsOf 只报 ok:false+空集合(调用方回落全量并标 ledger=unjudged),不崩不判死', () => {
  const dir = newRepo('land-web-ledger-')
  try {
    const lp = land.landedPathsOf({ root: dir })
    assert.equal(lp.ok, false)
    assert.match(lp.reason, /not-found/)
    assert.equal(lp.paths.size, 0)
    assert.match(readFileSync(SCRIPT, 'utf8'), /else ledgerUnjudged = true/, '读不到账本的出口是回落+标记,绝不 exit/判死')
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
    assert.match(text, /const list = paths\.map\(\(p\) => \(\{ at, leg, path: p, blobOid: blobOidOf\(p, \{ root \}\) \}\)\)/, `${n}: 登记行的 leg 必须取自 registerLanding 参数(默认 = LEG_NAME),三处同一形态`)
    assert.match(text, /gitRaw\(\['hash-object', '--', rel\], root\)/, `${n}: 取 oid 必须与账本库 worktree 面同一把尺(face-reader gitRaw + hash-object)`)
    const m = text.match(/export function landingKeys\([\s\S]*?\n\}/)
    assert.ok(m, `${n}: 缺 landingKeys`)
    bodies.push(m[0])
  }
  assert.equal(bodies[1], bodies[0], '三枚的 landingKeys 实现必须逐字同文(防三处漂移)')
  assert.equal(bodies[2], bodies[0])
  assert.equal(land.LEG_NAME, 'land-web-style-tiers')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
