// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `scripts/check-monitor-vocabulary-single-source.mjs` 的 §22c 镜像测试(2026-10-31 立)。
//
// 为什么必须存在:本门判的是"监控告警词表有没有第二份",而它的测试若自己再写一份解析规则或
// 一份档位清单,就成了"用另一把尺子量同一件事"—— 门漂移时测试照样绿。所以本文件**只 import
// 生产实现**(§22c),档位成员一律从 HEAD 的 canonical 面**现读**后拼进夹具,旧值 token 一律从
// `LEGACY_STATUS_TOKENS` 取,一条判据都不重抄。
//
// 跑法:`node --test scripts/tests/check-monitor-vocabulary-single-source.test.mjs`

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-monitor-vocabulary-single-source.mjs'
import { catBatch, gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-monitor-vocabulary-single-source.mjs'
const TEST_NAME = 'check-monitor-vocabulary-single-source.test.mjs'

/** git 派生一律显式 stdio + windowsHide(AGENTS §12g:缺省 stdio 在本机稳定 EBUSY)。 */
function gitAt(root, args) {
  return execFileSync(gitBinary(), ['-c', 'safe.directory=*', '-C', root, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  })
}

function commitAll(root, msg) {
  gitAt(root, ['add', '-A'])
  gitAt(root, ['-c', 'user.email=gate@local', '-c', 'user.name=gate', 'commit', '-q', '-m', msg])
}

/** HEAD 面取正文(判的是提交内容,不是可能滞后的共享工作树)。 */
function headFile(rel) {
  return catBatch(ROOT, [`HEAD:${rel}`]).get(`HEAD:${rel}`) ?? null
}

/**
 * 门体与它的镜像测试是同一批落地的,落地前 HEAD 面必然读不到 ⇒ 这两份只从磁盘读自己;
 * 判定用的仓内其它面一律走 headFile(HEAD blob)。
 */
function ownFile(...rel) {
  try {
    return readFileSync(join(ROOT, 'scripts', ...rel), 'utf8')
  } catch {
    return null
  }
}

const KEYS = (r) => r.violations.map((v) => v.key)

/** 端到端跑门体 CLI;stdio 显式给出(AGENTS §12g)。 */
function runGateCli(args, cwd = ROOT) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', SRC_NAME), ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000,
  })
}

const outOf = (r) => `${r.stdout ?? ''}${r.stderr ?? ''}`

/** 真仓档位成员**现读**自 canonical(不在本文件里手抄,§22c)。 */
let realStatuses = null
function statuses() {
  if (!realStatuses) {
    const canon = headFile(gate.CANON.rel)
    assert.ok(typeof canon === 'string' && canon.length > 0, `canonical 取不到:${gate.CANON.rel}`)
    const parsed = gate.parseCanonicalArray(gate.mask(canon), gate.CANON.statusArraySymbol)
    assert.ok(parsed, 'canonical 状态数组解析不到(锚点漂移?)')
    realStatuses = parsed.members
  }
  return realStatuses
}

let auditCache = null
function headAudit() {
  if (!auditCache) auditCache = gate.runAudit({ root: ROOT, face: 'head' })
  return auditCache
}

test('T1 测试不得有第二份真相:只 import 生产实现,门体走统一取材层与单一遮罩', () => {
  const src = ownFile('tests', TEST_NAME)
  const gateSrc = ownFile(SRC_NAME)
  assert.ok(src !== null && gateSrc !== null, '门体或镜像测试不在盘上(交付不完整)')
  assert.match(
    src,
    /from '\.\.\/check-monitor-vocabulary-single-source\.mjs'/,
    '没 import 生产实现',
  )
  // 判据不得在测试里复写:这三把解析器只许从门体拿
  for (const fn of [
    'declarationSites',
    'legacyTokenSites',
    'unguardedRecordIndexSites',
    'inlineUnionSites',
  ]) {
    assert.ok(typeof gate[fn] === 'function', `门体没导出 ${fn} 供镜像复用`)
    assert.equal(
      new RegExp(`function ${fn}\\s*\\(`).test(src),
      false,
      `测试里复写了 ${fn} 的实现(§22c:第二份判据必然漂移)`,
    )
  }
  assert.match(gateSrc, /from '\.\/lib\/face-reader\.mjs'/, '门没引统一取材层')
  assert.match(gateSrc, /catBatch/, '门没经 catBatch 取面')
  // 遮罩与声明形态解析都只许有一份:本门经**守门 200 的单源**转引 lib/code-mask 的 mask,
  // 自己不得再写第三把遮罩器(§0.6 —— 直接 import code-mask 也合法,但两处各写一份注释分词才违规)
  assert.match(
    gateSrc,
    /from '\.\/lib\/code-mask\.mjs'|from '\.\/check-provider-health-vocabulary\.mjs'/,
    '门既没引唯一遮罩实现,也没经守门 200 的单源转引',
  )
  assert.match(
    gateSrc,
    /from '\.\/check-provider-health-vocabulary\.mjs'/,
    '门没复用守门 200 的解析单源',
  )
  assert.doesNotMatch(gateSrc, /function mask\s*\(/, '门自带了第二把遮罩实现(§0.6)')
  assert.doesNotMatch(gateSrc, /readFileSync\(/, '门按磁盘读仓库内容(共享工作树常年滞后 HEAD)')
  assert.doesNotMatch(gateSrc, /'show'/, '门散写 git show 取正文')
  // 反向锁:门体与测试自己确实会命中判据(不然"自豁免"只是把门关掉),而自豁免把它们摘干净
  const legacy = gate.LEGACY_STATUS_TOKENS[0]
  const selfHits = [...gate.legacyTokenSites(gateSrc), ...gate.legacyTokenSites(src)]
  assert.ok(selfHits.length > 0, '自豁免保护的是一份"本来就不会命中"的空集 ⇒ 豁免等于没在保护判据')
  assert.ok(
    selfHits.every((h) => h.token === legacy),
    `自豁免面上的命中必须全部来自旧值 token '${legacy}' 本身,冒出别的 token 就是判据在咬散文`,
  )
  for (const rel of [`scripts/${SRC_NAME}`, `scripts/tests/${TEST_NAME}`]) {
    assert.ok(gate.SELF_EXEMPT_RE.test(rel), `${rel} 不在自豁免面(门会读自己)`)
  }
})

test('T2 canonical 文件自身不命中(W2 具名豁免生效,且豁免不是把门关掉)', () => {
  const canon = headFile(gate.CANON.rel)
  assert.ok(typeof canon === 'string' && canon.length > 0)
  const withExempt = gate.decide({
    canon,
    candidates: [
      { path: gate.CANON.rel, src: canon },
      { path: 'apps/x/quiet.ts', src: 'export const A = 1\n' },
    ],
    canonicalExempt: true,
  })
  assert.deepEqual(
    withExempt.violations.map((v) => v.key),
    [],
    `canonical 自身被判成第二份:${JSON.stringify(withExempt.violations)}`,
  )
  // 成对反向臂:同一份输入只改豁免开关 ⇒ 必红(证明豁免精确,不是整体失明)
  const revoked = gate.decide({
    canon,
    candidates: [
      { path: gate.CANON.rel, src: canon },
      { path: 'apps/x/quiet.ts', src: 'export const A = 1\n' },
    ],
    canonicalExempt: false,
  })
  assert.ok(
    KEYS(revoked).some((k) => k.startsWith('W1|') && k.includes(`|${gate.CANON.rel}|`)),
    `摘掉豁免后 canonical 仍不命中 ⇒ 豁免保护的本来就是空集:${JSON.stringify(KEYS(revoked))}`,
  )
  assert.equal(
    revoked.violations.length,
    withExempt.violations.length + 1,
    '豁免的净效应必须恰好是一枚命中',
  )
})

test('T3 注入一份与 canonical 逐字同值的副本 ⇒ W1 命中(成员集合取自真仓 HEAD 现读)', () => {
  const m = statuses()
  const copy = `export const LOCAL_ALERT_STATUSES = [${m.map((x) => `'${x}'`).join(', ')}] as const\n`
  assert.ok(copy.includes(m[0]), '夹具没真把档位写进去(判据拿不到输入,这一格等于没测)')
  const r = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/web/x/copy.ts', src: copy }],
  })
  assert.ok(
    KEYS(r).includes('W1|apps/web/x/copy.ts|array|LOCAL_ALERT_STATUSES'),
    `同值副本没被抓到:${JSON.stringify(r.violations)}`,
  )
  assert.match(r.violations[0].text, /apps\/web\/x\/copy\.ts:\d+ /, '违规文本必须带行号')
})

test('T4 注入内联联合形态的第二份(崩表事故的真实形态)⇒ 同样命中', () => {
  const m = statuses()
  const src = `export interface Alert { status: ${m.map((x) => `'${x}'`).join(' | ')} }\n`
  const r = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/web/t/types.ts', src }],
  })
  assert.ok(
    KEYS(r).some((k) => k.startsWith('W1|apps/web/t/types.ts|inlineUnion')),
    `内联联合的第二份没被抓到:${JSON.stringify(r.violations)}`,
  )
})

test('T5 注入旧值 token ⇒ W3 命中;token 从 LEGACY_STATUS_TOKENS 取,不在测试里重抄', () => {
  const legacy = gate.LEGACY_STATUS_TOKENS[0]
  assert.ok(
    typeof legacy === 'string' && legacy.length > 0,
    'LEGACY_STATUS_TOKENS 为空 ⇒ W3 这一维等于没装',
  )
  const asUnion = `export interface Alert { status: 'open' | '${legacy}' | 'closed' }\n`
  const asKey = `export const STATUS_LABEL = { open: '甲', ${legacy}: '乙', closed: '丙' }\n`
  const rUnion = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/a/u.ts', src: asUnion }],
  })
  const rKey = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/a/h.ts', src: asKey }],
  })
  assert.ok(
    KEYS(rUnion).some((k) => k.startsWith(`W3|apps/a/u.ts|${legacy}|`)),
    JSON.stringify(KEYS(rUnion)),
  )
  assert.ok(
    KEYS(rKey).some((k) => k.startsWith(`W3|apps/a/h.ts|${legacy}|`)),
    JSON.stringify(KEYS(rKey)),
  )
  // 行号必须指到被点名那一行(本门自写的解析器逐字精确)
  const multiline = `// 一\n// 二\nexport const STATUS_LABEL = { a: 1, ${legacy}: 2 }\n`
  const rLine = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/a/l.ts', src: multiline }],
  })
  assert.ok(
    KEYS(rLine).some((k) => k.endsWith('|3')),
    `行号没指到第 3 行:${JSON.stringify(KEYS(rLine))}`,
  )
})

test('T6 形状坏 / 取不到输入 ⇒ 未判定,不得记绿(§0.3)', () => {
  const noCanon = gate.decide({
    canon: null,
    candidates: [{ path: 'apps/x/a.ts', src: 'export const A = 1\n' }],
  })
  assert.equal(noCanon.statuses, null, 'canonical 缺席却解析出了值域 ⇒ 尺子在自造档位')
  assert.ok(
    noCanon.undetermined.some((u) => u.startsWith('W0')),
    JSON.stringify(noCanon.undetermined),
  )
  assert.equal(noCanon.violations.length, 0, '失明档不得冒红')
  const badAnchor = gate.decide({
    canon: `export const RENAMED_AWAY = ['aa', 'bb'] as const`,
    candidates: null,
  })
  assert.equal(badAnchor.statuses, null, '锚点符号漂移却读出了值域')
  assert.ok(badAnchor.undetermined.some((u) => u.includes(gate.CANON.statusArraySymbol)))
  const missingCand = gate.decide({
    canon: headFile(gate.CANON.rel),
    candidates: [{ path: 'apps/x/gone.ts', src: null }],
  })
  assert.ok(
    missingCand.undetermined.some((u) => u.includes('apps/x/gone.ts')),
    JSON.stringify(missingCand.undetermined),
  )
  assert.equal(missingCand.stats.undeterminedFiles, 1, '取不到的候选必须被计数(报告诚实性)')
})

test('T7 枚举到 0 个候选 ⇒ 未判定,不得记绿(§0.3 明令)', () => {
  const r = gate.decide({ canon: headFile(gate.CANON.rel), candidates: [] })
  assert.equal(r.violations.length, 0)
  assert.ok(
    r.undetermined.some((u) => u.startsWith('W1 候选枚举到 0')),
    JSON.stringify(r.undetermined),
  )
  // 未提供候选(null)与枚举到 0([])必须是两种结论:前者 note、后者判死
  const n = gate.decide({ canon: headFile(gate.CANON.rel), candidates: null })
  assert.equal(n.undetermined.length, 0, '"本轮不判这一维"不该被读成判死')
  assert.ok(n.notes.some((x) => x.startsWith('W1/W3 本轮未提供')))
})

test('T8 真仓 HEAD 面现状:判据非空、canonical 自洽、命中清单如实(存量清单归机主定档)', () => {
  const res = headAudit()
  assert.equal(res.face, 'head')
  assert.deepEqual(res.statuses, statuses(), '门现读的状态集合与 canonical 面不一致')
  assert.equal(
    res.defaultStatus,
    res.statuses[0],
    `库侧默认值现读为 ${res.defaultStatus}(本票立因)`,
  )
  assert.ok(res.stats.candidateFiles > 0, '候选枚举为空 ⇒ 扫描面漂了,这一维等于没跑')
  // canonical 派生形态与血缘:这两格坏了本门就是恒红门
  assert.equal(res.undetermined.length, 0, res.undetermined.join(' | '))
  assert.ok(
    res.violations.every((v) => !v.key.startsWith('W5|') && !v.key.startsWith('W2b|')),
    `canonical 自身已不红是接线前置:${JSON.stringify(res.violations.map((v) => v.key))}`,
  )
  // 存量已归零(2026-10-31 那轮 alerts 六文件修复之后):这三条改成**反向锁** ——
  // 谁把旧值词表或无兜底下标写回来,这里当场红。票面立因仍以 W3 键前缀表达,
  // 但不再是"必须有"而是"必须没有"。
  assert.equal(
    res.violations.filter((v) => v.key.startsWith('W3|')).length,
    0,
    `旧值词表被写回来了(存量已归零,零容忍):${JSON.stringify(res.violations.filter((v) => v.key.startsWith('W3|')).map((v) => v.key))}`,
  )
  assert.ok(res.stats.landingDebt.length >= 1, '库侧 schema 自写默认值必须被登记(票面第一问,仍是报数档)')
  assert.equal(
    res.stats.styleInFamily.length,
    0,
    `本族目录里又出现了无兜底 Record 下标(崩表根因):${JSON.stringify(res.stats.styleInFamily)}`,
  )
  // 默认档不判红,--strict 才判红;且升严只升本族目录那一档,不把别的域一起拽红(§12e)
  assert.ok(
    res.advisories.length > res.stats.styleInFamily.length,
    '射程外那一档必须真的比本族大,否则"两档"是假的',
  )
})

test('T9 预筛超集锁:裸键形态的旧值文件必须进候选面(只搜引号形态 = 判据有牙却够不着)', () => {
  const pre = {
    quoted: [
      ...statuses(),
      ...(
        gate.parseCanonicalArray(
          gate.mask(headFile(gate.CANON.rel)),
          gate.CANON.severityArraySymbol,
        ) || { members: [] }
      ).members,
    ],
    bare: gate.LEGACY_STATUS_TOKENS,
    extraFixed: gate.STYLE_GREP_PATTERNS,
  }
  const withBare = gate.grepCandidates(ROOT, 'head', pre.quoted, pre.bare, pre.extraFixed)
  const quotedOnly = gate.grepCandidates(ROOT, 'head', pre.quoted, [], pre.extraFixed)
  const HELPERS = 'apps/web/app/(main)/admin/monitor/alerts/helpers.ts'
  assert.ok(withBare.includes(HELPERS), `裸键旧值文件没进候选面(这一档失明):${HELPERS}`)
  // 「去掉裸形态就消失」那条已随存量归零失效(2026-10-31 修复后 helpers 只剩 canonical 字面量,
  // 引号形态也命中)⇒ 改成**集合包含**式反向锁:裸形态只许放宽候选面,绝不许收紧。
  assert.ok(
    quotedOnly.every((p) => withBare.includes(p)),
    '裸形态收紧了候选面 —— 那是把判据的牙拔掉,不是优化',
  )
  // 排除项必须是具名硬编码(canonical + 门自己),不是行内标记
  assert.ok(!withBare.includes(gate.CANON.rel), 'canonical 不该进候选(W2 具名豁免)')
  assert.ok(
    withBare.every((p) => !gate.SELF_EXEMPT_RE.test(p)),
    '门不得读自己',
  )
})

test('T10 接线方向锁:头注自称未接 ⇒ runner 里必须真的没有条目(反之亦然)', () => {
  const gateSrc = ownFile(SRC_NAME)
  assert.ok(gateSrc !== null, '门体不在盘上(交付不完整)')
  const runner = headFile('scripts/guardian-runner.mjs') ?? ''
  const registered = runner.includes(SRC_NAME)
  const claimsWired = !/尚未接提交链/.test(gateSrc)
  if (!claimsWired) assert.equal(registered, false, `头注自称未接,runner 却已登记(${SRC_NAME})`)
  else assert.equal(registered, true, '头注自称已接而 runner 无条目(守门 89 R2 会对每次提交判红)')
  // 未接线时 skipEnv 不得被头注当成已承诺的出路(§0.8:文档不许写跑不通的出路)
  if (!registered) assert.doesNotMatch(gateSrc, /HUSKY_SKIP_[A-Z_]*MONITOR[A-Z_]*/)
})

test('T11 端到端(独立仓):存量红按棘轮只报名,新增红必拦,修好后翻绿', () => {
  const dir = mkScratch('monitor-vocab-e2e')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  const canonSrc = `export const ${gate.CANON.statusArraySymbol} = ['aa', 'bb', 'cc'] as const
export type ${gate.CANON.statusTypeSymbol} = (typeof ${gate.CANON.statusArraySymbol})[number]
export const ${gate.CANON.severityArraySymbol} = ['xx', 'yy'] as const
export type ${gate.CANON.severityTypeSymbol} = (typeof ${gate.CANON.severityArraySymbol})[number]
export const ${gate.CANON.defaultSymbol}: ${gate.CANON.statusTypeSymbol} = 'aa'
`
  try {
    put(gate.CANON.rel, canonSrc)
    put('apps/web/legacy.ts', "export const OLD_COLS = ['aa', 'cc', 'bb']\n")
    put('apps/web/usage.ts', "if (s === 'aa') render('aa')\n")
    gitAt(dir, ['init', '-q', '-b', 'main'])
    commitAll(dir, 'init')

    const head = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(head.statuses, ['aa', 'bb', 'cc'], JSON.stringify(head.undetermined))
    assert.ok(
      head.violations.some((v) => v.key === 'W1|apps/web/legacy.ts|array|OLD_COLS'),
      `HEAD 面存量副本没被抓到:${JSON.stringify(head.violations)}`,
    )

    // 索引面新增第二份 ⇒ 只拦新增;HEAD 已红的那枚落 inherited
    put('packages/types/src/new-copy.ts', "export type NewTier = 'cc' | 'bb' | 'aa'\n")
    gitAt(dir, ['add', 'packages/types/src/new-copy.ts'])
    const staged = gate.runAudit({ root: dir, face: 'staged' })
    assert.ok(
      staged.violations.some((v) => v.key === 'W1|packages/types/src/new-copy.ts|union|NewTier'),
      `--staged 没抓住新增副本:${JSON.stringify(staged.violations)}`,
    )
    assert.ok(
      staged.inherited.some((v) => v.key === 'W1|apps/web/legacy.ts|array|OLD_COLS'),
      '--staged 把 HEAD 已红的存量算成新增(恒红方向,§12e)',
    )

    // 两副本都改成不重述档位 ⇒ 必须翻绿(证明红不是恒红)
    put('apps/web/legacy.ts', 'export const OLD_COLS = 1\n')
    put('packages/types/src/new-copy.ts', 'export type NewTier = SomethingElse\n')
    gitAt(dir, ['add', 'apps/web/legacy.ts', 'packages/types/src/new-copy.ts'])
    const fixed = gate.runAudit({ root: dir, face: 'staged' })
    assert.deepEqual(
      fixed.violations.map((v) => v.key),
      [],
      JSON.stringify(fixed.violations),
    )
    assert.equal(fixed.undetermined.length, 0, fixed.undetermined.join(' | '))
  } finally {
    rmScratch(dir)
  }
})

test('T12 端到端 A1 两档:本族目录随 W3 命中入族并可被 --strict 升严;别的域永不判红', () => {
  const dir = mkScratch('monitor-vocab-a1')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    put(
      gate.CANON.rel,
      `export const ${gate.CANON.statusArraySymbol} = ['aa', 'bb', 'cc'] as const
export type ${gate.CANON.statusTypeSymbol} = (typeof ${gate.CANON.statusArraySymbol})[number]
export const ${gate.CANON.severityArraySymbol} = ['xx', 'yy'] as const
export type ${gate.CANON.severityTypeSymbol} = (typeof ${gate.CANON.severityArraySymbol})[number]
export const ${gate.CANON.defaultSymbol}: ${gate.CANON.statusTypeSymbol} = 'aa'
`,
    )
    put(
      'apps/web/app/(main)/admin/monitor/alerts/types.ts',
      `export interface Alert { status: 'active' | '${gate.LEGACY_STATUS_TOKENS[0]}' | 'resolved' }\n`,
    )
    put(
      'apps/web/app/(main)/admin/monitor/alerts/AlertTable.tsx',
      'const st = LEVEL_STYLE[a.level]\nreturn st.icon\n',
    )
    put(
      'apps/web/app/(main)/other/Other.tsx',
      'const st = STATUS_STYLE[item.status]\nreturn st.label\n',
    )
    put('scripts/check-some-gate.mjs', 'const s = FACE_LABEL[face]\nconsole.info(s)\n')
    gitAt(dir, ['init', '-q', '-b', 'main'])
    commitAll(dir, '现状')

    const res = gate.runAudit({ root: dir, face: 'head' })
    assert.ok(
      res.stats.familyDirs.includes('apps/web/app/(main)/admin/monitor/alerts'),
      JSON.stringify(res.stats.familyDirs),
    )
    assert.equal(res.stats.styleInFamily.length, 1, JSON.stringify(res.stats.styleInFamily))
    assert.match(
      res.stats.styleInFamily[0],
      /AlertTable\.tsx:1 LEVEL_STYLE/,
      JSON.stringify(res.stats.styleInFamily),
    )
    assert.ok(
      res.stats.styleOutOfFamily.some((p) => p.includes('Other.tsx')),
      JSON.stringify(res.stats.styleOutOfFamily),
    )
    assert.equal(res.stats.styleScriptsFace, 1, `scripts 面应只计数:${JSON.stringify(res.stats)}`)
    assert.ok(
      res.advisories.every((a) => !a.key.startsWith('A1|scripts/')),
      'scripts 面不得产出一条 advisory(边界⑦的点名承诺)',
    )
    // 别的域那一档永不进升严集合:构造 strict 后的红名单并核对
    const strictRed = [...res.violations, ...res.stats.styleInFamily]
    assert.ok(
      strictRed.every((v) => !String(v.key || v).includes('Other.tsx')),
      '别的域被拽进红名单(§12e 恒红方向)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T13 同面同轮:未提交的副本不得进 HEAD 面,worktree 面必须看见', () => {
  const dir = mkScratch('monitor-vocab-face')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    put(
      gate.CANON.rel,
      `export const ${gate.CANON.statusArraySymbol} = ['aa', 'bb', 'cc'] as const
export type ${gate.CANON.statusTypeSymbol} = (typeof ${gate.CANON.statusArraySymbol})[number]
export const ${gate.CANON.severityArraySymbol} = ['xx', 'yy'] as const
export type ${gate.CANON.severityTypeSymbol} = (typeof ${gate.CANON.severityArraySymbol})[number]
export const ${gate.CANON.defaultSymbol}: ${gate.CANON.statusTypeSymbol} = 'aa'
`,
    )
    put('apps/web/usage.ts', "if (s === 'aa') render('aa')\n")
    gitAt(dir, ['init', '-q', '-b', 'main'])
    commitAll(dir, '干净现状')

    const clean = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(
      clean.violations.map((v) => v.key),
      [],
      JSON.stringify(clean.violations),
    )

    put('apps/web/usage.ts', "export const TIERS = ['aa', 'bb', 'cc'] as const\n")
    const headStill = gate.runAudit({ root: dir, face: 'head' })
    assert.deepEqual(
      headStill.violations.map((v) => v.key),
      [],
      '未提交的副本被判进了 HEAD 面(混面取数)',
    )
    const wt = gate.runAudit({ root: dir, face: 'worktree' })
    assert.ok(
      KEYS(wt).includes('W1|apps/web/usage.ts|array|TIERS'),
      `--worktree 没抓住未提交副本:${JSON.stringify(wt.violations)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T14 CLI 档位:两旗同给必 exit 2 且说清因由;--root 非 worktree 档也必 exit 2', () => {
  const both = runGateCli(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两旗同给 RC=${both.status} 应为 2;输出:${outOf(both)}`)
  assert.match(
    outOf(both),
    /两个判定面互斥/,
    `exit 2 没带互斥的因由 ⇒ 是别的失败冒充的:${outOf(both)}`,
  )
  const badRoot = runGateCli(['--root', ROOT])
  assert.equal(
    badRoot.status,
    2,
    `单旗 --root(非 worktree 档)RC=${badRoot.status} 应为 2:${outOf(badRoot)}`,
  )
  assert.match(outOf(badRoot), /--root 只在 --worktree 档有效/, outOf(badRoot))
})

test('T15 尺子失明判死不记绿:canonical 被摘线 ⇒ CLI 必 exit 2 且不打印合格字样', () => {
  const dir = mkScratch('monitor-vocab-dewired')
  const put = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text, 'utf8')
  }
  try {
    // 摘线形状:下游一切照旧,只有尺子的锚点不存在
    put('apps/web/usage.ts', "if (s === 'aa') render('aa')\n")
    gitAt(dir, ['init', '-q', '-b', 'main'])
    commitAll(dir, 'init')
    const cli = runGateCli(['--root', dir, '--worktree'])
    assert.equal(cli.status, 2, `摘线后门体 CLI 没 exit 2(RC=${cli.status}):${outOf(cli)}`)
    assert.doesNotMatch(cli.stdout ?? '', /✅|对账通过/, `失明被打印成合格证:${cli.stdout}`)
    assert.match(outOf(cli), /W0/, `exit 2 没点名是哪一维失明:${outOf(cli)}`)
    // 配对正向臂:补回 canonical 必须绿 ⇒ 证明那个 2 来自判据,不是恒红(§12e)
    put(
      gate.CANON.rel,
      `export const ${gate.CANON.statusArraySymbol} = ['aa', 'bb', 'cc'] as const
export type ${gate.CANON.statusTypeSymbol} = (typeof ${gate.CANON.statusArraySymbol})[number]
export const ${gate.CANON.severityArraySymbol} = ['xx', 'yy'] as const
export type ${gate.CANON.severityTypeSymbol} = (typeof ${gate.CANON.severityArraySymbol})[number]
export const ${gate.CANON.defaultSymbol}: ${gate.CANON.statusTypeSymbol} = 'aa'
`,
    )
    const fixed = runGateCli(['--root', dir, '--worktree'])
    assert.equal(fixed.status, 0, `补回 canonical 后仍不绿(RC=${fixed.status}):${outOf(fixed)}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
