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
 *  T3  leaseCursor 四态:无租约→新占段;自有段→段内连号(剔除本行主键);段满→越过全局 max 新占;
 *      他机段不参与;baseMax(本地⊕远端)必须参与 floor。
 *  T4  resolveIdTokens 接线:给 machineId ⇒ 段内连号/新占段两态取号正确且 leaseClaims 齐全;
 *      **不给 machineId ⇒ 与旧口径逐字同形**(镜像 N2/N3 那张面,回归锁)。
 *  T5  appendLeaseRows:只追加不删改;区在插区头、区不在文件尾新建。
 *  T6  源码形状锁:live-doc-edit 必须经 lib 取租约判据(抄第二份必漂),且 CAS 循环内取号带 machineId。
 *  T8  段起点偏移(G-815400):两机同 floor 段起点分离、同输入稳定、段尺寸不变、
 *      无 machineId ⇒ 偏移 0 逐字旧口径。机器标识混入 machineGuid 由 T7 的稳定性断言覆盖。
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

test('T3 leaseCursor 四态 + baseMax 参与 floor', () => {
  const mine = { primaryKeyNum: 1060999, primaryKey: 'G-1060999', machine: 'hostA-fp', start: 1060000, end: 1060999 }
  const theirs = { primaryKeyNum: 1050999, primaryKey: 'G-1050999', machine: 'hostB-fp', start: 1050000, end: 1050999 }
  // ① 无租约 ⇒ 新占段 [max+1+off, max+off+1000](G-815400:off 由机器 id|family|floor 派生;
  //    本断言的 702/1403/2402 是 hostA-fp|''|700 的离线钉死值,同输入恒定)
  const c1 = leaseCursor({ usedNumbers: [700], leases: [], machineId: 'hostA-fp' })
  assert.deepEqual(
    { mode: c1.mode, start: c1.start, end: c1.end },
    { mode: 'claim', start: 1403, end: 2402 },
    '千号段尺寸 1000(end=start+999),段起点混机器偏移',
  )
  // ② 自有段段内连号:主键(段尾)剔除,实号 1060000..1060002 已用 ⇒ 下一号 1060003
  const c2 = leaseCursor({ usedNumbers: [1050500, 1060000, 1060001, 1060002, 1060999], leases: [mine, theirs], machineId: 'hostA-fp' })
  assert.equal(c2.mode, 'in-lease')
  assert.equal(c2.next, 1060003, '段内下一个必须是段内实号 max+1(他机段的号与租约主键都不算)')
  // ③ 段满 ⇒ 越过全局 max(含他机段尾)新占(off = hash(hostA-fp||1060999)%1000 = 118,离线钉死)
  const c3 = leaseCursor({ usedNumbers: [1060998, 1060999], leases: [mine, theirs], machineId: 'hostA-fp' })
  assert.deepEqual({ mode: c3.mode, start: c3.start, end: c3.end }, { mode: 'claim', start: 1061118, end: 1062117 })
  // ④ 他机身份不借段 ⇒ 直接新占(floor 被 mine 主键顶到 1060999,hostB-fp 偏移 166)
  const c4 = leaseCursor({ usedNumbers: [1060000], leases: [mine], machineId: 'hostB-fp' })
  assert.equal(c4.mode, 'claim')
  assert.equal(c4.start, 1061166)
  // ⑤ baseMax(远端顶高)必须参与新占段 floor(hostA-fp 偏移 656)
  const c5 = leaseCursor({ usedNumbers: [700], leases: [], machineId: 'hostA-fp', baseMax: 9000 })
  assert.equal(c5.start, 9657, '新占段必须站在本地⊕远端 Union 之上,否则占段本身就撞')
})

test('T4a decideLease 胶水:真实台账面上解析+判定一次给全', () => {
  const text = [
    '- [ ] G-700 基准行。',
    row(),
    '',
    LEASE_SECTION_TITLE,
  ].join('\n')
  const used = usedIdsOfPrefix(text, 'G')
  const cur = decideLease({ baseContent: text, family: 'G', used, baseMax: used.max, machineId: 'hostA-fp' })
  assert.equal(cur.mode, 'in-lease')
  assert.equal(cur.next, 1060000, '段首号是第一个实号(段尾主键被剔除)')
  const curB = decideLease({ baseContent: text, family: 'G', used, baseMax: used.max, machineId: 'hostB-fp' })
  assert.equal(curB.mode, 'claim')
  assert.equal(curB.start, 1061442, '新占段起点 = floor+1+off(G-815400,hostB-fp|G|1060999 偏移 442,离线钉死)')
})

test('T4b resolveIdTokens 接线:段内连号 / 新占段 / 无 machineId 逐字旧口径', () => {
  const leased = [
    '- [ ] G-1059999 基准行。',
    row(),
    '',
    LEASE_SECTION_TITLE,
  ].join('\n')
  // ① 自有段:两个令牌段内连号,leaseNotes 交读数,无新占
  const r1 = lde.resolveIdTokens(
    ['- [ ] {{NEXT_ID:G}} 甲。', '- [ ] {{NEXT_ID:G}} 乙。'],
    leased,
    null,
    { machineId: 'hostA-fp' },
  )
  assert.equal(r1.ok, true)
  assert.equal(r1.assigned, 'G-1060000,G-1060001', '必须段内连号,而不是被段尾主键顶到 1061000')
  assert.ok(r1.leaseClaims.length === 0, '段内连号不得新占段')
  assert.ok(r1.leaseNotes.some((n) => n.includes('自有段')), '报告必须点名段内连号')
  // ② 无自有段:新占段,首号=段首(含机器偏移),leaseClaims 带段界
  const plain = '- [ ] G-1059999 基准行。'
  const r2 = lde.resolveIdTokens(['- [ ] {{NEXT_ID:G}} 甲。'], plain, null, { machineId: 'hostB-fp' })
  assert.equal(r2.ok, true)
  assert.equal(r2.assigned, 'G-1060121', '新占段首号 = chosenMax+1+off(G-815400:hostB-fp|G|1059999 偏移 121)')
  assert.equal(r2.leaseClaims.length, 1)
  assert.deepEqual(
    { family: r2.leaseClaims[0].family, start: r2.leaseClaims[0].start, end: r2.leaseClaims[0].end },
    { family: 'G', start: 1060121, end: 1061120 },
  )
  // ③ 不给 machineId ⇒ 与旧口径逐字同形(回归锁)
  const r3 = lde.resolveIdTokens(['- [ ] {{NEXT_ID:G}} 甲。'], plain)
  assert.equal(r3.ok, true)
  assert.equal(r3.assigned, 'G-1060000')
  assert.deepEqual(r3.leaseClaims, [])
  assert.deepEqual(r3.leaseNotes, [])
  // ④ 段内连号跨段界 ⇒ 拒绝(lease-exhausted-mid-edit)
  const tight = row({ start: 10, end: 11 }).replace('G-1060999', 'G-11').replace('G-1060000~G-1060999', 'G-10~G-11')
  const r4 = lde.resolveIdTokens(
    ['- [ ] {{NEXT_ID:G}} 甲。', '- [ ] {{NEXT_ID:G}} 乙。', '- [ ] {{NEXT_ID:G}} 丙。'],
    `- [ ] G-9 基准行。\n${tight}`,
    null,
    { machineId: 'hostA-fp' },
  )
  assert.equal(r4.ok, false)
  assert.equal(r4.reason, 'lease-exhausted-mid-edit:G', '单次编辑令牌数超过段容量必须拒绝,而不是静默跨段')
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

test('T8 段起点偏移(G-815400):两机同 floor 段起点分离、同输入稳定、段尺寸不变、无 machineId 旧口径', () => {
  // 同输入两次调用:段界确定(同机重跑不漂段;floor 含在偏移派生里)
  const c1 = leaseCursor({ usedNumbers: [1059999], leases: [], machineId: 'hostA-fp', family: 'G' })
  const c1b = leaseCursor({ usedNumbers: [1059999], leases: [], machineId: 'hostA-fp', family: 'G' })
  assert.deepEqual({ start: c1b.start, end: c1b.end }, { start: c1.start, end: c1.end }, '同输入恒定')
  // 段尺寸不变:偏移只平移整段,end = start + segmentSize - 1
  assert.equal(c1.end - c1.start, 999, '段尺寸必须仍是 1000(平移不缩水)')
  assert.equal(c1.start, 1060051, 'hostA-fp|G|1059999 偏移 51(离线钉死)')
  // 两机同 floor 同族:段起点(含主键=段尾号)分离 —— 旧口径两侧都从 floor+1 起,
  // 主键与首实号必撞;hostB-fp 偏移 121 ≠ 51,离线钉死。
  const cB = leaseCursor({ usedNumbers: [1059999], leases: [], machineId: 'hostB-fp', family: 'G' })
  assert.equal(cB.start, 1060121)
  assert.notEqual(c1.start, cB.start, '两机同 floor 新占段起点必须分离')
  assert.notEqual(c1.end, cB.end, '主键(段尾号)必须随之分离(F9 撞号面)')
  // 无 machineId ⇒ 偏移 0,逐字旧口径(N2/N3 回归锁同面)
  const cLegacy = leaseCursor({ usedNumbers: [1059999], leases: [], family: 'G' })
  assert.deepEqual(
    { mode: cLegacy.mode, start: cLegacy.start, end: cLegacy.end },
    { mode: 'claim', start: 1060000, end: 1060999 },
  )
})
