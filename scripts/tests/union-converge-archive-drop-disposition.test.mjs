// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * docs-207 ①(守门 207 第二刀①)在 union-converge 消费面的反证锁(2026-11-11 立)。
 *
 * 票面第一句:「补 `scripts/union-converge.mjs` 的 `declaredDropCaps`,让"AGENTS 归档移出"
 * 也算合法处置 —— 现读它只认台账摘除票,实测 merge-live-doc --apply 把有意移出的 AGENTS
 * 副本判真丢失并插回」。判据落地形态是平行维度 `lib/live-doc-archive-drops.mjs` 的
 * `archiveDropCaps`(凭据源不同:归档件逐字行,不是台账行),已接三处消费面:
 *   期望表(liveDocExpectedCounts 第 7 参)/ 行级 union(unionLinesCore 第 9 参)/
 *   落地闸(verifyUnion 的期望表同样带归档账 ⇒ "未存活行"按 want 追,归档行不在 want)。
 * 本文件用生产判据(§22c,一行判据都不复制)钉票面要求的成对反证:
 *   ① 正控:声明了归档移出的副本 ⇒ 期望表不追(= 落地闸不会判真丢失)、产出不补回(= 不插回);
 *   ② 反控:未声明(同族 0 件 / 异族件 / 凭据指向另一行)⇒ 照旧判、照旧补回;
 *   ③ 接线锁:三处消费面任何一处被摘掉 ⇒ 当场翻红(否则"只补了产出一半、落地闸照追"会静默漂移)。
 * merge-live-doc --apply 端到端的"判真丢失并插回"反证另有
 * `live-doc-archive-disposition.test.mjs`(gb22),本文件不重复那一段。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as U } from '../union-converge.mjs'
import { archiveDropCaps, selectMovedOut } from '../lib/live-doc-archive-drops.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const A1 = '.ihui-agent/archive/AGENTS_trim-docs207-pair.md'
const FOREIGN = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md'

const KEEP = '甲:仍在册的一行正文,长度足够避开短行过滤不参与本票任何一维'
const OURS_NEW = '丙:本侧新增的一行正文,归档这一维不许连本侧自己的活账一起吞掉'
const MOVED1 = '丁:整区移入归档的第一行正文,原位只留下指针注记,长度足够充当移出批次'
const MOVED2 = '戊:整区移入归档的第二行正文,与上一行同批搬走,同样够长'
const THEIRS_NEW = '己:对侧本轮新增的一行正文,与归档维度无关,必须照旧补回'

const OURS = ['# 文档', KEEP, OURS_NEW].join('\n')
// 对侧滞后副本:仍带着本侧已整区移出的 MOVED1/MOVED2,外加一行真新活 THEIRS_NEW
const THEIRS = ['# 文档', KEEP, MOVED1, MOVED2, THEIRS_NEW].join('\n')

/** 声明了归档移出的凭据(生产判据现算,不手搓 Set) */
function declaredCaps() {
  const archived = selectMovedOut('AGENTS.md', [{ path: A1, text: [MOVED1, MOVED2].join('\n') }], OURS)
  assert.equal(archived.ok, true, '夹具本身必须构成凭据,否则正控是空转')
  return archiveDropCaps(OURS, archived)
}

test('docs-207① 正控:声明归档移出 ⇒ 期望表不追(落地闸无从判真丢失)、产出不补回(不插回)', () => {
  const caps = declaredCaps()
  assert.ok(caps.has(MOVED1) && caps.has(MOVED2), '移出批次必须进抵扣集')
  assert.ok(!caps.has(KEEP) && !caps.has(OURS_NEW), '仍在册/本侧新行不得被抵扣集吞掉')

  const want = U.liveDocExpectedCounts(OURS, THEIRS, null, null, null, null, caps)
  // verifyUnion 的「未存活行」判据逐行追 want ⇒ 行不在 want = 落地闸结构性判不了它真丢失
  assert.equal(want.has(MOVED1), false, '声明过的归档行不得留在期望表')
  assert.equal(want.has(MOVED2), false)
  assert.ok(want.has(THEIRS_NEW), '对侧真新行必须照旧在册(抵扣不是把补回整个关掉)')
  assert.ok(want.has(OURS_NEW) && want.has(KEEP), '本侧活账一分不许被归档维吞')

  const merged = U.unionLines(OURS, THEIRS, null, null, { archived: caps })
  assert.ok(!merged.includes(MOVED1) && !merged.includes(MOVED2), '归档行被补回 = 清偿成果被吞回')
  assert.ok(merged.includes(KEEP) && merged.includes(OURS_NEW) && merged.includes(THEIRS_NEW))
})

test('docs-207① 反控:未声明(同族 0 件)⇒ 照旧判、照旧补回(真丢失不许洗成"已归档")', () => {
  const none = selectMovedOut('AGENTS.md', [], OURS)
  assert.equal(none.ok, false)
  const caps = archiveDropCaps(OURS, none)
  assert.equal(caps.size, 0, '无凭据 ⇒ 抵扣集必须为空')

  const want = U.liveDocExpectedCounts(OURS, THEIRS, null, null, null, null, caps)
  assert.ok(want.has(MOVED1) && want.has(MOVED2), '无凭据 ⇒ 期望表照旧追这两行')
  const merged = U.unionLines(OURS, THEIRS, null, null, { archived: caps })
  assert.ok(merged.includes(MOVED1) && merged.includes(MOVED2), '无凭据 ⇒ 产出面照旧补回')
})

test('docs-207① 反控:异族归档件(PROJECT_PLAN_* 里的逐字同行)不构成 AGENTS 的凭据 ⇒ 照判', () => {
  const foreign = selectMovedOut('AGENTS.md', [{ path: FOREIGN, text: [MOVED1, MOVED2].join('\n') }], OURS)
  assert.equal(foreign.ok, false, '同族通道表不认异族件')
  const merged = U.unionLines(OURS, THEIRS, null, null, { archived: archiveDropCaps(OURS, foreign) })
  assert.ok(merged.includes(MOVED1) && merged.includes(MOVED2), '异族件不得免掉本族行的补回义务')
})

test('docs-207① 反控:凭据指向另一行 ⇒ 本行照旧补回(扣行必须逐字对上,不按族/前缀)', () => {
  const other = '另一行与归档无关的正文,同样够长,用来当误伤反控的凭据(不得咬到移出批次)'
  const merged = U.unionLines(OURS, THEIRS, null, null, { archived: new Set([other]) })
  assert.ok(merged.includes(MOVED1) && merged.includes(MOVED2))
})

test('docs-207① 接线锁:归档维在 union-converge 三处消费面缺一即红(产出/落地闸两把尺子同源)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'union-converge.mjs'), 'utf8')
  // 行级 union:live-doc 环把凭据对象喂进 unionLinesCore 第 9 参
  assert.match(
    src,
    /unionLinesCore\(a, b, bt, ma\.suppress, foldOn, foldPicks, withheldReport, null, archived\)/,
    '行级 union 的 archived 接线被摘 ⇒ 产出一侧会照旧补回归档行',
  )
  // 抵扣集与 F5 同一本账(archiveDropCaps(a, archived)),不是第二份判据
  assert.match(
    src,
    /const archiveDropSet = archived && archived\.ok \? archiveDropCaps\(a, archived\) : new Set\(\)/,
    'F5 抵扣集构造被摘 ⇒ 少带一维会重新把归档移出判成违规',
  )
  assert.match(src, /archiveDropSet: archiveDropSet,/, 'F5 落地闸的归档维接线被摘 ⇒ 与行级 union 分账')
  // 落地闸自证面:verifyUnion 的期望表必须带同一本归档账(票面「判真丢失」就发生在这条链)
  assert.match(
    src,
    /liveDocExpectedCounts\(a, b, bt, ma\.suppress, null, null, archiveDropSetFor\(p, a, ours, cwd\)\)/,
    'verifyUnion 期望表摘掉归档账 ⇒ 归档行会重新被「未存活行」判成真丢失',
  )
  // 期望表本体(judgments lib)消费 archiveDropCaps —— 判据单源,调用方不另算
  const judg = readFileSync(join(REPO, 'scripts', 'lib', 'union-converge-judgments.mjs'), 'utf8')
  assert.match(
    judg,
    /for \(const l of archiveDropCaps\(oursText, archivedOverride\)\) want\.delete\(l\)/,
    '期望表的归档抵扣被摘 ⇒ 上面所有消费面同时失去意义',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
