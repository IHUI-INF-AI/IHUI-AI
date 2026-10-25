// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 取号器撞号防线的**并发层**取证(G-35 这一类缺陷的最后一格,2026-10-25/r3a 席)。
 *
 * 背景:G-35 的病型是"取号器把别席已占号当空闲发出 ⇒ 两个会话领同一张票"。
 * 单会话避让(候选号过全文件正则号集、命中即跳过并逐枚带位置点名)已由
 * `plan-id-allocator-collision.test.mjs` 量尽;但那一条量的是"一个会话看着一张底稿
 * 取号"。**两个会话同一刻对同一张底稿取号**会发生什么,此前没有任何夹具量过 ——
 * 而这正是"撞号"二字的定义场景。
 *
 * 防线机理(本文件取证的对象):取号发生在 `live-doc-edit.mjs` 的 CAS 循环内、每轮
 * 重读 HEAD 重算 ⇒ 先落地的一侧把"租约行 + 实号行"同批写进 HEAD 后,后落地一侧的
 * CAS 失败、重读新底稿重算,结构上避开前一侧的号。"提交前查一次占用"在高并发仓里
 * 不构成证据(live-doc-edit 头注原话),构成证据的是这个循环。
 *
 * 三条对照(方向必须双向,缺一不可):
 *   ① 同机双会话·新占窗:同一 machineId ⇒ 同一 hash ⇒ 两轮解析**确定性地**落在同一窗、
 *      拿到同一个号 —— 这就是撞号的一手来源(确定性复现,不是小概率假设);
 *      先落地者落账后,后落地者重读顺延,两会话最终号不相交。
 *   ② 同机双会话·既有共享段:两轮解析同得段内下一号(① 的另一条路径:段内连号);
 *      A 落地后 B 在段内顺延一格,不得另占新窗。
 *   ③ 异机双会话·他席段避让:A 先占窗落地后,B(异机)重算的候选窗不得压 A 的预留段
 *     (租约 reserved 的结构性避让),也不得拿 A 的实号(已占号不再发)。
 * 每条都同时断言"没有 CAS 重读时会撞(反向) + 有 CAS 重读时不撞(正向)"。
 *
 * ⚠ 判据一律从源脚本 `__test__` / lib 出口拿,本文件不写第二份"什么算该族的号"(§22c);
 * 落地装配复用 main 同一份 `appendLeaseRows` + `buildLeaseRow`(夹具与生产同一条装配,
 * 不在测试里重抄"落地后底稿长什么样")。
 * ⚠ 全部夹具是内存文本,零真仓读取 —— wb核验席 2026-10-25 复结注记记下的
 * "live-dup-guard/remote 两件在模块加载时读并发编辑中的真实台账"那一族抖动,本文件不加入。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { scanFamilyIds } from '../lib/plan-id-face.mjs'
import { appendLeaseRows, buildLeaseRow } from '../lib/plan-id-lease.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MACHINE = 'fixture-machine-concur'
const MACHINE_A = 'fixture-machine-concur-a'
const MACHINE_B = 'fixture-machine-concur-b'

const TOKEN = (title) => `- [ ] {{NEXT_ID:G}} **${title}** 正文`
const numOf = (label) => Number(/(\d+)$/.exec(String(label))?.[1] ?? Number.NaN)
const take = (lines, machineId) =>
  __test__.resolveIdTokens([TOKEN('并发新票')], lines, null, { machineId })

/**
 * 复刻 main 的落地装配(同一份函数,不抄第二份):底稿 ⊕ 令牌展开行 ⊕ 租约行。
 * main 在 CAS 循环内做的是 `appendLeaseRows(built.next, leaseClaims.map(buildLeaseRow))`,
 * 先落地一侧落进 HEAD 的就是这个形态 —— 后一侧重读看到的就是它。
 */
function landedText(baseText, tok, machineId) {
  const next = [...String(baseText).split('\n'), ...tok.lines]
  const rows = (tok.leaseClaims ?? []).map((c) => buildLeaseRow({ ...c, machineId }))
  return appendLeaseRows(next, rows).join('\n')
}

/** 无既有租约段的最小台账(该族至少一条登记行,否则取号器拒发"<族>-1")。 */
const BARE_BASE = ['# 临时台账(G-35 并发夹具)', '', '- [ ] G-05 **无关既有题** 正文', ''].join('\n')

test('① 同机双会话·新占窗:两轮解析确定性地同号(撞号的一手来源),CAS 重读后顺延不相交', () => {
  const rA = take(BARE_BASE, MACHINE)
  assert.equal(rA.ok, true, `夹具必须能发号;实得 ${JSON.stringify({ reason: rA.reason })}`)
  assert.equal(rA.leaseClaims.length, 1, '无既有段 ⇒ 走池内新占窗')
  const seg = rA.leaseClaims[0]
  const nA = numOf(rA.assigned)
  assert.equal(nA, seg.start, '窗首号 = 段首(夹具自证:扫描面不命中窗内任何号)')

  // 反向(没有 CAS 重读的那一侧):同机第二会话对**同一张底稿**解析 —— 同 machineId
  // 同 hash ⇒ 拿到的必须是同一个号。撞号不是小概率假设,是这样确定性发生的。
  const rB1 = take(BARE_BASE, MACHINE)
  assert.equal(
    rB1.assigned,
    rA.assigned,
    '同机双会话对同一底稿取号,两轮解析必须同号 —— 这一条就是"两个会话领同一张票"的实证',
  )

  // 先落地一侧落账(租约行 + 实号行同批进面,与 main 同一装配):
  const afterA = landedText(BARE_BASE, rA, MACHINE)
  assert.ok(scanFamilyIds(afterA, 'G').has(nA), 'A 的实号必须已在落地面里(夹具自证)')

  // 后落地一侧:CAS 失败 ⇒ 重读新底稿重算(A 的租约行现在是"本机自有段")
  const rB2 = take(afterA, MACHINE)
  assert.equal(rB2.ok, true, `重读后必须仍能发号;实得 ${JSON.stringify({ reason: rB2.reason })}`)
  assert.notEqual(rB2.assigned, rA.assigned, '重读后不得再拿 A 已占的号(撞号的收敛点)')
  assert.equal(rB2.assigned, `G-${nA + 1}`, 'A 新占的窗落账后即本机自有段 ⇒ 段内顺延一格')
  assert.deepEqual(rB2.leaseClaims, [], '顺延发生在段内 ⇒ 不得另占新窗(千段租约规则不变)')
  assert.ok(!scanFamilyIds(afterA, 'G').has(nA + 1), 'B 顺延后的号不得已在 A 的落地面里')
})

test('② 同机双会话·既有共享段:段内下一号被两轮解析同取,A 落地后 B 段内顺延', () => {
  const base = [
    '# 临时台账(G-35 并发夹具)',
    '',
    `- [x] G-99 〔千段租约〕 本机=${MACHINE} 段=G-90~G-99(取号器专用行)`,
    '- [ ] G-90 **段内已声明的既有题零** 正文',
    '- [ ] G-91 **段内已声明的既有题甲** 正文',
    '',
  ].join('\n')
  const rA = take(base, MACHINE)
  assert.equal(rA.assigned, 'G-92', '段内 90/91 已声明 ⇒ 下一空闲是 92')
  assert.deepEqual(rA.leaseClaims, [], '既有段内连号 ⇒ 不新占窗')

  // 反向:同机第二会话对同一底稿解析,同得 92
  const rB1 = take(base, MACHINE)
  assert.equal(rB1.assigned, 'G-92', '共享段内两轮解析同取段内下一号 —— 撞号的另一条路径')

  // A 先落地(实号行进面;段内连号不产生新租约行)
  const afterA = landedText(base, rA, MACHINE)
  assert.match(afterA, /^- \[ \] G-92 /m, 'A 的落地面必须带声明位 G-92(usedIdsOfPrefix 看得见)')

  // B 重读重算:92 已声明 ⇒ 段内顺延
  const rB2 = take(afterA, MACHINE)
  assert.equal(rB2.assigned, 'G-93', 'A 的 92 落账后,B 在共享段内顺延一格')
  assert.deepEqual(rB2.leaseClaims, [], '段内顺延不得另占新窗')
  assert.ok(!scanFamilyIds(afterA, 'G').has(93), 'B 的号不得已在 A 的落地面里')
})

test('③ 异机双会话·他席租约窗结构性避让:B 不得压 A 的预留段、不得拿 A 的实号', () => {
  const rA = take(BARE_BASE, MACHINE_A)
  assert.equal(rA.ok, true, `夹具必须能发号;实得 ${JSON.stringify({ reason: rA.reason })}`)
  const seg = rA.leaseClaims[0]
  const nA = numOf(rA.assigned)
  assert.equal(nA, seg.start, '窗首号 = 段首(夹具自证:扫描面不命中窗内任何号)')

  // A 先落地:异机 B 重读时,A 的整段 [seg.start..seg.end] 是 reserved 预留位
  const afterA = landedText(BARE_BASE, rA, MACHINE_A)
  assert.ok(scanFamilyIds(afterA, 'G').has(seg.end), 'A 的段尾主键必须入占用面(租约定理)')

  const rB = take(afterA, MACHINE_B)
  assert.equal(rB.ok, true, `异机重读后必须仍能发号;实得 ${JSON.stringify({ reason: rB.reason })}`)
  const nB = numOf(rB.assigned)
  assert.ok(
    nB < seg.start || nB > seg.end,
    `B 的号 G-${nB} 不得落进 A 的预留段 G-${seg.start}~G-${seg.end}( reserved 结构性避让)`,
  )
  if (rB.leaseClaims.length > 0) {
    const b = rB.leaseClaims[0]
    assert.ok(
      b.end < seg.start || b.start > seg.end,
      `B 新占的窗 G-${b.start}~G-${b.end} 不得与 A 的预留段相交`,
    )
  }
  assert.ok(!scanFamilyIds(afterA, 'G').has(nB), 'B 的号不得已在 A 的落地面里(已占号不再发)')
})

test('④ 装车形状锁:CAS 循环每轮重读底稿重算,失败重试路径必须在场', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  const loopStart = src.indexOf('for (let attempt = 1')
  const loopEnd = src.indexOf("if (landed === '')")
  assert.ok(loopStart >= 0 && loopEnd > loopStart, 'CAS 循环必须在场')
  const loop = src.slice(loopStart, loopEnd)
  assert.ok(
    loop.includes('const baseLines = norm(git([\'show\', `${head}:${doc}`]'),
    '每轮必须从该轮 HEAD 重读底稿(取号在循环内重算的前提)',
  )
  assert.ok(
    loop.includes('const tok = resolveIdTokens(targetLines, baseContent, remote, {'),
    '取号必须每轮重算(提交前查一次占用不构成证据)',
  )
  assert.ok(loop.includes('重取 HEAD 底稿重试'), 'CAS 失败必须重读重试(本文件三条行为测试依赖的收敛路径)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
