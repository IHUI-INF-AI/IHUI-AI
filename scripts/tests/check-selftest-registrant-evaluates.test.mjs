// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:`scripts/check-selftest-registrant-evaluates.mjs`
//
// 为什么必须存在(而不是只靠门自己的 --self-test):本门的判据是"读别人门体的形状",
// 而 --self-test 只喂**构造面**夹具 —— 它证明的是"函数会给答案",不是"真仓上有人问它"。
// 本文件补的正是后者:真仓 HEAD 面的覆盖面自证、以及一个真临时 git 仓的端到端双向锁。
//
// 一条硬约束:本文件**只 import 生产实现**(`__test__`),一条判据都不重写。
// 在测试里再抄一份"什么叫不求值",源门漂移时测试照样绿 —— 那正是 §22c 立项要杀的形态。
//
// 跑法:node --test scripts/tests/check-selftest-registrant-evaluates.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as gate } from '../check-selftest-registrant-evaluates.mjs'
// 存活期表的唯一真相源住在守门 108;豁免族的到期档只在它那儿判(T10),本文件不得复制天数表。
import { __test__ as expiry } from '../check-exemption-expiry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC_NAME = 'check-selftest-registrant-evaluates.mjs'
const GATE_FILE = join(ROOT, 'scripts', SRC_NAME)
const GIT = resolveGitBin() || 'git'

const gitShow = (refPath) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', ROOT, 'show', refPath], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const gateSrc = readFileSync(GATE_FILE, 'utf8')

/** 端到端夹具:潜伏登记 + 函数形态用例(本门要抓的那一型)。 */
const FIXTURE_LATENT = [
  'export function selfTest() {',
  '  const cases = []',
  '  const t = (name, ok) => cases.push({ name, ok })',
  "  t('remote 清单要能判', () => true)",
  '  return cases.length',
  '}',
  '',
].join('\n')

/** 同一份夹具的**合规**形态:thunk 族 —— 登记侧裸存,消费循环真的调用它。 */
const FIXTURE_THUNK = [
  'export function selfTest() {',
  '  const cases = []',
  '  const t = (name, fn) => cases.push({ name, fn })',
  "  t('remote 清单要能判', () => true)",
  '  let pass = 0',
  '  for (const c of cases) if (c.fn() === true) pass++',
  '  return pass',
  '}',
  '',
].join('\n')

/** 只有形状、没有代码:同一形态全部写在注释里 ⇒ 不得判红。 */
const FIXTURE_COMMENT_ONLY = [
  'export function selfTest() {',
  '  // 早先这里写 const t = (name, ok) => cases.push({ name, ok })',
  "  //   并且 t('remote 清单要能判', () => true)",
  '  const cases = []',
  '  const t = (name, fn) => cases.push({ name, fn })',
  "  t('remote 清单要能判', () => true)",
  '  for (const c of cases) c.fn()',
  '  return cases.length',
  '}',
  '',
].join('\n')

function runGate(args, cwd = ROOT) {
  const r = spawnSync(process.execPath, [GATE_FILE, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 300_000,
    maxBuffer: 64 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { rc: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

/** 造一个真临时 git 仓(端到端要跑的是被审面,不是磁盘上的临时文本)。 */
function makeRepo(fixtureText) {
  const dir = mkScratch('selftest-registrant-')
  const run = (args) =>
    execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'user.email=g@t', '-c', 'user.name=g', '-C', dir, ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  run(['init', '-q'])
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'scripts', 'fixture-gate.mjs'), fixtureText, 'utf8')
  run(['add', 'scripts/fixture-gate.mjs'])
  run(['commit', '-q', '-m', 'fixture'])
  return dir
}

test('T1 镜像只 import 生产实现,不得有第二份判据/遮噪', () => {
  const self = readFileSync(join(ROOT, 'scripts', 'tests', `${SRC_NAME.replace('.mjs', '')}.test.mjs`), 'utf8')
  assert.match(self, /import \{ __test__ as gate \} from '\.\.\/check-selftest-registrant-evaluates\.mjs'/)
  // 判据函数名只属于源门;在测试里出现同名定义 ⇒ 两份真相(§22c 的原始动因)
  for (const fn of ['classifyRegistrar', 'findRegistrars', 'secondArgForm', 'findSelfTestHosts'])
    assert.ok(
      !new RegExp(`function ${fn}\\s*\\(`).test(self),
      `测试里定义了 ${fn} ⇒ 复制了判据实现`,
    )
  // 门体只引一份遮罩:不得自带 maskCommentsAndStrings 的定义
  assert.match(gateSrc, /from '\.\/lib\/code-mask\.mjs'/, '没引那一份遮罩实现')
  assert.ok(
    !/function\s+maskCommentsAndStrings\s*\(/.test(gateSrc),
    '门体自带第二份遮噪 ⇒ 两处实现必漂移(§22c)',
  )
})

test('T2 门体走统一取材层,不得散写 git / 按磁盘判被审内容(守门 118 同口径)', () => {
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(gateSrc, /catBatch\(/, '引了层却没用它读内容 = 半接线')
  assert.ok(
    !/execFileSync\(\s*GIT[^)]*'show'/.test(gateSrc) && !/gitRaw\(\s*\[\s*'show'/.test(gateSrc),
    '自己派生 git show 读内容 ⇒ 判定面绕开了层',
  )
})

test('T3 真仓 HEAD 面:覆盖面自证 + 现读必须零配对红(看不见存量不算通过,判红则不得接线)', () => {
  const a = gate.analyze(ROOT, 'head')
  const d = gate.decide({ verdicts: a.verdicts, enumerated: a.enumerated })
  assert.ok(a.enumerated > 0, '在射程文件枚举到 0 ⇒ 判据失效,不得当成通过')
  assert.equal(d.counts.unreadable, 0, `有文件取不到内容(未判定被算进通过):${d.counts.unreadable}`)
  assert.ok(d.counts.hosts > 0, '真仓上一处自检宿主都没看见 ⇒ 宿主判据对整面失明')
  assert.ok(d.counts.registrars > 0, '真仓上一处登记函数都没看见 ⇒ 本门的绿灯没有任何含义')
  assert.ok(d.counts.latent > 0, '潜伏档在真仓上读为空 ⇒ "只报数"那一格从未被验证过')
  assert.deepEqual(
    d.red,
    [],
    `真仓 HEAD 现读有配对红 ⇒ 要么 R-CASE 过宽(收紧方向必须少误报),要么真找到了一个从未判过的自检:` +
      JSON.stringify(d.red),
  )
})

test('T4 端到端双向锁(真临时 git 仓,判被审面而非磁盘):注入必红 / thunk 必绿 / 只有注释必绿', () => {
  const arms = [
    { text: FIXTURE_LATENT, wantRc: 1, wantNamed: 'fixture-gate.mjs', why: '潜伏登记 + 函数用例' },
    { text: FIXTURE_THUNK, wantRc: 0, wantNamed: null, why: 'thunk 族(消费循环真调用)' },
    { text: FIXTURE_COMMENT_ONLY, wantRc: 0, wantNamed: null, why: '形状只出现在注释里' },
  ]
  for (const arm of arms) {
    const dir = makeRepo(arm.text)
    try {
      const r = runGate(['--root', dir])
      assert.equal(
        r.rc,
        arm.wantRc,
        `${arm.why}:期望 rc=${arm.wantRc},实得 ${r.rc}\n--- 输出 ---\n${r.out}`,
      )
      if (arm.wantNamed) {
        assert.match(r.out, new RegExp(arm.wantNamed), '判红未点名被审文件')
        assert.match(r.out, /函数形态用例/, '结论行要能看出是哪一型')
      }
    } finally {
      rmScratch(dir)
    }
  }
})

test('T5 装车证明:未注册不得被读成已装车;已注册则成套且定级必须是 warn', () => {
  const runner = gitShow('HEAD:scripts/guardian-runner.mjs')
  const at = runner.indexOf(`    script: '${SRC_NAME}'`)
  if (at < 0)
    assert.fail(
      `${SRC_NAME} 尚未注册进 guardian-runner —— 本用例的意义就是拦住"以为已接线"。`,
    )
  // ⚠️ 原取 `at ± 900` 的**窗口**判 warn,实测无牙(2026-10-06 变异坐实):本门 id '156' 紧邻
  // id '154'/'155'/'157',±900 窗口一次吞进 4 条注册块,邻门的 `mode:'warn'` 替本门交差 ——
  // 把本门自己升成 `blocking` 后本断言**仍绿**(变异面旧窗口内 mode 读数:
  // ['warn','warn','blocking','blocking'],本门那条已是 blocking)。
  // 下方那条"不得带 --strict"的负向锁同在此窗口内,同样会被邻门的 args 顶替。
  // 改按**注册块边界**取本门那一条。`\n  {` = 顶层注册项起始,`\n    script:` = 下一条开始;
  // 块内含下一条的头两行(id/label),但 mode/skipEnv/args 一律排在 `script:` 之后 ⇒ 切不进邻门。
  // 退化路径(lastIndexOf 返 -1 则用 at;indexOf 返 -1 则取到文件尾)保留,仅防 runner 形态再变。
  const start = runner.lastIndexOf('\n  {', at)
  const next = runner.indexOf('\n    script:', at + 10)
  const entry = runner.slice(start < 0 ? at : start, next > 0 ? next : runner.length)
  assert.match(
    entry,
    /mode:\s*'warn'/,
    '定级被改成 blocking:接线瞬间 36 处潜伏 + 判不出的形态会把每台每次提交钉红(§12f)。' +
      '要升档必须先(a)真仓现读配对红为 0 且未判定被逐条定性、(b)把本条与门体头注一起改掉。',
  )
  assert.match(entry, new RegExp(`skipEnv:\\s*'${gate.SELF_SKIP}'`), '应急跳过名必须与门自己声明的同一个')
  // 提交链跑的是默认档(不带 --strict):有未判定就 rc=2 的话,这道门就成了恒红门
  assert.ok(
    !/args:\s*\[[^\]]*'--strict'/.test(entry),
    "runner 不得给本门追加 --strict:现读有未判定档 ⇒ 每次提交都 exit 2",
  )
})

test('T6 门体头注不得谎报定级或接线(守门 89 专判这一格)', () => {
  const head = gateSrc.slice(0, 5200)
  assert.doesNotMatch(head, /已接 pre-commit|CI 必跑|已 blocking/, '头注写死"已接线/已 blocking"是假承诺')
  assert.match(head, /warn 起步/, '定级理由必须写在头注里,否则后人只会看到 warn 不知道为什么')
})

test('T7 判据自身的 --self-test 必须连跑两次都为 0(曾有过"第二次起恒红"的门)', () => {
  const first = gate.selfTest()
  const second = gate.selfTest()
  assert.equal(first, 0, '第一次就不为 0 ⇒ 判据有未通过的构造面')
  assert.equal(second, 0, `第二次为 ${second} ⇒ 自检留了状态或写了非幂等断言`)
})

test('T8 豁免族不得静默:标记必须带原因,只救本行(端到端在 T4 的注释臂已证)', () => {
  const withReason = gate.exemptOnLine(`// ${gate.EXEMPT_MARK}: 该登记由外部 runner 求值`)
  assert.equal(withReason.exempt, true)
  const terminator = gate.exemptOnLine(`// ${gate.EXEMPT_MARK}: */`)
  assert.equal(terminator.exempt, false, '注释闭合符冒充原因竟被放行')
  const bare = gate.exemptOnLine(`// ${gate.EXEMPT_MARK}`)
  assert.equal(bare.exempt, false, '不带原因的裸标记竟被放行')
})

test('T9 射程边界:lib/ 与 tests/ 不在面内(node:test 的 test(name, fn) 本来就该传函数)', () => {
  for (const p of ['scripts/lib/face-reader.mjs', 'scripts/tests/x.test.mjs', 'apps/web/a.mjs'])
    assert.equal(gate.SCOPE_RE.test(p), false, `${p} 不该进射程`)
  assert.equal(gate.SCOPE_RE.test('scripts/check-foo.mjs'), true)
})

test('T10 豁免族必须进守门 108 的存活期表并取 30 天(一条没有到期档的豁免出口 = 无人看管的出口)', () => {
  // 判据只引一次真相源:表住在 108(`expiry.FAMILY_LIFETIME_DAYS`),本测试不得复制一份天数表(§22c)。
  // 这条锁的由来:`radius-role-exempt` / `back-label-exempt` 都是**单独一票**补登记的 —— 说明
  // "立门时顺手登记"长期只是散文。守门 108 现已把"族被真用上而未登记"收成判据 E4(提交链档、
  // HEAD 锚点棘轮),但 E4 判的是**被豁免侧的用**:门体自己在 scripts/** 写出族名不算,
  // 所以带豁免出口的门必须自带这样一条正向锁,而不是等下游有人真的写了豁免才红。
  assert.equal(
    expiry.isFamilyRegistered(gate.EXEMPT_MARK),
    true,
    `${gate.EXEMPT_MARK} 不在 FAMILY_LIFETIME_DAYS 里 ⇒ 它只出生不死亡`,
  )
  assert.equal(
    expiry.FAMILY_LIFETIME_DAYS[gate.EXEMPT_MARK],
    30,
    '待偿债取 30 天(与 156 同走"先报数、清零后才谈 blocking"的路线);改成更长的档必须写理由',
  )
  assert.notEqual(
    expiry.FAMILY_LIFETIME_DAYS[gate.EXEMPT_MARK],
    expiry.DEFAULT_LIFETIME_DAYS,
    '靠默认值兜底不算登记 —— 那正是 E4 要判的形态',
  )
})

test('T11 R-EXIST 成对:宿主内本地自造登记器 ⇒ 点名并给出唯一出路;共用出口与注释 ⇒ 不得点名', () => {
  // 正例:宿主内本地自造(判绿的那一档同样要点名 —— R-EXIST 与 R-REG 正交)
  const made = [
    'export function selfTest() {',
    '  const cases = []',
    '  const t = (name, cond) => cases.push({ name, cond })',
    '  let pass = 0',
    '  for (const c of cases) if (c.cond === true) pass++',
    '  return pass',
    '}',
    '',
  ].join('\n')
  const r = gate.analyzeSource({ rel: 'scripts/fixture-selfmade.mjs', raw: made })
  assert.equal(r.selfMade.length, 1, '本地自造登记器未被点名')
  assert.equal(r.selfMade[0].name, 't')
  assert.match(r.selfMade[0].why, /scripts\/lib\/selftest-registrant\.mjs/, '未给出唯一出路')

  // 反向对照 A:走共用出口 —— 登记器不在宿主内声明 ⇒ 一处也不许点名(否则本判据是恒报)
  const viaExit = [
    "import { makeRegistrar } from './lib/selftest-registrant.mjs'",
    'export function selfTest() {',
    '  const { t, report } = makeRegistrar()',
    "  t('remote 清单要能判', () => true)",
    '  return report().fail',
    '}',
    '',
  ].join('\n')
  const ok = gate.analyzeSource({ rel: 'scripts/fixture-viaexit.mjs', raw: viaExit })
  assert.deepEqual(ok.selfMade, [], '共用出口用法被误点名 ⇒ R-EXIST 是恒报,没有判别力')

  // 反向对照 B:同形状只在注释里 ⇒ 遮罩必须把它吃掉(证明 A 不是"因为读不出才没报")
  const commentOnly = [
    'export function selfTest() {',
    '  // 早先这里写 const t = (name, cond) => cases.push({ name, cond })',
    '  return 0',
    '}',
    '',
  ].join('\n')
  const c = gate.analyzeSource({ rel: 'scripts/fixture-comment.mjs', raw: commentOnly })
  assert.deepEqual(c.selfMade, [], '注释里的形状被点名 ⇒ 遮罩没生效')
})

test('T12 R-EXIST 只报数:不得改变 exit 口径(配对红=1 / 未判定+strict=2 / 其余=0)', () => {
  const base = {
    file: 'x',
    registrars: 2,
    latent: [{ name: 't' }],
    evaluates: 1,
    strictCompare: [],
    undetermined: [],
    exempted: [],
    red: [],
    selfMade: [{ name: 't', line: 3, why: 'w' }],
    unreadable: null,
  }
  // 自造 1 处、其它干净 ⇒ 必须 0(本判据刻意不参与 exit)
  const clean = gate.decide({ verdicts: [base], enumerated: 10 })
  assert.equal(clean.exit, 0, 'R-EXIST 改变了 exit ⇒ 它已不是"只报数"档')
  assert.equal(clean.counts.selfMade, 1)
  // 红与未判定两档的口径未被这一格挪动
  const red = gate.decide({
    verdicts: [{ ...base, selfMade: [], red: [{ file: 'x', registrar: 't', caseLines: [3] }] }],
    enumerated: 10,
  })
  assert.equal(red.exit, 1)
  const und = gate.decide({
    verdicts: [{ ...base, selfMade: [], undetermined: [{ name: 't', line: 2, why: 'y' }] }],
    enumerated: 10,
    strict: true,
  })
  assert.equal(und.exit, 2)
})

test('T13 出口模块在真仓里存在、导出 makeRegistrant 且真判(判据指的出路不许是空头支票)', async () => {
  const p = join(ROOT, gate.SELF_ROUTE)
  assert.ok(existsSync(p), `${gate.SELF_ROUTE} 不存在 ⇒ R-EXIST 点名的出路是空头支票`)
  const mod = await import(pathToFileURL(p).href)
  assert.equal(typeof mod.makeRegistrar, 'function', '出口没导出 makeRegistrar')
  // 出口必须真判:一条真、一条假 —— 不是恒绿,也不是恒红
  const { t, report } = mod.makeRegistrar()
  t('正例', () => true)
  t('反例(不得恒绿)', () => 1 === 2)
  const r = report()
  assert.equal(r.pass, 1)
  assert.equal(r.fail, 1)
  assert.equal(r.cases.length, 2)
})

test('T14 样板消费方已接共用出口:该文件本地自造 0 处且潜伏 0(R-EXIST 的实证,不是设计意图)', () => {
  // 这一条锁的是"出口真的被用上了":若有人把 check-baseline-freshness.mjs 改回本地自造,
  // T11 仍会绿(它只验判据),而这一条会红(它验真仓事实)。
  const r = gate.analyzeSource({
    rel: 'scripts/check-baseline-freshness.mjs',
    raw: readFileSync(join(ROOT, 'scripts', 'check-baseline-freshness.mjs'), 'utf8'),
  })
  assert.equal(r.selfMade.length, 0, '样板门仍在本地自造登记器 ⇒ 共用出口没被真正接上')
  assert.equal(r.latent.length, 0, '样板门又回到裸存簇')
  assert.equal(r.red.length, 0, '样板门被判红')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
