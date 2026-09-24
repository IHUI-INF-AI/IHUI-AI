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
const {
  namespaceKeys,
  declaredBrandKeys,
  checkBrandKeys,
  danglingBrandRefs,
  MAPPINGS,
  RN_ONLY_BRAND_KEYS,
} = __test__

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
  const clean = checkBrandKeys({
    bodies: { rnLightTokens: OK_BODY },
    declared,
    allowlist: RN_ONLY_BRAND_KEYS,
  })
  assert.deepEqual(clean.bad, [], '真仓形态不得报未声明键')
  assert.deepEqual(clean.stale, [], '豁免清单不得有已失效项')

  const forked = checkBrandKeys({
    bodies: { rnLightTokens: FORKED_BODY },
    declared,
    allowlist: RN_ONLY_BRAND_KEYS,
  })
  assert.deepEqual(
    forked.bad.map((b) => b.key).sort(),
    ['ctaFill', 'ctaText'],
    '端内自立品牌档必须逐键点名',
  )
})

test('R2:兄弟命名空间的键不得被算进 brand(否则 surface.light 会误报)', () => {
  assert.deepEqual(namespaceKeys(OK_BODY, 'brand'), ['DEFAULT', 'foreground', 'dark'])
  assert.deepEqual(namespaceKeys(OK_BODY, 'surface'), ['light', 'muted'])
})

test('R3:悬空引用只认 token 袋前缀,局部变量 brand 不得假红', () => {
  const allowed = new Set([...declaredBrandKeys(MAPPINGS), ...Object.keys(RN_ONLY_BRAND_KEYS)])
  assert.equal(
    danglingBrandRefs('backgroundColor: tokens.brand.ctaFill', allowed).length,
    1,
    '退役档引用必须红',
  )
  assert.equal(
    danglingBrandRefs('const c = tk.brand.ctaText', allowed).length,
    1,
    'tk. 前缀同样要管',
  )
  assert.equal(
    danglingBrandRefs('const c = theme.brand.DEFAULT', allowed).length,
    0,
    '已声明档不报',
  )
  // 真踩过的假红:apps/web/src/components/marketing/BrandMarquee.tsx 里轮播数据对象也叫 brand
  assert.equal(
    danglingBrandRefs(
      'const brand = { nameKey: "a", src: "b" }\n<Img k={brand.nameKey} s={brand.src} />',
      allowed,
    ).length,
    0,
    '局部变量 brand 的属性不是 token 引用',
  )
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

test('端到端:真仓 HEAD 与 --self-test 都必须全绿', () => {
  const run = (args) =>
    execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  assert.match(run([]), /✅ .*条映射逐位同值/, 'R1 真仓必须全绿')
  assert.match(run([]), /无悬空 brand 引用/, 'R3 真仓 HEAD 必须无悬空引用(ctaFill 已删干净)')
  assert.match(run(['--self-test']), /self-test 全通过/, '判据自检必须全过')
})

test('回归锁:CTA 必须是"成对档"且先在 tokens.css 落源头(旧锁"brand 里不得有 cta"已被 AGENTS §4 2026-09-24 改档作废)', () => {
  const src = readFileSync(join(ROOT, 'packages', 'design-tokens', 'src', 'rn-tokens.ts'), 'utf8')
  const keys = namespaceKeys(extractBrandBlock(src), 'brand')
  assert.ok(keys.length >= 2, 'brand 命名空间必须仍可解析')
  // 被禁的一直是"端内自立的混血档"(浅色=web primary、深色另取一档),不是 cta 这个名字本身
  assert.ok(
    !keys.some((k) => /ctaFill|ctaText/.test(k)),
    `brand 里不得再出现混血 CTA 档:${keys.join('/')}`,
  )
  // 现行唯一写法:cta 实底必须与 ctaForeground 成对(§4「成对即合规」),缺一侧即为跨档错配
  assert.equal(
    keys.includes('cta'),
    keys.includes('ctaForeground'),
    `cta 与 ctaForeground 必须同进同出,实得:${keys.join('/')}`,
  )
  assert.match(src, /DEFAULT: '#000000'/, '亮色品牌底仍必须是黑')
  // 顺序合同:新增品牌档必须先落 CSS 源头,否则 RN 侧就是第二份真相
  const css = readFileSync(
    join(ROOT, 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'),
    'utf8',
  )
  for (const v of ['--color-cta', '--color-cta-foreground'])
    assert.ok(
      new RegExp(`${v}\\s*:`).test(css),
      `${v} 必须存在于 tokens.css(RN brand.cta* 的取值源头)`,
    )
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

/* ── R4 基础档按名推导 / R5 端内两表自洽(2026-09-24 扩面,消第四十二批未闭环③) ──
 * 立因:本门此前只核**手工登记**的映射,于是"13/13 in sync"与"基础档 78 条叶子无人看守"同时为真。
 * 扩面后必须钉住:①判据能看见漂移;②HSL 舍入不算漂移(否则上线当天假红);
 * ③推导面不得静默归零(归零 = 门瞎了仍报绿);④注释里的赋值不得被当取值。 */
const {
  colorsAgree,
  checkBasePalette,
  checkIntraPalette,
  objectLeaves,
  deriveCssVarNames,
  stripCssComments,
  stripTsComments,
  extractCssVars,
  extractTsObjectBody,
  BASE_CONFLICTS,
} = __test__

const FIX_CSS = {
  '--color-warning-amber': '#f59e0b',
  '--color-danger': '#dc2626',
  '--color-success': 'hsl(142 71% 45%)',
}
const r4 = (leaves, registered = {}) =>
  checkBasePalette({
    leavesByConst: { rnLightTokens: leaves },
    cssLight: FIX_CSS,
    cssDark: FIX_CSS,
    registered,
  })

test('R4:同名 CSS 变量而值不同必须判红;同值必须放过', () => {
  assert.equal(r4([{ path: 'warning.amber', value: '#000000' }]).drift.length, 1, '漂移必须判红')
  assert.equal(r4([{ path: 'warning.amber', value: '#f59e0b' }]).drift.length, 0, '同值不得判红')
  assert.equal(
    r4([{ path: 'nonexistent.key', value: '#000000' }]).checked,
    0,
    '推不到同名变量一律不判(不猜语义)',
  )
})

test('R4:shadcn 的 HSL 整数舍入不得算漂移,而真漂移不得被容差吞掉(成对)', () => {
  assert.equal(
    r4([{ path: 'success.DEFAULT', value: '#22c55e' }]).drift.length,
    0,
    '#22c55e ↔ hsl(142 71% 45%) 是同一颜色的两种编码',
  )
  assert.equal(
    r4([{ path: 'danger.DEFAULT', value: '#ff3333' }]).drift.length,
    1,
    '通道差 35 必须仍判红',
  )
  assert.ok(colorsAgree('#000', '#000000'), '缩写与全写不得算两个颜色')
  assert.ok(!colorsAgree('rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)'), '透明度差是真分歧,不得被容差吞')
})

test('R4:登记表是"只减不许腐烂"的 —— 登记即免红,登记却已不冲突则判红', () => {
  // 每条登记都必须写清"哪一侧是什么 / 为什么不能对齐 / 改动代价",空口径豁免等于没有门
  for (const [k, why] of Object.entries(BASE_CONFLICTS))
    assert.ok(why.length >= 40, `${k} 的登记理由过短(${why.length} 字),不构成可复核依据`)
  const registered = { 'rnLightTokens|warning.amber': '理由:两侧语义已分叉' }
  assert.equal(r4([{ path: 'warning.amber', value: '#000000' }], registered).drift.length, 0)
  const stale = r4([{ path: 'warning.amber', value: '#f59e0b' }], registered)
  assert.equal(stale.stale.length, 1, '已对齐却忘删登记必须红(防豁免清单腐烂)')
})

test('R4:推导规则是确定函数(改名即断链这一逃逸路径由 review 承担,不由门猜)', () => {
  assert.deepEqual(deriveCssVarNames('brandAccent.gradFrom'), ['--color-brand-accent-grad-from'])
  assert.deepEqual(deriveCssVarNames('danger.DEFAULT'), [
    '--color-danger-default',
    '--color-danger',
  ])
})

test('R5:端内两张表同路径不同值必须判红(遗留基表才是实际渲染出来的那份)', () => {
  const bad = checkIntraPalette({
    base: [{ path: 'danger.DEFAULT', value: '#ff3333' }],
    light: [{ path: 'danger.DEFAULT', value: '#dc2626' }],
  })
  assert.equal(bad.length, 1)
  assert.deepEqual(
    checkIntraPalette({
      base: [{ path: 'gray.black', value: '#000' }],
      light: [{ path: 'gray.black', value: '#000000' }],
    }),
    [],
    '#000 与 #000000 同值不得判红',
  )
  const src = readFileSync(join(ROOT, 'packages', 'design-tokens', 'src', 'rn-tokens.ts'), 'utf8')
  const strip = stripTsComments(src)
  const base = objectLeaves(extractTsObjectBody(strip, 'rnTokens') || '', [])
  const light = objectLeaves(extractTsObjectBody(strip, 'rnLightTokens') || '', [])
  assert.deepEqual(checkIntraPalette({ base, light }), [], '真仓 R5 必须零分叉')
})

test('取材缺陷锁:CSS/TS 注释里的赋值说明不得被当成取值', () => {
  const dirty =
    '@theme {\n  /* - --color-warning:RN warning.amber 说明 */\n  --color-warning: #f59e0b;\n}'
  assert.deepEqual(extractCssVars(stripCssComments(dirty)), { '--color-warning': '#f59e0b' })
  assert.notEqual(
    Object.values(extractCssVars(dirty))[0],
    '#f59e0b',
    '反向对照:不剥注释必然取到垃圾值',
  )
  assert.equal(
    objectLeaves(
      stripTsComments("brand: {\n /** foreground: '#FFFFFF' 说明 */\n cta: '#4A7A96' \n}"),
    ).length,
    1,
  )
})

test('反空绿:真仓跑出来的 R4 推导面必须仍是几十条量级(面静默归零 = 门瞎了仍报绿)', () => {
  const out = execFileSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  const m = /R4 基础档按名推导 (\d+) 条同值/.exec(out)
  assert.ok(m, `结论行必须报出 R4 推导面计数,实得:${out.slice(-160)}`)
  assert.ok(Number(m[1]) > 50, `推导面从 ${m[1]} 条塌到 50 以下 = 解析断了,不得记为通过`)
})
