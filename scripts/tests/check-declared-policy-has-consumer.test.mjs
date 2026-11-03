// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-declared-policy-has-consumer(策略/契约声明必须有非测试消费者)
//
// 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
// 不复制判据实现 —— 两份真相是登记在案的漂移源。
// 判据族:C1~C5(策略常量/预算契约/契约类型/谓词/清理函数)+ C6(i18n 码表键)+
//   C7(G-816034 ①②,导出 `create*Handler` / `create*Transport` 工厂)—— T11 判纯函数四验收,
//   T15 让子进程在临时仓真跑 `--staged`,证明新族走的是同一条取材面 + 同一条棘轮 + 同一套退出码。
//   default 链(2026-11-01,default 导入接进"声明体边 + 传递闭包")—— T13 判纯函数五形接线/
//   双变异对照/八条反向锁/新归属尺,T14 在同一临时仓口径下验"撤掉 default 取用即红、还原即复绿"。
// 装车前置(刻意不硬写编号):接线归主会话(AGENTS §25 三件同批事实),本测试判"注册表
// 若出现本门,必须同时 blocking + skipEnv + 编号唯一";未注册时绿,并如实说明是"未装车"
// 而不是"已防护"。

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 遮噪只引这一份实现(§3 共享层优先 / 本仓"注释里的提及不算"口径),测试里不得另写一台。
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as gate } from '../check-declared-policy-has-consumer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-declared-policy-has-consumer.mjs')

test('T1 §22c 锚点:__test__ 必须导出核心判据且 skipEnv 命名在位', () => {
  for (const k of [
    'inScanRoot',
    'candidateKinds',
    'isHandlerFactoryName',
    'declShape',
    'DECL_SHAPES',
    'factoryFace',
    'maskCommentsKeepStrings',
    'blankStringContents',
    'parseFile',
    'specCompat',
    'specResolvesToModule',
    'DEFAULT_SLOT',
    'judge',
    'decide',
    'analyze',
    'isLexiconPath',
    'LEX_LANGS',
    'flattenLexicon',
    'extractI18nUsages',
    'judgeI18n',
    'SELF_SKIP',
    'FIXTURES',
  ]) {
    assert.ok(k in gate, `__test__ 缺导出:${k}`)
  }
  assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_DECLARED_POLICY_CONSUMER')
  // C7 的夹具必须只有一份实现(§22c:测试里再抄一份夹具 = 第二真相);路径也要真在扫描面内,
  // 否则"0 候选"的绿是夹具路径写错换来的,不是判据判出来的。
  for (const k of ['HF_SRC', 'HF_TYPE', 'HF_CONSUMER', 'HF_NOISE', 'HF_DECL_FILE', 'HF_USE_FILE']) {
    assert.ok(k in gate.FIXTURES, `FIXTURES 缺 C7 夹具:${k}`)
  }
  assert.ok(
    gate.inScanRoot(gate.FIXTURES.HF_DECL_FILE),
    'C7 声明夹具路径不在扫描根 ⇒ 该族所有断言恒绿',
  )
  assert.ok(
    gate.inScanRoot(gate.FIXTURES.HF_USE_FILE),
    'C7 消费者夹具路径不在扫描根 ⇒ 接线侧断言恒绿',
  )
  // default 链夹具(2026-11-01)同规格:单一实现 + 两条路径都必须在扫描根内。
  for (const k of [
    'DEF_DECL_FILE',
    'DEF_USE_FILE',
    'DEF_FP',
    'DEF_IDENT',
    'DEF_FUN',
    'DEF_OBJ',
    'DEF_AS_DEFAULT',
    'DEF_NOREF',
    'DEF_NONE',
    'DEF_COMMENTED_SRC',
    'DEF_USE',
    'DEF_NOUSE',
    'DEF_COMMENTED_USE',
    'DEF_SHADOW',
    'DEF_OTHER_DIR',
    'DEF_MIX_SRC',
    'DEF_MIX_USE',
    'DEF_MIX_USE_NAMED_ONLY',
  ]) {
    assert.ok(k in gate.FIXTURES, `FIXTURES 缺 default 链夹具:${k}`)
  }
  assert.ok(
    gate.inScanRoot(gate.FIXTURES.DEF_DECL_FILE),
    'default 声明夹具路径不在扫描根 ⇒ 接线侧断言恒绿',
  )
  assert.ok(
    gate.inScanRoot(gate.FIXTURES.DEF_USE_FILE),
    'default 消费者夹具路径不在扫描根 ⇒ 接线侧断言恒绿',
  )
})

test('T2 正向证明(镜像自带构造):未接线必红、已接线必绿', () => {
  const { SS_UNWIRED, SS_WIRED, REPL_CONSUMER } = gate.FIXTURES
  const off = gate.judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]]))
  assert.deepEqual(off.unwired.map((u) => u.name).sort(), [
    'DEFAULT_MAX_AGE_MS',
    'pruneOldSessions',
  ])
  const on = gate.judge(
    new Map([
      ['apps/cli/src/sessions/state-store.ts', SS_WIRED],
      ['apps/cli/src/commands/repl.ts', REPL_CONSUMER],
    ]),
  )
  assert.equal(on.unwired.length, 0)
})

test('T3 变异对照:两条判据分支各自禁用一次,已接线夹具必须退回未接线(证明判据有牙)', () => {
  const { SS_WIRED, REPL_CONSUMER } = gate.FIXTURES
  const files = new Map([
    ['apps/cli/src/sessions/state-store.ts', SS_WIRED],
    ['apps/cli/src/commands/repl.ts', REPL_CONSUMER],
  ])
  assert.equal(
    gate.judge(files, { mutate: 'no-closure' }).unwired.length,
    2,
    '闭包分支被禁用后仍绿 ⇒ 闭包是摆设',
  )
  assert.equal(
    gate.judge(files, { mutate: 'no-external-refs' }).unwired.length,
    2,
    '外部消费分支被禁用后仍绿 ⇒ 种子是摆设',
  )
})

test('T4 消费者排除面:注释提及 / 只 import 不取用 / 纯 re-export / 测试面 四种"看起来有"都不算', () => {
  const { SS_UNWIRED, REPL_CONSUMER } = gate.FIXTURES
  const decl = ['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]
  const cases = {
    commentOnly: REPL_CONSUMER.replace('persist("x")', '// persist("x")'),
    importNoUse: REPL_CONSUMER.replace('persist("x")', '1'),
    reexportOnly: "export { saveSession } from './state-store.js';\n",
    testFace: REPL_CONSUMER,
  }
  const maps = new Map()
  maps.set('commentOnly', new Map([decl, ['apps/cli/src/commands/repl.ts', cases.commentOnly]]))
  maps.set('importNoUse', new Map([decl, ['apps/cli/src/commands/repl.ts', cases.importNoUse]]))
  maps.set('reexportOnly', new Map([decl, ['apps/cli/src/sessions/index.ts', cases.reexportOnly]]))
  maps.set('testFace', new Map([decl, ['apps/cli/tests/s.test.ts', cases.testFace]]))
  for (const [name, files] of maps) {
    assert.equal(gate.judge(files).unwired.length, 2, `${name} 应当不算消费者,却判了 0 红`)
  }
})

test('T5 契约面形态:经 Mount 类型闭包接线的契约算已接线,零消费者谓词单点红', () => {
  const { TC_SRC, TOOL_CONSUMER } = gate.FIXTURES
  const r = gate.judge(
    new Map([
      ['packages/types/src/tool-contract.ts', TC_SRC],
      ['apps/cli/src/tools/index.ts', TOOL_CONSUMER],
    ]),
  )
  assert.deepEqual(
    r.unwired.map((u) => u.name),
    ['mayTouchThing'],
  )
})

test('T6 棘轮四向 + 空扫判死(staged vs HEAD 锚点;与改动无关的红不得诞生)', () => {
  assert.equal(
    gate.decide({ stagedCounts: { 'f.ts': 2 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit,
    1,
  )
  assert.equal(
    gate.decide({ stagedCounts: { 'f.ts': 1 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit,
    0,
  )
  assert.equal(gate.decide({ stagedCounts: {}, headCounts: { 'f.ts': 3 }, mode: 'staged' }).exit, 0)
  assert.equal(gate.decide({ stagedCounts: { 'g.ts': 1 }, headCounts: {}, mode: 'staged' }).exit, 1)
  const empty = gate.judge(new Map([['README.md', 'x']]))
  assert.equal(
    gate.decide({ stagedCounts: empty.perFile, mode: 'full', undetermined: empty.undetermined })
      .exit,
    2,
  )
})

test('T7 runner 装车前置:未注册 ⇒ 绿并如实报"未装车";一旦注册必须 blocking + skipEnv + 编号唯一', () => {
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const src = readFileSync(SCRIPT, 'utf8')
  const idx = runner.indexOf('check-declared-policy-has-consumer.mjs')
  if (idx < 0) {
    // 接线是主会话的活(本票禁改 runner)。此刻唯一正确结论是"门在、尚未装车"。
    console.log('ℹ️  T7:本门尚未接入 guardian-runner(预期状态,接线由主会话统一完成)')
    // 反向锁:源脚本不得在头注里声称"已接 pre-commit/必跑"(守门 89 R1 的判据形态)
    assert.ok(
      !/已接\s*pre-commit|pre-commit\s*必跑/.test(src),
      '源脚本声称已接线但 runner 里没有 ⇒ 89 R1 型谎报',
    )
    return
  }
  const block = runner.slice(Math.max(0, idx - 500), idx + 500)
  // runner 的现行 schema 是 `mode: 'blocking'`(门 89/125 都按这个字段解析);
  // 旧写法只认 `blocking: true` ⇒ 这道"装车锁"**从一开始就永远不可能满足**,
  // 一旦有人真把门接上,它就把那个人的提交钉红 —— 判据失效的表现是"安静",而这台是"必响"。
  // 保留牙齿:注册成 warn 仍然不匹配 ⇒ 照样判红。
  assert.match(
    block,
    /mode:\s*['"]blocking['"]|blocking:\s*true/,
    '本门被注册却不是 blocking ⇒ 等于没装(恒红防护由棘轮做,不由降级做)',
  )
  assert.ok(
    block.includes(gate.SELF_SKIP),
    '注册条目缺紧急跳过通道 HUSKY_SKIP_DECLARED_POLICY_CONSUMER',
  )
  // 撞号核查必须判在**遮掉注释的面上**(`lib/code-mask.mjs` 那一份,不新写遮噪器):
  // runner 里"编号 NNN:注册前已核 grep -n \"id: 'NNN'\" 为空"这类注释**逐字写着 id 形态**,
  // 原文读会把它当成第二条注册 ⇒ 本门镜像测试从 2026-10-04 起对每次提交恒红(实测 HEAD 面
  // dup=['186','187'],真注册 dup=[])。这正是本仓那条口径:**注释里的提及不算**。
  // 不得反过来弱化:两条真注册同编号仍必须红 —— 由下面的成对构造证明(§22c 判据要有牙)。
  const dupGateIds = (text) => {
    const ids = [...maskComments(text).matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
    return ids.filter((v, i) => ids.indexOf(v) !== i)
  }
  const dup = [...new Set(dupGateIds(runner))]
  assert.deepEqual(
    dup,
    [],
    `runner 出现重复编号(${dup.join(', ')})—— 同日多会话撞号在 origin/main 上会互相覆盖注册块`,
  )
  // 成对反向锁:①注释里 quoting id 不得算撞号;②真注册撞号不得被这条锁放过。
  const CONTROL = [
    '  // 编号 900:注册前已核 `grep -n "id: \'900\'"` 为空(未被占用);现值以本文件为准。',
    "  { id: '900', script: 'a.mjs' },",
    "  { id: '901', script: 'b.mjs' },",
  ].join('\n')
  assert.deepEqual(dupGateIds(CONTROL), [], '注释里的 id 形态被当成了第二条注册 ⇒ 撞号锁会造恒红门')
  assert.deepEqual(
    [...new Set(dupGateIds(`${CONTROL}\n  { id: '900', script: 'c.mjs' },`))].sort(),
    ['900'],
    '两条真注册同编号却没判红 ⇒ 撞号锁是摆设',
  )
})

test('T8 --self-test 真跑且**连跑两次**皆 rc=0(只能跑一次的取证等于没取证,守门 shadow-copy 同训)', () => {
  for (const round of [1, 2]) {
    const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    })
    assert.equal(
      r.status,
      0,
      `第 ${round} 轮 --self-test rc=${r.status}\n${r.stdout?.slice(-600)}\n${r.stderr?.slice(-400)}`,
    )
    assert.match(String(r.stdout), /全部 \d+ 例通过/, `第 ${round} 轮未见通过汇总行`)
  }
})

// ---------------------------------------------------------------- C6 i18n 维(G-816043)

const LEX_KEYS = { chat: { hi: '你好', bye: '再见' }, items: { count: '条数' } }
const lexMap = () =>
  new Map(
    gate.LEX_LANGS.map((L) => [`packages/i18n/messages/web/${L}.json`, JSON.stringify(LEX_KEYS)]),
  )

test('T9 C6 i18n 三验收(G-816043):零发射必报、发射齐必绿、动态只报数不静默;伪调用不可见', () => {
  // 验收①:五语言都有值、全仓无发射点 ⇒ 报未接线,按面板归 en.json 计数
  const off = gate.judge(
    new Map([['apps/web/src/a.tsx', 'export function B(): number { return 1 }\n']]),
    {
      lexicon: lexMap(),
    },
  )
  assert.equal(off.i18n.byFolder.web.keys, 3)
  assert.equal(off.i18n.byFolder.web.unwired, 3)
  assert.equal(off.perFile['packages/i18n/messages/web/en.json'], 3)
  // 验收②:有发射点 ⇒ 绿(门对自家产出形态的必答题)
  const emitAll =
    "const t = useTranslations('chat')\nconst u = useTranslations('items')\nexport function A(): string { return t('hi') + t('bye') + u('count') }\n"
  const on = gate.judge(new Map([['apps/web/src/a.tsx', emitAll]]), { lexicon: lexMap() })
  assert.equal(on.i18n.byFolder.web.unwired, 0)
  // 验收③:动态拼键 ⇒ 计报数,不得静默算通过(全动态 ⇒ dynamic;有静态前缀 ⇒ 前缀覆盖)
  const fullDyn = gate.judge(
    new Map([
      [
        'apps/web/src/a.tsx',
        "const t = useTranslations('chat')\nexport function K(x: string): string { return t(`${x}`) }\n",
      ],
    ]),
    { lexicon: lexMap() },
  )
  assert.equal(fullDyn.i18n.dynamic, 1, '全动态实参必须计报数')
  assert.equal(fullDyn.i18n.byFolder.web.unwired, 3, '动态调用不得静默盖掉任何键')
  // 注释与字符串字面量里的伪发射都不可见(数据区/代码区分账)
  const noise =
    "// const t = useTranslations('chat')\n// t('hi')\nexport const s = \"t('hi')\";\nconst u = useTranslations('items')\nexport function E(): string { return u('count') }\n"
  const nz = gate.judge(new Map([['apps/web/src/a.tsx', noise]]), { lexicon: lexMap() })
  assert.equal(nz.i18n.emitted, 1, '只有 u(count) 是真发射')
  assert.equal(nz.i18n.byFolder.web.unwired, 2, 'chat.hi 不得被注释/字符串伪发射接线')
  // C6 第二族:import { t } from i18n 家族 ⇒ 根 ns 全键直发(cli/miniapp 真实形状)
  const imp = gate.judge(
    new Map([
      [
        'apps/cli/src/run.ts',
        "import { t } from '../i18n/index.js'\nexport function M(): string { return t('chat.hi') }\n",
      ],
    ]),
    { lexicon: lexMap() },
  )
  assert.equal(imp.i18n.emitted, 1)
  assert.equal(
    imp.i18n.byFolder.web.unwired,
    2,
    'import 的 t(全键) 必须接线,否则 cli 面板是假 100% 孤儿',
  )
  // C6 第三族:静态键表(NAV_LABEL_KEY 治理模式,d72e9ccf42)⇒ 表索引调用把表内全键接线
  const tabSrc =
    "const t = useTranslations()\nconst CHAT_LABEL_KEY: Record<string, string> = {\n  hi: 'chat.hi',\n  bye: 'chat.bye',\n}\nexport function L(x: string): string { return t(CHAT_LABEL_KEY[x]) }\n"
  const tab = gate.judge(new Map([['apps/web/src/a.tsx', tabSrc]]), { lexicon: lexMap() })
  assert.equal(tab.i18n.emitted, 2, '表内两个键都必须算发射')
  assert.equal(tab.i18n.dynamic, 0, '认得出表不得再计动态')
  assert.deepEqual(tab.i18n.byFolder.web.samples, ['items.count'], '只剩表外键未接线')
  // 反向:表声明零索引取用 ⇒ 不算接线;表值非字面量 ⇒ 整表不认(假表不得成捷径)
  const tabIdle = gate.judge(
    new Map([
      [
        'apps/web/src/a.tsx',
        "const CHAT_LABEL_KEY: Record<string, string> = {\n  hi: 'chat.hi',\n  bye: 'chat.bye',\n}\nexport function L(x: string): string { return x }\n",
      ],
    ]),
    { lexicon: lexMap() },
  )
  assert.equal(tabIdle.i18n.emitted, 0, '表本身不是发射点')
  assert.equal(tabIdle.i18n.byFolder.web.unwired, 3, '零取用的表不得接线')
  const tabBad = gate.judge(
    new Map([
      [
        'apps/web/src/a.tsx',
        "const t = useTranslations()\nconst BAD = {\n  hi: makeKey(),\n  bye: 'chat.bye',\n}\nexport function L(x: string): string { return t(BAD[x]) }\n",
      ],
    ]),
    { lexicon: lexMap() },
  )
  assert.equal(tabBad.i18n.dynamic, 1, '假表的调用照旧计动态')
  assert.equal(tabBad.i18n.byFolder.web.unwired, 3, '假表不得接线任何键')
  // C6 计数并入 perFile ⇒ 与 C1~C5 共用同一 decide 棘轮
  assert.equal(
    gate.decide({
      stagedCounts: { 'packages/i18n/messages/web/en.json': 3 },
      headCounts: { 'packages/i18n/messages/web/en.json': 3 },
      mode: 'staged',
    }).exit,
    0,
    '词表计数齐平 ⇒ 绿(存量不追)',
  )
  assert.equal(
    gate.decide({
      stagedCounts: { 'packages/i18n/messages/web/en.json': 4 },
      headCounts: { 'packages/i18n/messages/web/en.json': 3 },
      mode: 'staged',
    }).exit,
    1,
    '词表未接线新增 ⇒ 红(新增即拦)',
  )
})

test('T10 端到端(--staged,临时仓):接线减账 ⇒ 绿;码表加无主键 ⇒ 红并点名 en.json(词表改动不得退回全量档)', () => {
  const dir = mkScratch('g121-i18n-')
  try {
    const git = (args) =>
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      spawnSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    assert.equal(git(['init', '-q']).status, 0)
    assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
    assert.equal(git(['config', 'user.name', 'gate']).status, 0)
    mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
    mkdirSync(join(dir, 'packages', 'i18n', 'messages', 'web'), { recursive: true })
    for (const L of gate.LEX_LANGS)
      writeFileSync(
        join(dir, 'packages', 'i18n', 'messages', 'web', `${L}.json`),
        JSON.stringify({ chat: { hi: 'a', bye: 'b' } }),
      )
    writeFileSync(
      join(dir, 'apps', 'web', 'src', 'page.tsx'),
      "const t = useTranslations('chat')\nexport function A(): string { return t('hi') }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'base']).status, 0)
    const runGate = () =>
      spawnSync(process.execPath, [SCRIPT, '--staged', '--root', dir], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      })
    // 情形 A:staged 只接线 bye ⇒ staged 未接线 0 < HEAD 锚点 1 ⇒ 绿
    writeFileSync(
      join(dir, 'apps', 'web', 'src', 'page.tsx'),
      "const t = useTranslations('chat')\nexport function A(): string { return t('hi') + t('bye') }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    const green = runGate()
    assert.equal(
      green.status,
      0,
      `情形 A(接线减账)应绿 rc=${green.status}\n${green.stdout?.slice(-800)}${green.stderr?.slice(-800)}`,
    )
    // 情形 B:码表再加两个全语言无主键 ⇒ staged 2 > HEAD 锚点 1 ⇒ 红,点名 en.json 与样例键
    for (const L of gate.LEX_LANGS)
      writeFileSync(
        join(dir, 'packages', 'i18n', 'messages', 'web', `${L}.json`),
        JSON.stringify({ chat: { hi: 'a', bye: 'b' }, orphan: { a: 'x', b: 'y' } }),
      )
    assert.equal(git(['add', '-A']).status, 0)
    const red = runGate()
    assert.equal(
      red.status,
      1,
      `情形 B(码表加无主键)应红 rc=${red.status}\n${red.stdout?.slice(-800)}${red.stderr?.slice(-800)}`,
    )
    assert.match(
      String(red.stderr),
      /packages\/i18n\/messages\/web\/en\.json/,
      '红点名必须落在 en.json 计数上',
    )
    assert.match(String(red.stderr), /orphan\.b/, '红点名必须给出样例键')
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- C7 工厂族(G-816034 ①②)

/**
 * T11 与源脚本 --self-test 的 F 组成对(§22c:镜像测试**不重读实现**,只判据 + 判退出码)。
 * 四条票面验收各占一对正反用例,判据与夹具都从源脚本的 `__test__` 取(单一真相)。
 */
test('T11 C7 工厂族四验收:命中必红/接线必绿/同词不同义不立案/注释与字符串不算消费者/形状读不出报数/集合失败落未判定', () => {
  const { HF_SRC, HF_TYPE, HF_CONSUMER, HF_NOISE, HF_DECL_FILE, HF_USE_FILE } = gate.FIXTURES
  const decl = [HF_DECL_FILE, HF_SRC]
  // ① 新族命中必红(票面验收①:零生产调用方 ⇒ 报数并逐条点名,不是只报一个总数)
  const off = gate.judge(new Map([decl]))
  assert.deepEqual(
    [off.factory.candidates, off.factory.unwired.length, off.byKind['handler-factory']],
    [3, 3, 3],
    '三个读得出是工厂的导出声明必须全部立案并报零消费者',
  )
  assert.deepEqual(off.unwired.map((u) => u.name).sort(), [
    'createBarTransport',
    'createBazHandler',
    'createFooHandler',
  ])
  // ② 反向锁(定级不升):形状读不出只报数,既不立案也不进 exit 2(§12e 恒红陷阱)
  assert.deepEqual(
    off.factory.unreadable,
    [`${HF_DECL_FILE}:5 createLooseHandler`],
    '读不出形态的必须逐条点名',
  )
  assert.equal(off.undetermined.length, 0, '形状读不出不得伪装成"无法判定"')
  assert.equal(
    gate.decide({ stagedCounts: off.perFile, mode: 'full' }).exit,
    0,
    '全量档对存量只报数',
  )
  // ③ 接线必绿 + 只 import 不取用照旧红(新族不是恒真摆设)
  const on = gate.judge(new Map([decl, [HF_USE_FILE, HF_CONSUMER]]))
  assert.deepEqual(
    on.factory.unwired,
    [`${HF_DECL_FILE}:3 createBazHandler`],
    '真取用的两支必须转绿,只 import 不取用的那支必须仍红',
  )
  // ④ 注释里的提及不算消费者(票面验收②,复用守门 115 那条口径 = 本门既有遮噪面)
  const noise = gate.judge(new Map([decl, [HF_USE_FILE, HF_NOISE]]))
  assert.deepEqual(
    noise.factory.unwired.sort(),
    off.factory.unwired.sort(),
    '注释/字符串里的提及不得让任何一支转绿',
  )
  // ⑤ 同词不同义(票面"不得按名字一律算候选"):与工厂**完全同名**的 type/接口字段/class 不立案
  const sameName = gate.judge(
    new Map([['apps/miniapp-taro/src/pkg-ai/ai/cards/types.ts', HF_TYPE]]),
  )
  assert.deepEqual(
    [sameName.scanned, sameName.candidates.length, sameName.factory.candidates],
    [1, 0, 0],
    '同一批名字,定义不是工厂 ⇒ 一个候选都不许立',
  )
  // ⑥ 形状三态落在 parseFile 的同一份遮噪面上(不是第二台词法器)
  const shapes = gate.parseFile(HF_DECL_FILE, HF_SRC).decls.map((d) => d.shape)
  assert.deepEqual(shapes, ['factory', 'factory', 'factory', 'not-factory', 'unknown'])
  assert.ok(
    shapes.every((s) => gate.DECL_SHAPES.includes(s)),
    '出现了 DECL_SHAPES 之外的形状值',
  )
  // ⑦ 集合推导失败 ⇒ 未判定(取不到内容不得折成"该族 0 候选 = 绿")
  const blind = gate.judge(new Map([[HF_DECL_FILE, null]]), { face: 'head' })
  assert.equal(blind.undetermined.length, 1, '取不到内容必须逐条点名')
  assert.equal(blind.factory.candidates, 0)
  assert.equal(
    gate.decide({ stagedCounts: blind.perFile, mode: 'full', undetermined: blind.undetermined })
      .exit,
    2,
    '未判定必须落 exit 2,绝不记绿',
  )
  // ⑧ 新族并入同一条棘轮(新增即拦、齐平不红)
  assert.equal(
    gate.decide({
      stagedCounts: { [HF_DECL_FILE]: 3 },
      headCounts: { [HF_DECL_FILE]: 2 },
      mode: 'staged',
    }).exit,
    1,
  )
  assert.equal(
    gate.decide({
      stagedCounts: { [HF_DECL_FILE]: 3 },
      headCounts: { [HF_DECL_FILE]: 3 },
      mode: 'staged',
    }).exit,
    0,
  )
})

/**
 * T13 default 链(2026-11-01):判据"只扩认链、不松判据"两半都要有牙。
 * 与源脚本 --self-test 的 D 组成对;夹具与判据全部从 `__test__` 取(§22c 单一真相)。
 */
test('T13 default 链:五形接线必绿 / 双变异对照退回红 / 八条反向锁照旧红 / 新 specifier 尺更严', () => {
  const F = gate.FIXTURES
  const forms = [F.DEF_FP, F.DEF_IDENT, F.DEF_FUN, F.DEF_OBJ, F.DEF_AS_DEFAULT]
  // 夹具装配只做一次:每条断言都落在 printWidth 内(改判据不该把测试面写成格式存量)
  const filesOf = (src, use, useFile = F.DEF_USE_FILE) =>
    new Map([
      [F.DEF_DECL_FILE, src],
      [useFile, use],
    ])
  const unwiredNames = (src, use, opts = {}, useFile = F.DEF_USE_FILE) =>
    gate.judge(filesOf(src, use, useFile), opts).unwired.map((u) => u.name)
  assert.deepEqual(
    forms.map((src) => unwiredNames(src, F.DEF_USE)),
    [[], [], [], [], []],
    'default 导出的策略模块被 default 取用 ⇒ 五形都必须 0 未接线(改前五形全判 1 处)',
  )
  for (const mutate of ['no-external-refs', 'no-closure']) {
    assert.deepEqual(
      forms.map((src) => unwiredNames(src, F.DEF_USE, { mutate })),
      [['DEMO_TTL'], ['DEMO_TTL'], ['DEMO_TTL'], ['DEMO_TTL'], ['DEMO_TTL']],
      `mutate=${mutate} 仍判绿 ⇒ default 链是靠豁免而不是靠那两支既有判据`,
    )
  }
  // 反向锁:声明体没引用 / 无 default 导出 / export default 只在注释里 / 只 import 不取用 /
  // 取用写在注释里 / 消费者同名 local / 测试面 / specifier 只命中目录段
  const negations = [
    ['default 声明体没引用常量', F.DEF_NOREF, F.DEF_USE],
    ['模块无 default 导出', F.DEF_NONE, F.DEF_USE],
    ['export default 只写在注释与字符串里', F.DEF_COMMENTED_SRC, F.DEF_USE],
    ['default 导入了但零取用', F.DEF_FP, F.DEF_NOUSE],
    ['取用只写在注释里', F.DEF_FP, F.DEF_COMMENTED_USE],
    ['消费者自家声明同名 local(归属歧义)', F.DEF_FP, F.DEF_SHADOW],
    ['唯一 default 消费者在测试面', F.DEF_FP, F.DEF_USE, 'apps/api/tests/d.test.ts'],
    ['specifier 只命中同目录段', F.DEF_FP, F.DEF_OTHER_DIR],
  ]
  for (const [label, src, use, useFile] of negations) {
    assert.deepEqual(
      unwiredNames(src, use, {}, useFile),
      ['DEMO_TTL'],
      `${label} ⇒ 照旧红(判据不得被放宽)`,
    )
  }
  // 新尺必须比具名那把更严,且这一条差异被真用上(同目录段:specCompat 认、新尺不认)
  assert.deepEqual(
    [
      gate.specResolvesToModule('./demo.js', F.DEF_DECL_FILE),
      gate.specResolvesToModule('../plugins/demo', F.DEF_DECL_FILE),
      gate.specResolvesToModule('./plugins/other.js', F.DEF_DECL_FILE),
      gate.specCompat('./plugins/other.js', F.DEF_DECL_FILE),
      gate.specResolvesToModule('@ihui/types', 'packages/types/src/index.ts'),
      gate.specResolvesToModule('', F.DEF_DECL_FILE),
    ],
    [true, true, false, true, true, false],
    'default 槽位不带符号名 ⇒ 归属尺只认"specifier 末段就是声明文件基名"(目录 barrel 例外于 index)',
  )
  assert.deepEqual(
    [
      unwiredNames(F.DEF_MIX_SRC, F.DEF_MIX_USE).length,
      unwiredNames(F.DEF_MIX_SRC, F.DEF_MIX_USE_NAMED_ONLY).length,
    ],
    [0, 1],
    '`import D, { named } from` 的默认半边此前整条被丢弃;只取用具名半边不得顺带点亮 default 那支',
  )
  // 形状锁:DEFAULT_SLOT 只是虚拟宿主,不进 decls/declNames(否则会被立案或撞"同名不同物")
  const p = gate.parseFile(F.DEF_DECL_FILE, F.DEF_FP)
  const dOff = gate.parseFile(F.DEF_DECL_FILE, F.DEF_COMMENTED_SRC)
  assert.equal(p.hasDefault, true)
  assert.deepEqual([...p.defaultRefs], ['demoPlugin'])
  assert.ok(p.edges.has(gate.DEFAULT_SLOT), 'default 虚拟宿主必须进 edges,否则第 4 步闭包接不上')
  assert.equal(p.declNames.has(gate.DEFAULT_SLOT), false, 'default 进了 declNames 会污染具名判序')
  assert.equal(
    p.decls.some((d) => d.name === gate.DEFAULT_SLOT),
    false,
  )
  assert.equal(dOff.hasDefault, false, '注释里的 export default 不得算槽位')
})

/**
 * T14 端到端(--staged,临时仓):default 链必须在**索引 blob** 上真响真绿。
 * A 撤掉消费者取用 ⇒ 1 > 锚点 0 ⇒ 红并点名;B 还原取用 ⇒ 复绿。
 * 这一对证明装车路径(取材面/棘轮/退出码)与既有四族一致,不是只在纯函数里好看。
 */
test('T14 default 链端到端(--staged 临时仓):撤掉 default 取用即红且点名,还原即复绿', () => {
  const dir = mkScratch('g121-def-')
  try {
    const git = (args) =>
      spawnSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    assert.equal(git(['init', '-q']).status, 0)
    assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
    assert.equal(git(['config', 'user.name', 'gate']).status, 0)
    mkdirSync(join(dir, 'apps', 'api', 'src', 'plugins'), { recursive: true })
    mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true })
    const DECL = join(dir, 'apps', 'api', 'src', 'plugins', 'demo.ts')
    const BOOT = join(dir, 'apps', 'api', 'src', 'server.ts')
    writeFileSync(
      DECL,
      [
        'const DEMO_TTL = 60',
        'async function demoPlugin(server: unknown): Promise<void> { void DEMO_TTL; void server }',
        'export default demoPlugin',
        '',
      ].join('\n'),
    )
    writeFileSync(
      BOOT,
      "import demoPlugin from './plugins/demo.js'\nexport function build(server: unknown): void { void demoPlugin; void server }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'base']).status, 0)
    const runGate = () =>
      spawnSync(process.execPath, [SCRIPT, '--staged', '--root', dir], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    // A. 基线是"已接线" ⇒ HEAD 锚点 0;把消费者改成只 import 不取用 ⇒ 索引面 1 > 0 ⇒ 红
    writeFileSync(
      BOOT,
      "import demoPlugin from './plugins/demo.js'\nexport function build(server: unknown): void { void server }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    const red = runGate()
    assert.equal(
      red.status,
      1,
      `撤掉 default 取用应当红 rc=${red.status}\n${red.stdout?.slice(-700)}${red.stderr?.slice(-700)}`,
    )
    assert.match(String(red.stderr), /plugins\/demo\.ts/, '红必须点名声明文件')
    assert.match(String(red.stderr), /DEMO_TTL/, '红必须点名那枚策略常量')
    // B. 还原取用 ⇒ 回到锚点 ⇒ 复绿(证明判据不是恒红摆设)
    writeFileSync(
      BOOT,
      "import demoPlugin from './plugins/demo.js'\nexport function build(server: unknown): void { void demoPlugin; void server }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    const green = runGate()
    assert.equal(
      green.status,
      0,
      `还原 default 取用应当复绿 rc=${green.status}\n${green.stdout?.slice(-700)}${green.stderr?.slice(-700)}`,
    )
  } finally {
    rmScratch(dir)
  }
})
/**
 * T15 C7 端到端(--staged 临时仓):工厂存量齐平不红、新增零消费者工厂红且点名、补上消费者复绿
 * (2026-11-01 本票重写 T13/T14 时误吞了原 T12 的 test() 头,导致这一整块成为孤儿代码
 * —— 语法仍解析、`node --test` 一条都不跑,原 C7 三情形端到端腿静默失活;此处补回声明头。)
 */
// ---------------------------------------------------------------- C6 第四族:静态前缀+变量拼接(2026-11-01)

const LEX_CONCAT = new Map(
  gate.LEX_LANGS.map((L) => [
    `packages/i18n/messages/web/${L}.json`,
    JSON.stringify({ chat: { hi: 'a', dyn: { title: 't' } } }),
  ]),
)

test('T16 C6 第四族拼接前缀:const 前缀接线必绿 / 不可求值前缀照旧动态 / 变异对照退回红', () => {
  // 夹具只有一份实现(§22c):接线形态夹具从源脚本 FIXTURES 取,测试内不重抄
  const ON = gate.FIXTURES.CONCAT_ON
  assert.ok(ON && /const NS = 'dyn'/.test(ON), 'FIXTURES 缺拼接前缀夹具')
  const files = new Map([['apps/web/src/a.tsx', ON]])
  // 接线面:前缀 chat.dyn. 覆盖子键,只剩 chat.hi 未接线
  const wired = gate.judge(files, { lexicon: LEX_CONCAT })
  assert.deepEqual(
    [wired.i18n.dynamic, wired.i18n.byFolder.web.unwired],
    [0, 1],
    '静态前缀+变量拼接必须产出前缀覆盖(改前整条判动态 ⇒ 11753 型假阳性的主根因)',
  )
  assert.deepEqual(wired.i18n.byFolder.web.samples, ['chat.hi'])
  // 未接线面:前缀标识符无 const 定义 ⇒ 不认、计动态、不静默盖键(方向恒为漏报不假绿)
  const off = gate.judge(
    new Map([
      [
        'apps/web/src/a.tsx',
        "const t = useTranslations('chat')\nexport function K(x: string): string { return t(JUNK + '.' + x) }\n",
      ],
    ]),
    { lexicon: LEX_CONCAT },
  )
  assert.deepEqual(
    [off.i18n.dynamic, off.i18n.byFolder.web.unwired],
    [1, 2],
    '读不出静态前缀 ⇒ 照旧动态,一个键都不许被静默盖掉',
  )
  // 变异对照:关掉新识别 ⇒ 已接线夹具必须从绿退回红(新分支不是恒真摆设)
  const mutated = gate.judge(files, { lexicon: LEX_CONCAT, mutate: 'no-concat-prefix' })
  assert.deepEqual(
    [mutated.i18n.dynamic, mutated.i18n.byFolder.web.unwired],
    [1, 2],
    'mutate=no-concat-prefix 仍绿 ⇒ 第四族识别是摆设',
  )
})

test('T15 C7 端到端(--staged 临时仓):工厂存量齐平不红、新增零消费者工厂红且点名、补上消费者复绿', () => {
  const dir = mkScratch('g121-c7-')
  try {
    const git = (args) =>
      spawnSync('git', ['-C', dir, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    assert.equal(git(['init', '-q']).status, 0)
    assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
    assert.equal(git(['config', 'user.name', 'gate']).status, 0)
    mkdirSync(join(dir, 'apps', 'web', 'src', 'hf'), { recursive: true })
    const DECL = join(dir, 'apps', 'web', 'src', 'hf', 'stream-handlers.ts')
    const BOOT = join(dir, 'apps', 'web', 'src', 'hf', 'boot.ts')
    const writeDecl = (extra) =>
      writeFileSync(
        DECL,
        [
          'export function createFooHandler(): unknown { return 1 }',
          'export function createBazHandler(): unknown { return 2 }',
          extra,
          '',
        ].join('\n'),
      )
    // 消费者只取用 createFooHandler ⇒ createBazHandler 从基线起就是 1 处未接线(= HEAD 锚点)
    writeDecl('')
    writeFileSync(
      BOOT,
      "import { createFooHandler, createBazHandler } from './stream-handlers.js';\nexport function boot(): unknown { return createFooHandler() }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'base']).status, 0)
    const runGate = () =>
      spawnSync(process.execPath, [SCRIPT, '--staged', '--root', dir], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    // A. 只改声明文件本身、不加新工厂 ⇒ 索引面未接线数与 HEAD 锚点齐平 ⇒ 绿(存量不追)
    writeDecl('// 本轮只动注释,未新增工厂')
    assert.equal(git(['add', '-A']).status, 0)
    const flat = runGate()
    assert.equal(
      flat.status,
      0,
      `齐平应当绿 rc=${flat.status}\n${flat.stdout?.slice(-700)}${flat.stderr?.slice(-700)}`,
    )
    // B. 新增一个零生产调用方的工厂 ⇒ 2 > 锚点 1 ⇒ 红,且点名该文件与该工厂
    writeDecl(
      'export function createQuxHandler(): unknown { return 3 }\nexport let createLooseHandler',
    )
    assert.equal(git(['add', '-A']).status, 0)
    const red = runGate()
    assert.equal(
      red.status,
      1,
      `新增零消费者工厂应当红 rc=${red.status}\n${red.stdout?.slice(-700)}${red.stderr?.slice(-700)}`,
    )
    assert.match(String(red.stderr), /stream-handlers\.ts/, '红必须点名声明文件')
    assert.match(String(red.stderr), /createQuxHandler/, '红必须点名新增的工厂')
    // C. 把它接到生产面 ⇒ 回到锚点 ⇒ 复绿(证明判据不是恒红摆设,也证明"读得出形状"才接线)
    writeDecl(
      'export function createQuxHandler(): unknown { return 3 }\nexport let createLooseHandler',
    )
    writeFileSync(
      BOOT,
      "import { createFooHandler, createBazHandler, createQuxHandler } from './stream-handlers.js';\nexport function boot(): unknown { return createFooHandler() }\nexport function boot2(): unknown { return createBazHandler() }\nexport function boot3(): unknown { return createQuxHandler() }\n",
    )
    assert.equal(git(['add', '-A']).status, 0)
    const wired = runGate()
    assert.equal(
      wired.status,
      0,
      `补上消费者应当复绿 rc=${wired.status}\n${wired.stdout?.slice(-700)}${wired.stderr?.slice(-700)}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
