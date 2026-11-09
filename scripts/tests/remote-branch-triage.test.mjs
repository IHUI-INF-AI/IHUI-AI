// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * remote-branch-triage.mjs 判据镜像测试(2026-11-09 立)。
 *
 * 判据单源(§22c/§0.6):全部断言 import 源脚本的 __test__,本文件零复制判据。
 * 钉四组事,每组都带「摘掉一闸就翻红」的反向牙,防 §4 假绿五式复发:
 *  ① 取材层:ls-remote 畸形行丢弃、三点 diff 生成块文件排除、merge-tree 首行 tree oid 不算冲突。
 *  ② classify 全闸:对象缺失 / PR 未判定 / 人工 PR / keep 标签 / 保护前缀 / 在飞检出 /
 *     三种落地判据 / 未落地,每条都先给「其余全绿」正向对照,再只翻那一闸。
 *  ③ safetyCheck:tip 漂移 / ref 消失 / 新 open PR / 落地判据被撤 / 在飞检出 / verdict 不符,
 *     任一不符都必须 pass=false 且点名原因(不许静默降级)。
 *  ④ 报告层:markdown 必须含逐支行与三态计数;只报总数不算数。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseLsRemote, addedLines, mergeConflictFiles, classify, safetyCheck, markdownReport,
  __test__,
} from '../remote-branch-triage.mjs'

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)

// 全部闸都绿的正向对照:bot 作者、无 keep、已合并、无检出、无保护前缀
const base = () => ({
  name: 'fix/example-1109', sha: SHA_A, hasObject: true, prState: 'ok',
  prs: [], worktree: false, merged: true, contentLanded: false, linesLanded: false,
  stillDiff: 0, lineMiss: 0,
})

function expectVerdict(row, verdict) {
  const r = classify(row)
  assert.equal(r.verdict, verdict, `期望 ${verdict},实得 ${r.verdict} (${r.reason})`)
  return r
}

test('parseLsRemote: 只收 refs/heads + 40 位 sha + 恰好两列', () => {
  const text = [
    `${SHA_A}\trefs/heads/main`,
    `${SHA_B}\trefs/heads/feat/a`,
    `${SHA_A}\trefs/tags/v1`,
    `deadbeef\trefs/heads/bad-sha`,
    `${SHA_A}\trefs/heads/extra\tthird`,
    'garbage',
    '',
  ].join('\n')
  assert.deepEqual(parseLsRemote(text), { main: SHA_A, 'feat/a': SHA_B })
  assert.deepEqual(parseLsRemote(''), {})
})

test('addedLines: 生成块/锁文件不计语义信号,纯数字行与 +++ 头不误收', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '+++ b/src/a.ts',
    '+const answer = 42;',
    '+  12345',
    '+++ b/README.md',
    '+| 跟踪文件 | 20613 | `trackedFiles` |',
    '+++ b/pnpm-lock.yaml',
    '+  resolution: old',
    '+++ b/src/b.ts',
    '+++not-a-file',
    '+export const second = true;',
  ].join('\n')
  const m = addedLines(diff)
  assert.deepEqual([...m.keys()], ['src/a.ts', 'src/b.ts'])
  assert.deepEqual(m.get('src/a.ts'), ['const answer = 42;'])
  assert.deepEqual(m.get('src/b.ts'), ['export const second = true;'])
})

test('mergeConflictFiles: 首行 tree oid 不算冲突,遇非 stage 行立即停止', () => {
  const out = [
    '9c506fa992b4d1f31e3fa786dac4d73ac2e4b6f0',
    `100644 ${'c'.repeat(40)} 1\tREADME.md`,
    `100644 ${'d'.repeat(40)} 2\tREADME.md`,
    `100644 ${'e'.repeat(40)} 3\tREADME.md`,
    '  CONFLICT (content): Merge conflict in README.md',
    `100644 ${'f'.repeat(40)} 1\tsrc/late.ts`,
  ].join('\n')
  assert.deepEqual(mergeConflictFiles(out), ['README.md'])
  assert.deepEqual(mergeConflictFiles('tree-only'), [])
})

test('classify: 正向对照唯一落在 DISCARDABLE', () => {
  expectVerdict(base(), 'DISCARDABLE')
})

test('classify: 三种落地判据各自独立成立,理由必须点名是哪一条', () => {
  const a = base(); a.merged = false; a.contentLanded = true
  assert.equal(classify(a).reason, 'A∩B=∅')
  const b = base(); b.merged = false; b.linesLanded = true
  assert.equal(classify(b).reason, '新增行 100% 落地')
  const c = base(); c.merged = true
  assert.equal(classify(c).reason, 'main 祖先')
  const d = base(); d.merged = false
  expectVerdict(d, 'NEEDS_WORK')
})

test('classify: 每条安全闸都先过正向对照再单独翻转', () => {
  const cases = [
    ['对象缺失', (r) => { r.hasObject = false }, 'UNJUDGED'],
    ['PR 状态未判定', (r) => { r.prState = 'unknown' }, 'UNJUDGED'],
    ['人工作者 PR', (r) => { r.prs = [{ number: 217, author: 'lizong', labels: [] }] }, 'HOLD_PR'],
    ['Dependabot PR(与官方清理器同口径,不许当快照删)', (r) => { r.prs = [{ number: 98, author: 'dependabot[bot]', labels: [] }] }, 'HOLD_PR'],
    ['bot PR 带 keep', (r) => { r.prs = [{ number: 200, author: 'github-actions[bot]', labels: ['keep'] }] }, 'HOLD_PR'],
    ['保护前缀', (r) => { r.name = 'backup/main-line-20261026' }, 'HOLD_PROTECT'],
    ['在飞检出', (r) => { r.worktree = true }, 'HOLD_WORKTREE'],
    ['主干', (r) => { r.name = 'main' }, 'MAIN'],
  ]
  for (const [label, mutate, want] of cases) {
    const row = base()
    mutate(row)
    expectVerdict(row, want)
    expectVerdict(base(), 'DISCARDABLE') // 反向牙:同一批输入不翻闸必须仍绿
    void label
  }
})

test('classify: bot 作者 PR 不阻断已落地分支(防把 60 支快照误留)', () => {
  const r = base()
  r.prs = [{ number: 200, author: 'github-actions[bot]', labels: [] }]
  expectVerdict(r, 'DISCARDABLE')
})

test('classify: 超出深判阈值的超大分支必须 UNJUDGED,不许写成 NEEDS_WORK 或判绿', () => {
  const r = base()
  r.merged = false
  r.heavySkipped = true
  r.ahead = 7778
  r.stillDiff = 7586
  const v = classify(r)
  assert.equal(v.verdict, 'UNJUDGED')
  assert.match(v.reason, /超出深判阈值/)
  expectVerdict(base(), 'DISCARDABLE') // 反向牙:同一批输入不翻闸必须仍绿
})

test('classify: Dependabot PR 即使已落地也保留(与官方清理器同口径)', () => {
  const r = base()
  r.prs = [{ number: 98, author: 'dependabot[bot]', labels: [] }]
  expectVerdict(r, 'HOLD_PR')
})

test('safetyCheck: 全绿才放行', () => {
  const r = { ...base(), verdict: 'DISCARDABLE', reason: 'main 祖先' }
  assert.deepEqual(safetyCheck(r, { live: { [r.name]: SHA_A }, prByHead: {} }), { pass: true, reason: 'main 祖先' })
})

test('safetyCheck: 六种不符逐条点名,任一都不许静默放行', () => {
  const r = { ...base(), verdict: 'DISCARDABLE', reason: 'main 祖先' }
  const cases = [
    ['REF_GONE', {}, {}, /REF_GONE/],
    ['TIP_CHANGED', { [r.name]: SHA_B }, {}, /TIP_CHANGED/],
    ['NEW_OPEN_PR', { [r.name]: SHA_A }, { [r.name]: [{ number: 9 }] }, /NEW_OPEN_PR/],
  ]
  for (const [label, live, prByHead, re] of cases) {
    const s = safetyCheck(r, { live, prByHead })
    assert.equal(s.pass, false, label)
    assert.match(s.reason, re)
  }
  const noLanded = { ...r, merged: false }
  assert.equal(safetyCheck(noLanded, { live: { [r.name]: SHA_A }, prByHead: {} }).pass, false)
  const inFlight = { ...r, worktree: true }
  assert.equal(safetyCheck(inFlight, { live: { [r.name]: SHA_A }, prByHead: {} }).pass, false)
  const notDiscard = { ...r, verdict: 'NEEDS_WORK' }
  assert.equal(safetyCheck(notDiscard, { live: { [r.name]: SHA_A }, prByHead: {} }).pass, false)
})

test('markdownReport: 必须同时含逐支行与三态计数,只报总数不算数', () => {
  const rows = [
    { ...classify(base()), name: 'fix/a', sha: SHA_A, prs: [], worktree: false, stillDiff: 0 },
    { ...classify(base()), name: 'fix/b', sha: SHA_B, prs: [], worktree: false, stillDiff: 0 },
  ]
  const md = markdownReport(rows, { base: SHA_A, prCount: 0, apply: false })
  assert.match(md, /\| DISCARDABLE \| 2 \|/)
  assert.match(md, /`fix\/a`/)
  assert.match(md, /`fix\/b`/)
})

// ── contentLanded 生成块过滤反证(门 41 单分支守门口径统一)──────────────────────
// 全部断言走 __test__ 的真实判据 splitStill / GENERATED_FILE 与 classify,零复制实现(§22c)。
const { splitStill, GENERATED_FILE } = __test__
const asText = (...files) => files.join('\n')
const GEN_FILES = ['README.md', 'README.en.md', 'PROJECT_PLAN.md', 'x.generated.ts', 'pnpm-lock.yaml']
const CODE_FILES = ['src/core.ts', 'apps/api/route.ts', 'scripts/lib/gitdir.mjs']

// 只按 contentLanded 判定的中性 row:撤掉 merged / linesLanded,确保定性只由 splitStill 结果驱动。
const contentRow = (s) => ({
  ...base(), merged: false, linesLanded: false,
  stillDiff: s.stillDiff, stillGenerated: s.stillGenerated, stillCode: s.stillCode,
  contentLanded: s.contentLanded,
})

test('口径自检:用例里的生成块/真代码文件确实分别命中/不命中 GENERATED_FILE', () => {
  for (const f of GEN_FILES) assert.equal(GENERATED_FILE.test(f), true, `${f} 应命中生成块`)
  for (const f of CODE_FILES) assert.equal(GENERATED_FILE.test(f), false, `${f} 不应命中生成块`)
})

test('① 仅生成块落在 A∩B ⇒ 真代码差异=0,contentLanded=true,classify DISCARDABLE 且 reason 如实带过滤数', () => {
  const t = asText(...GEN_FILES)
  const s = splitStill(t, t)
  assert.equal(s.stillDiff, GEN_FILES.length)
  assert.equal(s.stillGenerated, GEN_FILES.length)
  assert.equal(s.stillCode, 0)
  assert.equal(s.contentLanded, true)
  const v = classify(contentRow(s))
  assert.equal(v.verdict, 'DISCARDABLE')
  assert.match(v.reason, /真代码差异=0/)
  assert.match(v.reason, /过滤生成块 5/)
  assert.match(v.reason, /still=5/)
})

test('② 有真代码差异 ⇒ contentLanded=false,仍 NEEDS_WORK,reason 点名真代码数', () => {
  const t = asText('src/core.ts')
  const s = splitStill(t, t)
  assert.equal(s.stillGenerated, 0)
  assert.equal(s.stillCode, 1)
  assert.equal(s.contentLanded, false)
  const v = classify(contentRow(s))
  assert.equal(v.verdict, 'NEEDS_WORK')
  assert.match(v.reason, /真代码=1/)
})

test('③ 混合情形 ⇒ 只看真代码那部分:加/减生成块不改变 stillCode 与最终定性', () => {
  const codeOnly = asText(...CODE_FILES)
  const mixed = asText(...CODE_FILES, ...GEN_FILES)
  const s1 = splitStill(codeOnly, codeOnly)
  const s2 = splitStill(mixed, mixed)
  assert.equal(s2.stillDiff, CODE_FILES.length + GEN_FILES.length)
  assert.equal(s2.stillGenerated, GEN_FILES.length)
  assert.equal(s2.stillCode, s1.stillCode)
  assert.equal(s2.contentLanded, s1.contentLanded)
  assert.equal(classify(contentRow(s2)).verdict, classify(contentRow(s1)).verdict)
  assert.equal(classify(contentRow(s2)).verdict, 'NEEDS_WORK')
  // 反向牙:混合里真代码那部分为空时,生成块再多也判绿(与 ① 互证)。
  const s3 = splitStill(mixed, asText(...GEN_FILES))
  assert.equal(s3.stillCode, 0)
  assert.equal(s3.contentLanded, true)
  assert.equal(classify(contentRow(s3)).verdict, 'DISCARDABLE')
})

test('③b splitStill 取的是 A∩B:A 有但 B 已无差异的文件不算未落地', () => {
  const s = splitStill(asText('src/core.ts', 'README.md'), asText('README.md'))
  assert.deepEqual(s.still, ['README.md'])
  assert.equal(s.stillCode, 0)
  assert.equal(s.contentLanded, true)
  assert.equal(classify(contentRow(s)).verdict, 'DISCARDABLE')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
