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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

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

/* ── R6:v3 端 /alpha 用量 ↔ tailwind-alpha-plugin 登记表(2026-09-25 扩面) ──
 * 立因:AGENTS §4 写着"新增颜色档必须同时进这个插件",但全仓**无一道门 import 过该插件** ——
 * 散文规则零判据。漏登记的后果是 v3 端静默零产出(typecheck/lint/build 全绿),与本门要防的
 * "跨端不同步"同族,所以判据落在本门而不是另起一号(同日撞号已发生四次)。
 * 这里只允许 import 源符号(§22c):测试里复写一份产出规则 = 两份真相 = 假绿。 */
const {
  checkAlphaUsage,
  extractAlphaUsages,
  maskComments,
  flattenColorTiers,
  loadAlphaPlugin,
  parseLiteralObject,
  extractObjectBody,
  readAlphaRegistry,
  ALPHA_EXEMPT_RE,
} = __test__

const alphaPlugin = await loadAlphaPlugin()
const FX_COLORS = {
  primary: { DEFAULT: 'var(--color-primary)', foreground: 'var(--color-primary-foreground)' },
  card: 'var(--color-card)',
  muted: { DEFAULT: 'var(--color-muted)' },
}
const fxTiers = flattenColorTiers(FX_COLORS)
const r6run = (code, usage, baselineRot = null) => {
  const { tokens } = extractAlphaUsages(maskComments(code, false), {
    tiers: fxTiers,
    original: code,
  })
  return checkAlphaUsage({ usages: tokens, usage, colors: FX_COLORS, plugin: alphaPlugin, baselineRot })
}
const t1 = (mod, kind = 'bg') => ({ [kind]: [mod] })

test('R6 判据有牙(成对):缺登记必红 / 补上必绿 / 无人用必红 / 判不出只报数', async () => {
  // ① 本票的原始场景:新档写了类名却没进表 —— v3 静默零产出,只有这道门能看见
  const miss = r6run('className="bg-card/50"', { primary: t1('10') })
  assert.equal(miss.missing.length, 1, '未登记的用量必须判红')
  assert.equal(miss.missing[0].key, 'bg-card/50', '必须点名是哪个形态')
  // ② 补一行 → 同一份源码立刻转绿
  assert.equal(r6run('className="bg-card/50"', { card: t1('50'), primary: t1('10') }).missing.length, 0)
  // ③ 反向:表里登了、三端源码没人写 = 清单腐烂(每条登记都等于往小程序主包塞一条死规则)
  const rot = r6run('className="bg-primary/10"', { primary: t1('10'), muted: t1('40') })
  assert.deepEqual(rot.rot.map((x) => x.key), ['bg-muted/40'], '腐烂必须逐条点名')
  // ④ 判不出的形态(动态拼接)只报数,绝不判红 —— 误报会逼人 --no-verify,连带废掉全部守门
  const dyn = extractAlphaUsages(maskComments('const c = `bg-${tier}/${op}`', false), {
    tiers: fxTiers,
    original: 'const c = `bg-${tier}/${op}`',
  })
  assert.equal(dyn.undetermined.length, 1)
  assert.equal(dyn.tokens.length, 0)
  // ⑤ 注释里的举例不得算用量(否则本门的文档自己在逼人补登记)
  assert.equal(
    extractAlphaUsages(maskComments('// 例:bg-card/90 需登记', false), {
      tiers: fxTiers,
      original: '// 例:bg-card/90 需登记',
    }).tokens.length,
    0,
  )
  // ⑥ 默认色板(white/black)v3 原生支持,不该要求登记
  assert.equal(r6run('className="bg-white/50"', {}).missing.length, 0)
})

test('R6 棘轮:存量腐烂不得拦住无关提交,本次新造的腐烂照红(否则恒红门只会逼人绕过钩子)', () => {
  const code = 'className="bg-card/50"'
  const table = { card: t1('50'), primary: t1('10') }
  const suppressed = r6run(code, table, new Set(['bg-primary/10']))
  assert.equal(suppressed.rot.length, 0, 'HEAD 已有的腐烂不得再拦本次提交')
  assert.equal(suppressed.rotInherited, 1, '存量必须如实计数,不得静默')
  const fresh = r6run(code, table, new Set(['bg-other/99']))
  assert.equal(fresh.rot.length, 1, '基线里没有的腐烂 = 本次新造,必须红')
  assert.equal(r6run(code, table).rot.length, 1, '无基线(全量审计)时存量照红')
})

test('R6 行内豁免必须带原因且逐行生效', () => {
  assert.match('alpha-plugin-exempt: 媒体上的浮层', ALPHA_EXEMPT_RE)
  assert.doesNotMatch('alpha-plugin-exempt:', ALPHA_EXEMPT_RE, '不带原因的标记必须无效')
  // 标记只救本行与紧邻上一行:第二条用量距标记两行,必须照判红
  const code =
    'className="bg-card/50" // alpha-plugin-exempt: 浮层专用\nconst pad = 1\nconst pad2 = 2\nconst p = "bg-card/60"'
  const r = r6run(code, {})
  assert.equal(r.exempted, 1, '标记只救本行')
  assert.deepEqual(r.missing.map((x) => x.key), ['bg-card/60'], '下一行的用量必须照判红')
})

test('R6 单一实现:产出规则必须来自插件本体,本门不得复写第二份', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /plugin\.buildAlphaUtilities\(/, '必须调用插件的产出函数')
  assert.match(src, /plugin\.escapeSelectorClass\(/, '选择器转义也必须复用插件实现')
  assert.ok(
    !/^\s*(export\s+)?const ALPHA_USAGE\s*=/m.test(src),
    '本门不得再声明一份 ALPHA_USAGE —— 第二份清单必然过期',
  )
  assert.ok(
    !/function buildAlphaUtilities/.test(src),
    '本门不得内联一份 buildAlphaUtilities 的等价实现(§22c 反镜像漂移)',
  )
})

test('R6/R7 必须真被主流程调用、且按判定面调用(判据存在但无人调用 = 没有判据,守门 70/81 同型)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const cliAt = src.indexOf('async function cli(')
  assert.ok(cliAt > 0, 'cli 主流程必须可定位')
  const body = src.slice(cliAt)
  for (const fn of ['runR6', 'runR7']) {
    const call = new RegExp(`await ${fn}\\(\\{[^)]*\\}`, 'm').exec(body)
    assert.ok(call, `cli 必须调用 ${fn}`)
    // 传面,但**不得写死**成字面量 —— 写死就等于"门永远只看一个面",换档旗标成了装饰
    assert.match(call[0], /\bface\b\s*[,=:]/, `${fn} 必须把判定面传进去`)
    assert.doesNotMatch(call[0], /face:\s*['"]/, `${fn} 的面不得写死字面量(须来自 selectFace)`)
  }
  // 面只有一个来源:CLI 里若有第二处 `argv.includes('--staged')` 就会造出两把尺子
  assert.equal(
    (src.match(/argv\.includes\('--staged'\)/g) || []).length,
    1,
    `--staged 只应在 selectFace 处解析一次,实得 ${(src.match(/argv\.includes\('--staged'\)/g) || []).length} 处`,
  )
})

/**
 * 搭一个最小真仓:两份 token 源 + alpha 插件/预设 + 一个 v3 端源文件 + 被测脚本(按 import 闭包拷)。
 * 两个端到端用例共用一份夹具搭建逻辑(取材面、清理、run 包装),各自只写自己的断言。
 * ⚠️ 全程在 `mkScratch` 的临时仓里跑,**绝不碰共享索引/共享工作树**。
 */
async function buildRepo(tag) {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const dir = mkScratch(tag)
  const git = (args) =>
    execFileSync('git', ['-c', 'safe.directory=*', ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
  const put = (rel, content) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  // R1–R5 与 R6/R7 现在**同一判定面**(2026-09-25 收口前 R1–R5 读磁盘),所以两边输入都得在位
  for (const rel of [
    'packages/design-tokens/src/tailwind-alpha-plugin.js',
    'packages/design-tokens/src/tailwind-preset.js',
    'packages/design-tokens/src/radius.js',
    'packages/design-tokens/src/styles/tokens.css',
    'packages/design-tokens/src/rn-tokens.ts',
  ]) {
    let content = readFileSync(join(ROOT, rel), 'utf8')
    if (rel.endsWith('tailwind-alpha-plugin.js'))
      // 夹具只带一个源文件 ⇒ 必须配一张同样小的表,否则"腐烂"是夹具造的,不是判据抓的
      content = content.replace(
        /export const ALPHA_USAGE = \{[\s\S]*?\n\}/,
        "export const ALPHA_USAGE = {\n  primary: { bg: ['10'] },\n}",
      )
    put(rel, content)
  }
  // 被测脚本按 **import 闭包** 拷,不手抄清单:本门把 git 派生收口到共用层之后,少拷一跳
  // `lib/face-reader.mjs` 就是 ERR_MODULE_NOT_FOUND —— 而那红的是一件无关的事(实测踩过)。
  // `expect` 是反向哨兵:哪天连层的依赖变了,由它点名,而不是让夹具静默缺文件。
  copyScriptWithClosure(join(ROOT, 'scripts'), 'check-cross-end-tokens.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
  ])
  // 用量必须落在**真 v3 消费端**才受 R6 管辖。此前写的是 miniapp,而 miniapp 实跑 v4
  // (v4 原生支持 /alpha,见 check-cross-end-tokens.mjs 的 ALPHA_V4_FACES 注释)⇒ 它不再判红,
  // 而表里登记的 primary/bg/10 反而成了腐烂 ⇒ 夹具首跑就红。红是新语义下的正确答案,
  // 所以要挪面,不是把断言放宽。
  const srcRel = 'apps/mobile-rn/src/box.tsx'
  put(srcRel, 'export const A = () => <View className="bg-primary/10" />\n')
  git(['init', '-q'])
  git(['config', 'user.email', 'gate@test.local'])
  git(['config', 'user.name', 'gate'])
  git(['add', '-A'])
  git(['commit', '-q', '-m', 'fixture'])
  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, [join(dir, 'scripts/check-cross-end-tokens.mjs'), ...args], {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180_000,
      })
      return { code: 0, out }
    } catch (e) {
      return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }
    }
  }
  return { dir, rmScratch, git, put, run, srcRel }
}

test('R6 取材口径端到端:未提交的改动不得钉红无关提交,暂存后必须红(临时仓,绝不碰共享索引)', async () => {
  const { dir, rmScratch, git, put, run, srcRel } = await buildRepo('cross-end-r6')
  const first = run([])
  assert.equal(first.code, 0, `夹具首跑必须全绿,实得:\n${first.out}`)
  // 别人(或本人)只改工作树、没暂存 ⇒ HEAD 面不得因此判红
  put(srcRel, readFileSync(join(dir, srcRel), 'utf8') + 'export const B = () => <View className="bg-card/50" />\n')
  assert.equal(run([]).code, 0, '未提交的改动不得钉红 —— 按磁盘读就会在这里假红')
  // 一旦暂存(= 这枚提交真的带走它)⇒ 必须红并点名
  git(['add', srcRel])
  const staged = run(['--staged'])
  assert.equal(staged.code, 1, '暂存了未登记用量必须红')
  assert.match(staged.out, /R6 未登记的 alpha 用量 bg-card\/50/, '必须点名形态')
  assert.match(staged.out, /box\.tsx/, '必须点名文件')
  rmScratch(dir)
})

/**
 * 第二条取材面端到端:**换面必须换结论**。
 * 钉的是 R1/R2/R4/R5 那半边 —— 它们此前恒按 `readFileSync` 读磁盘,于是"改色值没提交"
 * 会让这道门红,而红与本次提交无关(§12e 那型);反过来"提交了错值而磁盘已修好"它又装绿。
 * 四步分别证明:① 只在磁盘漂移 ⇒ HEAD/索引面不得红;② --worktree 必须立刻看见磁盘(证明
 * 这个逃生舱不是 HEAD 的别名);③ 暂存后索引面必须红并点名;④ 提交后默认面必须红(结论随面推进)。
 * 外加反向对照 ⑤:磁盘还原 ⇒ worktree 必回绿(证明 worktree 档不是恒红尺子)。
 */
test('取材面端到端:两份 token 源的比对必须随判定面走(旧行为恒按磁盘,一半判据看错对象)', async () => {
  const { dir, rmScratch, git, put, run } = await buildRepo('cross-end-face')
  const RN_REL = 'packages/design-tokens/src/rn-tokens.ts'
  const baseSha = git(['rev-parse', 'HEAD']).trim()
  const rnRelPath = join(dir, RN_REL)
  const drifted = readFileSync(rnRelPath, 'utf8').replace("gold: '#FFD700'", "gold: '#123456'")
  assert.notEqual(drifted, readFileSync(rnRelPath, 'utf8'), '夹具必须真改到那个色值(改不动=用例空转)')

  assert.equal(run([]).code, 0, '基线:干净仓必须绿')
  put(RN_REL, drifted) // 只改磁盘,不 add 不 commit
  assert.equal(run([]).code, 0, '① HEAD 面不得被未提交的磁盘漂移钉红(收口前正是这里假红)')
  assert.equal(run(['--staged']).code, 0, '①b 索引面同理:未暂存的改动不属于本次提交')

  const wt = run(['--worktree'])
  assert.equal(wt.code, 1, '② --worktree 必须立刻看见磁盘漂移(否则它是 HEAD 的别名,逃生舱是假的)')
  assert.match(wt.out, /vip\.gold|gold/, '②b 逃生舱必须点名到那条映射')

  git(['add', RN_REL])
  const st = run(['--staged'])
  assert.equal(st.code, 1, '③ 暂存后索引面必须红')
  assert.match(st.out, /vip\.gold/, '③b 必须点名 vip.gold 那条映射')

  git(['commit', '-q', '-m', 'drift'])
  assert.equal(run([]).code, 1, '④ 提交后默认面必须红 —— 结论随面推进,不是随磁盘')
  assert.equal(run(['--worktree']).code, 1, '④b 三面此时一致(磁盘==索引==HEAD)')

  git(['checkout', '-q', baseSha, '--', RN_REL]) // 磁盘回到未漂移的那版,而 HEAD 仍是漂移版
  assert.equal(run(['--worktree']).code, 0, '⑤ 磁盘还原后 worktree 档必须回绿(反恒红)')
  assert.equal(run([]).code, 1, '⑤b 同一时刻 HEAD 面仍须红 —— 两个面各自成立,不得互为别名')
  rmScratch(dir)
})

test('R6 解析器与真登记表:解析结果必须能驱动真产出函数', async () => {
  const reg = readAlphaRegistry('head')
  // 真表只断"解析得出对象"这一形状,**不断它的大小或内容** ——
  // 表由 sync-alpha-usage.mjs 从用量导出,合法地可以是 {}(2026-09-25 就是),
  // 把"≥5 档 / ≥15 条 / 必含 bg-primary/10"钉在这里,等于把某天的用量快照当成长期契约。
  assert.ok(reg && typeof reg.usage === 'object' && !Array.isArray(reg.usage), '解析必须得出对象')
  const built = alphaPlugin.buildAlphaUtilities(reg.usage, reg.colors)
  assert.equal(built.unresolvable.length, 0, '表里每一档都必须能从 preset 解析出 CSS 变量')
  assert.equal(built.unknownKinds.length, 0, '表里每个前缀都必须在能力表内')
  // "解析结果真能驱动产出"这条**改用构造面**证明:与仓库当天有没有人写 /alpha 无关,
  // 且这张构造表就是 R6 归零后仍然要保证能工作的那件事。
  const probe = { primary: { bg: ['10'], border: ['20', '30', '40'] }, muted: { bg: ['40', '[0.12]'] } }
  const builtProbe = alphaPlugin.buildAlphaUtilities(probe, reg.colors)
  assert.equal(builtProbe.unresolvable.length, 0, '构造表必须全部可解析')
  assert.ok(
    Object.keys(builtProbe.utilities).length >= 5,
    `构造表产出条数量级不对(${Object.keys(builtProbe.utilities).length})⇒ 产出函数或转义坏了`,
  )
  assert.ok(
    builtProbe.utilities[alphaPlugin.escapeSelectorClass('bg-primary/10')],
    '构造表里的 bg-primary/10 必须真产出(否则"解析驱动产出"这条没被证明过)',
  )
  // 写成非常量形态的登记表必须大声失败,绝不能被静默当成"没有用量"
  assert.throws(() => parseLiteralObject('a: compute()'), __test__.UndeterminedError)
  assert.throws(
    () => extractObjectBody('colors: { a: "x" } colors: { b: "y" }', /\bcolors\s*:\s*\{/),
    __test__.UndeterminedError,
  )
})

// ── 崩溃面(2026-09-25 补)──
// 起因:全量模式偶发匿名 `TypeError: Cannot read properties of undefined (reading 'length')` + exit 2,
// 只打 message 不打栈 ⇒ 复跑三轮再也复现不出来。修法是"崩 ⇒ 具名无法判定"与"截断 ⇒ 大声失败",
// 而这两条**只能用纯函数 + 构造面证明**(把旧形状写回本文件当证明会因 `break` 落循环外而语法错)。
test('装车形状:本门必须真走取材层,且不得自带 batch 解析(含"半收口"反例)', async () => {
  const { checkCrashShape } = await import('../check-cross-end-tokens.mjs')
  assert.equal(typeof checkCrashShape, 'function', 'checkCrashShape 必须被导出(否则形状判据测不到)')

  const src = readFileSync(new URL('../check-cross-end-tokens.mjs', import.meta.url), 'utf8')
  const onReal = checkCrashShape(src)
  assert.equal(
    onReal.usesLayer,
    true,
    '本门必须从 ./lib/face-reader.mjs 取层的 catBatch —— 不再自带一份',
  )
  assert.equal(onReal.selfBatchBack, false, '本门不得再出现自己的 cat-file --batch 派生')
  assert.equal(onReal.silentBreakBack, false, '真文件不得含旧静默 break 形状')
  assert.equal(onReal.catchHasStack, true, '顶层 catch 必须带栈')

  // 反例 1:旧写法(自带 batch + 静默 break 少扫)回来 ⇒ 三个字段必须同时翻(证明尺子有牙,不是恒绿)
  const onBad = checkCrashShape(
    "function catBatch(revs){ const out = execFileSync('git', ['cat-file', '--batch'])\n  map.set(rev, null)\n      break\n}\n",
  )
  assert.deepEqual(
    { u: onBad.usesLayer, b: onBad.selfBatchBack, s: onBad.silentBreakBack },
    { u: false, b: true, s: true },
    '一段自带解析的文本必须被 usesLayer / selfBatchBack / silentBreakBack 三处同时抓到',
  )

  // 反例 2:两个字段必须**互相独立**,不能互为代理 —— "收口收了一半"(走了层、又另起一处 batch 派生)
  // 只有 selfBatchBack 会翻。同时钉住已知前缀陷阱:`'--batch'` 是 `'--batch-check'` 的前缀,
  // 只出现后者不得被判成自带解析。
  const halfMoved = checkCrashShape(
    "import { catBatch } from './lib/face-reader.mjs'\nconst m = catBatch(root, revs)\nfunction extra(){ return g(['cat-file', '--batch-check']) }\n",
  )
  assert.equal(halfMoved.usesLayer, true, '走了层 ⇒ usesLayer 必须为 true')
  assert.equal(halfMoved.selfBatchBack, false, "只出现 '--batch-check' 不是自带 batch,不得误判")
  const halfMoved2 = checkCrashShape(
    "import { catBatch } from './lib/face-reader.mjs'\nconst m = catBatch(root, revs)\nfunction extra(){ return g(['cat-file', '--batch']) }\n",
  )
  assert.equal(
    halfMoved2.selfBatchBack,
    true,
    '同一文件既走层又另起一处 batch 派生 ⇒ 必须点名(半收口不许蒙过)',
  )

  // 反例:catch 只打 message ⇒ 必须被抓到
  assert.equal(
    checkCrashShape('main().catch((e) => { console.error(e.message); process.exit(2) })')
      .catchHasStack,
    false,
    '不带栈的 catch 必须判红'
  )
})

test('resolveTsPath 拿到不存在的表 ⇒ 具名 UndeterminedError 且点名表名', async () => {
  const m = await import('../check-cross-end-tokens.mjs')
  const { resolveTsPath, UndeterminedError } = m.__test__ ?? m
  assert.throws(
    () => resolveTsPath(undefined, ['rnGhostTokens', 'gold']),
    (e) => e instanceof UndeterminedError && /rnGhostTokens/.test(e.message) && /取不到/.test(e.message),
    '必须是具名"无法判定",且消息里要点名是哪张表'
  )
  // 反向对照:正常 body 不得被新守卫误伤
  assert.doesNotThrow(() => resolveTsPath('vip: { gold: "#FFD700" };', ['vip', 'gold']))
})
