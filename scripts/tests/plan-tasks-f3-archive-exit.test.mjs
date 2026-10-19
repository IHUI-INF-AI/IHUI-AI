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

/**
 * 真指针语料(2026-10-16 换面):逐字取自 **HEAD 面的归档件**,而不是台账面。
 * 为什么必须换:台账面 `auditPlan(...).counts.rotatedPointers` 现读 **0** —— §1「证据指针禁行号」
 * 与清偿器把面上的 L 形指针全改写完 ⇒ "真仓现读必须有经归档救回的指针"这条前提结构上再也摆不出来
 * (T7 头注记的 2026-09-29 那次重校治的是同一型的前提当判据,今天病到了下一层)。
 * 而同一批指针逐字活在归档件里(现读 1871 条被 `findRotatedPointers` 认出)。只挑同时满足两条的行:
 *  ① 带【归并】副本标记(与 T4 原有断言同族;ref 族按族表刻意无出口,那是 T6 的射程);
 *  ② 其复合主键真在**同一张归档面**的索引里 ⇒ 唯一可能救回它的出口就是归档反查。
 * 一次性取数并缓存:归档面 = 34 份文件,重复读会把夜间 soak 拖成分钟级。
 */
let pointerCorpusCache = null
function realPointerSamples(idx) {
  if (pointerCorpusCache !== null) return pointerCorpusCache
  const listed = git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', '.ihui-agent/archive'])
    .split('\0')
    .filter(Boolean)
    .filter((p) => /^PROJECT_PLAN_.*\.md$/.test(p.split('/').pop()))
  const out = []
  for (const p of listed) {
    const text = git(['show', `HEAD:${p}`])
    for (const q of findRotatedPointers(text)) {
      if (!DUP_POINTER_RE.test(q.raw)) continue
      const key = compositeKeyOf(q.raw)
      if (!key || !idx.has(key)) continue
      out.push({ raw: q.raw, key, file: p.split('/').pop() })
      if (out.length >= 5) break
    }
    if (out.length >= 5) break
  }
  pointerCorpusCache = out
  return out
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

test('T1b 带指针的行由归档档 F3 单独收口、F1 按档 A 豁免 ⇒ 两道落地闸都不得停手;把归档值摘掉则必须各自翻红', () => {
  // 为什么这条必须住在镜像而不是只住工具自检:CI 与提交链跑的是 `node --test`(镜像),
  // 而 `--self-test` 里那几条成对断言只有人工/自检档才跑 —— 只在那儿锁,等于"revert 掉本次修复
  // 也能过 CI"(台账 G-815914 那处少传参数就是这么活下来的:127 条自检全绿而真仓 8 行卡死)。
  //
  // 2026-10-16 期望更正(现读,不是推理):本条原来要求"同一行同时命中 F1 与 F3",而 `lib/plan-task-index.mjs`
  // 头注(档 A/档 B 那一节)写明**带机器可读副本标记的行已被 DUP_POINTER_RE 从 F1 全量豁免** ——
  // 理由是"持有行判据"若按文本措辞去认,作用面恰好是豁免不掉的那批,实测无分辨力。所以 F1 与 F3
  // 在同一行上结构上不可能并存;旧期望把一条**已改掉的设计**当缺陷钉,红的是测试不是生产。
  // 覆盖面不因此缩水:① 下面把"豁免确实在生效"钉成正锁(forks 必须为 0 —— 谁把豁免去掉、让同一行
  // 被两道闸各收一次,这条就翻红);② F1 本身由紧随其后的 T1b2 用**不带指针**的同主键成对行验它仍响。
  const idx = archivedEntryIndex([
    {
      name: 'PROJECT_PLAN_TEST.md',
      text: ARCH_TEXT.replace('O21 只在归档里的那条登记', 'O20 公网拓扑:ai-service 零暴露'),
    },
  ])
  // PTRO(未勾、指针指向 L9999 且那条只在归档里)+ DONE_ON_FACE(同复合主键的已勾那份)
  const doc = `${PTRO}\n${DONE_ON_FACE}\n${OPEN_NOEXIT}\n`
  setArchivedIndex(idx)
  try {
    const a = auditPlan(doc, { archivedKeys: idx })
    assert.equal(
      a.counts.forks,
      0,
      `带【归并】指针的行不得再被算进 F1(档 A 豁免;算了就是同一行被两道闸各收一次),实测 forks=${a.counts.forks}`,
    )
    assert.equal(a.counts.rotatedArchived, 1, '这一行的出口必须来自归档反查')
    const r = buildMerge(doc, '2026-09-29')
    const rec = r.changed.find((c) => /(?:^|\+)F3(?:\+|$)/.test(c.kind))
    assert.ok(rec, `夹具必须产出 F3 改写,实测 kind=${r.changed.map((c) => c.kind).join(',')}`)
    assert.doesNotMatch(
      rec.kind,
      /F1/,
      `F3 记录的 kind 不得同时挂 F1(与上面的 forks=0 同一件事的两面),实得 kind=${rec.kind}`,
    )
    assert.match(rec.after, /已随归档搬至/, '这一行的 F3 必须走归档档措辞(否则本例退化成 T1 的面内档测试)')
    assert.ok(rec.pointerArchived, '生产侧必须把实际用过的归档值随记录交出(闸门要靠它复现同一次改写)')
    assert.equal(rec.pointerArchived.name, 'PROJECT_PLAN_TEST.md', '交出的必须是生产侧真用过的那一份归档件')
    // ① 正当产物:两道闸都不许停手(停手 = 这一型永久折不动,即 G-815914 的现象)
    const stop = healStopReasons(doc, r.text, r.changed, 0)
    assert.deepEqual(stop, [], `归档档的 F1+F3 正当归并不得停手,实测:${JSON.stringify(stop)}`)
    const rep = verifyMerge(doc, r.text, r.changed)
    assert.deepEqual(rep.problems, [], `报告档同一形态也不得报问题:${JSON.stringify(rep.problems)}`)
    assert.equal(rep.after.rotatedAuto, 0, '可自动收口那一维必须归零')
    // ② 变异对照(G-815914)—— 2026-10-16 降级为**生产者契约锁**,并留下缺口的实名记录:
    // 闸门里那条检测住在 normalizeForkedBefore(源 `plan-tasks-merge.mjs` 3692 行),射程写死为
    // "kind 同时含 F3 与 F1|F2"。而档 A 把带指针的行从 F1 全量豁免之后,**现行生产不再发 F1+F3**
    // (本文件上面实测:该夹具只产 F3,forks=0)⇒ 原来的 stripped 变异对照落在射程外,两闸双双返回空。
    // 处理口径:不删这条锁(删了就没人知道契约还在),改为**手工合成** F1+F3 的记录去喂闸门 —— 任何
    // 生产者(自检/镜像/未来的合并器)若发出这种形态且少传 pointerArchived,闸门仍必须拦。
    // ⚠️ 更正我上一手写在这里的话(当时记的是「F3-only 没有等价的少传检测,是一格没被覆盖的洞」):
    // **那个洞不存在**。实测同一条 F3-only 记录,传完整 pointerArchived 与把这一维整块摘掉,两道闸结论
    // 逐字相同 ⇒ F3-only 根本不读这个值(F3 对账走 f3Reading() 那份共用读数,G-184)。因此正确处置不是把
    // normalizeForkedBefore 的射程扩到 F3-only(试过,只是白改 before),而是把它钉成下面的不变量锁。
    const synth = r.changed.map((c) => ({
      line: c.line,
      kind: `F1+${c.kind}`,
      before: c.before,
      after: c.after,
    }))
    assert.ok(
      synth.some((c) => /F1/.test(c.kind) && /F3/.test(c.kind)),
      '合成记录必须同时挂 F1 与 F3,否则下面两条在判空集(恒真断言比没有断言更糟)',
    )
    assert.ok(
      healStopReasons(doc, r.text, synth, 0).some((x) => x.includes('逐字保留')),
      '少传归档值时自愈档必须拦下来 —— 生产者契约锁(见上面注释的射程说明)',
    )
    assert.ok(
      verifyMerge(doc, r.text, synth).problems.some((x) => x.includes('逐字相等')),
      '报告档同一形态也必须点名(两闸各一份,只装一道将来另一道会漂)',
    )
    // ②b F3-only 的**不变量锁**(2026-10-16):生产现在只发 F3-only(档 A 之后无 F1+F3 同行),
    // 而这条记录的 pointerArchived 到底传不传,两道闸必须给出**逐字相同**的结论 —— 因为它不读这个值
    // (F3 的对账自走 f3Reading() 那份共用读数,G-184)。我一度把"stripped 两闸返回空"读成漏判的洞,
    // 那是没先做这一步对照;真正该锁的是"值不承载结论",而不是"少传必红"。
    // 若哪天 F3-only 开始依赖这个值,下面这条会因两侧不再等值而翻红,而不是静默放行。
    const strippedLive = r.changed.map((c) => ({ line: c.line, kind: c.kind, before: c.before, after: c.after }))
    assert.deepEqual(
      healStopReasons(doc, r.text, strippedLive, 0),
      stop,
      'F3-only 少传 pointerArchived 与完整记录必须同结论(该值不承载这道闸)——不等值即意味着 F3 开始依赖它,须回来补正向锁',
    )
    assert.deepEqual(
      verifyMerge(doc, r.text, strippedLive).problems,
      rep.problems,
      '报告档同一不变量:传与不传结论必须一致',
    )
    assert.deepEqual(strippedLive.map((c) => c.kind), r.changed.map((c) => c.kind), '夹具前提:两组记录 kind 相同,比的只是 pointerArchived 这一维')
  } finally {
    setArchivedIndex(null)
  }
})

test('T1b2 正向对照:不带指针的同主键"一勾一未勾"仍必须响 F1 —— 上面那条豁免不是把判据削掉', () => {
  // 这条是 T1b 的配套锁。只改 T1b 而不立这条,等于"红消失但覆盖面缩了"没人签字(§12e 禁止的正是这一手:
  // 修红不得顺手削判据)。夹具现读:`auditPlan` 对不带指针的一勾一未构成对给 forks=1,
  // buildMerge 产出 kind=F1,两道闸门都不停手。
  const done = '- [x] ✅(2026-09-20) O30 一对不带任何归并指针的探针题'
  const open = '- [ ] O30 一对不带任何归并指针的探针题 〔补记@2026-09-21:只有一句说明,无副本标记〕'
  const doc = `${open}\n${done}\n`
  const a = auditPlan(doc)
  assert.equal(
    a.counts.forks,
    1,
    `F1 必须仍认这一型(实测 forks=${a.counts.forks})⇒ 一旦掉到 0 就是判据被削,本套件从防线变成掩体`,
  )
  assert.equal(a.counts.forkOpenLines, 1)
  assert.equal(a.counts.rotatedPointers, 0, '夹具前提:这一对确实不带副本标记,与 T1b 分居两族')
  const r = buildMerge(doc, '2026-09-29')
  assert.ok(
    r.changed.some((c) => /(?:^|\+)F1(?:\+|$)/.test(c.kind)),
    `必须产出 F1 改写,实测 kind=${r.changed.map((c) => c.kind).join(',') || '(无改写)'}`,
  )
  assert.deepEqual(healStopReasons(doc, r.text, r.changed, 0), [], 'F1 的正当改写不得被闸门停住')
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

test('T4 真归档面的逐字指针样本 + 同面归档索引 ⇒ 出口必须真能命中', () => {
  const idx = realArchiveIndex()
  assert.ok(idx.size > 0, '真归档面认得的登记不能是空的(空集 ⇒ 这一维等于没测)')
  const samples = realPointerSamples(idx)
  assert.ok(
    samples.length > 0,
    '真归档面里取不到"主键对得上"的逐字指针行 ⇒ 是取证面失效,判死,不许降级成"仓库里没有这一型"',
  )
  const s = samples[0]
  // 被审面只摆这一行:目标行不在面上 ⇒ 此刻若有出口,唯一可能是归档反查(不会被面内档顶包)
  const doc = `${s.raw}\n`
  const a = auditPlan(doc, { archivedKeys: idx })
  const hit = a.rotated.find((p) => p.exit === 'archived')
  assert.ok(
    hit,
    `真仓逐字样本必须经归档救回,实测 exit=${a.rotated.map((p) => String(p.exit)).join(',')} ⇒ 出口对生产形态失明`,
  )
  const line = doc.split(/\r?\n/)[hit.line - 1]
  assert.equal(line, s.raw, '样本行必须逐字来自 HEAD 归档面')
  const rewritten = rewritePointer(line, compositeKeyOf(line), { name: idx.get(compositeKeyOf(line)).name })
  assert.doesNotMatch(rewritten, /(?:存活于|登记在|另见|参见|指向)\s*L\d/, '真样本改写后不得再含行号')
  assert.ok(DUP_POINTER_RE.test(rewritten), '副本标记必须留着,否则派单口径会重新多出一行')
  // 同一条样本摘掉归档索引 ⇒ 两个出口都必须归零(证明上一条的命中不是面内档冒充来的)
  const dry = auditPlan(doc)
  assert.equal(dry.counts.rotatedArchived, 0, '不喂索引不得有归档档出口')
  assert.equal(dry.counts.rotatedAuto, 0, '不喂索引时这条样本也不得有面内出口')
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
  assert.equal(
    both.counts.rotatedAuto,
    face.counts.rotatedAuto + both.counts.rotatedArchived,
    `归档臂必须是**净增**而非替换:面内 ${face.counts.rotatedAuto} + 归档 ${both.counts.rotatedArchived} 应等于合并后的 ${both.counts.rotatedAuto}`,
  )
  // "喂了归档索引就必须 >0"这一半**不能钉在台账面上**:现读 `auditPlan(台账面).counts.rotatedPointers = 0`
  // (§1 禁行号 + 清偿器已把面上的 L 形指针改写干净),把它留在台账面上等于又一次"拿当下状态当前提"——
  // 正是本用例头注记的 2026-09-29 那次重校的同型复发。非空那一半搬到真归档语料(逐字样本),并把成对
  // 对照做足:同一份语料摘掉索引 ⇒ archived 必回 0;喂上 ⇒ 必净增。
  const samples = realPointerSamples(idx)
  assert.ok(samples.length > 0, '真归档面取不到逐字指针样本 ⇒ 取证面失效,判死,不许当成"这一型不存在"')
  const corpus = samples.map((x) => x.raw).join('\n')
  const cDry = auditPlan(corpus)
  const cWide = auditPlan(corpus, { archivedKeys: idx })
  assert.equal(cDry.counts.rotatedArchived, 0, '同一份真语料:不喂索引时 archived 必须是 0')
  assert.ok(
    cWide.counts.rotatedArchived > 0,
    `同一份真语料:喂上索引必须净增,实测 ${cWide.counts.rotatedArchived}(为 0 就是归档臂空转)`,
  )
  assert.equal(
    cWide.counts.rotatedAuto,
    cDry.counts.rotatedAuto + cWide.counts.rotatedArchived,
    '真语料两侧也必须满足净增等式(归档臂不得顶掉面内臂)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
