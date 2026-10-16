// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-pointer-purge 归档台账**取名**的镜像测试(AGENTS §22c:判据一律 import 源文件导出的
 * 符号,本文件不复制任何实现/正则)。
 *
 * 钉住的形状(每条都对应 2026-10-15 那次跨机同名事故的一格):
 *  ① 同机重跑:已用名必须换到未占用者;无机器标识时**逐字退回旧口径**(降级不改变既有行为)
 *  ② 跨机形状:本机 HEAD 没有、远端那一份已有 ⇒ 取名必须避开远端已用名
 *  ③ 反向对照:远端面拿掉 ⇒ 必须**喊出降级**;本地面拿不到 ⇒ 必须**拒绝取名**(§0.3 三态不并桶)
 *  ④ 正则兼容:造出的新名逐个喂给**真实消费方**(门 71 的 archivedCopy;门 13c 的 anchorVerdict
 *     那一臂随归档机制退役 295487496e2 一并退役 —— 13c 整门已拆,判据出口不复存在),
 *     由消费方自己判认不认得 —— 本文件不抄 ARCHIVE_FILE_RE
 *  ⑤ 口径同源:机器标识必须 import `lib/plan-id-lease.mjs`,不得在本脚本里第二实现
 *  ⑥ 装车证明:对真仓 HEAD 面(只读派生)现取一次,选出的名字必须真不在该面上
 *
 * ⚠️ 期望值一律写**字面文件名**,不写成"用被测函数自己算出来的名字" —— 首版就是那么写的,
 * 结果把机器标识那一半逻辑整块摘掉后 12 条照绿(输入与期望同时跟着塌,测试成了自证)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  chooseLedgerRel,
  ledgerMachineTag,
  ledgerSeqRel,
  listLedgerNamesOnSource,
  remoteLedgerFace,
  taggedLedgerRel,
} from '../plan-pointer-purge.mjs'
// 消费方判据的唯一实现:门 71 的归档豁免(anchorVerdict 所在的门 13c 随归档机制退役,
// 295487496e2,其 ④b 臂一并退役 —— 见下)。
import { archivedCopy } from '../check-plan-line-loss.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const purgeSrc = readFileSync(join(REPO, 'scripts', 'plan-pointer-purge.mjs'), 'utf8')

// ── 字面夹具(期望值不许由被测函数生成,否则变异测不出)────────────────
const REL = '.ihui-agent/archive/plan-pointer-purge-2026-10-14.md'
const TAG = 'DESKTOP-MACH-A-1a2b3c4d'
const DIR = '.ihui-agent/archive/'
const PLAIN = `${REL}`
const PLAIN2 = `${DIR}plan-pointer-purge-2026-10-14-2.md`
const PLAIN5 = `${DIR}plan-pointer-purge-2026-10-14-5.md`
const PLAIN6 = `${DIR}plan-pointer-purge-2026-10-14-6.md`
const MK = `${DIR}plan-pointer-purge-2026-10-14-${TAG}.md`
const MK2 = `${DIR}plan-pointer-purge-2026-10-14-${TAG}-2.md`
const MK3 = `${DIR}plan-pointer-purge-2026-10-14-${TAG}-3.md`
const OTHER_MK = `${DIR}plan-pointer-purge-2026-10-14-DESKTOP-MACH-B-9f8e7d6c.md`

const bn = (p) => String(p).split('/').pop()

/** 收集 note 的输出,免得测试往真终端里刷。 */
function gatherNote() {
  const seen = []
  return { seen, note: (m) => seen.push(String(m)) }
}

test('①a 同机重跑(带机器标识):-4/-5 已占 ⇒ 新名必须换到未占用者', () => {
  const local = [MK, MK2, PLAIN, PLAIN2, PLAIN5]
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({
    ledgerRel: REL,
    tag: TAG,
    localFiles: local,
    remoteFiles: [],
    note,
  })
  assert.equal(got, MK3, `实测 ${got}`)
  assert.notEqual(got, PLAIN5, '不得把已占用的旧名再交出去')
  assert.deepEqual(seen, [])
})

test('①b 同机重跑(无机器标识):与改名前口径逐字同形(-5 已占 ⇒ 取 -6)', () => {
  // 这条是"摘掉机器标识那一半逻辑时行为不变"的回归锁;摘掉**序号扫描**那一半时它会红。
  const local = [
    PLAIN,
    PLAIN2,
    `${DIR}plan-pointer-purge-2026-10-14-3.md`,
    `${DIR}plan-pointer-purge-2026-10-14-4.md`,
    PLAIN5,
  ]
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({ ledgerRel: REL, tag: '', localFiles: local, remoteFiles: [], note })
  assert.equal(got, PLAIN6, `实测 ${got}`)
  assert.deepEqual(
    seen.filter((m) => m.includes('未含远端')),
    [],
    '远端面可读(空清单也是可读)⇒ 不得喊降级',
  )
})

test('② 跨机形状:本机 HEAD 没有、远端那一份已有 ⇒ 必须避开远端已用名', () => {
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({ ledgerRel: REL, tag: TAG, localFiles: [], remoteFiles: [MK], note })
  assert.equal(got, MK2, `实测 ${got}(旧实现只问本机 HEAD ⇒ 这里会交回 MK,两侧同名)`)
  assert.ok(![MK].includes(got), '选出的名字不得就是远端已用名 —— 那正是 add/add 冲突的成因')
  assert.deepEqual(seen, [], '远端面可读 ⇒ 不该有任何降级/拒绝的喊声')
})

test('②b 远端是**别机标识**的名字 ⇒ 本机不必无故加序号(标识已把两机隔开)', () => {
  const got = chooseLedgerRel({
    ledgerRel: REL,
    tag: TAG,
    localFiles: [],
    remoteFiles: [OTHER_MK],
    note: () => {},
  })
  assert.equal(got, MK, `实测 ${got}`)
})

test('③a 反向对照:远端面拿掉 ⇒ 必须喊出降级,不得假装"远端没占用"', () => {
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({
    ledgerRel: REL,
    tag: TAG,
    localFiles: [],
    remoteFiles: null,
    remoteReason: '远端 tip 的对象不在本地对象库',
    note,
  })
  assert.equal(got, MK, '远端不可判定时仍须给出一个名字(机器标识在)')
  assert.equal(seen.length, 1, `实测喊声 ${JSON.stringify(seen)}`)
  assert.ok(seen[0].includes('未含远端'), seen[0])
  assert.ok(seen[0].includes('远端 tip 的对象不在本地对象库'), `降级必须点名原因:${seen[0]}`)
  assert.ok(seen[0].includes('机器标识'), seen[0])
})

test('③b 本地面拿不到 ⇒ 拒绝取名返回 null(取不到不等于没占用)', () => {
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({
    ledgerRel: REL,
    tag: TAG,
    localFiles: null,
    localReason: 'HEAD:.ihui-agent/archive 枚举失败',
    remoteFiles: [],
    note,
  })
  assert.equal(got, null)
  assert.equal(seen.length, 1)
  assert.ok(seen[0].includes('未判定') && seen[0].includes('拒绝取名'), seen[0])
})

test('③c 后缀全被占用 ⇒ 拒绝取名,绝不回退原名(整文件重写会抹掉旧台账)', () => {
  const local = [
    MK,
    MK2,
    MK3,
    `${DIR}plan-pointer-purge-2026-10-14-${TAG}-4.md`,
    `${DIR}plan-pointer-purge-2026-10-14-${TAG}-5.md`,
  ]
  const { seen, note } = gatherNote()
  const got = chooseLedgerRel({
    ledgerRel: REL,
    tag: TAG,
    localFiles: local,
    remoteFiles: [],
    maxSeq: 5,
    note,
  })
  assert.equal(got, null, `实测 ${got} —— 兜底回退原名等于覆盖已有台账`)
  assert.ok(seen.join('\n').includes('拒绝取名'), JSON.stringify(seen))
})

test('④a 正则兼容(门 71 消费方):新名必须落在归档豁免射程内,反向名必须不被认', () => {
  const marker = '- [ ] G-999 **被清偿行的逐字原文** —— 只在台账里留档。'
  for (const p of [MK, MK3, PLAIN6]) {
    const hit = archivedCopy(marker, { list: () => [p], read: () => `# 台账\n${marker}\n` })
    assert.equal(hit, p, `门 71 的归档豁免认不出 ${p} ⇒ 清偿删掉的行会被回捞,对打循环复活`)
  }
  // 反向锁:前缀被换掉的名字结构上不该放行 —— 证明上面三条命中不是"全都算"
  const offTarget = `${DIR}purge-ledger-2026-10-15-DESKTOP-MACH-A.md`
  assert.equal(archivedCopy(marker, { list: () => [offTarget], read: () => marker }), null)
})

test('④c 命名形态锁:标识投影与插位必须逐字产出消费方认得的形状', () => {
  assert.equal(taggedLedgerRel(REL, TAG), MK, `实测 ${taggedLedgerRel(REL, TAG)}`)
  assert.equal(ledgerSeqRel(REL, TAG, 3), MK3, `实测 ${ledgerSeqRel(REL, TAG, 3)}`)
  assert.equal(taggedLedgerRel(REL, ''), REL, '无标识 ⇒ 名字逐字回退原名')
  const tag = ledgerMachineTag('DESKTOP ♥ 中文名 01/')
  assert.ok(
    tag
      .split('')
      .every((c) =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-'.includes(c),
      ),
    `投影后仍有非法字符:${tag}`,
  )
  assert.ok(!tag.startsWith('-') && !tag.endsWith('-'), `首尾分隔符未剥净: ${tag}`)
  assert.ok(
    bn(MK).startsWith('plan-pointer-purge-') && bn(MK).endsWith('.md'),
    '前缀/扩展名射程不得被破',
  )
})

test('⑤ 口径同源:机器标识 import 自 lib/plan-id-lease.mjs,本脚本不第二实现', () => {
  assert.match(
    purgeSrc,
    /from '\.\/lib\/plan-id-lease\.mjs'/,
    '机器标识没走 plan-id-lease 那一份口径',
  )
  // 形状锁(不是判据复制):主机名/机器 GUID/仓根指纹这些"身份原料"一旦在本脚本里再算一遍,
  // 两机就可能各自漂开 —— 而那正是本票要消的形态。
  assert.doesNotMatch(purgeSrc, /hostname\(/, '本脚本自己解析主机名 = 第二份机器标识口径')
  assert.doesNotMatch(
    purgeSrc,
    /MachineGuid|machine-id/,
    '本脚本自己取机器 GUID = 第二份机器标识口径',
  )
  assert.doesNotMatch(purgeSrc, /createHash/, '本脚本自己算指纹 = 第二份机器标识口径')
})

test('⑥ 装车证明:真仓 HEAD 面只读取名一次,选出的名字必须真不在该面上', () => {
  const local = listLedgerNamesOnSource('HEAD', { root: REPO })
  assert.ok(
    Array.isArray(local.files),
    `本地 HEAD 面未判定(${local.reason})⇒ 真仓连自己的归档目录都列不出来`,
  )
  assert.ok(local.files.length > 0, '归档目录枚举到 0 份 ⇒ 判死不记绿')
  const remote = remoteLedgerFace({ root: REPO })
  const { note } = gatherNote()
  const got = chooseLedgerRel({
    tag: ledgerMachineTag('mirror-test-machine'),
    localFiles: local.files,
    localReason: local.reason,
    remoteFiles: remote.files,
    remoteReason: remote.reason,
    note,
  })
  assert.ok(got, '取名被拒 ⇒ 先看上面的点名原因')
  assert.ok(
    !local.files.map(bn).includes(bn(got)),
    `选出的 ${got} 已在真仓 HEAD 上 ⇒ 会整文件重写别人的台账`,
  )
  if (remote.files)
    assert.ok(!remote.files.map(bn).includes(bn(got)), `选出的 ${got} 已在远端那一份上`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
