// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * 跨端色值同源对账守门的镜像测试(编号不写死:由 runner 按 script 名反查,见文件末尾两条自证)。
 *
 * 三条判据各配正反例,外加两条"装车证明":本门必须真的注册在 guardian-runner 里
 * (blocking + 有紧急跳过变量),以及真仓 HEAD 必须真的全绿 —— 判据没装车 = 没有判据。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-cross-end-tokens.mjs')

// §22c:直接 import 源符号,不留镜像常量
const { __test__ } = await import(`file://${SCRIPT}`)
const { namespaceKeys, declaredBrandKeys, checkBrandKeys, danglingBrandRefs, MAPPINGS, RN_ONLY_BRAND_KEYS } = __test__

const OK_BODY = `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF', muted: '#F5F5F5' },
`
const FORKED_BODY = `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', ctaFill: '#000000', ctaText: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF' },
`

test('R2:brand 键必须全部被声明或豁免(自立 ctaFill/ctaText 必红)', () => {
  const declared = declaredBrandKeys(MAPPINGS)
  const clean = checkBrandKeys({ bodies: { rnLightTokens: OK_BODY }, declared, allowlist: RN_ONLY_BRAND_KEYS })
  assert.deepEqual(clean.bad, [], '真仓形态不得报未声明键')
  assert.deepEqual(clean.stale, [], '豁免清单不得有已失效项')

  const forked = checkBrandKeys({ bodies: { rnLightTokens: FORKED_BODY }, declared, allowlist: RN_ONLY_BRAND_KEYS })
  assert.deepEqual(forked.bad.map((b) => b.key).sort(), ['ctaFill', 'ctaText'], '端内自立品牌档必须逐键点名')
})

test('R2:兄弟命名空间的键不得被算进 brand(否则 surface.light 会误报)', () => {
  assert.deepEqual(namespaceKeys(OK_BODY, 'brand'), ['DEFAULT', 'foreground', 'dark'])
  assert.deepEqual(namespaceKeys(OK_BODY, 'surface'), ['light', 'muted'])
})

test('R3:悬空引用只认 token 袋前缀,局部变量 brand 不得假红', () => {
  const allowed = new Set([...declaredBrandKeys(MAPPINGS), ...Object.keys(RN_ONLY_BRAND_KEYS)])
  assert.equal(danglingBrandRefs('backgroundColor: tokens.brand.ctaFill', allowed).length, 1, '退役档引用必须红')
  assert.equal(danglingBrandRefs('const c = tk.brand.ctaText', allowed).length, 1, 'tk. 前缀同样要管')
  assert.equal(danglingBrandRefs('const c = theme.brand.DEFAULT', allowed).length, 0, '已声明档不报')
  // 真踩过的假红:apps/web/src/components/marketing/BrandMarquee.tsx 里轮播数据对象也叫 brand
  assert.equal(danglingBrandRefs('const brand = { nameKey: "a", src: "b" }\n<Img k={brand.nameKey} s={brand.src} />', allowed).length, 0, '局部变量 brand 的属性不是 token 引用')
})

/**
 * 本门编号**不写死**。同日多会话在数组同一位各加一道门必撞号,撞号后按 AGENTS 门 80 的纪律是
 * "后登记者改号" —— 实测 2026-09-24 本门由 90 改到 93 时,红的是这道把编号字面值钉死的自证测试,
 * 而不是撞号本身(判据锚错了对象)。现按 script 名反查自己的编号,只钉三条真不变量:
 * 编号在 runner 里唯一 / mode 是 blocking / 有紧急跳过变量。
 */
const MY_SCRIPT = "script: 'check-cross-end-tokens.mjs'"
const idCount = (text, id) => text.split(`id: '${id}'`).length - 1
function myGateId(runner) {
  const at = runner.indexOf(MY_SCRIPT)
  assert.ok(at > 0, 'runner 里必须注册本门(按 script 名反查)')
  const before = [...runner.slice(0, at).matchAll(/^\s+id:\s*'([^']+)',?$/gm)]
  assert.ok(before.length, '本门注册块之前必须能找到 id 行')
  return before[before.length - 1][1]
}

test('装车证明:编号唯一 + blocking + 紧急跳过变量(按 script 名反查,不写死编号)', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const id = myGateId(runner)
  assert.equal(
    idCount(runner, id),
    1,
    `id ${id} 在 runner 里必须出现恰好一次 —— 同号两道 blocking 门会共用 skipEnv 与失败归属(AGENTS 门 80)`,
  )
  const block = runner.slice(runner.indexOf(`id: '${id}'`), runner.indexOf(MY_SCRIPT) + 600)
  assert.match(block, /mode: 'blocking'/, 'warn 模式的同源对账等于没有对账')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_CROSS_END_TOKENS'/)
})

test('反空绿:判据必须真能"看见"撞号(合成夹具,与仓内现状无关)', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const id = myGateId(runner)
  assert.equal(idCount(runner, id), 1, '先确认现网唯一,否则下面的合成没有意义')
  // 在最前面一道门的 label 前插一行同号 ⇒ 必须立刻数出 2,证明这条断言不是恒真
  const dup = runner.replace(/\n(\s+)label:/, `\n$1id: '${id}',\n$1label:`)
  assert.equal(idCount(dup, id), 2, '合成撞号未被识别 = 本条自证恒真')
})

/** 上一条已验「编号唯一 + blocking + skipEnv」;这里补「注册本身不得重复」。
 *  >1 次 = 同一脚本被两道门各插了一份注册(并行会话在数组同一位各加一门的典型后果),
 *  skipEnv 与失败归属会串门;0 次 = 判据没装车,等于没有判据。 */
test('装车证明补条:本门脚本在 runner 里必须恰好注册一次', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(
    runner.split(MY_SCRIPT).length - 1,
    1,
    '0 次=没装车;>1 次=同一脚本注册了多道门,失败归属会串门',
  )
})
test('端到端:真仓 HEAD 与 --self-test 都必须全绿', () => {
  const run = (args) => execFileSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  assert.match(run([]), /✅ .*条映射逐位同值/, 'R1 真仓必须全绿')
  assert.match(run([]), /无悬空 brand 引用/, 'R3 真仓 HEAD 必须无悬空引用(ctaFill 已删干净)')
  assert.match(run(['--self-test']), /self-test 全通过/, '判据自检必须全过')
})

test('回归锁:brand 命名空间不得再出现 cta 档(删掉的档不得被悄悄加回来)', () => {
  const src = readFileSync(join(ROOT, 'packages', 'design-tokens', 'src', 'rn-tokens.ts'), 'utf8')
  const keys = namespaceKeys(extractBrandBlock(src), 'brand')
  assert.ok(keys.length >= 2, 'brand 命名空间必须仍可解析')
  assert.ok(!keys.some((k) => /cta/i.test(k)), `brand 里不得再有 CTA 档:${keys.join('/')}`)
  assert.match(src, /DEFAULT: '#000000'/, '亮色品牌底仍必须是黑')
})

/** 从 rn-tokens.ts 里截出 base `rnTokens` 的 brand 块(测试用的小解析,不依赖运行时求值) */
function extractBrandBlock(src) {
  const m = /export const rnTokens\s*=\s*\{/.exec(src)
  assert.ok(m, 'rnTokens 定义必须可定位')
  const tail = src.slice(m.index)
  const b = /brand:\s*\{/.exec(tail)
  assert.ok(b, 'brand 块必须可定位')
  let i = b.index + b[0].length,
    depth = 1
  const start = i
  while (i < tail.length && depth > 0) {
    if (tail[i] === '{') depth++
    else if (tail[i] === '}') depth--
    i++
  }
  return `brand: {${tail.slice(start, i - 1)}}`
}