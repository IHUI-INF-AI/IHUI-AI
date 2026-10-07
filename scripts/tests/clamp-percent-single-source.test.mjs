// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 镜像判据(2026-10-06 收「门维」这一格:判据双实现漂移)。
 *
 * 本文件**不再自带任何违规正则**。改动前它自己写了一份 `INLINE_CLAMP_RE`(3 形态),而门体
 * `scripts/check-percent-clamp-single-source.mjs` 的 PATTERNS 有 5 形态 —— 两份真相实测漂开:
 *   · 门体有、测试没有:`三目 > 100 ? 100`、`三目 < 0 ? 0 : … > 100 ? 100`、`clamp(x, 0, 100)`
 *   · 测试有、门体没有:`Math.max(0, Math.min(x, 100))`(100 写在 min 的**第二个**参数位)
 * 违 AGENTS §22c「禁止在测试文件中复制源函数实现」;而"自带一份"的失效表现是安静的 ——
 * 门体看不见某一形态时,这份测试照样绿。现一律经 `gate.__test__` 裁定(§22d 的 isDirectRun
 * 守卫保证 import 不触发 main)。
 *
 * 「装了什么」与「还在不在」两件事各有一条锁:
 *   ① 形态集合对账(本文件下方):门体不得比这份测试**历史上**覆盖得更窄;确有刻意不拦的形态,
 *      必须由门体注释写明理由(约定标记见 EXCLUSION_MARKER),没有写明就判红 —— 红的是"没交代",
 *      不是"不许收窄"。
 *   ② 预筛必须是判据字面量的超集(门 102 教训,原测试头注自己也写着这条却没做到):PATTERNS 每一
 *      形态都必须能被 PREFILTER_ERE 捞到,否则该形态在站点普查里整型隐身。
 *
 * 存量处置 = 按文件棘轮(基线为空 ⇒ 全量零容忍)。与恒红门的区别写在 AGENTS §12e。
 * 判定面 = HEAD blob(仓规:工作树是别人的在飞现场)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// 判据的权威实现:门体导出的 __test__(不是复制品)。相对说明符 ⇒ 不经 Windows 裸绝对路径 import 那一坑。
import { __test__ as gate } from '../check-percent-clamp-single-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const GATE_FILE = join(ROOT, 'scripts', 'check-percent-clamp-single-source.mjs')

/** 唯一出口:取自门体的同一个常量,不得在此重述路径 */
const CANONICAL_FILE = gate.EXIT_FILE

/**
 * 门体"刻意不拦"的书面约定:门体内形如
 *   // percent-clamp-excludes: <形态描述> · 原因:<……>
 * 的行,构成对该形态不收窄的交代(而不是把形态从测试里删掉装作没这回事)。
 */
const EXCLUSION_MARKER = 'percent-clamp-excludes:'

/** 本测试在漂移修复前独立声明过的形态集合(名字与样本都取自改动前的 HEAD 面)。 */
const HISTORICAL_FORMS = [
  { id: 'A', desc: 'Math.max(0, Math.min(100, x))', src: 'const p = Math.max(0, Math.min(100, progress ?? 0))' },
  { id: 'B', desc: 'Math.max(0, Math.min(x, 100))', src: 'const p = Math.max(0, Math.min(progress ?? 0, 100))' },
  { id: 'C', desc: 'Math.min(100, Math.max(0, x))', src: 'const p = Math.min(100, Math.max(0, value))' },
]

/**
 * 与门体 PATTERNS 一一对应的取样(每条只用来证明"这一形态能被抓进候选行",不参与违规裁定)。
 * why 文案取自 gate.PATTERNS 现值,索引错位即红 ⇒ 新增形态忘补预筛时本文件会喊,而不是静默漏扫。
 */
function patternsProbeFixtures() {
  const known = [
    ['Math.max(0, Math.min(100, …))', 'const pct = Math.max(0, Math.min(100, progress))'],
    ['Math.min(100, Math.max(0, …))', 'const pct = Math.min(100, Math.max(0, progress))'],
    // B 档:常量在 min 的第二参数位 —— 与上一行同语义(裁到 0–100),2026-10-06 由本文件的
    // "形态集合对账"逼出并由门体补上;这条取样同时证明预筛(下一行 PREFILTER_ERE)捞得到它。
    ['Math.max(0, Math.min(x, 100))', 'const pct = Math.max(0, Math.min(progress, 100))'],
    ['三目 > 100 ? 100 : … < 0 ? 0', 'const pct = p > 100 ? 100 : p < 0 ? 0 : p'],
    ['三目 < 0 ? 0 : … > 100 ? 100', 'const pct = p < 0 ? 0 : p > 100 ? 100 : p'],
    ['clamp(x, 0, 100)', 'const pct = clamp(value, 0, 100)'],
  ]
  return gate.PATTERNS.map((p, i) => {
    const hit = known.find(([why]) => p.why === why)
    return { index: i, why: p.why, fixture: hit ? hit[1] : null }
  })
}

/**
 * 预筛(ERE,交给 git grep)——**必须是判据字面量的超集,自己不做任何裁定**。
 * 覆盖四路:Math.max/min 调用、clamp() 调用、`> 100`、`< 0`(两型三目的支点)。
 */
const PREFILTER_ERE = 'Math\\.(max|min)\\(|clamp\\(|>[[:space:]]*100|<[[:space:]]*0'
/** 同一份预筛的 JS 投影(唯一声明在上一行,这里只做 POSIX 字符类→JS 的机械换算,不是第二份定义) */
const prefilterJs = () => new RegExp(PREFILTER_ERE.split('[[:space:]]').join('\\s'))

/** 测试面排除:**取自门体的同一把尺**(gate.TEST_PATH_RE),本文件不再自己判"什么算测试面" */
const isTestFace = (path) => gate.TEST_PATH_RE.test(path)

/** 棘轮基线(路径→处数)。清理该文件后摘条目;基线只减不增;空基线 ⇒ 零容忍。 */
const RATCHET_BASELINE = {}

/** 裁定:一条预筛输出(HEAD:path:line:content)是否构成违规 —— 违规与否一律问 gate.findSites */
function judgeLine(raw) {
  const m = raw.match(/^HEAD:([^:]+):(\d+):(.*)$/)
  if (!m) return null
  const [, path, line, content] = m
  if (path === CANONICAL_FILE) return null
  if (isTestFace(path)) return null
  const hits = gate.findSites(content)
  if (hits.length === 0) return null
  return { path, line: Number(line), content: content.trim(), why: hits.map((h) => h.why) }
}

/** 预筛:HEAD 面上的候选行(超集,不做判定) */
function candidateLines(pattern) {
  try {
    return execFileSync('git', ['-C', ROOT, 'grep', '-n', '-E', pattern, 'HEAD', '--', 'apps', 'packages'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch (error) {
    // git grep exit 1 = 零候选(判定面干净);其他码才是取材失败,不得记绿
    if (error && (error.status === 1 || error.code === 1)) return []
    throw error
  }
}

function currentViolations() {
  const byFile = new Map()
  for (const v of candidateLines(PREFILTER_ERE).map(judgeLine).filter(Boolean)) {
    byFile.set(v.path, (byFile.get(v.path) ?? 0) + 1)
  }
  return byFile
}

/** 读门体源码里书面交代过的"刻意不拦"清单(门体是被调用的工具,不是被审内容 ⇒ 读盘正当) */
function gateExclusionNotes() {
  let text
  try {
    text = readFileSync(GATE_FILE, 'utf8')
  } catch (e) {
    throw new Error(`门体文件读不到 ⇒ 形态集合对账无从进行(不得记为通过):${e.message}`)
  }
  return text
    .split(/\r?\n/)
    .filter((l) => l.includes(EXCLUSION_MARKER))
    .map((l) => l.slice(l.indexOf(EXCLUSION_MARKER) + EXCLUSION_MARKER.length).trim())
}

test('形态集合对账(§22c 反漂移):门体不得比本测试历史上覆盖得更窄,收窄必须书面交代', () => {
  const notes = gateExclusionNotes()
  const uncoveredWithoutNote = []
  for (const f of HISTORICAL_FORMS) {
    const covered = gate.findSites(f.src).length >= 1
    if (covered) continue
    const documented = notes.some((n) => n.includes(f.desc))
    if (!documented) uncoveredWithoutNote.push(`${f.id} ${f.desc}`)
  }
  assert.deepEqual(
    uncoveredWithoutNote,
    [],
    [
      `门体 PATTERNS 覆盖不到的形态,既没拦也没在注释里交代(§22c「禁止在测试文件中复制源函数实现」的成因就是这里:),`,
      `两条正当出路二选一 ——`,
      `  ① 给门体 PATTERNS 补这条形态(收紧,默认正确方向);`,
      `  ② 确属刻意不拦,在门体写一行:  // ${EXCLUSION_MARKER} <形态描述> · 原因:<为什么不是百分比裁剪>`,
      `未交代的形态:${uncoveredWithoutNote.join(' | ')}`,
      `禁止的第三种做法:把这条形态从本文件的 HISTORICAL_FORMS 里删掉装作没这回事。`,
    ].join('\n'),
  )
})

test('预筛必须是判据字面量的超集:门体每一形态都要能被候选行捞到(门 102 教训)', () => {
  const re = prefilterJs()
  const missed = []
  for (const p of patternsProbeFixtures()) {
    if (p.fixture === null) {
      missed.push(`#${p.index} 门体新增形态 ${JSON.stringify(p.why)} 没有对应取样 ⇒ 无法证明预筛覆盖它`)
      continue
    }
    // 该形态必须真是门体的形态(自证 fixture 会命中),又必须进候选行(预筛是超集)
    if (gate.findSites(p.fixture).length === 0) missed.push(`#${p.index} ${p.why}:自证 fixture 未被门体命中 ⇒ fixture 过期`)
    else if (!re.test(p.fixture)) missed.push(`#${p.index} ${p.why}:命中了但预筛捞不到 ⇒ 该形态在普查中整型隐身`)
  }
  assert.deepEqual(missed, [], `预筛窄于判据:\n${missed.join('\n')}`)
})

test('G-815966 镜像判据(棘轮):基线外文件零内联百分比钳位,基线内不得增多', () => {
  const byFile = currentViolations()
  const offenders = []
  for (const [path, count] of byFile) {
    const allowed = RATCHET_BASELINE[path] ?? 0
    if (count > allowed) offenders.push(`${path}: ${count} 处 > 基线 ${allowed}`)
  }
  assert.deepEqual(
    offenders,
    [],
    `同一百分比裁剪出现了第二份内联实现——改走具名出口 import { clampPercent } from '@ihui/shared/utils/clamp-percent':\n${offenders.join('\n')}`,
  )
})

test('基线卫生:条目必须真实(已清零的文件要摘条目;基线文件消失=清单腐烂)', () => {
  const byFile = currentViolations()
  const staleZero = Object.keys(RATCHET_BASELINE).filter((p) => !byFile.has(p))
  assert.deepEqual(
    staleZero,
    [],
    `以下基线条目当前已零命中——清理完成后请从 RATCHET_BASELINE 摘除它们(基线只减不增):\n${staleZero.join('\n')}`,
  )
})

test('基线为空 ⇒ 语义必须是零容忍(不得被读成"什么都不判")', () => {
  assert.deepEqual(RATCHET_BASELINE, {}, '基线仍为空:此刻任何基线外/基线内的内联百分比钳位都必须判红')
  assert.equal(currentViolations().size, 0, '基线空而普查仍有站点 ⇒ 上面那条棘轮断言本应已经红')
})

test('正反成对(判据必须有牙,且不得误伤)——裁定一律走门体导出:', () => {
  const probe = (src, path = 'apps/web/src/__census_fixture__.ts') => judgeLine(`HEAD:${path}:9:${src}`)
  // 阳:门体每一种形态在无关生产文件里都必须被判(形态清单取自 gate.PATTERNS 现值,不在此另立)
  const positives = patternsProbeFixtures().map((p) => p.fixture)
  for (const bad of positives) {
    if (bad === null) continue
    assert.ok(probe(bad), `漏判:${bad}`)
  }
  // 阴:唯一出口本体 / 测试面(按门体那把尺)/ 非 0..100 档 / 仅候选无钳位 / 注释里的旧形态示例
  assert.equal(probe('  return Math.max(0, Math.min(100, value))', CANONICAL_FILE), null)
  assert.equal(probe('const p = Math.max(0, Math.min(100, v))', 'apps/web/src/ui/__tests__/widget.ts'), null)
  assert.equal(probe('const n = Math.max(0, Math.min(1, ratio))'), null, '0..1 归一化不属百分比这一维')
  assert.equal(probe('const m = Math.max(0, Math.min(idx, list.length - 1))'), null, '索引钳位不属百分比这一维')
  assert.equal(probe('const m = Math.max(a, b)'), null)
  assert.equal(probe('const m = v > 1 && v < 9 ? 1 : 0'), null, '与 100/0 无关的三目不得误伤')
  // 注释/字符串里的同形态由门体的等长遮罩排除(本文件不自己剥注释 ⇒ 没有第二份遮罩实现)
  assert.equal(probe('// 旧形态 Math.max(0, Math.min(100, …)) 逐处手搓,已收口'), null)
  assert.equal(probe('const doc = "写法 Math.max(0, Math.min(100, p)) 已废"'), null)
})

test('取景口径对账:测试面排除用的必须是门体那把尺,本文件不得再有第二份', () => {
  // 正面:同名不同形态的测试路径,门体排除 ⇒ 本测试也排除(两侧结论必须同形,因为只有一份实现)
  for (const p of ['apps/web/src/x/__tests__/y.ts', 'packages/app/tests/z.ts', 'apps/api/e2e/w.ts', 'packages/types/test/v.ts']) {
    assert.equal(isTestFace(p), true, `${p} 应被门体的 TEST_PATH_RE 排除`)
  }
  // 如实登记与改动前的**一处语义差**:改动前本文件自己额外排除了「文件名以 .test.ts 结尾」,
  // 而门体只按目录形态排除 ⇒ 直白把它测出来(这一格门体**会**判站点),别让下一个人以为两侧同形,
  // 也不许为了复刻旧的第二份排除而在这里再写一遍路径判据。
  assert.equal(isTestFace('apps/web/src/components/foo.test.ts'), false)
  assert.notEqual(
    judgeLine('HEAD:apps/web/src/components/foo.test.ts:9:const p = Math.max(0, Math.min(100, v))'),
    null,
    '已知差异:门体按目录排除测试面,src 下的 *.test.ts 仍算站点(真仓 HEAD 现读该类文件零命中 ⇒ 无存量)',
  )
})

test('装车证明:具名出口必须仍有生产调用方(防"判据在、出口被摘线后无人用")', () => {
  const users = new Set()
  for (const raw of candidateLines('clampPercent')) {
    const m = raw.match(/^HEAD:([^:]+):/)
    if (!m) continue
    const path = m[1]
    if (path === CANONICAL_FILE || isTestFace(path)) continue
    users.add(path)
  }
  assert.ok(users.size >= 1, `clampPercent 生产面零调用方(现读:${[...users].join(',') || '无'})——出口被摘线或改名时本断言红`)
})

test('门体导出面存在性:测试依赖的判据符号缺任何一个即红(防"import 到 undefined 照样绿")', () => {
  for (const key of ['PATTERNS', 'findSites', 'countSites', 'decide', 'EXIT_FILE', 'TEST_PATH_RE']) {
    assert.notEqual(gate[key], undefined, `门体未导出 ${key} ⇒ 本文件对它的所有断言都是空转`)
  }
  assert.ok(Array.isArray(gate.PATTERNS) && gate.PATTERNS.length >= 1, `门体 PATTERNS 为空 ⇒ 形态集合对账与预筛超集两条判据同时失明`)
})
