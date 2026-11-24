// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 归档移出凭据(守门 207 第二刀①)的判据锁。
 *
 * 这一族失效的表现永远是"安静":归档行被静默补回(清偿成果被吞),或对侧真加回来的行被
 * 静默吞掉(真丢行)。所以每个方向都要有正控与反控,且反控必须能在判据被摘掉时翻红
 * (§22c:镜像测试用生产判据,不复制常量)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_MOVED_LINE,
  SNAPSHOT_HEADING_HITS,
  SNAPSHOT_OVERLAP,
  __test__,
  archiveDropCaps,
  selectMovedOut,
} from '../lib/live-doc-archive-drops.mjs'

const A1 = '.ihui-agent/archive/AGENTS_trim-2026-10-25.md'
const SNAP = '.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md'
const OTHER = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md'

/** 本侧文档:三行正文;被移出的那三行不在其中。 */
const OURS = ['# 文档', '甲:仍然在册的一行正文', '乙:另一行仍在册的正文', '丙:第三行仍在册'].join(
  '\n',
)

const MOVED = ['丁:这是整区被移进 archive 的第一行正文', '戊:这是整区被移进 archive 的第二行正文']

test('① 同族才构成凭据:AGENTS 文档不吃 PROJECT_PLAN_* 里的行', () => {
  const r = selectMovedOut('AGENTS.md', [{ path: OTHER, text: MOVED.join('\n') }], OURS)
  assert.equal(r.ok, false, '不同族的件不得构成凭据')
  assert.equal(r.raw.size, 0)
  assert.match(r.reason, /同族归档件 0 份/)
})

test('② 整篇复制件被剔除,移出批次被采用(内容比例判别,不看文件名)', () => {
  // 快照件:内容几乎全是本侧仍在册的行(这里 3/4,已过阈值)
  const snapText = [OURS.split('\n')[1], OURS.split('\n')[2], OURS.split('\n')[3], MOVED[0]].join(
    '\n',
  )
  const r = selectMovedOut(
    'AGENTS.md',
    [
      { path: SNAP, text: snapText },
      { path: A1, text: MOVED.join('\n') },
    ],
    OURS,
  )
  assert.equal(r.ok, true)
  assert.deepEqual(
    r.snapshots.map((s) => s.path),
    [SNAP],
    '快照件必须被点名剔除',
  )
  assert.ok(r.snapshots[0].overlap >= SNAPSHOT_OVERLAP)
  assert.deepEqual(
    r.used.map((u) => u.path),
    [A1],
  )
  for (const l of MOVED) assert.ok(r.raw.has(l), '移出批次的行必须进集合')
  assert.ok(!r.raw.has(OURS.split('\n')[1]), '快照件的行不得进集合')
})

test('②b 反向对照:阈值下沿真正生效(同为一行,只是仍活在本侧的比例不同)', () => {
  const live = OURS.split('\n')[1]
  const under = [live, MOVED[0], MOVED[1], MOVED[1] + '·'] // 1/4 仍在本侧 ⇒ 移出批次
  const over = [live, OURS.split('\n')[2], MOVED[0], ''] // 2/3 仍在本侧 ⇒ 快照
  const a = selectMovedOut('AGENTS.md', [{ path: A1, text: under.join('\n') }], OURS)
  const b = selectMovedOut('AGENTS.md', [{ path: A1, text: over.join('\n') }], OURS)
  assert.equal(a.ok, true)
  assert.equal(b.ok, false)
  assert.match(b.reason, /整篇复制件/)
})

test('②c 整篇快照的第二道判别:文档缩水后行重合比例失效,章节标题覆盖仍能认出来', () => {
  // 实测形态(2026-10-25 现读):整篇旧复制件只有 2.9% 的行还活在本侧(文档已缩水),
  // 但它含本侧 58 个章节标题里的 31 个;trim 批含 0–2 个 ⇒ 门槛 8 两端都有余量。
  const oursDoc = ['# 总标题', ...Array.from({ length: 12 }, (_, i) => `## ${i + 1}. 章节`)].join(
    '\n',
  )
  const snapshotText = [
    '# 总标题(旧版措辞)',
    ...Array.from({ length: 12 }, (_, i) => `## ${i + 1}. 章节`),
  ]
    .concat(['旧正文甲(早已从本侧删掉)', '旧正文乙(早已从本侧删掉)'])
    .join('\n')
  const r = selectMovedOut('AGENTS.md', [{ path: SNAP, text: snapshotText }], oursDoc)
  assert.equal(r.ok, false, '含 13 个本侧标题的整篇复制件不得充当凭据')
  assert.equal(r.snapshots.length, 1)
  assert.ok(r.snapshots[0].headingHits >= SNAPSHOT_HEADING_HITS)
  // 反向对照:同样的行,但只含 1 个标题 ⇒ 它是移出批次,不是复制件
  const trimText = ['## 1. 章节', MOVED[0], MOVED[1]].join('\n')
  const t = selectMovedOut('AGENTS.md', [{ path: A1, text: trimText }], oursDoc)
  assert.equal(t.ok, true)
  assert.equal(t.snapshots.length, 0)
})

test('③ 本侧仍持有的行一条不扣(处置权未行使)', () => {
  const live = OURS.split('\n')[1]
  // 三行里只一行仍活在本侧(1/3 < 阈值)⇒ 这份是移出批次,但 `live` 那一行本侧还留着
  const r = selectMovedOut('AGENTS.md', [{ path: A1, text: [live, ...MOVED].join('\n') }], OURS)
  assert.equal(r.ok, true)
  const caps = archiveDropCaps(OURS, r)
  assert.ok(!caps.has(live), '本侧还在的行不得被扣')
  assert.ok(caps.has(MOVED[0]), '本侧 0 份的移出行应被扣')
})

test('④ 短行不作证据(排版残渣不算"整区移出")', () => {
  const short = '---'
  assert.ok(short.trim().length < MIN_MOVED_LINE)
  const r = selectMovedOut('AGENTS.md', [{ path: A1, text: [short, MOVED[0]].join('\n') }], OURS)
  const caps = archiveDropCaps(OURS, r)
  assert.ok(!caps.has(short), '短行被扣 = 对侧真加回来的短行会被吞')
  assert.ok(caps.has(MOVED[0]))
})

test('⑤ 取不到 ⇒ 空集(失效方向 = 多留一份,不是少带)', () => {
  // 正文取不到
  const lost = selectMovedOut('AGENTS.md', [{ path: A1, text: null }], OURS)
  assert.equal(lost.ok, false)
  assert.equal(archiveDropCaps(OURS, lost).size, 0)
  // 空清单 / 空集 / null
  assert.equal(selectMovedOut('AGENTS.md', [], OURS).ok, false)
  assert.equal(archiveDropCaps(OURS, new Set()).size, 0)
  assert.equal(archiveDropCaps(OURS, null).size, 0)
  // 无 oursText 也不能把整份归档当"本侧 0 份"的证据(空文本 ⇒ 全部 0 份)——
  // 这一条是硬纪律:调用方必须真的把本侧全文传进来,否则宁可一条不扣。
  assert.equal(archiveDropCaps('', new Set([MOVED[0]])).size, 0, '缺本侧正文 ⇒ 不受理')
})

test('⑥ 文档不在通道表里 ⇒ 不猜,直接不受理', () => {
  const r = selectMovedOut('docs/unknown.md', [{ path: A1, text: MOVED.join('\n') }], OURS)
  assert.equal(r.ok, false)
  assert.match(r.reason, /archiveOwnerFor=null/)
  assert.equal(r.raw.size, 0)
})

test('⑦ 反向对照:删掉归档件(同族 0 份)⇒ 凭据消失 ⇒ 调用方必须退回 lost', () => {
  const withArchive = selectMovedOut('AGENTS.md', [{ path: A1, text: MOVED.join('\n') }], OURS)
  const without = selectMovedOut('AGENTS.md', [], OURS)
  assert.equal(withArchive.ok, true)
  assert.equal(without.ok, false)
  assert.equal(archiveDropCaps(OURS, without).size, 0, '凭据没了还扣 = 真丢失会被洗成已归档')
})

test('⑧ 归档落点之外的件不构成凭据(同名也不算)', () => {
  const outside = 'scripts/data/AGENTS_trim-fake.md'
  const r = selectMovedOut('AGENTS.md', [{ path: outside, text: MOVED.join('\n') }], OURS)
  assert.equal(r.ok, false, '别处一份同名文件不构成仓库事实')
  assert.equal(r.raw.size, 0)
  assert.equal(__test__.norm('  甲  '), '甲')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
