// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-word-table-resolvable.mjs 的镜像测试(AGENTS.md §22c)。
 * 直接 import 源脚本的 `__test__` 导出,**不复制任何判据实现** —— 判据漂移本文件立刻变红。
 * 跑法:node --test scripts/tests/check-word-table-resolvable.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as gate } from '../check-word-table-resolvable.mjs'

const REPO = join(import.meta.dirname, '..', '..')
const SRC_FILE = join(REPO, 'scripts', 'check-word-table-resolvable.mjs')
/**
 * 真仓取材一律走本门的判定面(HEAD blob),**不得按磁盘读**。
 * 磁盘副本由多个并行会话共写、常年滞后 HEAD,还混着别人半编辑的语料 ——
 * 测试若按磁盘读源码、判据按 HEAD 读,量的是两份不同的仓库(§"诊断只能取同一个面")。
 */
const FACE = gate.makeFaceReader('head')
const readText = (rel) => FACE.read(rel)

const {
  discoverWordTables,
  scanObjectLiterals,
  resolvable,
  resolveSpecifier,
  importSpecifiers,
  exportedSymbols,
  consumerEnds,
  buildReverseIndex,
  listSourceFiles,
  buildPackageMap,
  buildDirectDeps,
  endsDependingOnPackage,
  buildMergedViews,
  corpusLeafSet,
  evaluateWordTables,
  guardNoTables,
  taroBundleViews,
  scanScatteredKeys,
  keySuffixes,
  buildKeyUniverse,
  evaluateScatteredKeys,
  splitScatteredRatchet,
  LANGS,
  END_DIRS,
} = gate

/** 内存假语料:一张 4 键的档位词表(形状与 permission-tier.ts 同构) */
const TIER_SRC = [
  'export const TIER_KEYS: Readonly<',
  '  Record<TierKey, { title: string; desc: string }>',
  '> = {',
  "  a: { title: 'tier.mode.a.title', desc: 'tier.mode.a.desc' },",
  "  b: { title: 'tier.mode.b.title', desc: 'tier.mode.b.desc' },",
  '}',
].join('\n')
const CORPUS = new Set([
  'tier.mode.a.title',
  'tier.mode.a.desc',
  'tier.mode.b.title',
  'tier.mode.b.desc',
])
const leafMap = (missing = []) =>
  new Map([...CORPUS].filter((k) => !missing.includes(k)).map((k) => [k, `V:${k}`]))
const goodViews = () => Object.fromEntries(LANGS.map((l) => [`web/${l}`, leafMap()]))
const tierTable = () =>
  discoverWordTables([{ rel: 'packages/demo/src/words.ts', text: TIER_SRC }])[0]
const ev = ({ tables, views, corpusLeaves = CORPUS, taro = null, isSharedTable = () => false }) =>
  evaluateWordTables({ tables, corpusLeaves, views, taro, isSharedTable })

test('§22c:源脚本必须 export __test__ 且关键判据函数可 import(唯一真相在源文件)', () => {
  for (const fn of [
    'discoverWordTables',
    'scanObjectLiterals',
    'evaluateWordTables',
    'resolvable',
    'resolveSpecifier',
    'consumerEnds',
    'reverseClosure',
    'tableScopedSymbols',
    'tableReachableNames',
    'taroBundleViews',
    'guardNoTables',
    'run',
    // W6 与判定面:漏一条 = 测试拿不到真判据,只能自我安慰
    'scanScatteredKeys',
    'keySuffixes',
    'buildKeyUniverse',
    'evaluateScatteredKeys',
    'splitScatteredRatchet',
    'makeFaceReader',
    'setActive',
    'sourceFile',
    'UndeterminedError',
  ]) {
    assert.equal(typeof gate[fn], 'function', `__test__ 缺导出 ${fn}`)
  }
  // 常量类锚点也要钉住:宇宙铺在哪些语料上、什么算带点键,漂移即判据静默变窄
  assert.deepEqual(gate.CORPUS_SOURCES, ['shared', ...END_DIRS])
  assert.ok(gate.DOTTED_KEY_BARE_RE.test('menu.search') && !gate.DOTTED_KEY_BARE_RE.test('Search'))
  assert.deepEqual(gate.LANGS, ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'])
  assert.ok(!gate.END_DIRS.includes('api'), 'api 不产界面文案,不得进端清单(与既有闸同口径)')
})

test('W1:嵌套 Record<K,{title,desc}> 取到 4 键,导出性与表名如实', () => {
  const t = tierTable()
  assert.equal(t.name, 'TIER_KEYS')
  assert.equal(t.exported, true)
  assert.deepEqual([...t.keys].sort(), [
    'tier.mode.a.desc',
    'tier.mode.a.title',
    'tier.mode.b.desc',
    'tier.mode.b.title',
  ])
})

test('W1:注释里的示例词表不得被扫到(stripComments 先生效)', () => {
  const commented =
    "// 例:\n// export const FAKE_TABLE = { a: 'x.y', b: 'p.q' }\n" +
    "/* export const FAKE2 = { a: 'x.y', b: 'p.q' } */\n" +
    TIER_SRC
  const names = discoverWordTables([{ rel: 'packages/demo/src/w.ts', text: commented }]).map(
    (x) => x.name,
  )
  assert.deepEqual(names, ['TIER_KEYS'], `注释里的假表被扫进来了:${JSON.stringify(names)}`)
})

test('W1:值里混了硬编码中文/函数/数组 → 整表不认(动态表不属本门)', () => {
  const files = [
    {
      rel: 'packages/demo/src/w2.ts',
      text: [
        'export const MIXED = {',
        "  a: 'tier.mode.a.title',",
        "  b: 'tier.mode.b.title',",
        "  c: '写死的中文',",
        '}',
        'export const WITH_FN = {',
        "  a: 'tier.mode.a.title',",
        '  b: () => "x.y",',
        '}',
        'export const WITH_ARR = {',
        "  a: 'tier.mode.a.title',",
        "  b: ['x.y1', 'x.y2'],",
        '}',
      ].join('\n'),
    },
  ]
  const names = discoverWordTables(files).map((x) => x.name)
  assert.deepEqual(names, [], `非纯字面量表被误认:${JSON.stringify(names)}`)
  assert.equal(scanObjectLiterals(" a: 'x.y', b: '写死中文' ").plain, 1)
})

test('W2 反例:含点但不是 i18n 键的字符串 map(模型名/版本号)判为不检', () => {
  const t = {
    file: 'packages/demo/src/m.ts',
    line: 1,
    name: 'MODEL_NAMES',
    keys: ['MiniMax-M2.5', 'gpt-4.1'],
    consumerEnds: ['web'],
    dependentEnds: [],
  }
  const r = ev({ tables: [t], views: goodViews() })
  assert.equal(r.failures.length, 0, '未锚定的字符串 map 不得进判据(否则误报洪水)')
  assert.equal(r.skipped.length, 1)
  assert.equal(r.skipped[0].absCount, 0)
})

test('W2 反例:命名空间相对取词的表(配 useTranslations 的短键)判为不检', () => {
  const t = {
    file: 'apps/web/app/(main)/admin/x/helpers.ts',
    line: 1,
    name: 'RELATIVE',
    keys: ['typeLabel.single_choice', 'typeLabel.judgment'],
    consumerEnds: ['web'],
    dependentEnds: [],
  }
  const r = ev({ tables: [t], views: goodViews() })
  assert.equal(r.checked.length, 0)
  assert.match(r.skipped[0].reason, /命名空间相对/)
})

test('W2 不掩盖真缺陷:过半可解析的表里,解析不出的那几个键仍逐条咬', () => {
  const t = {
    file: 'packages/demo/src/h.ts',
    line: 1,
    name: 'HALF',
    keys: ['tier.mode.a.title', 'tier.mode.b.title', 'x.y1', 'x.y2'],
    consumerEnds: ['web'],
    dependentEnds: [],
  }
  const r = ev({
    tables: [t],
    corpusLeaves: new Set([...CORPUS, 'x.y1', 'x.y2']),
    views: goodViews(),
  })
  assert.equal(r.checked.length, 1)
  const keys = new Set(r.failures.map((f) => f.key))
  assert.ok(keys.has('x.y1') && keys.has('x.y2'), '锚定过的表必须逐键断言')
  assert.ok(r.failures.every((f) => f.rule === 'W3'))
})

test('W3 注入:某语言抽掉一个键 → 判红且点名 键/表/语言', () => {
  const t = { ...tierTable(), consumerEnds: ['web'], dependentEnds: [] }
  const r = ev({ tables: [t], views: { ...goodViews(), 'web/ko': leafMap(['tier.mode.b.desc']) } })
  assert.equal(r.failures.length, 1)
  const f = r.failures[0]
  assert.equal(f.rule, 'W3')
  assert.equal(f.key, 'tier.mode.b.desc')
  assert.equal(f.where, 'web/ko')
  assert.match(f.table.file, /words\.ts/)
})

test('W3 反例:值恰好等于键名(静默回显)也算缺', () => {
  const echo = new Map([...CORPUS].map((k) => [k, k]))
  const r = ev({
    tables: [{ ...tierTable(), consumerEnds: ['web'], dependentEnds: [] }],
    views: Object.fromEntries(LANGS.map((l) => [`web/${l}`, echo])),
  })
  assert.equal(r.failures.length, 4 * 5)
  assert.equal(resolvable(echo, 'tier.mode.a.title'), false)
})

test('W3 反例:消费端为空的表不产生 W3 失败(不凭空要求未接入端)', () => {
  const r = ev({
    tables: [{ ...tierTable(), consumerEnds: [], dependentEnds: [] }],
    views: Object.fromEntries(LANGS.map((l) => [`web/${l}`, leafMap()])),
  })
  assert.equal(r.failures.filter((f) => f.rule === 'W3').length, 0)
})

test('W4:端 JSON 有值但小程序离线包缺键 → 判红并点名 taro-gen', () => {
  const t = { ...tierTable(), consumerEnds: ['miniapp-taro'], dependentEnds: [] }
  const views = Object.fromEntries(
    LANGS.flatMap((l) => [
      [`miniapp-taro/${l}`, leafMap()],
      [`web/${l}`, leafMap()],
    ]),
  )
  const r = ev({
    tables: [t],
    views,
    taro: { views: { ja: leafMap(['tier.mode.b.title']) }, remote: ['ja'], broken: [] },
  })
  assert.ok(
    r.failures.some(
      (f) => f.rule === 'W4' && f.where === 'taro-gen/ja' && f.key === 'tier.mode.b.title',
    ),
  )
})

test('W4:离线包整块解不出 → 点名需 pnpm gen:i18n', () => {
  const t = { ...tierTable(), consumerEnds: ['miniapp-taro'], dependentEnds: [] }
  const r = ev({
    tables: [t],
    views: Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()])),
    taro: { views: {}, remote: ['en'], broken: ['en'], unparsed: false },
  })
  const f = r.failures.find((x) => x.rule === 'W4')
  assert.ok(f && /gen:i18n/.test(f.why))
})

test('W4:取不到 REMOTE_LOCALES 清单时单列"离线面未核验",不冒充逐语言缺键', () => {
  const t = { ...tierTable(), consumerEnds: ['miniapp-taro'], dependentEnds: [] }
  const views = Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()]))
  const unparsed = ev({
    tables: [t],
    views,
    taro: { views: {}, remote: LANGS, broken: ['zh-CN'], unparsed: true },
  })
  assert.ok(
    unparsed.failures.some(
      (f) => f.rule === 'W4' && /REMOTE_LOCALES/.test(f.where) && /格式变更/.test(f.why),
    ),
  )
  const parsed = ev({
    tables: [t],
    views,
    taro: {
      views: Object.fromEntries(LANGS.map((l) => [l, leafMap()])),
      remote: LANGS,
      broken: [],
      unparsed: false,
    },
  })
  assert.equal(parsed.failures.length, 0, '清单可读且载荷齐全时不得有 W4 假红')
})

test('W5:共享层词表在"依赖但未接入"的端整块缺键 → 落点债一条(不逐键刷屏)', () => {
  const t = { ...tierTable(), consumerEnds: [], dependentEnds: ['cli'] }
  const views = {
    ...goodViews(),
    ...Object.fromEntries(LANGS.map((l) => [`cli/${l}`, leafMap([...CORPUS])])),
  }
  const r = evaluateWordTables({
    tables: [t],
    corpusLeaves: CORPUS,
    views,
    taro: null,
    isSharedTable: (x) => x.file.startsWith('packages/'),
  })
  // W5 是"落点债":照报但不进 failures —— 该端没引用这张表,今天没有任何界面会回显键名;
  // 进 failures 会让 blocking 门长期红在别人未接入的存量上(实测初版 5 条全属此类)。
  assert.equal(r.failures.length, 0)
  assert.equal(r.notices.length, 1)
  assert.equal(r.notices[0].rule, 'W5')
  assert.match(r.notices[0].where, /^cli\/\[zh-CN,/)
})

test('W5 不误伤:端包内的表不要求别的端', () => {
  const t = { ...tierTable(), file: 'apps/web/src/x.ts', consumerEnds: [], dependentEnds: ['cli'] }
  const r = evaluateWordTables({
    tables: [t],
    corpusLeaves: CORPUS,
    views: goodViews(),
    taro: null,
    isSharedTable: (x) => x.file.startsWith('packages/'),
  })
  assert.equal(r.failures.length, 0)
})

test('空输入不得恒真:全量 0 表 → guardNoTables 给原因;暂存区无词表属正常态', () => {
  assert.notEqual(guardNoTables({ tablesFound: 0, mode: 'full', scopedCount: 0 }), null)
  assert.equal(guardNoTables({ tablesFound: 12, mode: 'full', scopedCount: 12 }), null)
  assert.equal(guardNoTables({ tablesFound: 12, mode: 'staged', scopedCount: 0 }), null)
})

test('import 解析:作用域名占两段;css/第三方/越界/不存在一律 null', () => {
  const pkgMap = buildPackageMap()
  assert.equal(
    resolveSpecifier('@ihui/shared/chat', 'apps/miniapp-taro/src/a.ts', pkgMap),
    'packages/shared/src/chat/index.ts',
  )
  assert.equal(
    resolveSpecifier('@ihui/shared', 'apps/web/src/a.ts', pkgMap),
    'packages/shared/src/index.ts',
  )
  assert.equal(resolveSpecifier('next-intl', 'apps/web/src/a.ts', pkgMap), null)
  assert.equal(resolveSpecifier('./x.css', 'apps/web/src/a.ts', pkgMap), null)
  assert.equal(resolveSpecifier('../../../../outside', 'apps/web/src/a.ts', pkgMap), null)
  assert.equal(resolveSpecifier('./no-such-module', 'apps/web/src/a.ts', pkgMap), null)
})

test('import 解析:相对路径与 barrel 都能落到真实文件;说明符三类形态都收', () => {
  const pkgMap = buildPackageMap()
  assert.equal(
    resolveSpecifier('./permission-tier', 'packages/shared/src/chat/index.ts', pkgMap),
    'packages/shared/src/chat/permission-tier.ts',
  )
  const specs = importSpecifiers(
    "import { a } from './x'\nexport * from './y'\nimport 'side-effect'",
  )
  assert.deepEqual([...specs].sort(), ['./x', './y', 'side-effect'])
  assert.ok(
    exportedSymbols('export const A = 1\nexport function b(){}\nexport { c as d } from "./x"').has(
      'd',
    ),
  )
})

test('包依赖图:packages/shared 被 5 端依赖,packages/ui-react 只有 web+extension', () => {
  const pkgMap = buildPackageMap()
  const deps = buildDirectDeps(pkgMap)
  assert.deepEqual(
    endsDependingOnPackage('packages/shared', pkgMap, deps).sort(),
    [...END_DIRS].sort(),
  )
  assert.deepEqual(endsDependingOnPackage('packages/ui-react', pkgMap, deps).sort(), [
    'extension',
    'web',
  ])
})

test('真仓锚点:PERMISSION_TIER_WORD_KEYS 被认定、10 键且全部绝对可解析(锚定不是空判据)', () => {
  const real = discoverWordTables([
    {
      rel: 'packages/shared/src/chat/permission-tier.ts',
      text: readText('packages/shared/src/chat/permission-tier.ts'),
    },
  ]).find((x) => x.name === 'PERMISSION_TIER_WORD_KEYS')
  assert.ok(real, '扫描面漂移:认不到 permission-tier 的词表')
  assert.equal(real.keys.length, 10)
  const corpus = corpusLeafSet()
  assert.equal(real.keys.filter((k) => corpus.has(k)).length, 10)
})

test('真表 × 真语料注入:删掉 web/ko 的一个键 → W3 点名 1 处', () => {
  const real = discoverWordTables([
    {
      rel: 'packages/shared/src/chat/permission-tier.ts',
      text: readText('packages/shared/src/chat/permission-tier.ts'),
    },
  ]).find((x) => x.name === 'PERMISSION_TIER_WORD_KEYS')
  const views = buildMergedViews()
  const target = real.keys[3]
  assert.ok(views['web/ko'].get(target), '前置:web/ko 必须真有这个键(语料变了请更新断言前提)')
  const ko = new Map(views['web/ko'])
  ko.delete(target)
  const r = evaluateWordTables({
    tables: [{ ...real, consumerEnds: ['web'], dependentEnds: [] }],
    corpusLeaves: corpusLeafSet(),
    views: { ...views, 'web/ko': ko },
    taro: null,
    isSharedTable: () => false,
  })
  assert.equal(r.failures.length, 1)
  assert.equal(r.failures[0].rule, 'W3')
  assert.equal(r.failures[0].where, 'web/ko')
  assert.equal(r.failures[0].key, target)
})

test('消费端符号粒度:同模块多导出时,只认读到这张表的那几个', () => {
  const SRC = [
    "export const WORDS: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
    'const ZH_ONLY: Record<string, string> = { a: "甲", b: "乙" }',
    'export function keyOf(k: string) { return WORDS[k] }',
    'export function zhOnly(k: string) { return ZH_ONLY[k] }',
  ].join('\n')
  assert.deepEqual([...gate.tableScopedSymbols(SRC, 'WORDS')].sort(), ['WORDS', 'keyOf'])
  // 变异对照:让 zhOnly 也读这张表,它必须立刻进触表面(判据不是按名字写死的白名单)
  assert.equal(
    gate.tableScopedSymbols(SRC.replace('ZH_ONLY[k]', 'WORDS[k]'), 'WORDS').has('zhOnly'),
    true,
  )
})

test('消费端符号粒度:两处兜底都必须退回全量,切分失效不得洗成绿', () => {
  // ① re-export 形态:符号没有自己的顶层声明块
  const REEXPORT = ['export { nope } from "./other"', 'export const T = 1'].join('\n')
  assert.deepEqual([...gate.tableScopedSymbols(REEXPORT, 'nope')].sort(), ['T', 'nope'])
  // ② 没有任何导出符号触表 → 退回全量。与下面的"链式触表"刻意成对:同一个 noop
  //    在 NO_READER 里是靠**兜底**留下的,在 VIA_PRIVATE 里是**真触表**留下的 ——
  //    两条路径结果相同,所以必须用 tableReachableNames 把机制差别钉住,否则等式是空判据。
  const NO_READER = [
    "const PRIV: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
    'function pick(k: string) { return PRIV[k] }',
    'export function noop() { return 1 }',
  ].join('\n')
  const VIA_PRIVATE = NO_READER.replace('return 1', 'return pick("a")')
  assert.ok(
    gate.tableReachableNames(NO_READER, 'PRIV').has('pick') &&
      !gate.tableReachableNames(NO_READER, 'PRIV').has('noop'),
    'NO_READER 里 noop 不该被判触表(它是走兜底的那一侧)',
  )
  assert.equal(
    gate.tableReachableNames(VIA_PRIVATE, 'PRIV').has('noop'),
    true,
    '传递闭包没吃到经私有 helper 的间接触表',
  )
  assert.deepEqual([...gate.tableScopedSymbols(NO_READER, 'PRIV')], ['noop'])
  assert.deepEqual([...gate.tableScopedSymbols(VIA_PRIVATE, 'PRIV')], ['noop'])
  // 变异对照:再导出不触表的符号时,收窄面必须把它剔出去(证明判据真在收窄,不是一律返回全量)
  assert.deepEqual([...gate.tableScopedSymbols(`${VIA_PRIVATE}\nexport const d = () => 1`, 'PRIV')], [
    'noop',
  ])
})

test('真仓 A/B:error-messages 的全量符号面判出消费端、收窄面判零(70 枚恒红的根因)', () => {
  const EM = 'packages/shared/src/utils/error-messages.ts'
  const text = readText(EM)
  const importers = buildReverseIndex(listSourceFiles(), buildPackageMap())
  const narrow = gate.tableScopedSymbols(text, 'ERROR_CODE_TO_I18N_KEY')
  assert.ok(!narrow.has('toUserFriendlyMessage'), '不查词表的符号不得留在触表面')
  assert.ok(narrow.has('resolveErrorMessage'), '经 getErrorI18nKey 查词表的符号必须留在触表面')
  assert.ok(
    consumerEnds({ file: EM }, importers, exportedSymbols(text)).includes('mobile-rn'),
    '前置:旧判据(全量符号面)必须真能算出 mobile-rn,否则本用例什么都没比',
  )
  assert.deepEqual(consumerEnds({ file: EM }, importers, narrow), [])
})

test('真仓防收窄过窄:四端都在用的 permission-tier 真 accessor 不能被剔掉', () => {
  const scoped = gate.tableScopedSymbols(
    readText('packages/shared/src/chat/permission-tier.ts'),
    'PERMISSION_TIER_WORD_KEYS',
  )
  assert.ok(scoped.has('permissionTierWordKeys'), '真 accessor 被剔掉 = 门会在缺键上恒绿')
})

test('taro 离线包取法与既有闸同源(生成器格式变了要立即炸)', () => {
  const r = taroBundleViews(readText(gate.TARO_GEN_SCRIPT), readText(gate.TARO_GEN))
  assert.deepEqual(r.remote, ['en', 'ja', 'ko', 'zh-TW'], 'REMOTE_LOCALES 取法漂移')
  assert.deepEqual(r.broken, [], '离线包有语言载荷解不出(需 pnpm gen:i18n)')
})

// ─────────────────────────────────────────────────────────────────────────────
// W6 散落取词 + 判定面(2026-09-25 补,首页 menu.* 事故的回归锁)
// ─────────────────────────────────────────────────────────────────────────────

/** 与 buildKeyUniverse 同一套后缀构造,自检不得另立第二份真相 */
const uni = (leafPaths) => new Set(leafPaths.flatMap((p) => keySuffixes(p)))

test('W6 阳性对照:数组里的 labelKey 从未入库 → 必被抓且点名键/行', () => {
  const src = [
    'const MENU_ITEMS: HomeMenuItem[] = [',
    "  { key: 'Search', labelKey: 'menu.search', icon: Search },",
    "  { key: 'History', labelKey: 'menu.history', icon: History },",
    ']',
  ].join('\n')
  const bad = evaluateScatteredKeys({ file: 'apps/mobile-rn/src/screens/HomeScreen.tsx', text: src, universe: uni(['common.ok']) })
  assert.deepEqual(
    bad.map((b) => `${b.key}@${b.line}`),
    ['menu.search@2', 'menu.history@3'],
    'W6 必须逐键点名(少一条 = 判据没真跑)',
  )
  // 发现层单独钉一次:形状识别与语料判缺是两回事,任一坏了都不得表现为"零违规"
  assert.deepEqual(
    scanScatteredKeys(src).map((h) => `${h.field}=${h.key}:${h.line}`),
    ['labelKey=menu.search:2', 'labelKey=menu.history:3'],
  )
})

test('W6 反例(判据非恒红):入库绝对键 / 相对命名空间 / 裸 key / 非取词属性 / 注释 全放过', () => {
  const universe = uni(['footer.platforms.n8n', 'search.title'])
  const src = [
    "  { key: 'Search', label: 'Search' },", // 属性名不以 Key 结尾 ⇒ 路由名/枚举值,不判
    "  { key: 'Ok', labelKey: 'search.title' },", // 绝对路径已入库
    "  { nameKey: 'platforms.n8n' },", // 相对取词:命名空间在别的文件里,按后缀吸收
    "  { queryKey: 'not.i18n' },", // 非取词属性名单
    "  { label: 'menu.search' },", // 属性名不以 Key 结尾
    "// 注释里写: labelKey: 'menu.search'",
    "/* 块注释: labelKey: 'menu.search' */",
    'const v = t(`search.${dyn}.title`)', // 动态键:静态判据不猜
    'const ok1 = t("search.title")',
    "const ok2 = i18n.t('search.title')",
  ].join('\n')
  assert.deepEqual(
    evaluateScatteredKeys({ file: 'apps/demo/src/x.tsx', text: src, universe }),
    [],
    `反例被误判:${JSON.stringify(evaluateScatteredKeys({ file: 'a', text: src, universe }))}`,
  )
})

test('W6 阳性对照:t()/tt() 直调的未入库键同样必抓', () => {
  const universe = uni(['search.title'])
  const bad = evaluateScatteredKeys({
    file: 'apps/demo/src/y.tsx',
    text: "const a = t('menu.search')\nconst b = tt('menu.history')",
    universe,
  })
  assert.deepEqual(bad.map((b) => b.key).sort(), ['menu.history', 'menu.search'])
})

test('W6 真仓端到端:HomeScreen 现状零违规,把当年那批 menu.* 塞回去即点名', () => {
  const HOME = 'apps/mobile-rn/src/screens/HomeScreen.tsx'
  const universe = buildKeyUniverse(FACE)
  const real = FACE.read(HOME)
  assert.match(real, /labelKey: '[^']+'/)
  assert.deepEqual(evaluateScatteredKeys({ file: HOME, text: real, universe }), [])
  const broken = evaluateScatteredKeys({
    file: HOME,
    text: real.replace(/labelKey: '[^']+'/, "labelKey: 'menu.search'"),
    universe,
  })
  assert.equal(broken.length, 1)
  assert.equal(broken[0].key, 'menu.search')
})

test('W6 棘轮:与 HEAD 齐平放过、超出必红、新文件锚 0(存量数十文件不得变恒红)', () => {
  const mk = (file, n) => [file, Array.from({ length: n }, (_, i) => ({ key: `k${i}`, line: i + 1 }))]
  const pending = new Map([mk('a.tsx', 3), mk('b.tsx', 4), mk('brand-new.tsx', 1)])
  const r = splitScatteredRatchet(pending, (f) => ({ 'a.tsx': 3, 'b.tsx': 3 })[f] ?? 0)
  assert.deepEqual(
    r.fresh.map((x) => x.file).sort(),
    ['b.tsx', 'brand-new.tsx'],
  )
  assert.equal(r.tolerated, 3, '齐平的存量必须只报数不计红')
})

test('判定面:全量入口按 HEAD blob 自报口径,且在 HEAD 上判绿(反恒红)', () => {
  const r = gate.run({ quiet: true })
  try {
    assert.match(r.face, /HEAD/, '全量模式必须自报「HEAD blob」口径')
    assert.equal(r.ok, true, `HEAD 上判红 = 恒红门,唯一结局是各会话 --no-verify:${JSON.stringify(r.failures?.slice(0, 3))}`)
    assert.ok(r.scattered.filesScanned > 3000, 'W6 覆盖面塌了(扫不到文件等于没有这条判据)')
    assert.ok(r.scattered.missingKeys >= 1, 'W6 存量必须如实报数,扫到 0 要先怀疑判据')
    assert.equal(r.scattered.freshFiles, 0, '全量模式判的是 HEAD,新增必须为 0')
    assert.equal(
      r.scattered.inventory.reduce((a, x) => a + x.count, 0),
      r.scattered.missingKeys,
      '--json 必须能还原全量存量清单(文本输出只截 12 行,数字对不上就是报告造假)',
    )
  } finally {
    gate.setActive(gate.makeFaceReader('head'))
  }
})

test('判定面:--staged 判索引 blob 而非滞后的共享工作树', () => {
  const r = gate.run({ staged: true, quiet: true })
  gate.setActive(gate.makeFaceReader('head'))
  assert.match(r.face, /索引/, `--staged 走错了面:${r.face}`)
})

test('判定面:取不到输入是「无法判定」(exit 2 语义),既不冒红也不记绿', () => {
  assert.throws(() => gate.makeFaceReader('nope'), gate.UndeterminedError)
  assert.throws(
    () => gate.makeFaceReader('head').read('packages/definitely-not-here/x.ts'),
    gate.UndeterminedError,
  )
})

test('反混面:CLI 同时给 --staged 与 --worktree 必须 exit 2,不得猜一个面', () => {
  let code = 0
  let err = ''
  try {
    execFileSync(process.execPath, [SRC_FILE, '--staged', '--worktree'], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = e.status
    err = String(e.stderr ?? '')
  }
  assert.equal(code, 2, '两面同给必须按「无法判定」退出')
  assert.match(err, /互斥/)
})

test('判据不得按磁盘读:fs 直读只允许出现在 makeWorktreeReader(人工逃生舱)内', () => {
  const src = readFileSync(SRC_FILE, 'utf8')
  const start = src.indexOf('function makeWorktreeReader')
  const end = src.indexOf('export function makeFaceReader')
  assert.ok(start > 0 && end > start, '取材层结构变了,本断言需随之更新')
  const outside = [...src.matchAll(/\b(?:readFileSync|readdirSync|statSync|existsSync)\s*\(/g)]
    .map((m) => m.index)
    .filter((i) => i < start || i > end)
  assert.deepEqual(outside, [], '判据路径里出现了磁盘直读 —— 混面即假绿(本门口径的命门)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
