// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 L3957 S-26(Z46 席)镜像测试 —— `scripts/git-sync-converge.mjs` 的 `mergedPlanStateRegressions`
// 活文档取材面三态化(§0.3 取不到 ⇒ 未判定 / §0.4 全量档判被审面 blob,不回落索引面与工作树面)。
//
// 立因(2026-11-06 现读):本器原先只有一把 `blobOf(rev, rel)`,失败一律回落成 `''`,于是
//  ① 合并面读不到 ⇒ `if (!merged.trim()) return []` = 把"没判"写成"没有放大"(冒绿);
//  ② 一侧读不到 ⇒ 那一侧喂进去的是 `''`,`max(两侧)` 被压成 0 ⇒ 一次通道故障被放大成内容假红
//     (真实读数,本仓 178/12 分叉现跑:`F4 同一件事多条待办(副本行) 各侧最多 0,归并结果 2`);
//  ③ 基线读失败与"该面没有基线"同形 ⇒ 第②把尺子整维静默消失。
//
// 四件用例的分工(缺一不算结清):
//  ① 滞后/取不到的那一格不再被定罪,也不再冒绿(真 git 夹具,三面各落一枚提交);
//  ② **反向牙**:三面都可读时,判据必须照样被调用、且**两侧 blob 逐字都在输入里** —— 摘掉这一格
//     就等于把修法做成"读不到就一律不带回 / 一律不判",那会丢别人的行;
//  ③ 基线 absent 与"取不到"分档(不并桶);
//  ④ 形状锁:取材面调用点结构上读不到工作树/索引面。
// 说明:夹具文本不足以让 F1/F4/F9 任一维真涨(2026-11-06 实测三种形状全 [] —— 那些维吃的是真实
// 台账的编号形状与声明位口径),所以反向牙不吃"某条维必红",而吃**判据是否被真调用 + 输入内容是否完整**。
// §22c:判据一律 import 生产导出,测试里零复制。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import * as CONV from '../git-sync-converge.mjs'

await CONV.ensureUnionModule()
assert.ok(
  CONV.unionGate.mod,
  `union-converge 必须装载成功(它承载第①把尺子),实测 ${CONV.unionGate.error}`,
)

const PLAN_REL = 'PROJECT_PLAN.md'
const BASE_REL = 'scripts/plan-task-state-baseline.json'
const FIELDS_REL = 'scripts/data/plan-fields.jsonl'
const UNDET = '[台账闸门未判定]'
const HEAD_TXT = '# 台账\n\n'
const ROW_A = '- [ ] T-1 (2026-11-06) 本侧独有的一件事项正文长到足以进入判据集合 z46face\n'
const ROW_C = '- [ ] T-3 (2026-11-06) 对侧独有的另一件事项正文同样长到足以入选 z46face\n'
const BASELINE = { F1: 0, F4: 0, F6: 0, F9: [], F11: [], F12: [] }
// "取不到"的 rev:git 报 invalid object name ⇒ 既不是 blob 也不是删除档(absent)
const BAD_REV = 'z46-no-such-rev'

const gitAt = (repo, args) =>
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@e', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'], // §12g
    windowsHide: true, // §5b
  }).trim()

/** 往夹具仓**根目录**落一枚含台账/基线/侧车的提交并返回 sha(三面各是可独立读取的 blob 面)。 */
function faceCommit(repo, plan, { baseline = BASELINE } = {}) {
  mkdirSync(join(repo, 'scripts/data'), { recursive: true })
  writeFileSync(join(repo, PLAN_REL), plan, 'utf8')
  if (baseline === null) rmSync(join(repo, BASE_REL), { force: true })
  else writeFileSync(join(repo, BASE_REL), JSON.stringify(baseline), 'utf8')
  writeFileSync(join(repo, FIELDS_REL), '', 'utf8')
  gitAt(repo, ['add', '-A'])
  gitAt(repo, ['commit', '-q', '--allow-empty', '-m', 'face'])
  return gitAt(repo, ['rev-parse', 'HEAD'])
}

function fixture({ localPlan, remotePlan, mergedPlan, mergedOpts }) {
  const dir = mkScratch('z46-live-doc-face-')
  const repo = join(dir, 'repo')
  mkdirSync(repo, { recursive: true })
  gitAt(repo, ['init', '-q', '-b', 'main'])
  faceCommit(repo, HEAD_TXT)
  const local = faceCommit(repo, localPlan)
  const remote = faceCommit(repo, remotePlan)
  const merged = faceCommit(repo, mergedPlan, mergedOpts ?? {})
  return { dir, repo, local, remote, merged }
}

/**
 * 反向牙的探针(§22c:不吃测试自造的判据,只**观察生产判据被不被真调用、喂进去的是哪些面**)。
 * 装一层壳 ⇒ 用例结束后必还原,否则同一进程后续用例会读到假尺子。
 */
function spyRuler() {
  const real = CONV.unionGate.mod
  const calls = []
  CONV.unionGate.mod = {
    planStateRegressions: (mergedText, sides, ...rest) => {
      calls.push({ mergedText, sides, n: sides.length })
      return real.planStateRegressions(mergedText, sides, ...rest)
    },
  }
  return {
    calls,
    restore: () => {
      CONV.unionGate.mod = real
    },
  }
}

const SRC_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'git-sync-converge.mjs')
const BODY = (() => {
  const src = readFileSync(SRC_PATH, 'utf8')
  const start = src.indexOf('export function mergedPlanStateRegressions(')
  assert.ok(start >= 0, '取材面判据必须仍住在 mergedPlanStateRegressions 里')
  const end = src.indexOf('\n}\n', start)
  assert.ok(end > start, '函数体边界取不到')
  return src.slice(start, end)
})()

// ── ① 正向销账 ─────────────────────────────────────────────────────────────
test('① 一侧的台账 blob 取不到 ⇒ 整维落未判定并点名,不得再产出「各侧最多 0」那型假红', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
  })
  try {
    const r = CONV.mergedPlanStateRegressions(f.merged, BAD_REV, f.remote, f.repo)
    assert.ok(
      r.some((x) => x.includes(UNDET) && x.includes('相对两侧上限')),
      `必须落未判定并点名是哪一把尺子没跑,实测:${JSON.stringify(r)}`,
    )
    assert.ok(
      !r.some((x) => x.includes('各侧最多')),
      `通道故障不得被读成内容放大(旧 blobOf→'' 那一格),实测:${JSON.stringify(r)}`,
    )
  } finally {
    rmScratch(f.dir)
  }
})

test('①b 合并面的台账取不到 ⇒ 不得 return [] 冒绿(旧写法 `!merged.trim()` 那一格)', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
  })
  try {
    const r = CONV.mergedPlanStateRegressions(BAD_REV, f.local, f.remote, f.repo)
    assert.equal(r.length, 1, `合并面读不到只能是一条未判定,实测:${JSON.stringify(r)}`)
    assert.ok(r[0].includes(UNDET) && r[0].includes(PLAN_REL), `必须点名是哪一面,实测:${r[0]}`)
  } finally {
    rmScratch(f.dir)
  }
})

test('①c 台账在该面确实不存在(absent,删除档)⇒ 维持"该面无语义"的空结论,不升级成未判定', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_A,
    mergedPlan: HEAD_TXT + ROW_A,
  })
  try {
    rmSync(join(f.repo, PLAN_REL), { force: true })
    gitAt(f.repo, ['add', '-A'])
    gitAt(f.repo, ['commit', '-q', '-m', 'plan deleted'])
    const merged = gitAt(f.repo, ['rev-parse', 'HEAD'])
    const r = CONV.mergedPlanStateRegressions(merged, f.local, f.remote, f.repo)
    assert.deepEqual(
      r,
      [],
      `absent ≠ 取不到,不得制造一条无人能处置的未判定,实测:${JSON.stringify(r)}`,
    )
  } finally {
    rmScratch(f.dir)
  }
})

// ── ② 反向牙:三面都可读 ⇒ 判据必须照跑,且两侧 blob 逐字都在输入里 ──────────
test('② 反向牙(修法不得变成"一律不带回/一律不判"):三面可读时第①把尺子被真调用,两侧 blob 全在输入面', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
  })
  const spy = spyRuler()
  try {
    const r = CONV.mergedPlanStateRegressions(f.merged, f.local, f.remote, f.repo)
    assert.equal(
      spy.calls.length,
      1,
      `三面都可读时第①把尺子必须被调用恰好一次(实测 ${spy.calls.length} 次)`,
    )
    const { mergedText, sides, n } = spy.calls[0]
    assert.equal(n, 2, `两侧面必须都喂进去(少喂一侧就是"各侧最多 0"那型假红的根)`)
    assert.ok(
      sides.every((s) => typeof s === 'string' && s.trim() !== ''),
      `任何一侧都不得被喂成空面:'' = 旧回落形状`,
    )
    assert.ok(
      mergedText.includes(ROW_A.trim()) && mergedText.includes(ROW_C.trim()),
      '合并面输入必须同时含本侧与对侧独有的登记行 ⇒ 真对侧独有内容在取材面上没有被丢',
    )
    assert.ok(
      sides[0].includes(ROW_A.trim()) && sides[1].includes(ROW_C.trim()),
      '两侧 blob 逐字交回判据(取的是被审面,不是工作树滞后副本)',
    )
    assert.ok(!r.some((x) => x.includes(UNDET)), '通道正常时绝不许冒"未判定"代替判定')
  } finally {
    spy.restore()
    rmScratch(f.dir)
  }
})

test('②b 反向牙:第①把尺子给出的定罪行必须原样透传(把判据删了在这格必翻红)', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
  })
  const real = CONV.unionGate.mod
  CONV.unionGate.mod = {
    planStateRegressions: () => ['F4 同一件事多条待办(副本行) 各侧最多 0,归并结果 2'],
  }
  try {
    const r = CONV.mergedPlanStateRegressions(f.merged, f.local, f.remote, f.repo)
    assert.ok(
      r.some((x) => x.includes('F4 同一件事多条待办')),
      `判据的定罪必须原样进结论面,实测:${JSON.stringify(r)}`,
    )
  } finally {
    CONV.unionGate.mod = real
    rmScratch(f.dir)
  }
})

// ── ③ 基线三态:absent 不并桶、可读才判 ────────────────────────────────────
test('③ 基线在合并面不存在 ⇒ 该维"无语义"(不升级成未判定),第①把尺子照跑', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
    mergedOpts: { baseline: null },
  })
  const spy = spyRuler()
  try {
    const r = CONV.mergedPlanStateRegressions(f.merged, f.local, f.remote, f.repo)
    assert.ok(
      !r.some((x) => x.includes(UNDET)),
      `基线 absent 不是"取不到",实测:${JSON.stringify(r)}`,
    )
    assert.equal(spy.calls.length, 1, '基线缺席不得连带把第①把尺子也一起停掉')
  } finally {
    spy.restore()
    rmScratch(f.dir)
  }
})

test('③b 基线在合并面存在但内容空 ⇒ 与 absent 同档"该面无语义",不读成判定通过', () => {
  const f = fixture({
    localPlan: HEAD_TXT + ROW_A,
    remotePlan: HEAD_TXT + ROW_C,
    mergedPlan: HEAD_TXT + ROW_A + ROW_C,
  })
  try {
    writeFileSync(join(f.repo, BASE_REL), '   ', 'utf8')
    gitAt(f.repo, ['add', '-A'])
    gitAt(f.repo, ['commit', '-q', '-m', 'empty baseline'])
    const merged = gitAt(f.repo, ['rev-parse', 'HEAD'])
    const r = CONV.mergedPlanStateRegressions(merged, f.local, f.remote, f.repo)
    assert.ok(Array.isArray(r), '空基线 ⇒ 第②把尺子整维不参与,第①把照跑')
    assert.ok(!r.some((x) => x.includes(UNDET)), `空 blob ≠ 读失败,实测:${JSON.stringify(r)}`)
  } finally {
    rmScratch(f.dir)
  }
})

// ── ④ 形状锁:取材面调用点结构上读不到工作树/索引 ─────────────────────────
test('④ 形状锁:mergedPlanStateRegressions 体内不得出现工作树读取 API,也不得以字面冒号或 HEAD 当 rev', () => {
  for (const banned of [
    'readFileSync',
    'readWorktreeFile',
    'existsSync',
    'writeFileSync',
    'statSync',
  ]) {
    assert.ok(
      !BODY.includes(banned),
      `取材面出现 "${banned}" ⇒ 工作树/索引面被当成内容面(本票题面),判红`,
    )
  }
  assert.ok(
    !/show',\s*['"`]:/.test(BODY),
    "出现 `git show ':<path>`(索引面字面)⇒ 取材面回落到另一个面,判红",
  )
  assert.ok(
    !/show',\s*['"`]HEAD:/.test(BODY),
    "出现 `git show 'HEAD:<path>'` 字面 ⇒ 绕开被审 rev 自取一面,判红(本器一律吃调用方传入的 rev)",
  )
  assert.ok(BODY.includes('readFace'), '三态读法必须住在本函数内(判据在而没人调 = 没有)')
  assert.ok(BODY.includes("['show'"), 'blob 取材必须走 git show <rev>:<path>')
  assert.ok(!/const blobOf = /.test(BODY), '旧的一律回落 "" 的 blobOf 必须已被三态读法取代')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
