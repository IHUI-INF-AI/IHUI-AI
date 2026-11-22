// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:取号拒绝的**成因归因层**(gb22,2026-10-28 立)。
 *
 * 立因(gb22 实测):G 族发号恒回 `pool-exhausted:G`,而出口硬拼的归因是"号池已满 ⇒ 归档腾号"。
 * 现读拆解(HEAD 宽面,台账⊕47 份归档件):池内租约保留段 0 段、baseMax 抬高 0 枚、远端低位独占 0 枚、
 * 声明位占用 32 枚 —— leaseCursor 当场给出 `mode:'claim'` 候选窗 58..67;真正把 freeList 清空的
 * 是**调用侧** G-14 全文件扫描面(池内 98/99 枚在面上出现过,三关全干净的仅 1 枚)。旧出口把这一型
 * 念成 POOL_FULL 并把人引向"归档腾号"这个实测 Δ=0 的无效出路(§0.8/§12f)。
 *
 * 本文件钉五件事(族用 B——`TASK_ID_PATTERN` 族表里的合法字母,形状 `B%d` 不带横杠):
 *  S1 scan-filter 归因:游标让了窗、候选却被扫描面全灭 ⇒ exhaustion.stage='scan-filter',
 *     读数(candidates/window/scanHitCount)齐全,且**一个号也没发出去**(失效方向=多要一次说明);
 *  S2 lease-window 归因:真 POOL_FULL 与 NO_CONTIGUOUS_LEASE_WINDOW 仍走游标读数,两型不并桶;
 *  S3 over-claim 归因:本批需求超过池内可领清单 ⇒ stage='over-claim' 且带 freeTotal;
 *  S4 红线·变异自证:两席同面同轮错窗领号必须不同号;任何一席领到的号不得在原面出现
 *     (G-14 未被削弱);对面并入后再领仍不撞(归因改造不得动分配层);
 *  S5 形状锁:归因句住 lib(describeExhaustion 单源),出口不得再自带旧硬拼句;
 *     读数缺失 ⇒ 恒落"未判定",绝不冒称判过(§0.3)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { __test__ as LDE } from '../live-doc-edit.mjs'
import {
  EXHAUST_STAGE,
  POOL_EXHAUST_REASON,
  SCAN_FACE_EXHAUST_REASON,
  describeExhaustion,
} from '../lib/plan-id-lease.mjs'

const resolveIdTokens = LDE.resolveIdTokens

/** 声明位行(占用面口径的"实占");B 族形状不带横杠,与 usedIdsOfPrefix 现读同形。 */
const claim = (nums) => nums.map((n) => `- [ ] B${n} 既有占位登记${n}。`).join('\n')
/** 非登记行的正文引用行:usedIdsOfPrefix 看不见、G-14 全文件扫描看得见(归档引用同型)。 */
const refs = (nums) => `取证承接:${nums.map((n) => `B${n}`).join('、')}(仅引用,非登记行)`

const TOKEN_ROW = '- [ ] {{NEXT_ID:B}} 本轮唯一新登记标题不会与占位行同题'

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// ── S1 scan-filter:占用面让了窗,窗内候选全被扫描面顶掉 ⇒ 拒绝 + 归因 + 零发号 ──
test('S1 扫描面全灭候选窗 ⇒ exhaustion.stage=scan-filter 且一个号也没发', () => {
  // 1..39、50..99 实占 ⇒ 占用口径唯一干净窗 40..49;40..49 再各埋一条正文引用 ⇒ 扫描面全灭。
  const face = [claim([...range(1, 39), ...range(50, 99)]), refs(range(40, 49))].join('\n')
  const tok = resolveIdTokens([TOKEN_ROW], face, null, { machineId: 'seatA' })
  assert.equal(tok.ok, false, '候选全灭必须拒绝,绝不发池外号')
  assert.equal(tok.reason, 'pool-exhausted:B', 'reason 字符串逐字不变(既有镜像锁认它)')
  assert.ok(!('lines' in tok), '拒绝路径不得交回任何改写后的行(零发号面)')
  const ex = tok.exhaustion
  assert.equal(ex.stage, EXHAUST_STAGE.scanFilter, '真成因=扫描关灭窗,不是池满也不是无窗')
  assert.deepEqual(ex.window, [40, 49], '候选窗读数必须现场交出(运维要能对账;49 是段尾主键位)')
  assert.equal(ex.candidates, 9, '窗内可发空间 = [start,end)(段尾号留给租约行主键,既有口径)')
  assert.equal(ex.scanHitCount, 9)
  assert.ok(
    Array.isArray(tok.scanNotes) && tok.scanNotes.some((n) => n.includes('跳过 B40')),
    '早退路径同样必须逐枚点名被跳过的号与命中位置(票面出路①)',
  )
  const line = describeExhaustion(ex)
  assert.ok(line.includes(SCAN_FACE_EXHAUST_REASON))
  assert.ok(line.includes('新字母族'), '出路必须点名"族满开新字母族"(2026-10-24 拍板的唯一真出路)')
  assert.ok(!line.includes('号池已满'), '不得把这一型念成池满(§12f:假归因=无效出路)')
})

// ── S2 lease-window:游标本体拒发 ⇒ POOL_FULL / NO_CONTIGUOUS 两型仍分档 ──
test('S2a 池内一个空闲都没有 ⇒ stage=lease-window + cursor.reason=POOL_FULL', () => {
  const face = claim(range(1, 99))
  const tok = resolveIdTokens([TOKEN_ROW], face, null, { machineId: 'seatA' })
  assert.equal(tok.ok, false)
  assert.equal(tok.exhaustion.stage, EXHAUST_STAGE.leaseWindow)
  assert.equal(tok.exhaustion.cursor.reason, POOL_EXHAUST_REASON.poolFull)
  assert.equal(tok.exhaustion.cursor.freeInPool, 0)
  assert.ok(describeExhaustion(tok.exhaustion).includes('池内一个空闲号都没有'))
})

test('S2b 有闲号却全是散点 ⇒ cursor.reason=NO_CONTIGUOUS(不被 S1 档吞并)', () => {
  const face = claim(range(1, 99).filter((n) => n % 2 === 1))
  const tok = resolveIdTokens([TOKEN_ROW], face, null, { machineId: 'seatA' })
  assert.equal(tok.ok, false)
  assert.equal(tok.exhaustion.cursor.reason, POOL_EXHAUST_REASON.noContiguousWindow)
  assert.equal(tok.exhaustion.cursor.freeInPool, 49, 'blocked 口径的空闲位只报数,不冒充可发')
})

// ── S3 over-claim:可领清单在本批领空 ⇒ stage=over-claim + freeTotal ──
test('S3 令牌数超过池内可领清单 ⇒ stage=over-claim,freeTotal 读数在场', () => {
  const face = claim(range(1, 89)) // 干净可领 = 90..99 共 10 枚
  const rows = range(1, 12).map((i) => `- [ ] {{NEXT_ID:B}} 连登第十二票会撞领空${i}。`)
  const tok = resolveIdTokens(rows, face, null, {})
  assert.equal(tok.ok, false)
  assert.equal(tok.reason, 'pool-exhausted:B')
  assert.ok(!('lines' in tok), '领空同样零发号:不得半批发出去再宣布失败')
  assert.equal(tok.exhaustion.stage, EXHAUST_STAGE.overClaim)
  assert.equal(tok.exhaustion.freeTotal, 10)
})

// ── S4 红线·变异自证:归因改造不削弱 G-14/G-916936 防撞号 ──
test('S4 两席同面同轮错窗领号互不相同;领到的号不在原面上;面推进后再领仍不撞', () => {
  // 干净窗只有 [10..19] 与 [40..49];claimOffset(seatA|B族|2窗)=0、claimOffset(seatC|B族|2窗)=1(离线钉死)。
  const face = claim([...range(1, 9), ...range(20, 39), ...range(50, 99)])
  const a = resolveIdTokens([TOKEN_ROW], face, null, { machineId: 'seatA' })
  const c = resolveIdTokens([TOKEN_ROW], face, null, { machineId: 'seatC' })
  assert.equal(a.ok, true)
  assert.equal(c.ok, true)
  const idA = /B\d+/.exec(a.lines[0])[0]
  const idC = /B\d+/.exec(c.lines[0])[0]
  assert.equal(idA, 'B10', 'seatA 错窗读数离线钉死:第一窗窗首')
  assert.equal(idC, 'B40', 'seatC 落第二窗窗首')
  assert.notEqual(
    idA,
    idC,
    '两席同面同轮必须领不同号(G-916936 千段租约的立身之本,归因改造不得动它)',
  )
  // G-14 未削弱:发出的号在原面上不得有任何出现。
  assert.ok(!face.includes(idA), `${idA} 在原面已出现 ⇒ 扫描面被绕过了`)
  assert.ok(!face.includes(idC), `${idC} 在原面已出现 ⇒ 扫描面被绕过了`)
  // 面推进(seatA 的行并入)后 seatC 再领:仍与 seatA 的号不同,且不与任何已声明号相同。
  const face2 = `${face}\n${a.lines[0]}`
  const c2 = resolveIdTokens([TOKEN_ROW], face2, null, { machineId: 'seatC' })
  assert.equal(c2.ok, true)
  const idC2 = /B\d+/.exec(c2.lines[0])[0]
  assert.notEqual(idC2, idA, '对面已把号并入台账后再领,绝不重复领同一枚')
  assert.ok(!face2.includes(idC2))
})

// ── S5 形状锁:渲染单源 + 未判定兜底 ──
test('S5a 归因句只住 lib:live-doc-edit 不得再自带"号池已满⇒归档腾号"硬拼句', () => {
  const src = readFileSync(new URL('../live-doc-edit.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('describeExhaustion,'), '主出口必须 import lib 的总渲染')
  assert.ok(src.includes('EXHAUST_STAGE'), 'stage 取值必须 import 单源,不得字面量自立')
  assert.ok(
    !src.includes('先归档已完成条目腾号'),
    '旧的假归因出路句必须从出口消失(实测对 scan 型 Δ=0)',
  )
  assert.ok(!src.includes('function describeScanFace'), '出口不得写第二份成因渲染(§22c)')
})

test('S5b 读数缺失/未知 stage ⇒ 恒落"未判定",绝不回落旧措辞冒称判过(§0.3)', () => {
  const empty = describeExhaustion({})
  assert.ok(empty.includes('未判定'))
  assert.ok(empty.includes('定向说明'))
  assert.ok(!empty.includes(POOL_EXHAUST_REASON.poolFull), '未判定时不得替池子声明状态')
  assert.ok(describeExhaustion({ stage: 'wild-guess' }).includes('未判定'))
})

// ── S6 反向分档:候选根本没产生(不是被扫描灭掉的)⇒ 不得念成 scan-filter ──
test('S6 无 machineId 且 poolFreeList 交空清单 ⇒ lease-window 档 + freeInPool=0,且不编造跳过明细', () => {
  const face = claim(range(1, 99))
  const tok = resolveIdTokens([TOKEN_ROW], face, null, {})
  assert.equal(tok.ok, false)
  assert.equal(tok.reason, 'pool-exhausted:B', 'reason 字符串逐字不变(既有镜像锁认它)')
  assert.ok(!('lines' in tok), '拒绝路径零发号')
  const ex = tok.exhaustion
  assert.equal(ex.stage, EXHAUST_STAGE.leaseWindow, '候选没进过扫描关 ⇒ 属游标/池水位档,不是扫描灭窗')
  assert.equal(ex.cursor.reason, POOL_EXHAUST_REASON.poolFull, 'poolFreeList 交空清单是量到的,不是猜的')
  assert.equal(ex.cursor.freeInPool, 0)
  assert.deepEqual(tok.scanNotes, [], '无候选被跳过 ⇒ 不得产出任何跳过明细(反向对照)')
  assert.ok(
    !describeExhaustion(ex).includes(SCAN_FACE_EXHAUST_REASON),
    '池真满不得念成 SCAN_FACE_FULL(三成因不并桶)',
  )
})

// ── S7 形状锁(§0.6/§22c):G-14 点名的措辞只许一份,两个消费方共用同一个出口 ──
test('S7 跳过点名的两句措辞在本器各只出现一次,渲染出口只有一个调用点', () => {
  const src = readFileSync(new URL('../live-doc-edit.mjs', import.meta.url), 'utf8')
  const count = (needle) => src.split(needle).length - 1
  assert.equal(
    count('G-14 全文件扫描:候选号'),
    1,
    '聚合行措辞只许一份:早退路径再内联一次就是第二份口径,漂掉的正是"该去核哪一行"的取证位',
  )
  assert.equal(count('G-14 全文件扫描:跳过'), 1, '逐枚明细措辞只许一份(同上)')
  assert.equal(
    count('describeExhaustion('),
    1,
    '成因句渲染在本器只有一个调用点(成因句住 lib,出口各拼一句必漂)',
  )
  assert.equal(typeof LDE.skippedIdNoteLines, 'function', '措辞出口必须经 __test__ 交出(§22c)')
  assert.deepEqual(LDE.skippedIdNoteLines({ skipped: [] }), [], '无明细 ⇒ 空数组(不得产噪声)')
  assert.deepEqual(LDE.skippedIdNoteLines(null), [], '输入缺席 ⇒ 空数组,不抛(失效方向是少一句噪声)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
