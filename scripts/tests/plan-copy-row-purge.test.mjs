// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/plan-copy-row-purge.mjs` 的镜像测试(判据一律 import,零复算 —— 与 plan-row-conservation
 * 等既有镜像同一纪律)。
 *
 * 只钉 2026-10-24 新开的 ④c「归档已勾主行档」这一格(票面 G-67 同主键副本行物理归并专项):
 * 行首指针 `副本指针(编号 N)` 在新面上找不到编号 N 的 open 行(指针行 `key=null`,编号只在括注里),
 * 于是旧判据 ④ 把这些行**全数**拒删 —— 连"主行早已勾选归档、指针只是陈旧悬空"的那批也一起挡。
 *
 * 补档后必须双向锁:
 *  - A 型(归档主行已勾)⇒ 可删,且点名用复合主键(编号 + 题面前 24 字,`compositeKeyOf` 唯一实现);
 *  - B 型(归档主行未勾)⇒ 不可删,并进 rejectLog 逐条点名(删指针 = 丢唯一活登记);
 *  - 归档缺席 / 归档面没取全 ⇒ 与补档前逐字同形(不可删;判不出 ≠ 零份);
 *  - 「编号·题面」括注按题面逐字前缀收窄,`P1-②` 不得被 `P1-①` 的主行顶替(不许模糊匹配);
 *  - 新面有接收方时走原语义,归档面在不在都不影响。
 *
 * 夹具只喂 `[{ path, text }]` 进 `buildArchiveIndex`,不碰真实 `.ihui-agent/archive/`(取材面的
 * 目录枚举/取正文归 `lib/plan-id-face.mjs`,本套件不重复实现也不读盘)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildArchiveIndex, pointerTargetVerdict, selectCopyRowsToPurge } from '../plan-copy-row-purge.mjs'

const row = (line, raw, extra = {}) => ({ line, state: 'open', raw, body: raw, key: null, claim: null, ...extra })
const archOf = (text) => buildArchiveIndex([{ path: '.ihui-agent/archive/PROJECT_PLAN_x.md', text }])
const ARCHIVE_DONE = ['# 归档件', '- [x] ✅(2026-09-27) 62. 会话搜索栏挂载 + 侧栏批量选择', ''].join('\n')
const ARCHIVE_OPEN = ['# 归档件', '- [ ] 4. 观察期:连续 3 次 main push e2e 稳定绿后收官。', ''].join('\n')
const POINTER_62 = '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本,只加指针不动勾选;当前状态见 62 那条。'
const POINTER_4 = '- [ ] 副本指针(编号 4·观察期)：同主键第二份未勾选副本,只加指针不动勾选。'

describe('④c 归档已勾主行档', () => {
  it('A 型:新面缺席 ∧ 归档主行已勾 ⇒ 陈旧悬空指针可删,接收方点名到归档件', () => {
    const d = selectCopyRowsToPurge([row(1, POINTER_62)], { archiveIndex: archOf(ARCHIVE_DONE) })
    assert.equal(d.length, 1)
    assert.equal(d[0].receiver, 'archive')
    assert.equal(d[0].key, '62')
    assert.equal(d[0].family, 'pointer-row')
    assert.equal(d[0].survivorLine, 2)
    assert.equal(d[0].receiverPath, '.ihui-agent/archive/PROJECT_PLAN_x.md')
    assert.deepEqual(d[0].composites, ['62#会话搜索栏挂载+侧栏批量选择'])
  })

  it('B 型:归档主行未勾 ⇒ 不可删,并点名到那条未勾主行', () => {
    const rejectLog = []
    const d = selectCopyRowsToPurge([row(1, POINTER_4)], { archiveIndex: archOf(ARCHIVE_OPEN), rejectLog })
    assert.equal(d.length, 0)
    assert.equal(rejectLog.length, 1)
    assert.equal(rejectLog[0].verdict, 'archive-live')
    assert.equal(rejectLog[0].pointed, '4·观察期')
    assert.equal(rejectLog[0].detail[0].line, 2)
  })

  it('归档缺席 ⇒ 维持补档前判定(不可删,archive-absent)', () => {
    const rejectLog = []
    const d = selectCopyRowsToPurge([row(1, POINTER_62)], { archiveIndex: archOf('# 归档件\n'), rejectLog })
    assert.equal(d.length, 0)
    assert.equal(rejectLog[0].verdict, 'archive-absent')
  })

  it('归档面没取全 ⇒ 判不出 ≠ 零份,拒删', () => {
    const rejectLog = []
    const broken = buildArchiveIndex([{ path: '.ihui-agent/archive/PROJECT_PLAN_x.md' }])
    assert.equal(broken.ok, false)
    const d = selectCopyRowsToPurge([row(1, POINTER_62)], { archiveIndex: broken, rejectLog })
    assert.equal(d.length, 0)
    assert.equal(rejectLog[0].verdict, 'archive-undetermined')
  })

  it('编号·题面括注按题面逐字前缀收窄,`P1-②` 不得被 `P1-①` 主行顶替', () => {
    const index = archOf('# 归档件\n- [ ] P1-① 扩共享层首批:等容器运行时。\n')
    const rejectLog = []
    selectCopyRowsToPurge([row(1, '- [ ] 副本指针(编号 P1-①)：同主键第二份未勾选副本。')], { archiveIndex: index, rejectLog })
    assert.equal(rejectLog[0].verdict, 'archive-live', '同编号主行未勾 ⇒ 拒删')
    const rejectLog2 = []
    selectCopyRowsToPurge([row(1, '- [ ] 副本指针(编号 P1-②)：同主键第二份未勾选副本。')], { archiveIndex: index, rejectLog: rejectLog2 })
    assert.equal(rejectLog2[0].verdict, 'archive-absent', '题面不同 ⇒ 不算同一编号的登记行')
  })

  it('新面有接收方 ⇒ 原语义不变(归档面在不在都不影响)', () => {
    const rows = [
      row(1, '- [ ] G-10 主任务行(正文最全)', { key: 'G-10' }),
      row(2, '- [ ] 副本指针(编号 G-10)：同主键第二份未勾选副本;当前状态见 G-10 那条。'),
    ]
    const withArchive = selectCopyRowsToPurge(rows, { archiveIndex: archOf(ARCHIVE_DONE) })
    assert.equal(withArchive.length, 1)
    assert.equal(withArchive[0].receiver, 'ledger')
    assert.deepEqual(selectCopyRowsToPurge(rows), withArchive)
  })

  it('verdict 出口单一:非指针行交 no-pointer,不误判', () => {
    const openById = new Map()
    assert.equal(pointerTargetVerdict(row(1, '- [ ] 普通任务行'), openById, archOf(ARCHIVE_DONE)).verdict, 'no-pointer')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
