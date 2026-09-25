// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— scripts/check-miniapp-css-landing.mjs
 *
 * 跑法:node --test scripts/tests/check-miniapp-css-landing.test.mjs
 *
 * 三件事必须被证明,缺一即测试无意义:
 *  1. **判据有牙**:C1 的算术在"全缺失"时必判 0、"全落地"时必判 1,且分母不收参考层外的名字。
 *     形状判据只能用纯函数 + 构造面证明(不得靠"真仓跑一次看它红不红"—— 真仓现在根本没有
 *     可信的 weapp 产物,那种证明方式今天会直接退化成了没测)。
 *  2. **绝不假绿**:产物缺失 / 产物是别的平台构建 / 参考层跑不起来 —— 三种输入都必须 exit 2,
 *     任何一条退化成 exit 0 就说明"把工具失效当成了通过"。
 *  3. **本门不得被静默摘线**:接线态由门自己的 `WIRING_MODE` 单点声明,镜像测试拿它和
 *     `guardian-runner.mjs` 的实际注册内容对账,**两个方向都要红**:
 *       - 声明 manual 而 runner 里出现了它 ⇒ 有人把它接进了提交链却没改声明;
 *       - 声明 commit 而 runner 里没有它 ⇒ 门被摘线(造好没装车,本仓最高频那一型)。
 *     当前真值是 manual —— 因为它判构建产物,提交者结构上未必满足,接成 blocking 只会逼人
 *     --no-verify 并连带废掉全部守门(§12e)。
 *  4. **转写比对收紧必须"有牙也不放水"** (§2b,2026-09-25):阳性对照与反向对照都在**同一次
 *     运行的同一份 landed** 上做 A/B(旧判据必命中不足 / 收紧后已知事实集全中 / 凭空名字仍判缺),
 *     真 dist 不在位时显式 skip 并说原因 —— 自跳过要喊出来,不得静默计为通过。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G, WIRING_MODE } from '../check-miniapp-css-landing.mjs'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-miniapp-css-landing.mjs')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')

function runGate(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 64 << 20,
    windowsHide: true,
  })
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

function mkTmp(tag) {
  const p = join(ROOT, '.ihui-agent', 'tmp', `css-landing-mirror-${tag}`)
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
  mkdirSync(p, { recursive: true })
  return p
}
function rmTmp(p) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true })
}

/* ─────────────── 1. 判据有牙:C1 算术(纯函数 + 构造面) ─────────────── */

test('C1 全缺失必判 0 覆盖并点名样例(该红必红)', () => {
  const c = G.computeCoverage(['flex', 'text-sm', 'w-full'], new Set(['flex', 'text-sm', 'w-full']), new Set())
  assert.equal(c.pct, 0)
  assert.equal(c.demandedKinds, 3)
  assert.equal(c.missKinds, 3)
  assert.equal(c.missingSamples.length, 3)
})

test('C1 全落地必判 1 覆盖(该绿必绿)', () => {
  const c = G.computeCoverage(['flex', 'text-sm'], new Set(['flex', 'text-sm']), new Set(['flex', 'text-sm']))
  assert.equal(c.pct, 1)
  assert.equal(c.missKinds, 0)
})

test('C1 分母不收参考层外的自有类(否则恒红)', () => {
  // action-btn / my-title 是端内自有语义类,Tailwind 结构上不会产出它们,
  // 把它们算进分母会让覆盖率永远到不了 100% —— 那是一把恒红的尺子。
  const c = G.computeCoverage(['flex', 'action-btn', 'my-title'], new Set(['flex']), new Set(['flex']))
  assert.equal(c.demandedKinds, 1)
  assert.equal(c.pct, 1)
})

test('C1 分母为空不得判成 0 覆盖(无需求 ≠ 全失败)', () => {
  assert.equal(G.computeCoverage(['x'], new Set(), new Set()).pct, 1)
})

/* ─────────────── 2. 转义与任意值类名不得隐身 ─────────────── */

test('任意值/感叹号前缀的转义类名必须被认出来', () => {
  assert.deepEqual([...G.harvestLandedSelectors('.\\!visible{a:b}')], ['!visible'])
  assert.ok(G.harvestLandedSelectors('.-right-\\[12rpx\\]{right:-12rpx}').has('-right-[12rpx]'))
})

test('裸类名(无规则体)不得算落地,注释里的假规则不得算定义', () => {
  assert.deepEqual([...G.harvestLandedSelectors('.parent .child')], [])
  assert.deepEqual([...G.harvestClassDeclarations('/* .fake{color:red} */ .real{color:red}').keys()], ['real'])
})

/* ─────────────── 2b. weapp 类名转写比对(2026-09-25 C1 收紧) ─────────────── */
/**
 * 缺陷本体:weapp-tailwindcss 产出 wxss 时把类名里的标点按固定表转写
 * (`[ → _b ] → _B / → _f : → _c ( → _p ) → _P , → _m . → _d + → _u`),
 * 旧 C1 拿源文件里的**原始类名**比产物里 harvest 到的名字 ⇒ 所有含标点的档整片被判"没落地"
 * (实测 505 条缺项里绝大多数是这把尺的噪声,而 `.bg-muted`/`.top-1_f2` 声明体真实在产物里)。
 * 本组证明三件事:
 *  ① **阳性对照(真 dist 对账)**:已知落地事实集在旧判据(只比原名)下明显命中不足、
 *    收紧后(原名 ∪ 转写名)全部命中 —— A/B 在同一次运行、同一份 landed 上做,不靠"改前跑一次"。
 *  ② **反向对照(不得放水)**:产物里没有的名字,收紧后仍必判缺。加转写表只允许
 *    把"其实落了地的"认回来,不得让"真没落地的"更容易点头。
 *  ③ **表外标点不猜**:未在真产物实测到转写的 `! * % # @ > ~` 一律不进表,
 *    它们参与的缺项进 unmangledPunctMisses 只报数,绝不并入 hit。
 */

test('转写函数:样本逐字取自 2026-09-25 真 weapp 构建产物(非立票猜测)', () => {
  assert.equal(G.weappMangleClassName('-top-[8rpx]'), '-top-_b8rpx_B')
  assert.equal(G.weappMangleClassName('top-1/2'), 'top-1_f2')
  assert.equal(G.weappMangleClassName('bg-[var(--color-black-50)]'), 'bg-_bvar_p--color-black-50_P_B')
  assert.equal(G.weappMangleClassName('bg-[rgba(0,0,0,0.4)]'), 'bg-_brgba_p0_m0_m0_m0_d4_P_B')
  assert.equal(G.weappMangleClassName('dark:text-foreground'), 'dark_ctext-foreground')
  assert.equal(G.weappMangleClassName('pb-[calc(20rpx+env(safe-area-inset-bottom,0))]'), 'pb-_bcalc_p20rpx_uenv_psafe-area-inset-bottom_m0_P_P_B')
  // 表外标点原样保留 —— 未实测的转写不得写进表(猜错的方向是"把真没落地的判成落地")
  assert.equal(G.weappMangleClassName('!bg-cta'), '!bg-cta')
  assert.deepEqual(G.unmappedPunctIn('!bg-cta'), ['!'])
  assert.deepEqual(G.unmappedPunctIn('w-[50%]'), ['%'], '连字符/字母不算标点;只剩 % 待验')
  assert.deepEqual(G.unmappedPunctIn('bg-muted'), [], '反向对照:普通名字不得被说成"含表外标点"')
})

test('阳性对照(真 dist):旧判据命中不足、收紧后已知落地事实集全部命中', (t) => {
  const dist = join(ROOT, 'apps', 'miniapp-taro', 'dist')
  const shape = G.classifyDist(dist)
  if (shape.kind !== 'weapp') {
    t.skip(`本机当前无可信 weapp 产物(${shape.reason || shape.kind})⇒ 本对照自跳过并明说,不冒绿`)
    return
  }
  let landed
  try {
    landed = G.collectLandedFromDist(dist).landed
  } catch (e) {
    t.skip(`产物读取失败(构建可能正在进行):${e.message}`)
    return
  }
  const KNOWN_LANDED = [
    '-top-[8rpx]',
    'top-1/2',
    'bg-[var(--color-black-50)]',
    'dark:text-foreground',
    'bg-[rgba(0,0,0,0.4)]',
    'pb-[calc(20rpx+env(safe-area-inset-bottom,0))]',
  ]
  // A 臂 = 旧判据(只比原名);B 臂 = 收紧后(原名 ∪ 转写名)。同一份 landed,只差判据。
  const oldHits = KNOWN_LANDED.filter((n) => landed.has(n))
  const newHits = KNOWN_LANDED.filter((n) => landed.has(n) || landed.has(G.weappMangleClassName(n)))
  assert.ok(oldHits.length < KNOWN_LANDED.length, `旧判据竟把 ${oldHits.length}/${KNOWN_LANDED.length} 都判了命中 ⇒ 产物形态变了,本对照失去判别力,需人工复核`)
  assert.equal(newHits.length, KNOWN_LANDED.length, `收紧后仍有已知落地事实未命中:${KNOWN_LANDED.filter((n) => !newHits.includes(n)).join(', ')}`)
  // 走门自己的算术:这些命中必须全部记在"转写后中"这一态上(表确实参与判定,不是直白的恒真)
  const c = G.computeCoverage(KNOWN_LANDED, new Set(KNOWN_LANDED), landed)
  assert.ok(c.hitMangledKinds > 0, 'hitMangledKinds=0 ⇒ 转写判据没参与真实产物,整组对照是摆设')
  assert.equal(c.hitKinds + c.missKinds, c.demandedKinds)
  assert.equal(c.missKinds, 0, `转写后仍缺:${(c.missFamilies || []).map((f) => f.family).join(', ')}`)
})

test('反向对照(真 dist):凭空造的名字收紧后仍必须判缺(否则=让门更容易点头)', (t) => {
  const dist = join(ROOT, 'apps', 'miniapp-taro', 'dist')
  if (G.classifyDist(dist).kind !== 'weapp') {
    t.skip('本机当前无可信 weapp 产物 ⇒ 自跳过')
    return
  }
  let landed
  try {
    landed = G.collectLandedFromDist(dist).landed
  } catch (e) {
    t.skip(`产物读取失败:${e.message}`)
    return
  }
  const FAKE = 'bg-does-not-exist-tier'
  assert.ok(!landed.has(FAKE) && !landed.has(G.weappMangleClassName(FAKE)), '凭空名字竟在产物里 ⇒ 产物不干净,本对照失去判别力')
  const c = G.computeCoverage([FAKE], new Set([FAKE]), landed)
  assert.deepEqual([c.hitKinds, c.missKinds, c.unmangledPunctMisses, c.definiteMissKinds], [0, 1, 0, 1])
  assert.deepEqual(c.missFamilies, [{ family: 'bg', count: 1 }], '真缺项仍须成族可读,归族不得被转写表带跑')
})

test('装车证明:转写判据真挂在 computeCoverage / runCheck / report 上(定义了没接 = 没有)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /landedNames\.has\(weappMangleClassName\(n\)\)/, 'computeCoverage 没有真比转写名')
  assert.match(src, /!landed\.has\(n\) && !landed\.has\(weappMangleClassName\(n\)\)/, 'runCheck 的 missOccurrences 没吃同一谓词 ⇒ 两处数字不同源(§"两处算同一件事必漂移")')
  assert.match(src, /miss\.filter\(\(n\) => unmappedPunctIn\(n\)\.length > 0\)/, '表外标点桶定义了却没挂上')
  assert.match(src, /原名直中 \$\{c\.hitOriginalKinds\} \+ weapp 转写后中 \$\{c\.hitMangledKinds\}/, '两态计数算出来了却没进报告(只报合计会把"表漏一条"藏起来)')
  assert.match(src, /待验字符:\$\{c\.unmangledPunctChars\.join\(' '\)\}/, '表外字符没在报告里点名 ⇒ 下一次实测不知道表还缺哪几条')
  assert.match(src, /按族分布\(共 \$\{c\.missFamilies\.length\} 族,top5\)/, '缺项归族没进报告 ⇒ 样例仍是扁平截断,"成族"信号不可读')
  // 负锁:未实测的标点不得被"顺手补进"转写表。只认**映射条目形态** `['X', '_y']` ——
  // 第一版写成 /\['!'/ 把 self-test 里"unmangledPunctChars 期望值 = ['!']"这条正当夹具也判了红,
  // 那正是本仓反复记的"门看不见自己产出的形态";判据失效方向错了会挡死合法收紧。
  assert.doesNotMatch(src, /\['[!*%#@>~]'\s*,\s*'_/, '未实测标点(! * % # @ > ~)被猜进了转写表条目')
})

/* ─────────────── 3. 同名双义三档分类,各一正一反 ─────────────── */

test('white-on-white:浅色 color × 浅色 background 且自有不设 color', () => {
  assert.equal(
    G.classifyDualMeaning(['color:var(--color-card)'], ['background:var(--color-card)', 'padding:28rpx']),
    'white-on-white',
  )
})

test('反向对照:深色 background / 自己设 color / utility 不出 color,都不得判成白底事故', () => {
  assert.notEqual(G.classifyDualMeaning(['color:var(--color-card)'], ['background:#111827']), 'white-on-white')
  assert.notEqual(G.classifyDualMeaning(['color:var(--color-card)'], ['background:#fff', 'color:#333']), 'white-on-white')
  assert.notEqual(G.classifyDualMeaning(['display:flex'], ['background:var(--color-card)']), 'white-on-white')
})

test('盲区判据只在 Tailwind 命名空间里成立(1500+ 条噪声会把真那一条埋掉)', () => {
  // text-card 前缀 text 下有 text-sm ⇒ 它可能是候选,参考层看不见就必须点名
  assert.deepEqual(G.findBlindSpots(['text-card'], new Set(['text-sm'])), ['text-card'])
  // action-btn 前缀 action 下没有任何 Tailwind 规则 ⇒ 结构上不可能,不得混进来
  assert.deepEqual(G.findBlindSpots(['action-btn', 'agent-avatar'], new Set(['text-sm', 'flex'])), [])
  assert.equal(G.namespacePrefix('text-muted-foreground'), 'text-muted')
  assert.equal(G.namespacePrefix('visible'), 'visible')
})

/* ─────────────── 4. 主包切分:长在 pages/ 下的分包根必须剔除 ─────────────── */

test('主包按 app.json 的 subpackage roots 切,不按 pkg-* 前缀', () => {
  const base = mkTmp('budget')
  try {
    const d = join(base, 'dist')
    mkdirSync(join(d, 'pages', 'circle'), { recursive: true })
    const appJson = JSON.stringify({ pages: ['pages/i'], subpackages: [{ root: 'pages/circle' }] })
    writeFileSync(join(d, 'app.json'), appJson)
    writeFileSync(join(d, 'app.wxss'), 'x'.repeat(100))
    writeFileSync(join(d, 'pages', 'circle', 'i.wxss'), 'y'.repeat(500))
    const m = G.measureMainPackage(d)
    assert.equal(m.subBytes, 500, 'pages/circle 是分包,不得算进主包')
    assert.equal(m.mainBytes, Buffer.byteLength(appJson) + 100)
    assert.equal(m.headroomBytes, G.MAIN_PACKAGE_LIMIT - m.mainBytes)
  } finally {
    rmTmp(base)
  }
})

/* ─────────────── 5. 绝不假绿:三种坏输入都必须 exit 2 ─────────────── */

test('产物不存在 ⇒ exit 2「无法判定」,不得报成 0% 覆盖', () => {
  const base = mkTmp('absent')
  try {
    const dir = mkFakeApp(base)
    const r = runGate(['--root', base, '--skip-reference', '--dist-dirname', 'nope-dist'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /无法判定/)
    assert.doesNotMatch(r.out, /❌ C1/, '产物缺失绝不该表现为判据红(那是把工具失效当业务结论)')
    void dir
  } finally {
    rmTmp(base)
  }
})

test('dist 是 h5 构建(与 weapp 共用 outputRoot)⇒ exit 2,不得当成 0 落地', () => {
  const base = mkTmp('h5clobber')
  try {
    const app = mkFakeApp(base)
    const dist = join(app, 'dist')
    mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, 'index.html'), '<html>')
    writeFileSync(join(dist, 'app.js'), '')
    const r = runGate(['--root', base, '--skip-reference'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /h5/, '必须点名是被 h5 构建覆盖了')
  } finally {
    rmTmp(base)
  }
})

test('参考层不可用时 C1/C2 判不出,不得"看起来全绿"', () => {
  const base = mkTmp('noref')
  try {
    mkFakeApp(base)
    const r = runGate(['--root', base, '--skip-reference'])
    assert.equal(r.code, 2)
    assert.match(r.out, /skip-reference/)
  } finally {
    rmTmp(base)
  }
})

/* ─────────────── 6. 真仓读数:退出码必须由**产物形态**决定,不得由"本机此刻有没有 dist"决定 ─────────────── */

/**
 * 这一条原先写成 `assert.equal(code, 2)` + 理由"本机当前无可信 weapp 产物"。
 * **那是把移动量钉成期望**(§"别把移动量钉成健康期望"同型):dist 被 .gitignore 忽略、
 * weapp 与 h5 **共用 outputRoot**,同端任何人一次构建就整目录换掉 —— 本次实测就遇到
 * 同一份门在 5 分钟内先给 `6/759 exit 1`、再给 `492/667 exit 0`,因为期间别人的
 * `taro build --type weapp` 正在重写 dist。
 * ⇒ **判据不能建立"磁盘上这一刻的 dist 该判几"上**,所以本条改成用合成目录直接量
 *   `classifyDist`(它就是"形态 ⇄ 是否允许判定"的唯一分派点),既不依赖本机产物、
 *   又把"不得把产物不存在报成 0% 覆盖"这条真正要防的东西钉住。
 */
const writeDist = (d, { wxss = 0, wxml = 0, indexHtml = false } = {}) => {
  mkdirSync(d, { recursive: true })
  if (indexHtml) writeFileSync(join(d, 'index.html'), '<div id="root"></div>')
  for (let i = 0; i < wxss; i++) writeFileSync(join(d, `p${i}.wxss`), '.a{color:red}')
  for (let i = 0; i < wxml; i++) writeFileSync(join(d, `p${i}.wxml`), '<view/>')
}
test('形态分类是"能不能判定"的唯一分派点(四种形态各自的答案都被证明过)', () => {
  const base = mkdtempSync(join(tmpdir(), 'ihui-shape-'))
  try {
    const absent = join(base, 'absent')
    assert.equal(G.classifyDist(absent).kind, 'absent', '目录不存在必须判 absent,不得报 0% 覆盖')
    const h5 = join(base, 'h5')
    writeDist(h5, { indexHtml: true })
    assert.equal(G.classifyDist(h5).kind, 'wrong-platform', 'h5 的 dist(有 index.html 无 wxml)必须判 wrong-platform')
    const empty = join(base, 'empty')
    writeDist(empty)
    assert.equal(G.classifyDist(empty).kind, 'wrong-platform', '一个 .wxml 都没有 ⇒ 不是 weapp 产物')
    const broken = join(base, 'broken')
    writeDist(broken, { wxml: 2 })
    assert.equal(G.classifyDist(broken).kind, 'wrong-platform', '有 .wxml 但 .wxss 为 0 ⇒ 产物不完整,不得按 0% 判红')
    const good = join(base, 'good')
    writeDist(good, { wxss: 2, wxml: 2 })
    assert.equal(G.classifyDist(good).kind, 'weapp', '正向对照:完整 weapp 产物必须被认出来(否则上面四条是恒真)')
  } finally {
    rmSync(base, { recursive: true, force: true, maxRetries: 3 })
  }
})

test('真仓跑一次:退出码只能是 0/1/2,且弃权时必须说"未判定"', () => {
  const r = runGate([])
  assert.ok([0, 1, 2].includes(r.code), `退出码越界(${r.code})⇒ 门自身异常,不得当作结论`)
  if (r.code === 2) assert.match(r.out, /未判定|无法判定/, 'exit 2 却没写"未判定" ⇒ 把工具失效冒充成了业务结论')
  if (r.code === 1) assert.match(r.out, /判红/)
  if (r.code === 0) assert.doesNotMatch(r.out, /判红/)
  // 同面改造后的对外契约(2026-09-25):报告只报**一把判定面**,且不再出现两条自我否定。
  // 旧形态"源码 = head,产物 = 磁盘"配合一条"参考层取材=worktree … 两把不同面"的 notice,
  // 等于门自己承认基准错位还照样给结论 —— 那把尺要钉死不得回来。
  assert.match(r.out, /取材面:单一判定面 = (head|staged|worktree)/, '默认档必须只报一把判定面(源码 ↔ 参考层同面)')
  assert.doesNotMatch(r.out, /两把不同面|不得据以决策/, '作废的自我否定措辞不得回到任何一次运行输出里')
})

/* ─────────────── 6b. 同面/异面判据:同一份构造输入,只换面,结论必须换 ─────────────── */
/**
 * 形状判据只能用纯函数 + 构造面证明("prove-shape-rulers"):这里**不依赖真仓 dist 的运气** ——
 * 输入只是 (face, engine, explicit) 三元组,P1 与 P2 用同一引擎档只差一个面,
 * 一拒一判才算证明"面"真的参与了判据,而不是恒绿/恒红的摆设。
 */
test('异面必拒 / 同面必判:v3 参考层 × head 面 ⇒ 判"无法判定";× worktree ⇒ 正常出结论(只差一个面)', () => {
  const away = G.planReferenceFace({ face: 'head', engine: 'v3', explicit: false })
  assert.equal(away.action, 'abstain', 'v3 生成器只能读磁盘,配 head 源码面必须拒绝出判定数(旧写法只挂 notice 照常判红)')
  assert.equal(away.judged, false)
  assert.equal(away.sameFace, false)
  assert.match(away.reason, /异面/)
  const same = G.planReferenceFace({ face: 'worktree', engine: 'v3', explicit: false })
  assert.deepEqual([same.action, same.sameFace, same.judged], ['build', true, true], '反向对照:全磁盘面(worktree)下 v3 生成器就是同面,不得连这个也拒 ⇒ 那 P1 就成了恒拒的摆设')
  // v4 候选由被审面喂入 ⇒ 任何源码面都同面
  assert.deepEqual(G.planReferenceFace({ face: 'staged', engine: 'v4' }), { sameFace: true, judged: true, action: 'build', reason: '' })
})

test('人工对比档:异面照样出**读数**但结构上判不了红(judged=false)', () => {
  const r = G.planReferenceFace({ face: 'head', engine: 'v3', explicit: true })
  assert.deepEqual([r.action, r.sameFace, r.judged], ['build', false, false])
})

test('装车证明:runCheck 必须真消费 planReferenceFace,abstain 折进「无法判定」;旧的两面 notice 不得回来', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /planReferenceFace\(\{ face, engine: picked\.engine, explicit: picked\.explicit \}\)/, '同面判据定义了却没被 runCheck 调用 = 没有(§70/76/81 同型)')
  assert.match(src, /facePlan\.action === 'abstain'[\s\S]{0,120}undetermined\.push/, 'abstain 没有折进 undetermined ⇒ 会表现为"没数但绿"')
  assert.match(src, /c1Judged = !!coverage && !engineMismatch && referenceJudged/, 'C1 判红没吃同面闸 ⇒ 异面读数照样能判红')
  assert.doesNotMatch(src, /参考层取材 = \$\{referenceFace\},源码面 = \$\{face\} —— 两把不同面/, '"两把不同面还照样出结论"那条 notice 形态不得复原')
})

/* ─────────────── 7. 本门不得被静默摘线(装车形状对账) ─────────────── */

test('WIRING_MODE 与实际接线必须双向一致', () => {
  assert.ok(['manual', 'commit'].includes(WIRING_MODE), `WIRING_MODE 取值非法:${WIRING_MODE}`)
  const runner = readFileSync(RUNNER, 'utf8')
  const wired = /check-miniapp-css-landing\.mjs/.test(runner)
  if (WIRING_MODE === 'manual') {
    assert.equal(wired, false, '声明为手动/CI 门,但 guardian-runner 里出现了它 —— 有人把它接进了提交链而没改声明。接成 blocking 会让提交者因"产物不存在"被逼 --no-verify(§12e)。')
  } else {
    assert.equal(wired, true, '声明已接提交链,但 runner 里没有它 —— 本门被摘线了(造好没装车,本仓最高频那一型)。')
    const block = runner.slice(Math.max(0, runner.indexOf('check-miniapp-css-landing.mjs') - 600), runner.indexOf('check-miniapp-css-landing.mjs') + 600)
    assert.match(block, /skipEnv/, '接线成提交链的门必须留应急出口')
  }
})

test('源码里必须写着「当前为手动 / CI 门」,且结论行也要说出这件事', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /手动 \/ CI 门/, '头注必须如实登记定级,否则下一个人会以为它在守提交')
  const r = runGate(['--min-coverage', '0'])
  assert.match(r.out, /未接进提交链/, '运行输出也要说明定级(只看代码的人不会跑代码,跑一次的人应当被告知)')
})

/* ─────────────── 8. 产物引擎判据:必须"被算出来"且"被说出来" ─────────────── */

test('引擎判据三向可分(只有 v4 指纹 / 只有 v3 指纹 / 两版都有 ⇒ unknown)', () => {
  const V4 = '--tw-leading:;--tw-tracking:;--tw-gradient-position:initial;--tw-drop-shadow-size:;--tw-duration:initial;--tw-ease:initial;'
  const V3 = '--tw-bg-opacity:1;--tw-text-opacity:1;--tw-border-opacity:1;'
  const base = mkdtempSync(join(tmpdir(), 'ihui-eng-'))
  try {
    const d = join(base, 'dist')
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'app.wxss'), '@import "./app-origin.wxss";')
    const w = (css) => writeFileSync(join(d, 'app-origin.wxss'), css)
    w(`page{box-sizing:border-box;border:0 solid}${V4}`)
    const a = G.detectProductTailwindMajor(d)
    assert.deepEqual([a.major, a.preflight, a.v4Hits, a.v3Hits], ['v4', true, 6, 0])
    w(`page{margin:0}${V3}`)
    assert.equal(G.detectProductTailwindMajor(d).major, 'v3', '反向对照:只有 v3 指纹必须答 v3,否则本判据等于恒答 v4')
    w(`${V4}${V3}`)
    assert.equal(G.detectProductTailwindMajor(d).major, 'unknown', '两版指纹同时出现时必须承认判不出,不得猜一个方向')
  } finally {
    rmSync(base, { recursive: true, force: true, maxRetries: 3 })
  }
})

test('引擎不一致时必须把"不得据以决策"打在输出里(判据存在却没说出来 = 没有)', () => {
  const src = readFileSync(GATE, 'utf8')
  // 装车证明①:必须真调用,且把结果放进返回对象(只定义不调用 = 没有这道判据)
  assert.match(src, /productEngine = detectProductTailwindMajor\(/, '没真正调用产物引擎判据')
  assert.match(src, /productEngine,\s*\n\s*engineMismatch,/, '算出来了却没放进返回对象 ⇒ 报告拿不到')
  // 装车证明②(2026-09-25 换形):C3 那句"若开启 utilities…装不装得下"的**假设算术**已随链开落地作废
  // (主包/余量现在是含 utilities 落地量的实测现值),所以"引擎失配必须喊出来"落在两处,都要钉住:
  //  ① 引擎不一致的 ⚠️ 段必须明说"不构成依据";② C1 在非判红档必须标"只是读数,不计红"。
  assert.match(src, /都不构成"该不该开链"的依据/, '引擎不一致却没在输出里说"不构成依据" ⇒ 人照样会拿这个数决策')
  assert.match(src, /r\.c1Judged \? '' : ' 〔对比档/, 'C1 在参考层不同引擎/不同面时必须自标"只是读数,不计红"')
  // 注意这里**不能**判"源码里不许出现 (装得下) 这几个字" —— 上面那句引擎失配的注释里
  // 正当引用了它(正是为了说明为什么作废)。要拦的是**产出那句结论的表达式**本身。
  assert.ok(!src.includes("slack >= 0 ? '(装得下)'"), '作废的"若开启…装不装得下"假设算术不得回来(链已开,那组前置数实测方向是反的)')
})

/* ─────────────── 8b. 参考层必须与产物**同引擎**(换档的全部理由) ─────────────── */

/**
 * 三条一起看才算证明:
 *  ① **阳性对照**:v4 参考层真的把引擎换成了 v4 —— 用的是"两把尺子结论不同的那个名字"
 *    (`invisible`:v4 参考层认、端内 v3 参考层不认)。只断言"版本字符串是 4.x"是不够的:
 *    字符串可以写死,清单不会。
 *  ② **读数确实变了**:同一批候选在 v3/v4 两把尺下分母不同 —— 否则"换引擎"是句空话。
 *  ③ **反向对照**:换一个不存在的类名必须**不**在参考层里 —— 否则参考层是"全都算"的假尺,
 *    覆盖率会恒等于 100%。
 */
test('参考层真换成 v4:两把尺子结论不同的名字 + 分母读数确实变了 + 不存在的类名不得被认作候选', async () => {
  const appDir = join(ROOT, 'apps', 'miniapp-taro')
  const candidates = ['px-4', 'text-sm', 'flex', 'bg-muted', 'invisible', 'not-a-class-xyz']
  const v4 = await G.buildUtilityReferenceV4({ root: ROOT, appDir, candidates })
  const v3 = await G.buildUtilityReference(appDir)
  assert.equal(v4.engine, 'v4')
  assert.match(v4.tailwindVersion, /^4\./, `v4 档拿到的却是 ${v4.tailwindVersion}`)
  assert.ok(v4.names.has('px-4') && v4.names.has('text-sm'), 'theme 没喂进去时 v4 只出 arbitrary 那一半 —— px-4/text-sm 缺失即输入不一致')
  // ① 阳性对照(先钉夹具前提:v3 那侧确实没有,否则这条断言是恒真)
  assert.equal(v3.names.has('invisible'), false, '夹具前提变了:v3 参考层如今含 invisible,本对照失去判别力,换一个两把尺不同的名字')
  assert.equal(v4.names.has('invisible'), true, '换成 v4 后参考层必须真的变了')
  // ② 分母读数确实变了
  const c4 = G.computeCoverage(candidates, v4.names, new Set())
  const c3 = G.computeCoverage(candidates, v3.names, new Set())
  assert.notEqual(c4.demandedKinds, c3.demandedKinds, `v3/v4 两把尺的分母一样(${c3.demandedKinds})⇒ "换引擎"没落到读数上`)
  // ③ 反向对照:不存在的类名不得进参考层
  assert.equal(v4.names.has('not-a-class-xyz'), false, '参考层把不存在的类名也认作候选 ⇒ 是一把"全都算"的假尺')
})

test('auto 档必须先看产物引擎再决定参考层(顺序反了就是先射箭再画靶)', () => {
  const src = readFileSync(GATE, 'utf8')
  const engineAt = src.indexOf('productEngine = detectProductTailwindMajor(')
  // 找**调用点**而不是函数定义(定义行 `export function pickReferenceEngine({ productMajor…` 也含这个名字)
  const pickAt = src.indexOf('pickReferenceEngine({ productMajor: productEngine')
  assert.ok(engineAt > 0 && pickAt > engineAt, 'pickReferenceEngine 必须在产物引擎判完之后调用')
  // C1 判红必须过 c1Judged 这道闸(人工对比档不得判红)
  assert.match(src, /!undetermined\.length && c1Judged && coverage\.pct < minCoverage/, 'C1 判红没走 c1Judged ⇒ 错引擎的参考层照样能判红')
  assert.match(src, /参考层引擎无法确定/, '同引擎做不到时必须登记「无法判定」而不是继续出数')
})

/**
 * 反向对照①:**产物引擎判不出 ⇒ exit 2,且一个覆盖率都不给。**
 * 这是换档要防的那一型 —— 一把量不出引擎的尺子报出 "还剩 N 条没落地",
 * 看起来是结论,实际是噪声;而它最坏的形态是"看起来很有把握"。
 */
test('产物引擎判不出 ⇒ exit 2 且不得输出任何 C1 覆盖率数字', () => {
  const base = mkTmp('eng-unknown')
  try {
    const app = mkFakeApp(base)
    const dist = join(app, 'dist')
    mkdirSync(join(dist, 'pages'), { recursive: true })
    writeFileSync(join(dist, 'app.json'), JSON.stringify({ pages: ['pages/i'] }))
    writeFileSync(join(dist, 'pages', 'i.wxml'), '<view/>')
    // v4 独有与 v3 独有指纹**同时**在 ⇒ detectProductTailwindMajor 判 'unknown'
    writeFileSync(
      join(dist, 'app.wxss'),
      'page{--tw-leading:;--tw-gradient-position:initial;--tw-bg-opacity:1;--tw-text-opacity:1}',
    )
    writeFileSync(join(dist, 'app2.wxss'), '.flex{display:flex}')
    const r = runGate(['--root', base, '--worktree'])
    assert.equal(r.code, 2, `期望 exit 2(弃权),实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /无法判定/)
    assert.doesNotMatch(r.out, /C1 覆盖 \d+\/\d+/, '引擎判不出却照样报了覆盖率')
    // 必须点名"是因为引擎判不出才弃权"—— 只看"未判定"三个字会把别的故障(取不到源码清单等)
    // 也算成这条判据通过,那这条反向对照就没有牙了。
    assert.match(r.out, /参考层引擎无法确定/, '没有点名弃权原因是"引擎对不上" ⇒ 无法区分是不是本判据在起作用')
    assert.match(r.out, /major = unknown/, '必须把判不出的那个指纹结论说出来(unknown 而不是猜一个方向)')
  } finally {
    rmTmp(base)
  }
})

/**
 * 反向对照②:**判得出引擎是 v4,但同引擎那套工具链拿不到 ⇒ 同样弃权,且绝不回落到 v3。**
 * 夹具里那个假端没有 `tailwind.config.ts`,也没有可解析的 node_modules。
 */
test('v4 工具链不可得 ⇒ exit 2,不得悄悄回落到 v3 出一份数', () => {
  const base = mkTmp('v4-unreachable')
  try {
    const app = mkFakeApp(base)
    const dist = join(app, 'dist')
    mkdirSync(join(dist, 'pages'), { recursive: true })
    writeFileSync(join(dist, 'app.json'), JSON.stringify({ pages: ['pages/i'] }))
    writeFileSync(join(dist, 'app.wxss'), 'page{--tw-leading:;--tw-tracking:;--tw-gradient-position:initial}')
    writeFileSync(join(dist, 'pages', 'i.wxml'), '<view/>')
    writeFileSync(join(dist, 'pages', 'i.wxss'), '.flex{display:flex}')
    const r = runGate(['--root', base, '--worktree', '--json'])
    assert.equal(r.code, 2, `期望 exit 2,实得 ${r.code}\n${r.out}`)
    const j = JSON.parse(r.out.slice(r.out.indexOf('{')))
    assert.equal(j.coverage, null, '拿不到同引擎工具链却仍产出了 coverage 对象')
    assert.equal(j.referenceEngine, null, 'referenceEngine 不为空说明它回落到了别的引擎')
    assert.match(r.out, /参考层判不出\(v4 档\)|参考层引擎无法确定/, '未判定原因必须点名是 v4 档拿不到')
  } finally {
    rmTmp(base)
  }
})

test('嵌套规则不得从两侧隐身(v4 把 @supports 嵌在类规则自己身上,扁平解析会整条漏掉)', () => {
  // 阳性:参考层侧漏收会让分母变小(覆盖率虚高),产物侧漏收会把已落地的判成没落地
  assert.ok(G.harvestLandedSelectors('.bg-primary\\/10{background-color:var(--c);@supports (color:color-mix(in lab,r 50%,b)){background-color:color-mix(in oklab,var(--c)10%,var(--b))}}').has('bg-primary/10'))
  const src = readFileSync(GATE, 'utf8')
  assert.ok(!src.includes('/([^{}]+)\\{([^{}]*)\\}/g'), '旧的扁平规则正则不得回来(它会把 v4 嵌套规则整条漏掉)')
  assert.match(src, /function ruleNodes\(/, '花括号树解析器必须在位')
  assert.match(src, /function declarationsOf\(/, '自身+后代的声明收集必须在位(空壳规则不得算落地)')
})

/* ─────────────── 8. §22c / §22d 结构锚点 ─────────────── */

test('§22d:源文件必须有 isDirectRun 守卫(被 import 时不得触发 main)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  assert.match(src, /pathToFileURL/, 'Windows 反斜杠路径必须经 pathToFileURL 归一,裸拼永不匹配')
})

test('§22c:__test__ 必须导出判据函数本体(不得让测试复制第二份实现)', () => {
  for (const k of [
    'harvestClassNameTokens',
    'harvestClassDeclarations',
    'harvestLandedSelectors',
    'classifyDist',
    'collectLandedFromDist',
    'measureMainPackage',
    'classifyDualMeaning',
    'findBlindSpots',
    'namespacePrefix',
    'computeCoverage',
    'weappMangleClassName',
    'unmappedPunctIn',
    'missFamily',
    'buildUtilityReference',
    'buildUtilityReferenceV4',
    'pickReferenceEngine',
    'planReferenceFace',
    'resolveTailwindInstall',
    'resolveV4Loaders',
    'runCheck',
  ]) {
    assert.equal(typeof G[k], 'function', `__test__ 缺少 ${k}`)
  }
  // 转写表必须是**导出的那一份**(测试与门共用一张表;在测试里另抄一份 = §22c 禁止的镜像漂移)
  assert.ok(G.WEAPP_CLASS_MANGLE_TABLE instanceof Map && G.WEAPP_CLASS_MANGLE_TABLE.size === 9, '转写表不在位或条数变了(9 条为现值;增删条目必须带真产物取证)')
})

test('--self-test 必须全绿(判据自身的成对正反例)', () => {
  const r = runGate(['--self-test'])
  assert.equal(r.code, 0, `self-test 失败:\n${r.out}`)
  assert.match(r.out, /失败 0/)
})

/* ─────────────── 9. 只读性:跑门不得改动产物或源码 ─────────────── */
/**
 * 原先比的是**整仓** `git status --porcelain` 前后逐字等值;后又改成"端源码 + dist 指纹"。
 * 两者都不可守:本仓是多会话共享工作区,且**同端任何人一次 `taro build` 就整目录换掉 dist**
 * (实测本门一次判定要 30–60s,期间 dist 被别人重写是常态,不是异常)。
 * ⇒ "跑完之后世界没变"这个前提在共享工作区里根本不成立,拿它当只读证据,
 *   失败时既可能是门写了东西、也可能是别人在建东西 —— 一把分不开两种原因的尺子等于没有。
 * 现改成**静态证明**:门自身源码里不得出现任何指向 dist / 端源码 / 门自身的写文件调用。
 * 这比运行时对比更强(它不看运气),且失败原因唯一。
 */
test('本门只读:源码里不得存在写向 产物/端源码/门自身 的调用', () => {
  const src = readFileSync(GATE, 'utf8')
  const code = src.replace(/^\s*\/\/.*$/gm, '') // 注释里提到 writeFileSync 不算
  // 判"写向仓库路径"而不是"有没有写":--self-test 往临时目录造夹具是合法的,
  // 用标识符白名单去枚举它必然假红(实测第一版就把 join(w,…)/join(partial,…) 全报成可疑)。
  // 唯一可靠的性质是:**写调用的参数里不得出现任何模块级仓库路径常量或字面量端路径**。
  const REPO_PATHS = ['ROOT', 'DEFAULT_ROOT', 'APP_REL', 'SRC_PREFIX', 'process.cwd']
  const writers = [...code.matchAll(/\b(writeFileSync|appendFileSync|copyFileSync|rmSync|unlinkSync|rmdirSync|mkdirSync|createWriteStream)\s*\(([\s\S]{0,160}?)\)/g)]
  const offending = writers.filter((m) => REPO_PATHS.some((p) => new RegExp(`\\b${p.replace(/\./g, '\\.')}\\b`).test(m[2])))
  assert.deepEqual(
    offending.map(([, fn, args]) => `${fn}(${args.replace(/\s+/g, ' ').slice(0, 70)})`),
    [],
    '发现写调用参数里出现了仓库路径常量 ⇒ 本门不再只读',
  )
  assert.doesNotMatch(code, /writeFileSync\([^)]*['"]apps\//, '不得写端源码')

  // 阳性对照:上面那三条必须是"会响的尺",不是恒真断言。
  // 做法:把同一段判据套到一份**故意写坏**的源码上,要求它判红。
  const judge = (text) => {
    const t = text.replace(/^\s*\/\/.*$/gm, '')
    const ws = [...t.matchAll(/\b(writeFileSync|appendFileSync|copyFileSync|rmSync|unlinkSync|rmdirSync|mkdirSync|createWriteStream)\s*\(([\s\S]{0,160}?)\)/g)]
    return ws.filter((m) => REPO_PATHS.some((p) => new RegExp(`\\b${p.replace(/\./g, '\\.')}\\b`).test(m[2]))).length
  }
  assert.equal(judge(`writeFileSync(join(base, 'x.wxss'), '')`), 0, '正向对照:写临时夹具不该被判红(否则上面那条是恒红尺)')
  assert.equal(judge(`writeFileSync(join(ROOT, 'apps/miniapp-taro/dist/app.wxss'), '')`), 1, '阳性对照:写仓库路径必须判红,量到 0 ⇒ 本条尺子没有牙')
})

/* ── 夹具:一份最小可枚举的假端目录(不含 tailwind,故参考层必然判不出) ── */
function mkFakeApp(base) {
  const app = join(base, 'apps', 'miniapp-taro')
  mkdirSync(join(app, 'src', 'pages'), { recursive: true })
  writeFileSync(join(app, 'src', 'pages', 'i.tsx'), 'export const X = () => <View className="flex text-card" />')
  writeFileSync(join(app, 'src', 'app.css'), '.text-card{background:var(--color-card)}')
  return app
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
