// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端转壳解锁经济账只读尺的镜像测试(§22c:判据一律 import 源脚本 __test__,本文件零复制)
/* eslint-disable no-console -- 测试夹具需要构造被审源码,不输出诊断 */
/**
 * cross-end-unlock-economy.test.mjs — 钉住 `report-cross-end-unlock-economy.mjs` 的四族牙。
 *
 *   ① 反频次锁:解锁判据是「该页 extras 全集 ⊆ 补齐集」,不是 blockers 频次。
 *      夹具两页 extras=[@/api] 与 [@/api,@/host/on-toast] ⇒ 只补 @/api 真解锁 **1** 页
 *      (按频次估会得 2)。这一条就是本尺存在的理由,必须单独命名。
 *   ② 全 combo 锁:补 {@/api,@/host/on-toast} ⇒ 解锁 2 页。
 *   ③ 两口径差分:文案「在词包里、但不住在该屏消费的键值里」⇒ scoped>0 且 pack=0(键不对齐型,
 *      **不许报成"需补词条"**);阳性对照给一句整包也没有的文案 ⇒ pack>0(真需补五语言词条)。
 *   ④ 未判定三臂:rows 为空 / 规划器输出非法 JSON / 词包取不到 ⇒ status=undetermined 且
 *      conclusion=null(不记绿)。前两臂走**真 CLI**(`--plan-json -` 喂 stdin)断言 exit code=2
 *      且 stdout 不含结论行键名;词包那臂**留纯函数**——词包是 HEAD 面 git blob,stdin 注入不了它
 *      (CLI 侧真注入会让"取不到词包"与"取不到 HEAD"两型混在一起,测不到本尺想钉的那一型),
 *      故该臂按 §22c import 生产判据 resolveMessages 直接断言。
 *   ⑤ 形状锁:读尺子源码,断言其内**没有**自写中文取数正则(`\u4e00` 形态字符类 / `[一-鿿]`),
 *      并配正向臂断言 maskComments 与 cjkNotRenderedOnScreen 的 import 确实在位
 *      (缺正向臂的"摘掉即翻红"是恒真断言,不算锁)。
 *
 * 零副作用:不落盘、不起网络、不写 git;子进程只起本尺自身(CLI 两臂),输入全走 stdin。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as eco } from '../report-cross-end-unlock-economy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const SCALE_REL = 'scripts/report-cross-end-unlock-economy.mjs'
const SCALE = path.join(ROOT, SCALE_REL)

test('① 反频次锁:补齐 {@/api} 真解锁 1 页(按频次估会得 2)', () => {
  const rows = [
    { route: 'a/one', extras: ['@/api'] },
    { route: 'a/two', extras: ['@/api', '@/host/on-toast'] },
  ]
  assert.deepEqual(eco.unlockPagesBySet(rows, new Set(['@/api'])), ['a/one'])
  const curve = eco.economyCurve(
    rows,
    [
      ['@/api', 2],
      ['@/host/on-toast', 1],
    ],
    2,
  ).curve
  assert.equal(curve[0].unlocked, 1, 'K=1 只解锁 1 页 ⇒ 频次 2 是估值不是解锁数')
  assert.equal(curve[0].routes.join(','), 'a/one')
})

test('② 全 combo 锁:补齐 {@/api,@/host/on-toast} 解锁 2 页', () => {
  const rows = [
    { route: 'a/one', extras: ['@/api'] },
    { route: 'a/two', extras: ['@/api', '@/host/on-toast'] },
  ]
  assert.deepEqual(eco.unlockPagesBySet(rows, new Set(['@/api', '@/host/on-toast'])), [
    'a/one',
    'a/two',
  ])
  const ec = eco.economyCurve(
    rows,
    [
      ['@/api', 2],
      ['@/host/on-toast', 1],
    ],
    2,
  )
  assert.deepEqual(
    ec.curve.map((c) => c.unlocked),
    [1, 2],
  )
  assert.deepEqual([ec.best.unlocked, ec.best.k], [2, 2])
})

test('②b 反例:补齐集不含页上某一枚 ⇒ 该页一枚也不解(全集判据不是命中判据)', () => {
  const rows = [{ route: 'a/two', extras: ['@/api', '@/host/on-toast'] }]
  assert.deepEqual(eco.unlockPagesBySet(rows, new Set(['@/api'])), [])
})

test('③ 两口径差分:键不对齐型 scoped>0 且 pack=0(不许报成"需补词条")', () => {
  const pack = JSON.stringify({
    rendered: { ok: '已被该屏消费的文案' },
    orphan: { tip: '这句话整包里有但屏不消费' },
  })
  const screen = "const t = (k) => k\nexport const S = () => { t('rendered.ok'); return null }"
  const shell = "const t = (k) => k\nexport const H = () => { t('rendered.ok'); return null }"
  const read = eco.readPageCopy({
    pageText: 'const tip = "这句话整包里有但屏不消费"\nexport const P = () => tip',
    sharedText: screen,
    shellText: shell,
    messagesText: [pack, ''],
    packText: pack,
  })
  assert.ok(read.scoped > 0, `作用域口径应报缺口,实到 ${read.scoped}`)
  assert.equal(read.pack, 0, '整包口径找不到 ⇒ 这一型是键没接上,零新词条可解')
  assert.equal(read.mode, 'scoped')
})

test('③b 阳性对照:整张词包也没有 ⇒ pack>0(才是真需要补五语言词条的量)', () => {
  const pack = JSON.stringify({ rendered: { ok: '已被该屏消费的文案' } })
  const screen = "const t = (k) => k\nexport const S = () => { t('rendered.ok'); return null }"
  const read = eco.readPageCopy({
    pageText: 'const tip = "这句话整张词包也没有"\nexport const P = () => tip',
    sharedText: screen,
    shellText: '',
    messagesText: [pack, ''],
    packText: pack,
  })
  assert.ok(read.pack > 0, `整包口径应报缺口,实到 ${read.pack}`)
})

test('③c 作用域读法对"屏已消费的键"销账 ⇒ scoped=0', () => {
  const pack = JSON.stringify({ rendered: { ok: '已被该屏消费的文案' } })
  const screen = "const t = (k) => k\nexport const S = () => { t('rendered.ok'); return null }"
  const read = eco.readPageCopy({
    pageText: 'const x = "已被该屏消费的文案"\nexport const P = () => x',
    sharedText: screen,
    shellText: '',
    messagesText: [pack, ''],
    packText: pack,
  })
  assert.equal(read.scoped, 0)
})

test('③d 键集为空 ⇒ 退回整包口径作为决策数(不发明第三种口径)', () => {
  const pack = JSON.stringify({ rendered: { ok: '已被该屏消费的文案' } })
  const read = eco.readPageCopy({
    pageText: 'const x = "这句话整张词包也没有"\nexport const P = () => x',
    sharedText: 'export const S = () => null',
    shellText: 'export const H = () => null',
    messagesText: [pack, ''],
    packText: pack,
  })
  assert.equal(read.mode, 'pack-fallback')
  assert.equal(read.scoped, read.pack)
})

test('④a 未判定臂一(CLI 真跑):rows 为空 ⇒ exit 2 且 stdout 不记绿', () => {
  const input = JSON.stringify({
    face: 'head',
    hand: 43,
    pairs: 245,
    hosted: 202,
    counts: { convertible: 0 },
    blockers: [['@/api', 30]],
    rows: [],
  })
  const { code, stdout } = runScale(['--plan-json', '-', '--json'], input)
  assert.equal(code, 2, '取不到输入 ⇒ 未判定 exit 2')
  assert.ok(!stdout.includes(eco.CONCLUSION_KEY), `未判定的 stdout 不得出现结论行键名:${stdout}`)
  const payload = JSON.parse(stdout)
  assert.equal(payload.status, 'undetermined')
  assert.equal(payload.conclusion, null, '未判定时结论必须为 null,不用 0 冒充没有')
})

test('④b 未判定臂二(CLI 真跑):规划器输出非法 JSON ⇒ exit 2 且 stdout 不记绿', () => {
  const { code, stdout } = runScale(['--plan-json', '-', '--json'], '这不是 JSON{{{')
  assert.equal(code, 2)
  assert.ok(!stdout.includes(eco.CONCLUSION_KEY))
  const payload = JSON.parse(stdout)
  assert.equal(payload.status, 'undetermined')
  assert.equal(payload.conclusion, null)
})

test('④c 未判定臂三(纯函数):词包取不到/解析失败 ⇒ undetermined 且不写结论行键名', () => {
  // 词包面是 HEAD 的 git blob(batchReadTexts 走 catBatch),stdin 注入不到它 —— 它不属于
  // --plan-json 的射程。拿 CLI 真跑这一臂会把"取不到词包"与"取不到 HEAD"混成一型,
  // 于是本尺想钉的那一型(词包坏 ⇒ 不记绿)反而测不到。故按 §22c 直接问生产判据。
  for (const bad of [
    ['', ''],
    ['{坏 json', ''],
  ]) {
    assert.throws(() => eco.resolveMessages(bad), eco.Undetermined)
  }
  const payload = eco.undeterminedPayload(new eco.Undetermined('词包取不到'))
  assert.equal(payload.status, 'undetermined')
  assert.equal(payload.conclusion, null)
  assert.ok(!payload.reason.includes(eco.CONCLUSION_KEY), '未判定的 reason 也不得带结论行键名')
})

test('④d 枚举被 slice(0,400) 截断 ⇒ 未判定(rows+convertible 必须等于 hand)', () => {
  assert.throws(
    () =>
      eco.parsePlan(
        JSON.stringify({
          hand: 43,
          counts: { convertible: 0 },
          blockers: [['@/api', 30]],
          rows: Array.from({ length: 5 }, (_, i) => ({ route: `r/${i}`, extras: ['@/api'] })),
        }),
      ),
    eco.Undetermined,
  )
})

test('④e 反例:输入齐备时 parsePlan 不冒未判定(否则上面几臂是恒真锁)', () => {
  const plan = eco.parsePlan(
    JSON.stringify({
      hand: 2,
      counts: { convertible: 0 },
      blockers: [['@/api', 2]],
      rows: [
        { route: 'a/one', extras: ['@/api'] },
        { route: 'a/two', extras: ['@/api', '@/x'] },
      ],
    }),
  )
  assert.equal(plan.hand, 2)
})

test('⑤ 形状锁:尺子源码零自写中文取数判据,且 import 正向臂在位', () => {
  const src = readFileSync(SCALE, 'utf8')
  // 反向臂:摘掉 import 会翻红的前提是"这条锁量的确实是它禁的东西"
  assert.ok(!/\\u4e00/.test(src), '尺子里不得出现 \\u4e00 形态的中文字符类(取数一律走 import)')
  assert.ok(!src.includes('[一-鿿]'), '尺子里不得出现 [一-鿿] 形态的中文区间(同上)')
  // 正向臂:两个 import 缺任一个 ⇒ 摘掉不会翻红 = 锁恒真,所以必须先证明它们在位
  assert.ok(
    /import\s*\{[^}]*\bmaskComments\b[^}]*\}\s*from\s*'\.\/lib\/code-mask\.mjs'/.test(src),
    'maskComments 必须从 ./lib/code-mask.mjs import',
  )
  assert.ok(
    /import\s*\{[^}]*\bcjkNotRenderedOnScreen\b[^}]*\}\s*from\s*'\.\/plan-hand-mirror-conversion\.mjs'/.test(
      src,
    ),
    'cjkNotRenderedOnScreen 必须从规划器 import',
  )
  assert.ok(
    /import\s*\{[^}]*\bhardcodedCjkNotInMessages\b/.test(src),
    '整包口径判据同样只能 import',
  )
})

test('⑤b 反例(形状锁的阳面对照):含中文字符类的源码必须被本锁抓到', () => {
  // 反向臂若不配阳面对照,"没抓到"就分不清是"文件干净"还是"正则写坏了恒不命中"
  const bad = 'const re = /[\\u4e00-\\u9fff]/g'
  assert.ok(/\\u4e00/.test(bad), '阳面对照:同样的判式必须能命中伪造违规')
  const bad2 = 'const re = /[一-鿿]/g'
  assert.ok(bad2.includes('[一-鿿]'), '阳面对照:字面区间同样命中')
})

test('⑤c 摘掉 import 即翻红(对真源码做变异,不落盘、不改文件)', () => {
  // 正向臂只证明"现在在位";这一臂证明"摘掉会红" —— 缺一半就是恒真断言。
  const src = readFileSync(SCALE, 'utf8')
  const maskRe = /import\s*\{[^}]*\bmaskComments\b[^}]*\}\s*from\s*'\.\/lib\/code-mask\.mjs'/
  const cjkRe =
    /import\s*\{[^}]*\bcjkNotRenderedOnScreen\b[^}]*\}\s*from\s*'\.\/plan-hand-mirror-conversion\.mjs'/
  assert.ok(maskRe.test(src) && cjkRe.test(src), '原源码两枚 import 都在位(前提)')
  assert.ok(!maskRe.test(src.replace(maskRe, '// 摘掉了')), '变异一:摘 maskComments ⇒ 正向臂翻红')
  assert.ok(
    !cjkRe.test(src.replace(cjkRe, '// 摘掉了')),
    '变异二:摘 cjkNotRenderedOnScreen ⇒ 正向臂翻红',
  )
})

test('⑤d 盲区披露锁:曲线必须自称"上界",且点名两把未复算的反查判据与真反例', () => {
  // 立因(2026-11-05 实测):另一路代理拿 `pkg-shop/vip/details` 撞出本尺的盲区——
  // 它唯一 blocker 是 `Taro.navigateTo`,按"extras ⊆ 补齐集"记账算"可解锁",但那个跳转目标是
  // 小程序/H5 独占支付页,RN 侧无同物路由 ⇒ 合法可填通道根本不存在,该页真解锁 = 0。
  // 曲线不声明这一维,下一席就会把上界当实测值派单(本仓"汇总面必须声明自己的盲区"那一格)。
  const src = readFileSync(SCALE, 'utf8')
  const must = ['上界第二型', 'coveredNavigation', 'apiEndpointsCovered', 'pkg-shop/vip/details']
  for (const m of must) assert.ok(src.includes(m), `披露必须点名「${m}」,否则汇总面在替未验证的通道背书`)
  // 摘掉即翻红:删掉披露那一行后,同一断言必须落空(证明这把锁有牙,不是恒真)
  const i = src.indexOf('上界第二型')
  assert.ok(i > 0, '前提:披露在位')
  const mutated = src.slice(0, i) + src.slice(i + 60)
  assert.ok(!mutated.includes('上界第二型'), '变异:摘掉披露 ⇒ 本锁必须翻红')
})

test('⑥ 两把口径自相矛盾 ⇒ status=red;对得上 ⇒ ok(成对正反例)', () => {
  const pack = JSON.stringify({ rendered: { ok: '短' } })
  const screen = "const t = (k) => k\nexport const S = () => { t('rendered.ok'); return null }"
  const heavy = `const s = "${'转壳后会丢的正文'.repeat(20)}"\nexport const P = () => s`
  const ctx = {
    pageTextOf: () => heavy,
    sharedTextOf: () => screen,
    shellTexts: new Map(),
    messagesText: [pack, ''],
    packText: pack,
    maxK: 2,
  }
  const mk = (extras, kind = 'page-only-capability') => ({
    hand: 1,
    pairs: 1,
    hosted: 0,
    counts: { convertible: 0 },
    blockers: extras.length ? [[extras[0], 1]] : [],
    rows: [{ route: 'a/heavy', spec: 'p/HeavyScreen.tsx', shell: 'HeavyScreen', kind, extras }],
  })
  assert.equal(eco.buildReport({ plan: mk([]), face: 'head', ctx }).status, 'red')
  assert.equal(eco.buildReport({ plan: mk([]), face: 'head', ctx }).contradictions.length, 1)
  assert.equal(
    eco.buildReport({ plan: mk([eco.HARDCODED_TEXT_TOKEN]), face: 'head', ctx }).status,
    'ok',
  )
  // 闸没跑到的型不参与对账(拿"闸没跑"读成"闸判绿"是本仓最高频失效型)
  assert.equal(
    eco.buildReport({
      plan: {
        ...mk([]),
        rows: [{ ...mk([]).rows[0], kind: 'no-shell', shell: null, extras: undefined }],
      },
      face: 'head',
      ctx,
    }).contradictions.length,
    0,
  )
})

test('⑦ 结论行字段顺序固定(C 段可 grep)', () => {
  const line = eco.conclusionLine({
    pages: 43,
    convertible: 0,
    copyBlocked: 7,
    copyKeyMisaligned: 1000,
    copyTrulyMissing: 159,
    maxUnlockByAdapterCombo: 20,
    maxUnlockK: 12,
    face: 'head',
    carrierAliasPages: 2,
    directShellScopedOverstate: 34,
    copyShortCircuit: 7,
  })
  assert.ok(
    line.startsWith(
      'UNLOCK-ECONOMY pages=43 convertible=0 copyBlocked=7 copyKeyMisaligned=1000 copyTrulyMissing=159 maxUnlockByAdapterCombo=20@K=12 face=head ',
    ),
    `结论行前缀必须逐字对齐,实到:${line}`,
  )
})

test('⑧ 异名承载壳失真量化:直推壳名口径把缺口虚高且改判 no-shell', () => {
  const d = eco.aliasDistortion(
    {
      route: 'pkg-learn/course/list',
      spec: 'packages/app/src/features/course-tab/CourseTabScreen.tsx',
      shell: 'CourseScreen',
    },
    { keyCount: 40, scoped: 7, pack: 0 },
    { keyCount: 5, scoped: 7, pack: 0 },
    false,
  )
  assert.equal(d.specBase, 'CourseTabScreen')
  assert.equal(d.carrierShell, 'CourseScreen')
  assert.equal(d.directShellRel, 'apps/mobile-rn/src/screens/CourseTabScreen.tsx')
  assert.equal(d.directShellExists, false)
  assert.equal(d.plannerKindIfDirect, 'no-shell')
  assert.equal(d.scopedDelta, 0)
})

test('⑨ 自检档零副作用:--self-test 全过且退出码 0', () => {
  const { code, stdout } = runScale(['--self-test'])
  assert.equal(code, 0)
  assert.match(stdout, /SELF-TEST \d+\/\d+ 通过/)
  assert.ok(!stdout.includes('✖'), `自检档不得有失败例:\n${stdout}`)
})

function runScale(args, input) {
  // §12g:派生 git/node 必须显式 stdio;带 input 时首档恒 'pipe'(写 'ignore' 在本机稳定 EBUSY)
  try {
    const stdout = execFileSync(process.execPath, [SCALE, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      input,
      stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? null, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
