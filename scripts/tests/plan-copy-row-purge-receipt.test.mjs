#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-copy-row-purge-receipt.test.mjs —— ④d「枚回执」档的镜像测试(goal-b34 g34-s8,2026-10-30)
 *
 * 立因:`commitReceiptVerdict` 的实现曾在 `7160346576`/`91ead7dd14`,被 `1fe3a2b42d` 的 −790 行
 * 整体回退抹掉;`65f63112c2` 重做 ④c 时只还原了归档档,枚回执档一直缺位 ⇒ HEAD 台账
 * `副本指针（编号 L6880）…(枚 290a26bc1)` 这一族(指针指向某枚提交里的已勾行)永远只能
 * archive-absent 拒删。本件按 `91ead7dd14` 的原设计逐条钉回执档的判定边界 ——
 * 判据一律 import 源脚本,零复算(§22c);夹具全走纯函数入参(快照经注入的 resolveSnapshot),
 * 判据层不碰真 git 面(与 ④c 不读盘同一条纪律)。
 *
 * 三型反向夹具(票面要求,一型一枚):
 *   A 枚号解析不出(快照取不到)⇒ 拒删并点名「快照取不到」;
 *   B 那枚里该行仍未勾        ⇒ 拒删并点名「仍未勾(活登记)」;
 *   C 同键组另有 open 承载    ⇒ 拒删并点名「open 正主」。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildArchiveIndex,
  buildLedgerFaceIndex,
  commitReceiptVerdict,
  pointerTargetVerdict,
  receiptTokenOf,
  selectCopyRowsToPurge,
} from '../plan-copy-row-purge.mjs'

const mk = (line, raw, extra = {}) => ({ line, state: 'open', raw, body: raw, key: null, claim: null, ...extra })

// 快照面:L1 非登记行 / L2 未勾登记行 / L3 已勾主行(行号型指针的三种落点)
const SNAP_LEDGER =
  '# 快照\n- [ ] **62. 未勾主行** y。\n- [x] ✅(2026-09-24) **污染守门补上第二维并同步文档**:细节。\n'
const snapOk = (token) => (/^[0-9a-f]{7,40}$/.test(token) ? SNAP_LEDGER : null)

// 真语料形状(HEAD 台账 L30762 逐字取材,行号换成夹具小号):行号型指针 + 枚 token + 加粗题面账上号
const RECEIPT_POINTER_ROW =
  '- [ ] 副本指针（编号 L6880）重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复。 **G-351〔旧号〕. 分叉合并丢掉的东西**:① 丢的实现。'

// 结清面:指针行自述副本 + 一条 `<!-- 已归档 … ✅` 墓碑(L3) + 无关活行(L4)
const LEDGER_TOMB = [
  '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
  '- [ ] 重复登记副本:见 G-351 那条。本行不进派单口径,活账以主行为准。',
  '<!-- 已归档(2026-10-15:✅(2026-10-15) **G-351. 分叉合并丢掉的东西** 完整内容在 archive -->',
  '- [ ] **G-999 甲题** 无关活行。',
  '',
].join('\n')
const faceT = buildLedgerFaceIndex(LEDGER_TOMB)
const rcOpt = (resolve, face = faceT) => ({ resolveSnapshot: resolve, ledgerFace: face })
const emptyArch = buildArchiveIndex([{ path: 'x', text: '# 空归档件\n' }])

describe('④d 枚回执:token 提取与纯函数边界', () => {
  it('枚 token 提取器:有/无两形各钉(7-40 位十六进制,取行内第一个)', () => {
    assert.equal(receiptTokenOf('- [ ] x(枚 abc1234def)。'), 'abc1234def')
    assert.equal(receiptTokenOf('- [ ] x(枚 290a26bc1)与(枚 deadbeef)。'), '290a26bc1')
    assert.equal(receiptTokenOf('无枚'), null)
    assert.equal(receiptTokenOf('枚 zzzzzzz'), null)
  })
  it('通道输入不齐 ⇒ null(判据层拒绝自行读盘,调用方逐字退回 ④c)', () => {
    assert.equal(commitReceiptVerdict(mk(1, RECEIPT_POINTER_ROW), 'L6880', null), null)
    assert.equal(
      commitReceiptVerdict(mk(1, RECEIPT_POINTER_ROW), 'L6880', { ledgerFace: faceT }),
      null,
    )
    assert.equal(
      commitReceiptVerdict(mk(1, RECEIPT_POINTER_ROW), 'L6880', { resolveSnapshot: snapOk }),
      null,
    )
  })
  it('指向非行号形态(裸编号 62)⇒ null:本档不启用,逐字退回 ④c 原判定', () => {
    assert.equal(commitReceiptVerdict(mk(1, RECEIPT_POINTER_ROW), '62', rcOpt(snapOk)), null)
  })
  it('行内无枚 token 的行号型指针 ⇒ null(没有可解析的快照 = 行号无凭据 = 判不出)', () => {
    assert.equal(
      commitReceiptVerdict(mk(1, '- [ ] 副本指针（编号 L6880）重复登记副本。'), 'L6880', rcOpt(snapOk)),
      null,
    )
  })
  it('buildLedgerFaceIndex:复选框行进 lineRows/openByKey,注释与散文不进(墓碑住在不进的那一档)', () => {
    assert.equal(faceT.lineRows.has(3), false) // 注释墓碑不是登记行
    assert.ok(faceT.lineRows.has(4)) // - [ ] G-999 是登记行
    const open999 = faceT.openByKey.get('G-999')
    assert.equal(open999?.length, 1)
    assert.equal(open999[0].line, 4)
  })
})

describe('④d 枚回执:判定五前提与三型反向夹具', () => {
  it('正例(D 型):行号型指针 ∧ 枚快照该行已勾 ∧ 账上编号无 open 正主 ∧ 有结清墓碑 ⇒ commit-receipt', () => {
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const v = commitReceiptVerdict(row, 'L3', {
      ...rcOpt(snapOk),
      deletedRowLines: new Set([1, 2]),
    })
    assert.equal(v.verdict, 'commit-receipt')
    assert.equal(v.token, '290a26bc1')
    assert.equal(v.snapshotLine, 3)
    assert.equal(v.snapshotState, 'done')
    assert.equal(v.accountKey, 'G-351') // 四档取材:首段加粗题面档命中(正尺 keyOfRow/titleOf 交 null)
    assert.deepEqual(v.tombstones, [{ line: 3, kind: 'tombstone' }])
  })
  it('反向夹具 A(枚号解析不出):resolveSnapshot 取不到快照 ⇒ archive-absent 点名「快照取不到」', () => {
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const v = commitReceiptVerdict(row, 'L3', { ...rcOpt(() => null), deletedRowLines: new Set([1]) })
    assert.equal(v.verdict, 'archive-absent')
    assert.match(v.detail[0], /快照取不到/)
  })
  it('反向夹具 B(那枚里该行仍未勾):快照 L2 是 `- [ ]` 活登记 ⇒ archive-absent 点名「仍未勾」', () => {
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L2'))
    const v = commitReceiptVerdict(row, 'L2', { ...rcOpt(snapOk), deletedRowLines: new Set([1]) })
    assert.equal(v.verdict, 'archive-absent')
    assert.match(v.detail[0], /仍未勾\(活登记\)/)
  })
  it('反向夹具 C(同键组另有 open 承载):现行面有非副本未勾主行 ⇒ archive-absent 点名「open 正主」', () => {
    const liveFace = buildLedgerFaceIndex(
      ['- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。', '- [ ] **G-351 甲题** 主行还挂着未勾。', ''].join('\n'),
    )
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const v = commitReceiptVerdict(row, 'L3', {
      resolveSnapshot: snapOk,
      ledgerFace: liveFace,
      deletedRowLines: new Set([1]),
    })
    assert.equal(v.verdict, 'archive-absent')
    assert.match(v.detail[0], /open 正主/)
  })
  it('快照行不是登记行(L1 是标题)⇒ archive-absent 点名「不是登记行」', () => {
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L1'))
    const v = commitReceiptVerdict(row, 'L1', { ...rcOpt(snapOk), deletedRowLines: new Set([1]) })
    assert.equal(v.verdict, 'archive-absent')
    assert.match(v.detail[0], /不是登记行/)
  })
  it('结清凭据缺失:面上只有非结清注释与散文引用 ⇒ 拒删(没找到活的≠找到结清的)', () => {
    const nostop = buildLedgerFaceIndex(
      [
        '- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。',
        '<!-- 重复副本锚(归并器防误回捞措辞),没有 ✅/已归档 -->',
        '  - 复盘清单里提了一嘴 `G-351` 的散文引用行。',
        '',
      ].join('\n'),
    )
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const v = commitReceiptVerdict(row, 'L3', { resolveSnapshot: snapOk, ledgerFace: nostop, deletedRowLines: new Set([1]) })
    assert.equal(v.verdict, 'archive-absent')
    assert.match(v.detail[0], /结清凭据/)
  })
  it('done 勾选行也是结清凭据(墓碑/done 两族同权,点名 kind)', () => {
    const face = buildLedgerFaceIndex(
      ['- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。', '- [x] ✅(2026-10-15) **G-351. 甲** 已勾结清。', ''].join('\n'),
    )
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const v = commitReceiptVerdict(row, 'L3', { resolveSnapshot: snapOk, ledgerFace: face, deletedRowLines: new Set([1]) })
    assert.equal(v.verdict, 'commit-receipt')
    assert.deepEqual(v.tombstones, [{ line: 2, kind: 'done-checkbox' }])
  })
})

describe('④d 接线:select/pointerTargetVerdict 通道与"未注入即逐字退回"形状锁', () => {
  it('pointerTargetVerdict:归档缺席 ∧ 回执验通 ⇒ verdict=commit-receipt;第四参缺省 ⇒ 逐字 archive-absent', () => {
    const row = mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))
    const openById = new Map()
    const withReceipt = pointerTargetVerdict(row, openById, emptyArch, {
      ...rcOpt(snapOk),
      deletedRowLines: new Set([1]),
    })
    assert.equal(withReceipt.verdict, 'commit-receipt')
    const without = pointerTargetVerdict(row, openById, emptyArch)
    assert.equal(without.verdict, 'archive-absent')
    assert.deepEqual(without.detail, [])
  })
  it('selectCopyRowsToPurge 正例:回执通道在 ⇒ 指针行可删(receiver=commit),同面 merge-note 行不经此通道(④b 未放宽)', () => {
    const rows = [
      mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3')),
      mk(2, '- [ ] 重复登记副本:本行与同标题登记 L6880(枚 290a26bc1)重复。 **G-351〔旧号〕. 分叉合并丢掉的东西**:① 丢的实现。'),
      mk(3, LEDGER_TOMB.split('\n')[2]),
      mk(4, '- [ ] **G-999 甲题** 无关活行。', { key: 'G-999' }),
    ]
    const d = selectCopyRowsToPurge(rows, { archiveIndex: emptyArch, receipt: rcOpt(snapOk) })
    assert.equal(d.length, 1)
    assert.equal(d[0].family, 'pointer-row')
    assert.equal(d[0].receiver, 'commit')
    assert.equal(d[0].key, 'L3')
    assert.equal(d[0].token, '290a26bc1')
    assert.equal(d[0].accountKey, 'G-351')
    assert.equal(d[0].survivorLine, 3)
    assert.equal(d[0].tombstones.length, 1)
  })
  it('selectCopyRowsToPurge 反例(三型经通道各拒删一枚并落 rejectLog)', () => {
    for (const [name, rows, receipt] of [
      ['A 枚号解析不出', [mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))], rcOpt(() => null)],
      ['B 快照行未勾', [mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L2'))], rcOpt(snapOk)],
      [
        'C 同键 open 正主',
        [mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'))],
        {
          resolveSnapshot: snapOk,
          ledgerFace: buildLedgerFaceIndex(
            ['- [ ] 副本指针（编号 L6880）重复登记副本:见 G-351 那条。', '- [ ] **G-351 甲题** 主行还挂着未勾。', ''].join('\n'),
          ),
        },
      ],
    ]) {
      const rejectLog = []
      const d = selectCopyRowsToPurge(rows, { archiveIndex: emptyArch, rejectLog, receipt })
      assert.equal(d.length, 0, `${name}: 不得进删除集`)
      assert.equal(rejectLog[0]?.verdict, 'archive-absent', `${name}: 必须落 archive-absent 拒删`)
      assert.ok(rejectLog[0]?.detail?.length > 0, `${name}: 拒删必须点名`)
    }
  })
  it('形状锁:未注入 receipt 通道 ⇒ 行为与补档前逐字同形(不可删,不炸)', () => {
    const rows = [mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3')), mk(2, LEDGER_TOMB.split('\n')[2])]
    assert.deepEqual(selectCopyRowsToPurge(rows, { archiveIndex: emptyArch }), [])
  })
  it('指针行若带租约(③)⇒ 通道在也不删(活账永不删,回执档不豁免 ③)', () => {
    const rows = [mk(1, RECEIPT_POINTER_ROW.replace('L6880', 'L3'), { claim: { holder: '某人' } })]
    const d = selectCopyRowsToPurge(rows, { archiveIndex: emptyArch, receipt: rcOpt(snapOk) })
    assert.equal(d.length, 0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
