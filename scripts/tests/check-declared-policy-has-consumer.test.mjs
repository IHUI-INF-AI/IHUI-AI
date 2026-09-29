// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-declared-policy-has-consumer(策略/契约声明必须有非测试消费者)
//
// 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
// 不复制判据实现 —— 两份真相是登记在案的漂移源。
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
import { __test__ as gate } from '../check-declared-policy-has-consumer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-declared-policy-has-consumer.mjs')

test('T1 §22c 锚点:__test__ 必须导出核心判据且 skipEnv 命名在位', () => {
  for (const k of [
    'inScanRoot',
    'candidateKinds',
    'maskCommentsKeepStrings',
    'blankStringContents',
    'parseFile',
    'specCompat',
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
  const ids = [...runner.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(
    dup,
    [],
    `runner 出现重复编号(${dup.join(', ')})—— 同日多会话撞号在 origin/main 上会互相覆盖注册块`,
  )
})

test('T8 --self-test 真跑且**连跑两次**皆 rc=0(只能跑一次的取证等于没取证,守门 shadow-copy 同训)', () => {
  for (const round of [1, 2]) {
    const r = spawnSync(process.execPath, [SCRIPT, '--self-test'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
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
  new Map(gate.LEX_LANGS.map((L) => [`packages/i18n/messages/web/${L}.json`, JSON.stringify(LEX_KEYS)]))

test('T9 C6 i18n 三验收(G-816043):零发射必报、发射齐必绿、动态只报数不静默;伪调用不可见', () => {
  // 验收①:五语言都有值、全仓无发射点 ⇒ 报未接线,按面板归 en.json 计数
  const off = gate.judge(new Map([['apps/web/src/a.tsx', 'export function B(): number { return 1 }\n']]), {
    lexicon: lexMap(),
  })
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
      ['apps/cli/src/run.ts', "import { t } from '../i18n/index.js'\nexport function M(): string { return t('chat.hi') }\n"],
    ]),
    { lexicon: lexMap() },
  )
  assert.equal(imp.i18n.emitted, 1)
  assert.equal(imp.i18n.byFolder.web.unwired, 2, 'import 的 t(全键) 必须接线,否则 cli 面板是假 100% 孤儿')
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
      spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
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
    assert.match(String(red.stderr), /packages\/i18n\/messages\/web\/en\.json/, '红点名必须落在 en.json 计数上')
    assert.match(String(red.stderr), /orphan\.b/, '红点名必须给出样例键')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
