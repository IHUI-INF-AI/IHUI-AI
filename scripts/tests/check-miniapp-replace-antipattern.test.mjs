// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-miniapp-replace-antipattern.mjs`(miniapp-taro ICU 反模式静态扫描)。
 *
 * 判据一律走门体导出的 `__test__`(HIT_PATTERNS / WHITELIST_PATTERNS / getWhitelistHit /
 * dedupFindings / posToLineCol / buildSnippet),测试里不再抄第二份形态清单 —— 抄了就有了
 * 第二条真相:门体漏某一形态时测试照样绿(§22c 红线,守门 191 `check-test-judge-not-replicated.mjs`
 * 专拦这一型)。
 *
 * 断言输入的出处(§22c 最后一条红线:不得全部自造夹具):
 *   · 真面 = `git show HEAD:apps/miniapp-taro/src/**`(catBatch 现读),整份真 HEAD 文件写进
 *     scratch 演练树跑 CLI ⇒ 必须零命中;白名单站点行也从真面里**按门体读数**找出来;
 *   · 阳性面 = 在同一份真 HEAD 文本上**内存内**插一条反模式调用(构造面变异),真仓文件与门体都不改;
 *   · CLI 报的 line/col/snippet 与门体自己导出的 posToLineCol/buildSnippet 交叉对账 —— 两处若各
 *     有一份截取逻辑,这里就会分叉。
 *
 * 覆盖锁:用例表按 `gate.HIT_PATTERNS` / `gate.WHITELIST_PATTERNS` 的 id 现枚举,门体新增形态而
 * 测试未补夹具时本文件立刻红(而不是"多一条形态没人判")。
 *
 * 派生一律 `stdio:['ignore','pipe','pipe']` + `windowsHide: true`(§12g),临时树只经
 * `scripts/lib/scratch-dir.mjs` 的 mkScratch/rmScratch。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-miniapp-replace-antipattern.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_PATH = join(REPO, 'scripts', 'check-miniapp-replace-antipattern.mjs')
const ANSI = /\x1b\[[0-9;]*m/g

/** ICU 占位符的书写件(拼接:夹具里只当数据出现,不作为第二份判据)。 */
const OBR = ['{{'].join('')
const CBR = ['}}'].join('')

const stripAnsi = (s) => String(s ?? '').replace(ANSI, '')

function runGate(args, cwd) {
  const r = spawnSync(process.execPath, [GATE_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
    maxBuffer: 1 << 26,
  })
  return { rc: r.status, out: stripAnsi(r.stdout), err: stripAnsi(r.stderr), all: stripAnsi(r.stdout) + stripAnsi(r.stderr) }
}

function runGateJson(args, cwd) {
  const r = runGate([...args, '--json'], cwd)
  let json = null
  try {
    json = JSON.parse(r.out)
  } catch {
    json = null
  }
  return { ...r, json }
}

function gitIn(root, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${stripAnsi(r.stderr)}`)
  return String(r.stdout ?? '')
}

/** 规则 id 现枚举自门体(写死 A/B/C 就是第二条真相)。 */
const HIT_IDS = gate.HIT_PATTERNS.map((p) => p.id)
const WL_IDS = gate.WHITELIST_PATTERNS.map((w) => w.id)

/** 一行文本被哪几条命中规则打到 —— 只用门体的正则。 */
function hitsOf(text) {
  return gate.HIT_PATTERNS.filter((p) => (text.match(p.re) || []).length > 0).map((p) => p.id)
}

/** 取一行里的第一个单引号串(真面键名的现读出处,不手抄)。 */
function firstQuoted(text) {
  const rest = text.slice(text.indexOf("'") + 1)
  return rest.slice(0, rest.indexOf("'"))
}

// ── 真仓 HEAD 面(加载期一次批量现读) ────────────────────────────────────
const REAL_SPECS = [
  'HEAD:apps/miniapp-taro/src/components/LearningStreak.tsx',
  'HEAD:apps/miniapp-taro/src/components/AgentRuntimePanel.tsx',
  'HEAD:apps/miniapp-taro/src/app.tsx',
  'HEAD:apps/miniapp-taro/src/lib/image-preview-pack.ts',
]
const REAL_BATCH = catBatch(REPO, REAL_SPECS)
const REAL_FACES = REAL_SPECS.map((spec) => {
  const text = REAL_BATCH.get(spec)
  assert.equal(typeof text, 'string', `${spec} 取不到 HEAD blob ⇒ 无法判定(不回落磁盘那一面)`)
  return { spec, rel: spec.slice('HEAD:'.length), text, lines: text.split(/\r?\n/) }
})

function findRealLine(where, faces = REAL_FACES) {
  for (const face of faces) {
    const line = face.lines.map((l) => l.trim()).find(where)
    if (line) return { face, line }
  }
  return null
}

/** 按门体读数从真面里找各白名单型的站点行(找到才算"真面在位")。 */
const REAL_WL_SITES = new Map(
  WL_IDS.map((wid) => [
    wid,
    findRealLine((l) => hitsOf(l).length === 0 && gate.getWhitelistHit(l)?.id === wid),
  ]),
)

const REAL_STREAK = REAL_FACES.find((f) => f.rel.endsWith('LearningStreak.tsx'))
assert.ok(REAL_STREAK, '取材清单里读不到 LearningStreak.tsx 的 HEAD 面 ⇒ 现读通道断了')
/** 阳性对照钉在**同一份真面**上:改写的就是这一行,还原它必须零命中。 */
const REAL_ICU =
  findRealLine((l) => hitsOf(l).length === 0 && gate.getWhitelistHit(l)?.id === WL_IDS[0], [REAL_STREAK]) ||
  findRealLine((l) => l.includes('t(') && l.includes('{'), [REAL_STREAK])
assert.ok(REAL_ICU, '真面里找不到 variables 形的调用点 ⇒ 阳性对照失去了同源')
const REAL_KEY = firstQuoted(REAL_ICU.line)

/** 阳性夹具:把真 HEAD 行的 variables 形改写成 .replace 通道(只在内存里)。 */
function toReplaceChannelFace(key) {
  return `t('${key}', '连续 ${OBR}n${CBR} 天').replace('${OBR}n${CBR}', streakDays)`
}

/** 按 id 取阳性夹具:每条命中规则各一条。 */
function hitArmFor(id) {
  if (id === HIT_IDS[0]) return toReplaceChannelFace(REAL_KEY)
  if (id === HIT_IDS[1]) return `t('${REAL_KEY}').replace('${OBR}n${CBR}', streakDays)`
  // 兜底那条(C)刻意不带 t()/tt() 前缀,也不给 .replace 传第二个参数,
  // 否则会被更具体的规则先吃掉或根本落不进 C 的形状,这一格等于没判
  return `renderNote("${REAL_KEY} ${OBR}n${CBR}").replace("${OBR}n${CBR}", streakDays)`
}

/** 按 id 取白名单夹具:能真读到的用真面行,读不到的用拼接夹具(如实标注来源)。 */
function whitelistArmFor(id) {
  const real = REAL_WL_SITES.get(id)
  if (real) return { text: real.line, source: real.face.rel }
  if (id === WL_IDS[1]) return { text: `tt('${REAL_KEY}', 'fb ${OBR}n${CBR}', { n: streakDays })`, source: 'constructed' }
  return { text: `t('${REAL_KEY}', params ?? {})`, source: 'constructed' }
}

test('M0 import 门体不得触发 CLI(§22d 双形态守卫 = §22c 通道的前提)', () => {
  for (const k of ['HIT_PATTERNS', 'WHITELIST_PATTERNS', 'getWhitelistHit', 'dedupFindings', 'posToLineCol', 'buildSnippet']) {
    assert.ok(k in gate, `__test__ 缺导出 ${k} ⇒ 测试只能另抄一份判据(§22c 红线)`)
  }
  assert.ok(Array.isArray(gate.HIT_PATTERNS) && gate.HIT_PATTERNS.length > 0, '命中规则清单为空 ⇒ 尺子失明')
  assert.ok(Array.isArray(gate.WHITELIST_PATTERNS) && gate.WHITELIST_PATTERNS.length > 0, '白名单清单为空 ⇒ 放行通道不存在')

  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(GATE_PATH).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  const out = stripAnsi(r.stdout)
  assert.match(out, /__IMPORTED__/, `import 门体失败:${out}${stripAnsi(r.stderr)}`)
  assert.doesNotMatch(out, /\[scan\]/, 'import 门体就跑掉了扫描主流程 ⇒ 顶层裸 main() 回来了')
})

test('M1 真仓 HEAD 现读面必须逐行零命中(逐字真站点,不是自造夹具)', () => {
  let checked = 0
  for (const f of REAL_FACES) {
    for (const l of f.lines) {
      assert.deepEqual(hitsOf(l), [], `${f.rel} 的一行真面被判成反模式:${JSON.stringify(l.trim().slice(0, 120))}`)
      checked += 1
    }
  }
  assert.ok(checked > 200, `只扫到 ${checked} 行真面 ⇒ 取材面失效,这条断言无从证明什么`)

  const docLine = findRealLine((l) => l.includes(OBR) && l.includes('.replace') && hitsOf(l).length === 0)
  assert.ok(docLine, '真面里找不到「含占位符 + .replace 却零命中」的那一行(门体的文档注释形态) ⇒ 面漂了')
  assert.equal(
    gate.getWhitelistHit(docLine.line),
    null,
    `注释行 ${docLine.line} 是靠白名单兜住的 ⇒ 文档散文被当成了调用点,放行理由不成立`,
  )
})

test('M2 每条命中规则各有阳性对照,且不得被白名单放行(一正一反配对)', () => {
  for (const p of gate.HIT_PATTERNS) {
    assert.equal(p.severity, 'block', `规则 ${p.id} 的定级不再是 block ⇒ 这一格拦不住提交,需改判据而不是改测试`)
    const arm = hitArmFor(p.id)
    assert.ok(hitsOf(arm).includes(p.id), `规则 ${p.id} 的阳性夹具打不到自己:${JSON.stringify(arm)} ⇒ 先疑尺子(门体正则被摘?)`)
    assert.equal(gate.getWhitelistHit(arm), null, `规则 ${p.id} 的阳性夹具同时被放行 ⇒ 该格恒绿:${JSON.stringify(arm)}`)
  }
  assert.deepEqual(hitsOf(REAL_ICU.line), [], `真 HEAD 的合法 ICU 写法被判红:${JSON.stringify(REAL_ICU.line)}`)
})

test('M3 白名单五型各有站点,真面站点逐字取自 HEAD', () => {
  let realSites = 0
  for (const id of WL_IDS) {
    const arm = whitelistArmFor(id)
    const got = gate.getWhitelistHit(arm.text)
    assert.ok(got, `白名单 ${id} 没有任何站点能证明它生效:${JSON.stringify(arm.text)}`)
    assert.equal(got.id, id, `${id} 的站点被读成了 ${got.id} ⇒ 五型之间有遮蔽,需点名是哪一条`)
    if (arm.source !== 'constructed') realSites += 1
  }
  assert.ok(realSites >= 1, '白名单站点全部自造 ⇒ 违反 §22c「不得全部用自造夹具」')
  for (const id of HIT_IDS) assert.equal(gate.getWhitelistHit(hitArmFor(id)), null, `${id} 阳性面被放行 ⇒ 白名单过宽`)
})

test('M4 CLI 端到端:整份真 HEAD 文件零命中,内存变异必命中且行/列/摘要与门体自证一致', () => {
  const root = mkScratch('ihui-miniapp-replace-')
  try {
    const relInTree = join('apps', 'miniapp-taro', 'src', 'probe', 'learning-streak.tsx')
    const absInTree = join(root, relInTree)
    mkdirSync(dirname(absInTree), { recursive: true })

    writeFileSync(absInTree, REAL_STREAK.text, 'utf8')
    const silentRun = runGateJson([], root)
    assert.equal(silentRun.rc, 0, `真 HEAD 面在演练树里被判红,实得 ${silentRun.rc}:${silentRun.all.slice(0, 400)}`)
    assert.equal(silentRun.json.hitCount, 0, JSON.stringify(silentRun.json.findings))
    assert.ok(silentRun.json.scannedCount >= 1, `扫描面为空:${JSON.stringify(silentRun.json)}`)
    assert.equal(silentRun.json.scanMode, 'full')

    const mutationLine = toReplaceChannelFace(REAL_KEY)
    const mutated = `${REAL_STREAK.text}\nexport const BrokenProbe = () => <Text>{${mutationLine}}</Text>\n`
    writeFileSync(absInTree, mutated, 'utf8')
    const hit = runGateJson([], root)
    assert.equal(hit.rc, 1, `注入反模式必须判红,实得 ${hit.rc}:${hit.all.slice(0, 400)}`)
    assert.equal(hit.json.hitCount, 1, JSON.stringify(hit.json.findings))
    const f = hit.json.findings[0]

    const src = readFileSync(absInTree, 'utf8')
    const pos = src.indexOf(mutationLine)
    assert.ok(pos >= 0, '变异行没写进演练树 ⇒ 上面几条无从判定')
    const pat = gate.HIT_PATTERNS.find((p) => p.id === f.pattern)
    assert.ok(pat, `CLI 报了门体清单里没有的形态 ${f.pattern}`)
    // 用门体自己的正则现定位命中区间(去掉 g 只为拿 index,不新增形态)
    const spanRe = new RegExp(pat.re.source, pat.re.flags.replace('g', ''))
    const span = spanRe.exec(src.slice(pos))
    assert.ok(span, '注入行里门体正则反而定位不到 ⇒ 报告与判据分叉')
    const start = pos + span.index
    const expect = gate.posToLineCol(src, start)
    assert.equal(f.pattern, HIT_IDS[0], `注入的是最具体的那一型,却读成了 ${f.pattern}`)
    assert.equal(f.line, expect.line, `CLI 行号与门体自己的 posToLineCol 不一致:${JSON.stringify({ cli: f.line, helper: expect })}`)
    assert.equal(f.col, expect.col, `CLI 列号与 posToLineCol 不一致:${JSON.stringify({ cli: f.col, helper: expect })}`)
    assert.equal(f.file, relInTree.split(/[\\/]/).join('/'), `相对路径写法漂了:${f.file}`)
    assert.equal(
      f.snippet,
      gate.buildSnippet(src, start, start + span[0].length),
      'CLI 的上下文摘取与门体自己的 buildSnippet 分叉 ⇒ 两处各有一份截取逻辑',
    )
    assert.match(f.reason, /SSR|ICU|replace/, `命中理由是空话:${f.reason}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('M5 --staged 只算新增行:暂存注入必红,入库成存量后放行(免得逼人跳钩子)', () => {
  const root = mkScratch('ihui-miniapp-staged-')
  try {
    const rel = 'apps/miniapp-taro/src/pages/probe-staged.tsx'
    const abs = join(root, ...rel.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    gitIn(root, ['init', '--quiet'])
    gitIn(root, ['config', 'user.email', 'gate-test@example.invalid'])
    gitIn(root, ['config', 'user.name', 'gate-test'])

    const mutationLine = toReplaceChannelFace(REAL_KEY)
    writeFileSync(abs, `export const Broken = () => <Text>{${mutationLine}}</Text>\n`, 'utf8')
    gitIn(root, ['add', '--', rel])
    const staged = runGateJson(['--staged'], root)
    assert.equal(staged.rc, 1, `新增行带反模式必须判红,实得 ${staged.rc}:${staged.all.slice(0, 400)}`)
    assert.equal(staged.json.scanMode, 'staged', JSON.stringify(staged.json && staged.json.scanMode))
    assert.equal(staged.json.hitCount, 1, JSON.stringify(staged.json && staged.json.findings))

    gitIn(root, ['commit', '--quiet', '-m', 'gate-test: 存量入库'])
    const stock = runGate(['--staged'], root)
    assert.equal(stock.rc, 0, `同一枚内容入库后不该算在本次头上:${stock.all.slice(0, 300)}`)
    const fullStock = runGate([], root)
    assert.equal(fullStock.rc, 1, `全量档对同一份存量必须仍然报红(两档口径不同,串了就有洞):${fullStock.all.slice(0, 300)}`)
  } finally {
    rmScratch(root, { bestEffort: true })
  }
})

test('M6 dedupFindings 同 file+line 只留最具体的一条,跨行不并桶', () => {
  const most = HIT_IDS[0]
  const least = HIT_IDS[HIT_IDS.length - 1]
  const sameLine = gate.dedupFindings([
    { file: 'a.tsx', line: 7, pattern: least },
    { file: 'a.tsx', line: 7, pattern: most },
  ])
  assert.equal(sameLine.length, 1, JSON.stringify(sameLine))
  assert.equal(sameLine[0].pattern, most, `并桶留下了 ${sameLine[0].pattern} 而不是更具体的 ${most}`)

  const twoFiles = gate.dedupFindings([
    { file: 'b.tsx', line: 9, pattern: least },
    { file: 'a.tsx', line: 3, pattern: most },
  ])
  assert.equal(twoFiles.length, 2, '跨文件的命中不该被并掉(并错了就少报一处)')
  assert.deepEqual(twoFiles.map((x) => `${x.file}:${x.line}`), ['a.tsx:3', 'b.tsx:9'], `排序没锁住:${JSON.stringify(twoFiles)}`)
})

test('M7 posToLineCol / buildSnippet 在真面上的读数(1-based、折叠空白、160 上限)', () => {
  const src = REAL_STREAK.text
  assert.deepEqual(gate.posToLineCol(src, 0), { line: 1, col: 1 }, '首字符必须是 1:1')

  const needle = REAL_ICU.line
  const pos = src.indexOf(needle)
  assert.ok(pos >= 0, '真面行在取材文件里取不到偏移 ⇒ 现读面与断言面不是同一份')
  const lc = gate.posToLineCol(src, pos)
  assert.ok(lc.line > 1, JSON.stringify(lc))
  const lineAt = src.split(/\r?\n/)[lc.line - 1].trim()
  assert.equal(lineAt, needle, `posToLineCol 报的行不是那一行:${JSON.stringify(lineAt.slice(0, 80))}`)

  const short = gate.buildSnippet(src, pos, pos + needle.length)
  assert.equal(short, needle.replace(/\s+/g, ' '), '短上下文本应逐字还原')
  assert.ok(!/\n/.test(short), 'snippet 必须是单行')

  const longFace = `${needle} ${'x'.repeat(300)}`
  const truncated = gate.buildSnippet(longFace, 0, longFace.length)
  assert.ok(truncated.length <= 160, `超长 snippet 没被夹住:${truncated.length}`)
  assert.ok(truncated.includes('…'), `截断必须留可见记号:${truncated}`)
})

test('M8 测试不得重写判据(本文件只许调用门体导出的符号)', () => {
  const own = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.ok(
    own.includes("import { __test__ as gate } from '../check-miniapp-replace-antipattern.mjs'"),
    '§22c 锚点:必须 import 门体导出的判据',
  )
  for (const name of Object.keys(gate)) {
    assert.ok(!own.includes(`function ${name}(`), `测试里出现了第二份 ${name} ⇒ 镜像从防线变成漂移的掩体`)
    assert.ok(!own.includes(`const ${name} =`), `测试里重新声明了 ${name}`)
  }
  // 反抄锁:门体形态清单的原文一条都不许出现在测试里(出现即两份真相)
  for (const p of gate.HIT_PATTERNS) {
    assert.ok(!own.includes(p.re.source), `形态 ${p.id} 的正则原文被抄进测试 ⇒ §22c 红线,门体一改测试就静默失效`)
  }
  for (const w of gate.WHITELIST_PATTERNS) {
    assert.ok(!own.includes(w.re.source), `白名单 ${w.id} 的正则原文被抄进测试 ⇒ 同上`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
