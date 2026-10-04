// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:F3「归档反查出口」(2026-09-29 立)。
 *
 * 判据全部经 import 取生产侧那一份实现(本文件不抄任何一条正则/主键算法)。成对性:
 *  T1 目标已不在面上、但同主键那条**在被审归档件里** ⇒ 出口成立、改写产物是内容锚点且不含行号
 *  T2 目标既不在面上也不在任何归档件里 ⇒ **拒绝自动处理**并计入无出口(不得为了清零改写字)
 *  T3 目标仍在面上 ⇒ 走**已有**那条出口(face),措辞与归档档不同,且不被归档档顶掉
 *  T4 逐字取自真仓 HEAD 面的一条指针行 + 真归档面 ⇒ 出口必须真的能命中(不是夹具自证)
 *  T5 没装载归档索引 ⇒ rotatedAuto 逐字退回旧口径,且 archivedIndexSupplied=false(不得把"没算"写成"没有")
 *  T6 出口不越过族表登记的"无自动出口"族(ref 一族即便键在归档里也不改)
 *  T7 改写不得破坏【归并】重复登记副本 标记 ⇒ 派单口径不因此重新多出一行
 */
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  archivedEntryIndex,
  auditPlan,
  compositeKeyOf,
  findRotatedPointers,
  DUP_POINTER_RE,
} from '../lib/plan-task-index.mjs'
import {
  buildMerge,
  setArchivedIndex,
  healStopReasons,
  verifyMerge,
  __test__ as mergeT,
} from '../plan-tasks-merge.mjs'
const { rewritePointer } = mergeT

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (args) =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
  })

/** 真仓 HEAD 面上的归档件(与生产同一份面判据 —— 这里走 git 只是为了拿文本喂 import 进来的索引构造器)。 */
function realArchiveIndex() {
  const listed = git([
    'ls-tree',
    '-r',
    '--name-only',
    '-z',
    'HEAD',
    '--',
    '.ihui-agent/archive',
  ])
    .split('\0')
    .filter(Boolean)
    .filter((p) => /^PROJECT_PLAN_.*\.md$/.test(p.split('/').pop()))
  return archivedEntryIndex(
    listed.map((p) => ({ name: p.split('/').pop(), text: git(['show', `HEAD:${p}`]) })),
  )
}

const PTRO =
  '- [ ] O20 公网拓扑:ai-service 零暴露 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L9999〕'
const DONE_ON_FACE = '- [x] ✅(2026-09-20) O20 公网拓扑:ai-service 零暴露'
const ARCH_LINE = '- [x] ✅(2026-09-21) O21 只在归档里的那条登记'
const ARCH_TEXT = `# 归档\n\n${ARCH_LINE}\n`
const OPEN_NOEXIT =
  '- [ ] O22 哪儿都不在的那条 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L7777〕'

// 夹具自身的前提:键必须真的能对上(对不上就是夹具错,不是判据错)
test('T0 夹具前提:指针行与被引的归档行同复合主键,且该指针本身此刻无出口', () => {
  assert.equal(compositeKeyOf(PTRO), compositeKeyOf(ARCH_LINE.replace('O21 只在归档里的那条登记', 'O20 公网拓扑:ai-service 零暴露')))
  assert.ok(!findRotatedPointers(PTRO).some((p) => p.autoFixable), '不给归档面时这条必须是无出口(旧口径)')
})

test('T1 目标已被归档代表 ⇒ 出口成立,改写产物是内容锚点且不含行号', () => {
  const idx = archivedEntryIndex([{ name: 'PROJECT_PLAN_TEST.md', text: ARCH_TEXT.replace('O21 只在归档里的那条登记', 'O20 公网拓扑:ai-service 零暴露') }])
  const doc = `${PTRO}\n${OPEN_NOEXIT}\n`
  const a = auditPlan(doc, { archivedKeys: idx })
  assert.equal(a.counts.rotatedPointers, 2, '两条指针都该被看见')
  assert.equal(a.counts.rotatedArchived, 1, '只有归档里那条算救回')
  assert.equal(a.counts.rotatedNoExit, 1, '哪儿都不在那条仍是无出口,一处都不会从账上消失')
  setArchivedIndex(idx)
  try {
    const r = buildMerge(doc, '2026-09-29')
    const one = r.changed.find((c) => c.kind.includes('F3'))
    assert.ok(one, '必须真的产出一条 F3 改写')
    assert.match(one.after, /PROJECT_PLAN_TEST\.md/, '锚点必须点名归档件,否则不可复核')
    assert.doesNotMatch(one.after, /(?:存活于|登记在|另见|参见|指向)\s*L\d/, '改写后不得再含行号指针')
    assert.equal(one.before.split('\n').length, 1, '只动这一行')
  } finally {
    setArchivedIndex(null)
  }
})

test('T1b F1 与归档档 F3 落在同一行 ⇒ 两道落地闸都不得停手;把归档值摘掉则必须各自翻红', () => {
  // 为什么这条必须住在镜像而不是只住工具自检:CI 与提交链跑的是 `node --test`(镜像),
  // 而 `--self-test` 里那几条成对断言只有人工/自检档才跑 —— 只在那儿锁,等于"revert 掉本次修复
  // 也能过 CI"(台账 G-815914 那处少传参数就是这么活下来的:127 条自检全绿而真仓 8 行卡死)。
  const idx = archivedEntryIndex([
    {
      name: 'PROJECT_PLAN_TEST.md',
      text: ARCH_TEXT.replace('O21 只在归档里的那条登记', 'O20 公网拓扑:ai-service 零暴露'),
    },
  ])
  // PTRO(未勾、指针指向 L9999 且那条只在归档里)+ DONE_ON_FACE(同复合主键的已勾那份)
  // ⇒ 同一行同时命中 F1 与 F3(归档档)—— 这正是修复前折不动的那一型。
  const doc = `${PTRO}\n${DONE_ON_FACE}\n${OPEN_NOEXIT}\n`
  setArchivedIndex(idx)
  try {
    const r = buildMerge(doc, '2026-09-29')
    const rec = r.changed.find(
      (c) => /(?:^|\+)F3(?:\+|$)/.test(c.kind) && /(?:^|\+)F1(?:\+|$)/.test(c.kind),
    )
    assert.ok(rec, `夹具必须产出 F1+F3 同一行,实测 kind=${r.changed.map((c) => c.kind).join(',')}`)
    assert.match(rec.after, /已随归档搬至/, '这一行的 F3 必须走归档档措辞(否则本例退化成 T1 的面内档测试)')
    assert.ok(rec.pointerArchived, '生产侧必须把实际用过的归档值随记录交出(闸门要靠它复现同一次改写)')
    assert.equal(rec.pointerArchived.name, 'PROJECT_PLAN_TEST.md', '交出的必须是生产侧真用过的那一份归档件')
    // ① 正当产物:两道闸都不许停手(停手 = 这一型永久折不动,即 G-815914 的现象)
    const stop = healStopReasons(doc, r.text, r.changed, 0)
    assert.deepEqual(stop, [], `归档档的 F1+F3 正当归并不得停手,实测:${JSON.stringify(stop)}`)
    const rep = verifyMerge(doc, r.text, r.changed)
    assert.deepEqual(rep.problems, [], `报告档同一形态也不得报问题:${JSON.stringify(rep.problems)}`)
    assert.equal(rep.after.rotatedAuto, 0, '可自动收口那一维必须归零')
    // ② 变异对照:把那个值摘掉(等价于修复前的闸门)⇒ 两闸必须各自重新翻红,否则①的绿可能只是恒真
    const stripped = r.changed.map((c) => ({ line: c.line, kind: c.kind, before: c.before, after: c.after }))
    assert.ok(
      healStopReasons(doc, r.text, stripped, 0).some((x) => x.includes('逐字保留')),
      '少传归档值时自愈档必须拦下来 —— 这条就是"闸门不得重推生产侧分支"的回归锁',
    )
    assert.ok(
      verifyMerge(doc, r.text, stripped).problems.some((x) => x.includes('逐字相等')),
      '少传归档值时报告档也必须点名(两闸各一份,只装一道将来另一道会漂)',
    )
  } finally {
    setArchivedIndex(null)
  }
})

test('T2 目标既不在面上也不在归档件里 ⇒ 拒绝自动处理并计入无出口', () => {
  const idx = archivedEntryIndex([{ name: 'PROJECT_PLAN_TEST.md', text: ARCH_TEXT }])
  setArchivedIndex(idx)
  try {
    const r = buildMerge(`${OPEN_NOEXIT}\n`, '2026-09-29')
    assert.equal(r.changed.length, 0, '没有出口就不许改一行')
    assert.equal(auditPlan(OPEN_NOEXIT, { archivedKeys: idx }).counts.rotatedNoExit, 1)
  } finally {
    setArchivedIndex(null)
  }
})

test('T3 目标仍在面上 ⇒ 走已有那条出口,不被归档档顶掉', () => {
  const doc = `- [ ] O20 公网拓扑:ai-service 零暴露 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L2〕
${DONE_ON_FACE}
`
  const idx = archivedEntryIndex([{ name: 'PROJECT_PLAN_TEST.md', text: ARCH_TEXT }])
  const faceOnly = auditPlan(doc)
  const withArch = auditPlan(doc, { archivedKeys: idx })
  assert.equal(faceOnly.rotated.find((p) => p.line === 1)?.exit, 'face', '目标在面上 ⇒ 走面内那条出口')
  assert.equal(withArch.rotated.find((p) => p.line === 1)?.exit, 'face', '有归档索引也必须是 face(强弱次序不得反)')
  assert.equal(withArch.counts.rotatedArchived, 0, '这一条不得被算成归档救回')
  setArchivedIndex(idx)
  try {
    const r = buildMerge(doc, '2026-09-29')
    const one = r.changed.find((c) => c.kind.includes('F3'))
    assert.ok(one, 'face 出口必须仍产出改写')
    assert.ok(!/归档/.test(one.after), '面内那条不得写成归档措辞')
    assert.match(one.after, /同主键的另一条登记 「?O20/)
  } finally {
    setArchivedIndex(null)
  }
})

test('T4 真仓 HEAD 面的逐字样本 + 真归档面 ⇒ 出口必须真能命中', () => {
  const plan = git(['show', 'HEAD:PROJECT_PLAN.md'])
  const idx = realArchiveIndex()
  assert.ok(idx.size > 0, '真归档面认得的登记不能是空的(空集 ⇒ 这一维等于没测)')
  const rotated = auditPlan(plan, { archivedKeys: idx }).rotated
  const hits = rotated.filter((p) => p.exit === 'archived')
  assert.ok(hits.length > 0, '真仓现读必须有经归档救回的指针,为 0 说明出口对生产形态失明')
  // 逐字取自被审面的那一行:改写只能由生产函数产出,本文件不重算锚点
  const sample = hits[0]
  const line = plan.split(/\r?\n/)[sample.line - 1]
  assert.equal(line, sample.raw, '样本行必须逐字来自 HEAD 面')
  const rewritten = rewritePointer(line, compositeKeyOf(line), { name: idx.get(compositeKeyOf(line)).name })
  assert.doesNotMatch(rewritten, /(?:存活于|登记在|另见|参见|指向)\s*L\d/, '真样本改写后不得再含行号')
  assert.ok(DUP_POINTER_RE.test(rewritten), '副本标记必须留着,否则派单口径会重新多出一行')
})

test('T5 未装载归档索引 ⇒ 逐字退回旧口径,并如实报"没算"而不是"没有"', () => {
  const doc = `${PTRO}
`
  const idx = archivedEntryIndex([
    { name: 'PROJECT_PLAN_TEST.md', text: ARCH_TEXT.replace('O21 只在归档里的那条登记', 'O20 公网拓扑:ai-service 零暴露') },
  ])
  const narrow = auditPlan(doc)
  const wide = auditPlan(doc, { archivedKeys: idx })
  assert.equal(narrow.counts.rotatedAuto, 0, '旧口径:auto 只算面内')
  assert.equal(narrow.counts.archivedIndexSupplied, false, '"没算归档反查"必须与"算了但没有"分得开')
  assert.equal(narrow.counts.rotatedNoExit, 1)
  assert.equal(wide.counts.archivedIndexSupplied, true)
  assert.equal(wide.counts.rotatedArchived, 1)
  assert.equal(wide.counts.rotatedAuto, 1)
  assert.ok(mergeT.POINTER_REPAIRS.alive && mergeT.POINTER_REPAIRS.dup, '两条族都必须真有出口规则(缺一条就是"判得到、修不了")')
})

test('T6 ref 一族即便键在归档里也不自动改(族表的"无出口"登记优先)', () => {
  const line = `- [ ] O21 只在归档里的那条登记 〔参见 L4242〕`
  // 归档侧的那条**就是本行翻勾后的形状** ⇒ 复合主键必然相同,唯一差别只剩族表(ref 无出口)。
  const idx = archivedEntryIndex([{ name: 'PROJECT_PLAN_TEST.md', text: line.replace('- [ ]', '- [x]') }])
  assert.ok(compositeKeyOf(line) && idx.has(compositeKeyOf(line)), '夹具前提:这条的键必须真在归档索引里,否则本例没测到族表那一关')
  const a = auditPlan(`${line}\n`, { archivedKeys: idx })
  assert.equal(a.rotated.find((p) => p.line === 1)?.family, 'ref', '夹具得真是 ref 族')
  assert.equal(a.rotated.find((p) => p.line === 1)?.exit ?? null, null, 'ref 族不得被归档出口救回')
})

test('T7 出口摘掉 ⇒ 对应用例翻红(变异自证,不是恒绿断言)', () => {
  // 把 archived 档从出口表里摘掉(等价于"只留旧面内出口"),归档那一臂必须一个都救不回来。
  //
  // ⚠️ 本例第一版写成"不喂归档索引 ⇒ rotatedAuto 必须回 0",2026-09-29 现读已不成立并被实测
  // 打成红(42 !== 0):它把"HEAD 台账上恰好没有面内出口"这条**当下状态**当成了判据前提。面内出口
  // (`autoFixable`:目标行还在面上且同复合主键)与归档反查是**两条独立出口**,前者本来就能非零 ——
  // 归并器每收一条面内指针都会让别的行指向"还在面上的同主键登记",所以这一维只会随ledger演化而涨。
  // 保留的原语只有一个:**归档那一臂必须净增**,且增的量恰好等于 archived 档的计数(它只可能由
  // 归档反查产生)。这比"auto > 0"更严:若归档臂把面内臂顶掉(两侧共用一个计数),等式当场不成立。
  const plan = git(['show', 'HEAD:PROJECT_PLAN.md'])
  const idx = realArchiveIndex()
  const face = auditPlan(plan)
  const both = auditPlan(plan, { archivedKeys: idx })
  assert.equal(face.counts.rotatedArchived, 0, '不喂归档索引 ⇒ archived 档必须回 0(它只能由归档反查产生)')
  assert.ok(
    both.counts.rotatedArchived > 0,
    `喂了归档索引就必须救回至少一条,实测 ${both.counts.rotatedArchived}(为 0 就是归档臂空转)`,
  )
  assert.equal(
    both.counts.rotatedAuto,
    face.counts.rotatedAuto + both.counts.rotatedArchived,
    `归档臂必须是**净增**而非替换:面内 ${face.counts.rotatedAuto} + 归档 ${both.counts.rotatedArchived} 应等于合并后的 ${both.counts.rotatedAuto}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
