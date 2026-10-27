// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 合并面「活文档状态放大」闸的镜像测试(§22c:判据一律 import 生产导出,测试里零复制)。
//
// 立因(2026-10-27 现读):`scripts/git-sync-converge.mjs` 的 `mergedPlanStateRegressions`
// 在**无冲突合并**这一支给合并结果定罪时,用的是**没有结构化侧车的散文面**
// (`auditPlan(merged)` 少传 `fields`),而过滤面(派单出口 / 门 130 F11·F12 / 兜底清扫器
// `strip-banned-buckets.mjs`)吃的是 `dispositionOfV2`(侧车 ⊕ 散文)那一把尺。
// 同一件事两把尺(§0.6 违例)的后果是假红:合并面 `G-395…` 侧车已改判 owned-elsewhere、
// 散文面仍读成 waiting-human ⇒ 「F11 等人拍板 出现基线键集里没有的未勾行」拦下**全仓推送**
// —— 与提交内容无关的红,唯一结局是逼人 `--no-verify`(§12e)。
//
// 本文件的纪律:每一枚"不再定罪"的反向对照,都必须配一枚"摘掉单源接线即翻红"的对照,
// 否则"修好"与"把判据删了"在账面上同形。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 判据只有一份:下面这些 import 全是生产实现本身(§22c),测试不另写一把尺。
import { auditPlan, compositeKeyOf, dispositionOfV2 } from '../lib/plan-task-index.mjs'
import { loadFields } from '../lib/plan-fields.mjs'
import { narrowF9Face, probe, ratchetViolations } from '../plan-tasks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_PATH = resolve(HERE, '..', 'git-sync-converge.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')

const CONV = await import(import.meta.resolve('../git-sync-converge.mjs'))
await CONV.ensureUnionModule()
assert.ok(
  CONV.unionGate.mod,
  `union-converge 必须装载成功(它承载第①把尺子),实测 ${CONV.unionGate.error}`,
)

const BASELINE = { F1: 0, F2: 0, F3: 0, F4: 0, F4b: 0, F5: 0, F6: 0, F9: [], F11: [], F12: [] }

const gitAt = (repo, args) =>
  execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    // §12g:派生 git 必须显式接管 stdio;§5b:windowsHide
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

/**
 * 把一枚"合并面"落成夹具仓的一次提交,并把同一个 sha 同时当 merged/local/remote 传进去
 * —— 第①把尺子(相对两侧上限)在这种面上恒返回 [],于是本文件量到的每一条都出自
 * 第②把尺子(相对入库基线),也就是出事故的那一支。夹具仓一律落 mkScratch(工作树外,
 * 门 208 禁的是仓内 git init 夹具)。
 */
function landFace({ plan, fields, baseline = BASELINE, withSidecarFile = true }) {
  const dir = mkScratch('git-sync-converge-amplify-')
  const repo = join(dir, 'repo')
  mkdirSync(join(repo, 'scripts/data'), { recursive: true })
  gitAt(repo, ['init', '-q', '-b', 'main'])
  writeFileSync(join(repo, 'PROJECT_PLAN.md'), plan, 'utf8')
  if (withSidecarFile)
    writeFileSync(join(repo, 'scripts/data/plan-fields.jsonl'), fields ?? '', 'utf8')
  writeFileSync(
    join(repo, 'scripts/plan-task-state-baseline.json'),
    JSON.stringify(baseline) + '\n',
    'utf8',
  )
  gitAt(repo, ['add', '-A'])
  gitAt(repo, [
    '-c',
    'user.name=mirror-fixture',
    '-c',
    'user.email=mirror@example.invalid',
    'commit',
    '-qm',
    'face',
  ])
  const sha = gitAt(repo, ['rev-parse', 'HEAD']).trim()
  return { dir, repo, sha }
}

/** 现成的侧车一行(键 = compositeKeyOf,与生产查找键同一把尺,不在测试里拼字符串规则) */
function sidecarLine(row, extra) {
  return (
    JSON.stringify({
      key: compositeKeyOf(row),
      waiting: 'none',
      updatedAt: '2026-10-27T00:00:00.000Z',
      updatedBy: 'mirror-fixture',
      ...extra,
    }) + '\n'
  )
}

/**
 * **改判前**的接线(逐字复刻原先那两行生产调用,不做任何加工):
 * `narrowF9Face(auditPlan(merged), merged)` —— 少传 `fields` ⇒ 只剩散文那一把尺。
 * 用它做"摘掉单源接线"的对照,是为了证明反向对照的红是被接线压掉的,不是判据被删掉的。
 */
function oldWiringLines(planText, baseline = BASELINE) {
  const face = narrowF9Face(auditPlan(planText), planText)
  return ratchetViolations(baseline, probe(face), face)
}

const HEAD = '# 计划\n\n## P1 优先级\n\n'
// 真等人拍板:措辞族尺命中且带护栏那把尺没否决(散文回落一档必须继续定罪)
const ROW_TRUE = '- [ ] G-913 真活 —— 这件事需要用户拍板后再动。\n'
// 叙述引文一型:无护栏的措辞族尺命中(direct=self),带语法辖域护栏的 self 尺判"引号内、判不准"
const ROW_QUOTED =
  '- [ ] G-917 注记回收 —— 需要用户拍板的旧说法我列进「等人拍板」那一档,现已代裁收回。\n'
// 等条件词族命中(F12)
const ROW_ENV = '- [ ] G-914 等条件 —— 本机结构性缺 macOS 开发者工具,需真机验证。\n'
// 散文完全不说等待(只有侧车表态)
const ROW_SILENT = '- [ ] G-916 侧车表态 —— 文案见下游,本行散文不含任何等待措辞。\n'

test('W1 接线锁:定罪面必须与过滤面同一把尺(侧车从合并树一起取,且喂进 auditPlan)', () => {
  const at = SRC.indexOf('export function mergedLedgerFace')
  assert.ok(at > 0, 'mergedLedgerFace 必须存在(合并面违禁桶判定面的唯一实现)')
  const body = SRC.slice(at, SRC.indexOf('\n}', SRC.indexOf('return { face:', at)))
  assert.match(body, /auditPlan\(mergedText,\s*\{\s*fields\s*\}\)/, '判定面必须把侧车喂进单源尺')
  assert.match(body, /dispositionOfV2\(/, '散文回落档必须问同一把 v2 尺的出处')
  assert.match(body, /waitingHumanSelfVerdict|waitingEnvVerdict/, '引文一型必须过带护栏的那把尺')
  const gAt = SRC.indexOf('export function mergedPlanStateRegressions')
  assert.ok(gAt > 0)
  const gate = SRC.slice(gAt, SRC.indexOf('\n}', gAt))
  assert.match(
    gate,
    /blobOrNull\(mergedTree, FIELDS_GIT_REL\)/,
    '侧车必须取合并树那一份(§0.4 同面同轮)',
  )
  assert.match(gate, /loadFields\(/, '装载必须走 plan-fields.mjs 的唯一出口,不在本器另写解析')
  assert.match(gate, /mergedLedgerFace\(/, '定罪面必须来自 mergedLedgerFace,不是散文面')
  assert.doesNotMatch(
    gate.slice(gate.indexOf('fields.undetermined')),
    /ratchetViolations\(base, probe\(narrowF9Face\(auditPlan\(merged\)/,
    '侧车取不到时不得拿无侧车的散文面定 F11/F12 的罪',
  )
})

test('W2 反向对照:侧车已改判出桶的行不再定罪;摘掉单源接线 ⇒ 同一面必须翻红', () => {
  const { dir, repo, sha } = landFace({
    plan: HEAD + ROW_TRUE,
    fields: sidecarLine(ROW_TRUE, { owner: 'cli/子代理线持有人' }),
  })
  try {
    const after = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.equal(
      after.length,
      0,
      `侧车 owner 命中 ⇒ owned-elsewhere,不得再定罪,实测 ${JSON.stringify(after)}`,
    )
    const before = oldWiringLines(HEAD + ROW_TRUE)
    assert.ok(
      before.some((l) => l.includes('F11 等人拍板')),
      `摘掉单源接线后同一面必须翻红(证明接线在生效,不是把判据删了),实测 ${JSON.stringify(before)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W3 反向对照:叙述引文一型落未判定并点名 —— 既不定罪,也不当干净', () => {
  const { dir, repo, sha } = landFace({ plan: HEAD + ROW_QUOTED, fields: '' })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(out.length > 0, '判不准不得被读成"干净放行"(§0.3)')
    assert.ok(
      out.every((l) => !l.includes('F11 等人拍板')),
      `self 尺判不准的行不得按"放大"定罪,实测 ${JSON.stringify(out)}`,
    )
    assert.ok(
      out[0].startsWith(CONV.STATE_GATE_UNDETERMINED),
      `首条必须是未判定点名(调用方按首条分流),实测 ${out[0]?.slice(0, 60)}`,
    )
    assert.match(out[0], /G-917/, '未判定必须逐行报名,不许只报数')
    const before = oldWiringLines(HEAD + ROW_QUOTED)
    assert.ok(
      before.some((l) => l.includes('F11 等人拍板')),
      `摘掉接线后引文行照样翻红(假红的来源就是这一格),实测 ${JSON.stringify(before)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W4 正向对照:真新增"待拍板"未勾登记行 ⇒ 照样拒推(牙一条不放宽)', () => {
  const { dir, repo, sha } = landFace({ plan: HEAD + ROW_TRUE, fields: '' })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(
      out.some((l) => l.includes('F11 等人拍板')),
      `新增等人拍板行必须定罪,实测 ${JSON.stringify(out)}`,
    )
    assert.ok(
      oldWiringLines(HEAD + ROW_TRUE).some((l) => l.includes('F11 等人拍板')),
      '改判前后同一枚真行都必须红 —— 覆盖面没有缩小',
    )
  } finally {
    rmScratch(dir)
  }
})

test('W5 正向对照:真新增"等条件"未勾登记行 ⇒ F12 点名拒推', () => {
  const { dir, repo, sha } = landFace({ plan: HEAD + ROW_ENV, fields: '' })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(
      out.some((l) => l.includes('F12 等条件')),
      `新增等条件行必须定罪,实测 ${JSON.stringify(out)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W6 覆盖面只朝严的一边走:散文没说话、侧车记 waiting 的行必须定罪(旧接线在这一型是漏判)', () => {
  for (const [waiting, dim, row] of [
    ['human', 'F11 等人拍板', ROW_SILENT],
    ['env', 'F12 等条件', ROW_SILENT],
  ]) {
    const { dir, repo, sha } = landFace({ plan: HEAD + row, fields: sidecarLine(row, { waiting }) })
    try {
      const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
      assert.ok(
        out.some((l) => l.includes(dim)),
        `侧车 waiting=${waiting} 必须落 ${dim},实测 ${JSON.stringify(out)}`,
      )
      assert.ok(
        !oldWiringLines(HEAD + row).some((l) => l.includes(dim)),
        `同面在无侧车散文面下本来读不到 ${dim} —— 这一格正是单源尺带来的新射程(不是放宽)`,
      )
    } finally {
      rmScratch(dir)
    }
  }
})

test('W7 侧车取不到 ⇒ F11/F12 未判定并点名,其余维度照旧硬判,不回落散文定罪', () => {
  // 整块重复的探测器量的是"同一块 ≥3 行逐字重复"(与本器 self-test 的 PS 用例同形),
  // 行宽要垫到与真实台账同一量级,否则块级判据压根不命中,这一例就成了空断言。
  const pad = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const dupBlock = () =>
    [
      pad('- 块行一:整块登记被并发并集留下两份,行级四条看不见'),
      pad('- 块行二:第二行,过块级阈值才计入'),
      pad('- 块行三:第三行'),
    ].join('\n') + '\n'
  const plan = `## 甲\n${dupBlock()}## 乙\n${dupBlock()}\n\n尾行非 bullet\n` + ROW_TRUE
  const { dir, repo, sha } = landFace({ plan, withSidecarFile: false })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(
      out.some(
        (l) => l.startsWith(CONV.STATE_GATE_UNDETERMINED) && l.includes('plan-fields.jsonl'),
      ),
      `侧车不在面上必须大声落未判定,实测 ${JSON.stringify(out.map((l) => l.slice(0, 70)))}`,
    )
    assert.ok(
      out.every((l) => !l.includes('F11 等人拍板')),
      `未判定这一维不得按"放大"定罪(定罪面与过滤面必须同一把尺),实测 ${JSON.stringify(out)}`,
    )
    assert.ok(
      out.some((l) => l.includes('F6')),
      `其余维度(F6 整块重复)不得因侧车缺失而被一起放过,实测 ${JSON.stringify(out)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('W8 空侧车文件 = 零条记录,不是未判定(两态不得揉成一团)', () => {
  const { dir, repo, sha } = landFace({ plan: HEAD + ROW_TRUE, fields: '' })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(
      out.every((l) => !l.startsWith(CONV.STATE_GATE_UNDETERMINED)),
      `面上有侧车文件(空)⇒ 不许报未判定,实测 ${JSON.stringify(out)}`,
    )
    assert.ok(
      out.some((l) => l.includes('F11 等人拍板')),
      '零条记录 ⇒ 回落散文尺,真行照样定罪',
    )
  } finally {
    rmScratch(dir)
  }
})

test('W9 名单与读数同形:收窄后 counts 必须跟着名单改(否则键集档落 blind)', () => {
  const plan = HEAD + ROW_TRUE + ROW_QUOTED + ROW_ENV + ROW_SILENT
  const fields = sidecarLine(ROW_SILENT, { owner: '别席' })
  const face = loadFields(process.cwd(), fields)
  const { face: a, undetermined } = CONV.mergedLedgerFace(plan, face)
  assert.equal(a.counts.waitingHuman, a.waitingHumanRows.length, 'F11 名单与读数必须同形')
  assert.equal(a.counts.waitingEnv, a.waitingEnvRows.length, 'F12 名单与读数必须同形')
  assert.ok(
    undetermined.every((u) => u.verdict === 'undetermined'),
    '只有 self 尺明说"判不准"的才降档',
  )
  assert.ok(
    a.waitingHumanRows.some((r) => r.raw.includes('G-913')),
    `真等行不得被护栏挤掉,实测 ${JSON.stringify(a.waitingHumanRows.map((r) => r.raw.slice(0, 20)))}`,
  )
  assert.ok(!a.waitingHumanRows.some((r) => r.raw.includes('G-917')), '引文行不得按定罪进名单')
  assert.ok(
    !a.waitingHumanRows.some((r) => r.raw.includes('G-916')),
    '侧车 owner 命中的行走侧车,不得被散文顶回 waiting-human',
  )
  assert.ok(
    undetermined.some((u) => u.bucket === 'F11' && u.raw.includes('G-917')),
    `降档的行必须留着报名,实测 ${JSON.stringify(undetermined.map((u) => u.bucket))}`,
  )
  // 同一枚面在无侧车散文面下会把 G-916/G-917 一起算成 F11 —— 差值就是接线本身
  assert.equal(oldWiringLines(plan).length > 0, true, '摘线对照必须非空')
  const v2NoGuard = dispositionOfV2({ line: ROW_QUOTED, fields: face })
  assert.equal(
    v2NoGuard.bucket,
    'waiting-human',
    '引文行在 v2 尺(无侧车记录)下仍落 waiting-human ⇒ 靠护栏降档',
  )
})

test('W10 分流锁:未判定按逐条扫,不再只看第 0 条(不得被派去解不存在的冲突)', () => {
  assert.match(
    SRC,
    /regressions\.filter\(\(r\)\s*=>\s*r\.startsWith\(STATE_GATE_UNDETERMINED\)\)/,
    'main() 必须逐条扫未判定行',
  )
  assert.doesNotMatch(
    SRC,
    /regressions\[0\]\.startsWith\(STATE_GATE_UNDETERMINED\)/,
    '只看首条会把第 N 条的未判定读成"判了放大",随后派生 union-converge --apply 去解不存在的冲突',
  )
})

test('W11 基线缺 F11/F12 键(旧形状)⇒ 缺项不判,不制造一条无人能处置的未判定行', () => {
  const { dir, repo, sha } = landFace({
    plan: HEAD + ROW_TRUE,
    baseline: { F6: 0 },
    withSidecarFile: false,
  })
  try {
    const out = CONV.mergedPlanStateRegressions(sha, sha, sha, repo)
    assert.ok(
      out.every((l) => !l.startsWith(CONV.STATE_GATE_UNDETERMINED)),
      `基线里没有这两维 ⇒ ratchetViolations 的"缺项不判"善意照旧生效,实测 ${JSON.stringify(out)}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
