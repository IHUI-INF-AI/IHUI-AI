// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:千段租约制(lib/plan-id-lease.mjs + live-doc-edit.mjs 接线,G-916936,2026-10-07)。
 *
 * 背景:两台机在同一远端 max 上各取同号,并集收敛才撞出 F9;让号是自我循环。拍板落地 =
 * 取号前先占千号段(租约行 done 形态、主键=段尾号),段内连号、段满另立下一段、占段撞号由
 * CAS 终止。本文件钉五件事:
 *  T1  租约行形态:主键=段尾号且只贡献主键(段首不占面 ⇒ 持有机第一个实号=段首,一个号不浪费);
 *      usedIdsOfPrefix 的 max 被顶到段尾 ⇒ 无租约感知的 max+1 出口结构上落在段外;
 *      畸形登记编号判据不误伤(主键 + 正文段引用都不命中"族名出现两次")。
 *  T2  parseLeases:三读数(主键/段/机)齐且互洽才算;主键≠段尾号的漂移行不认(失效方向 = 走新占段)。
 *  T3  leaseCursor 池式(2026-10-14):无租约→池内最小空闲窗;自有池内段→段内连号(剔除本行
 *      主键);段满→池内下一窗(不再越过 max);池外旧段(end>999)不可续;池满→拒绝发号;
 *      baseMax(远端只抬高)≤999 参与避让、>999 池外大号不参与。
 *  T4  resolveIdTokens 接线:给 machineId ⇒ 段内空闲序/池内新占段两态取号正确且 leaseClaims 齐全;
 *      不给 machineId ⇒ 池内最小空闲(池式新基准;旧"与旧口径逐字同形"锁随池式改造废除)。
 *  T5  appendLeaseRows:只追加不删改;区在插区头、区不在文件尾新建。
 *  T6  源码形状锁:live-doc-edit 必须经 lib 取租约判据(抄第二份必漂),且 CAS 循环内取号带 machineId。
 *  T8  段窗选择:同面同轮确定、两机窗分离(claimOffset 混机器指纹,下标=hash|窗数%窗数)、
 *      段尺寸 50、无 machineId 恒取最小窗。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  LEASE_MARK,
  LEASE_SECTION_TITLE,
  appendLeaseRows,
  buildLeaseRow,
  claimOffset,
  decideLease,
  machineIdentity,
  parseLeases,
  leaseCursor,
} from '../lib/plan-id-lease.mjs'
import { keyOfRow, usedIdsOfPrefix } from '../lib/plan-task-index.mjs'
import { __test__ as lde, MALFORMED_ID_RE } from '../live-doc-edit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const LDE_SRC = readFileSync(join(ROOT, 'scripts', 'live-doc-edit.mjs'), 'utf8')

const row = (over = {}) =>
  buildLeaseRow({
    family: 'G',
    template: 'G-%d',
    start: 1060000,
    end: 1060999,
    machineId: 'hostA-fp',
    ...over,
  })

test('T1 租约行形态:主键=段尾号、只贡献主键、max 被顶到段尾、畸形判据不误伤', () => {
  const r = row()
  assert.ok(r.startsWith('- [x] G-1060999 '), '租约行必须是 done 形态且主键=段尾号')
  assert.ok(r.includes(LEASE_MARK), '正文必须带租约标记(解析靠它)')
  assert.equal(keyOfRow(r), 'G-1060999', 'usedIdsOfPrefix 那一份 keyOfRow 取到的主键必须是段尾号')
  const base = ['- [ ] G-1059136 某票(进行中@2026-10-07/x)', r, '', LEASE_SECTION_TITLE].join('\n')
  const used = usedIdsOfPrefix(base, 'G')
  assert.equal(used.max, 1060999, '段尾号必须入占用面 ⇒ 无租约感知的 max+1 落在段外')
  assert.deepEqual(used.ids, ['G-1059136', 'G-1060999'], '租约行只贡献主键号,段首号不占面')
  // 畸形登记编号判据(族名出现两次)不得把租约行读成畸形
  assert.equal(MALFORMED_ID_RE.test(r), false, '主键不得被判成畸形')
  const segRefs = r.match(/G-1060\d+/g) ?? []
  for (const g of segRefs) assert.equal(MALFORMED_ID_RE.test(g), false, `正文引用 ${g} 不得被判成畸形`)
  assert.equal(lde.newMalformed(base, [...base.split('\n'), r].join('\n')).added.length, 0, '整行入面不得产生 added 畸形')
})

test('T2 parseLeases:三读数齐且互洽才算;漂移行不认', () => {
  const good = row()
  const otherFamily = row({ family: 'D', template: 'D-%d', start: 50, end: 1049 })
  const drift = '- [x] G-1234567 〔千段租约〕 本机=hostA-fp 段=G-1060000~G-1060999(主键与段尾不符 ⇒ 不认)'
  const noMark = '- [x] G-1060999 本机=hostA-fp 段=G-1060000~G-1060999(没有租约标记)'
  const text = [good, otherFamily, drift, noMark, '- [ ] G-1 普通票'].join('\n')
  const leases = parseLeases(text, 'G')
  assert.equal(leases.length, 1, `只认三读数互洽的那一行,实得 ${leases.length}`)
  assert.equal(leases[0].primaryKey, 'G-1060999')
  assert.equal(leases[0].machine, 'hostA-fp')
  assert.equal(leases[0].start, 1060000)
  assert.equal(leases[0].end, 1060999)
  assert.equal(parseLeases(text, 'D').length, 0, 'D 行的段声明家族与主键家族不一致 ⇒ 对 D 族也不认')
})

test('T3 leaseCursor 池式:最小窗/碎窗/池满 + 段内连号 + 段满滑窗 + 池外旧段不可续 + baseMax 避让', () => {
  // ① 无租约 ⇒ 池内最小空闲窗(无 machineId ⇒ off=0 恒取最小窗;blocked 只认 ≤999 的号)
  const c1 = leaseCursor({ usedNumbers: [700], leases: [], family: 'G' })
  assert.deepEqual(
    { mode: c1.mode, start: c1.start, end: c1.end },
    { mode: 'claim', start: 1, end: 50 },
    '池内首窗 = 1..50(段尺寸 50,end=start+49),700 只堵它自己',
  )
  // ①b 碎窗:1/2/49 已占 ⇒ "连续 50 全空闲"的最小窗从 50 起(3..52 含 49,不构成窗)
  const c1b = leaseCursor({ usedNumbers: [1, 2, 49], leases: [], family: 'G' })
  assert.deepEqual({ start: c1b.start, end: c1b.end }, { start: 50, end: 99 }, '窗必须是连续空闲段,49 处的碎片把首窗顶到 50')
  // ①c 整池装不下一段 ⇒ 池满拒绝,绝不越界发号
  const c1c = leaseCursor({ usedNumbers: [1, 2], leases: [], family: 'G', segmentSize: 3, poolMax: 4 })
  assert.deepEqual(
    { mode: c1c.mode, poolMax: c1c.poolMax, segmentSize: c1c.segmentSize },
    { mode: 'pool-exhausted', poolMax: 4, segmentSize: 3 },
    '池内找不出连续 segmentSize 个空闲 ⇒ pool-exhausted(调用方必须拒绝发号)',
  )
  // ② 自有池内段段内连号:主键(段尾=50)剔除,1/2/3 已用 ⇒ 下一号 4
  const mine = { primaryKeyNum: 50, primaryKey: 'G-50', machine: 'hostA-fp', start: 1, end: 50 }
  const c2 = leaseCursor({ usedNumbers: [1, 2, 3, 50], leases: [mine], machineId: 'hostA-fp', family: 'G' })
  assert.equal(c2.mode, 'in-lease')
  assert.equal(c2.next, 4, '段内下一个 = 段内实号 max+1(主键是段尾不是实号)')
  // ③ 段满 ⇒ 池内下一窗,不再越过 max:1..50 占满(自有段)、他机段 51..100 是保留位 ⇒
  //    无 machineId 恒取最小窗 101..150;hostA-fp 按窗数 850 取模(下标 285,离线钉死)⇒ 386..435
  const theirs = { primaryKeyNum: 100, primaryKey: 'G-100', machine: 'hostB-fp', start: 51, end: 100 }
  const full50 = Array.from({ length: 50 }, (_, i) => i + 1)
  const c3 = leaseCursor({ usedNumbers: full50, leases: [mine, theirs], machineId: 'hostA-fp', family: 'G' })
  assert.deepEqual(
    { mode: c3.mode, start: c3.start, end: c3.end },
    { mode: 'claim', start: 386, end: 435 },
    '段满滑到池内下一窗(他机段整段保留,窗只能落在 101 以后)',
  )
  const c3b = leaseCursor({ usedNumbers: full50, leases: [mine, theirs], family: 'G' })
  assert.deepEqual({ start: c3b.start, end: c3b.end }, { start: 101, end: 150 }, '无 machineId ⇒ 恒取最小候选窗 101..150')
  // ④ 池外旧段(end>999)不可续:七位数旧段是历史定格,续发就突破三位数上限 ⇒ 结构上不认,
  //    与无租约同径走池内新占(失效方向 = 多占一窗,安全侧)
  const legacy = { primaryKeyNum: 1060999, primaryKey: 'G-1060999', machine: 'hostA-fp', start: 1060000, end: 1060999 }
  const c4 = leaseCursor({ usedNumbers: [700], leases: [legacy], machineId: 'hostA-fp', family: 'G' })
  assert.equal(c4.mode, 'claim')
  assert.equal(c4.start, 281, '池外旧段不续(hostA-fp|G|900 下标 280 ⇒ candidates[280]=281,离线钉死)')
  // ⑤ baseMax(远端只抬高)≤999 参与避让:1..5 已用、远端 8 ⇒ 6..8 不发,首窗 9..58;
  //    >999 是池外大号(存量债)⇒ 不参与避让、不挡新号 ⇒ 首窗 6..55
  const c5 = leaseCursor({ usedNumbers: [1, 2, 3, 4, 5], leases: [], family: 'G', baseMax: 8 })
  assert.deepEqual({ start: c5.start, end: c5.end }, { start: 9, end: 58 }, '远端盲区段必须避让,否则宽面盲区里的号被重复发')
  const c5b = leaseCursor({ usedNumbers: [1, 2, 3, 4, 5], leases: [], family: 'G', baseMax: 2000 })
  assert.deepEqual({ start: c5b.start, end: c5b.end }, { start: 6, end: 55 }, '池外大号不参与(双方号域不相交,结构性不撞)')
})

test('T4a decideLease 胶水:真实台账面上解析+判定一次给全', () => {
  const text = [
    '- [ ] G-700 基准行。',
    row({ start: 1, end: 50 }),
    '',
    LEASE_SECTION_TITLE,
  ].join('\n')
  const used = usedIdsOfPrefix(text, 'G')
  const cur = decideLease({ baseContent: text, family: 'G', used, baseMax: used.max, machineId: 'hostA-fp' })
  assert.equal(cur.mode, 'in-lease')
  assert.equal(cur.next, 1, '自有段 1..50 段首是第一个实号(段尾主键被剔除)')
  const curB = decideLease({ baseContent: text, family: 'G', used, baseMax: used.max, machineId: 'hostB-fp' })
  assert.equal(curB.mode, 'claim')
  assert.deepEqual(
    { start: curB.start, end: curB.end },
    { start: 289, end: 338 },
    '池内新占窗:blocked{50,700}∪保留位[1..50] ⇒ 候选 850 窗,hostB-fp 下标 238(离线钉死)⇒ 51+238',
  )
  const curC = decideLease({ baseContent: text, family: 'G', used, baseMax: used.max })
  assert.deepEqual(
    { mode: curC.mode, start: curC.start, end: curC.end },
    { mode: 'claim', start: 51, end: 100 },
    '无 machineId ⇒ 恒取最小候选窗(租约保留位 1..50 之后就是 51..100)',
  )
})

test('T4b resolveIdTokens 接线:段内空闲序 / 池内新占段 / 无 machineId 池内最小空闲 / 池满拒绝', () => {
  const leased = [
    '- [ ] G-700 基准行。',
    row({ start: 1, end: 50 }),
    '',
    LEASE_SECTION_TITLE,
  ].join('\n')
  // ① 自有池内段:令牌按段内空闲序连号(段尾主键剔除),leaseNotes 交读数,无新占
  const r1 = lde.resolveIdTokens(
    ['- [ ] {{NEXT_ID:G}} 甲。', '- [ ] {{NEXT_ID:G}} 乙。'],
    leased,
    null,
    { machineId: 'hostA-fp' },
  )
  assert.equal(r1.ok, true)
  assert.equal(r1.assigned, 'G-1,G-2', '自有段 1..50 段内空闲序连号,首号=段首(一个号不浪费)')
  assert.ok(r1.leaseClaims.length === 0, '段内连号不得新占段')
  assert.ok(r1.leaseNotes.some((n) => n.includes('自有段')), '报告必须点名段内连号')
  // ② 无自有段:池内新占窗(机器指纹选下标),首号=窗首(主键=段尾,令牌领不到),leaseClaims 带段界
  const plain = '- [ ] G-700 基准行。'
  const r2 = lde.resolveIdTokens(['- [ ] {{NEXT_ID:G}} 甲。'], plain, null, { machineId: 'hostB-fp' })
  assert.equal(r2.ok, true)
  assert.equal(r2.assigned, 'G-549', '新占窗 = 第 hash(hostB-fp|G|900)%900=548 个候选窗 ⇒ 549(离线钉死)')
  assert.equal(r2.leaseClaims.length, 1)
  assert.deepEqual(
    { family: r2.leaseClaims[0].family, start: r2.leaseClaims[0].start, end: r2.leaseClaims[0].end },
    { family: 'G', start: 549, end: 598 },
  )
  // ③ 不给 machineId ⇒ 池内最小空闲(池式新基准;旧"与旧口径逐字同形"锁随池式改造废除)
  const r3 = lde.resolveIdTokens(['- [ ] {{NEXT_ID:G}} 甲。'], plain)
  assert.equal(r3.ok, true)
  assert.equal(r3.assigned, 'G-1')
  assert.deepEqual(r3.leaseClaims, [])
  assert.deepEqual(r3.leaseNotes, [])
  // ④ 段空闲数不足以覆盖本块令牌 ⇒ 拒绝:自有段 10..11 只有 10 这一个实号空闲,第二令牌领空
  const tight = row({ start: 10, end: 11 })
  const r4 = lde.resolveIdTokens(
    ['- [ ] {{NEXT_ID:G}} 甲。', '- [ ] {{NEXT_ID:G}} 乙。'],
    `- [ ] G-9 基准行。\n${tight}`,
    null,
    { machineId: 'hostA-fp' },
  )
  assert.equal(r4.ok, false)
  assert.equal(r4.reason, 'pool-exhausted:G', '单次编辑令牌数超过可领空闲数必须拒绝,而不是静默跨段')
  // ⑤ 整池占满(1..999 全被占)⇒ 池满拒绝,绝不发 1000+
  const fullPool = Array.from({ length: 999 }, (_, i) => `- [ ] G-${i + 1} 占位行${i + 1}。`).join('\n')
  const r5 = lde.resolveIdTokens(['- [ ] {{NEXT_ID:G}} 甲。'], fullPool, null, { machineId: 'hostA-fp' })
  assert.equal(r5.ok, false)
  assert.equal(r5.reason, 'pool-exhausted:G', '整池无窗 ⇒ 拒绝发号(出路=归档腾号,绝不突破三位数)')
})

test('T5 appendLeaseRows:只追加不删改;区在插区头,区不在文件尾新建', () => {
  const lines = ['- [ ] G-1 某票', '']
  const out1 = appendLeaseRows(lines, [row()])
  assert.equal(out1.length, lines.length + 3, '空行 + 区标题 + 租约行')
  assert.equal(out1[out1.length - 2], LEASE_SECTION_TITLE)
  assert.deepEqual(out1.slice(0, 2), lines.slice(0, 2), '既有行一字不动')
  const out2 = appendLeaseRows(out1, [row(), row({ start: 1062000, end: 1062999 })])
  const idx = out2.findIndex((l) => l.trim() === LEASE_SECTION_TITLE)
  assert.ok(idx > 0, '区标题必须已在')
  assert.deepEqual(out2.slice(idx + 1, idx + 3), [row(), row({ start: 1062000, end: 1062999 })], '新行插在区头')
  assert.equal(out2.filter((l) => l === row()).length, 2, '旧行仍在(只追加)')
})

test('T6 源码形状锁:live-doc-edit 必须经 lib 取租约判据,CAS 循环内的取号带 machineId', () => {
  assert.match(
    LDE_SRC,
    /import\s*\{[\s\S]*?machineIdentity[\s\S]*?\}\s*from\s*'\.\/lib\/plan-id-lease\.mjs'/,
    '机器标识必须来自 lib(同机双 checkout 各占各段的那份实现,不得在出口重抄)',
  )
  assert.match(
    LDE_SRC,
    /import\s*\{[\s\S]*?(decideLease|appendLeaseRows|buildLeaseRow)[\s\S]*?\}\s*from\s*'\.\/lib\/plan-id-lease\.mjs'/,
    '段判定/行构造/落账并线必须 import 那一份实现',
  )
  const loopStart = LDE_SRC.indexOf('for (let attempt = 1')
  const loopEnd = LDE_SRC.indexOf("if (landed === '')")
  const loop = LDE_SRC.slice(loopStart, loopEnd)
  assert.match(loop, /machineId/, 'CAS 循环内必须把 machineId 喂进取号(整批重算含租约)')
  assert.match(
    loop,
    /appendLeaseRows\(built\.next/,
    '租约行必须在畸形判据之前并进 next(写前守卫看到的就是将要提交的内容)',
  )
})

test('T7 machineIdentity:env 优先、含主机名、同根稳定', () => {
  const orig = process.env.IHUI_MACHINE_ID
  try {
    process.env.IHUI_MACHINE_ID = '  my machine 01 '
    assert.equal(machineIdentity(ROOT), 'my-machine-01', 'env 显式给优先(空白折叠成连字符)')
    delete process.env.IHUI_MACHINE_ID
    const a = machineIdentity(ROOT)
    assert.equal(machineIdentity(ROOT), a, '同根稳定')
    assert.ok(a.length > 0 && /^[^\s]+$/.test(a), '缺省标识不得含空白(租约行用 本机=<mid> 单 token 解析)')
  } finally {
    if (orig === undefined) delete process.env.IHUI_MACHINE_ID
    else process.env.IHUI_MACHINE_ID = orig
  }
})

test('T8 段窗选择(池式):同面同轮确定、两机窗分离、窗尺寸不变、无 machineId 恒取最小窗', () => {
  // 同输入两次调用:窗界确定(同机重跑不漂窗;候选窗数含在偏移派生里)
  const c1 = leaseCursor({ usedNumbers: [700], leases: [], machineId: 'hostA-fp', family: 'G' })
  const c1b = leaseCursor({ usedNumbers: [700], leases: [], machineId: 'hostA-fp', family: 'G' })
  assert.deepEqual({ start: c1b.start, end: c1b.end }, { start: c1.start, end: c1.end }, '同输入恒定')
  // 窗尺寸不变:候选窗都是连续 segmentSize 个 ⇒ end = start + segmentSize - 1
  assert.equal(c1.end - c1.start, 49, '窗尺寸必须仍是段容量 50(平移不缩水)')
  assert.equal(c1.start, 281, 'blocked{700} ⇒ 候选 900 窗,hostA-fp|G|900 下标 280 ⇒ candidates[280]=281(离线钉死)')
  // 两机同面同族:窗首(含主键=段尾号)分离 —— 下标 = hash(machineId|family|窗数) % 窗数
  const cB = leaseCursor({ usedNumbers: [700], leases: [], machineId: 'hostB-fp', family: 'G' })
  assert.equal(cB.start, 549, 'hostB-fp 下标 548(离线钉死)')
  assert.notEqual(c1.start, cB.start, '两机同面新占窗首必须分离')
  assert.notEqual(c1.end, cB.end, '主键(段尾号)必须随之分离(F9 撞号面)')
  // 下标机理直钉:claimOffset(floor=窗数, segmentSize=窗数) 的返回值就是"第几个候选窗"的下标
  assert.equal(claimOffset({ machineId: 'hostA-fp', family: 'G', floor: 900, segmentSize: 900 }), 280)
  assert.equal(claimOffset({ machineId: 'hostB-fp', family: 'G', floor: 900, segmentSize: 900 }), 548)
  // 无 machineId ⇒ off=0,恒取最小候选窗(N2/N3 回归锁同面)
  const cLegacy = leaseCursor({ usedNumbers: [700], leases: [], family: 'G' })
  assert.deepEqual(
    { mode: cLegacy.mode, start: cLegacy.start, end: cLegacy.end },
    { mode: 'claim', start: 1, end: 50 },
  )
})
