// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks 镜像测试(§22c)—— 判据跑在**构造面**上，真实文档只用来做"形态对得上"的正向证明。
 *
 * 为什么必须有这一份：`node scripts/plan-tasks.mjs --self-test` 是同一个模块自己写的断言，
 * 它和被测实现同源；这一文件从**外部** import 生产出口，证明"接线在位的判据"确实能被消费者拿到。
 *
 * §5c 溯源水印：本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  DECOR_RE_SOURCE,
  DECOR_STATUS_WORDS,
  POINTER_FAMILIES,
  pointerBlindness,
  VOID_MARK_RE,
  auditPlan,
  compositeKeyOf,
  dispositionOf,
  findIdCollisions,
  findRotatedPointers,
  keyOfRow,
  titleIsDegenerate,
  titleOf,
  usedIdsOfPrefix,
  bodyOfRow,
} from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  countNewUndisposed,
  f9GroupLine,
  f9KeySetOf,
  f9Ratchet,
  gate,
  grewViolations,
  newCollisionGroups,
  parseArgs,
  planF9BaselineRewrite,
  probe,
  replaceTopLevelJsonValueText,
  ratchetViolations,
} from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const FIXTURE = [
  '# 计划',
  '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明文字。',
  '- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着 —— 该被 F1 点名。',
  '- [ ] **D98 未做的任务**:这条是真待办,不得被任何判据点名。',
  '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕—— 该被 F2 点名。',
  '- [ ] **D96 指针**:本行正题逐字存活于 L1 的同编号登记 —— L1 不是条目行,该被 F3 点名。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '',
].join('\n')

test('M1 构造面:三条判据各命中一条,且真待办不被点名', () => {
  const a = auditPlan(FIXTURE)
  if (a.counts.forks !== 1 || !a.forks[0].key.startsWith('D99'))
    throw new Error(`F1 判歪:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.voidRows !== 1 || !a.voidRows[0].raw.includes('D97'))
    throw new Error(`F2 判歪:${JSON.stringify(a.voidRows.map((r) => r.line))}`)
  if (a.counts.rotatedPointers !== 1 || a.rotated[0].target !== 1)
    throw new Error(`F3 判歪:${JSON.stringify(a.rotated)}`)
  if (a.counts.claimable !== 2) throw new Error(`派单口径应为 2,实测 ${a.counts.claimable}`)
  const opened = a.claimableRows.map((r) => r.raw)
  if (!opened.some((s) => s.includes('D98')) || !opened.some((s) => s.includes('D96')))
    throw new Error('派单口径漏掉真待办')
})

test('M2 反向对照:干净文档三条全零(判据不得无牙地一直红)', () => {
  const a = auditPlan(
    ['- [ ] **D90 干净任务**:无人认领。', '- [x] ✅(2026-09-26) **D91 干净完成**:已落账。'].join(
      '\n',
    ),
  )
  for (const k of ['forks', 'voidRows', 'rotatedPointers'])
    if (a.counts[k] !== 0) throw new Error(`${k} 应为 0,实测 ${a.counts[k]}`)
  if (a.counts.claimable !== 1) throw new Error(`派单口径应为 1,实测 ${a.counts.claimable}`)
})

test('M3 变异对照:把 F1 的判据对象拆开写,分叉必须消失(证明 F1 靠的是主键相等而非巧合)', () => {
  const mutated = FIXTURE.replace(
    '- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着',
    '- [ ] **D99 已被改写成另一件事**:内容完全不同',
  )
  const a = auditPlan(mutated)
  if (a.counts.forks !== 0) throw new Error('拆掉同主键后 F1 仍报分叉 ⇒ 判据在巧合上发光')
  if (a.counts.rotatedPointers !== 1) throw new Error('变异不应波及 F3,实测变了')
})

/**
 * 真实形态样本取自**固定的历史 blob**(`0bc0af653df^` = 首次归并的前一版),不取当前 HEAD。
 *
 * 为什么不取 HEAD:这两条要证的是"判据认得现实里发生过的形态"。而现实已经**被自己修好了** ——
 * 清偿之后 HEAD 上就没有"判:裸副本"的未勾选行、也没有腐烂指针了,拿 HEAD 当夹具的断言
 * 会在成功那一轮变红(第一版正是如此)。钉一个历史版本 = 证明永久可复现;
 * 读不到该版本时**必须失败**,不许静默跳过(跳过就是把"没判"写成"判过了")。
 */
const SAMPLE_REV = '0bc0af653df^'
function realSample() {
  const lines = gitRaw(['show', `${SAMPLE_REV}:PROJECT_PLAN.md`], ROOT).split(/\r?\n/)
  const voidRows = lines.filter((l) => /^\s*- \[ \]/.test(l) && /判:裸副本|勿照本行派单/.test(l))
  const pointerRows = lines.filter((l) => /存活于\s*L\d{1,6}/.test(l))
  return { voidRows, pointerRows }
}

test('M4 真实形态正向证明:历史 HEAD 里"判:裸副本"那批行必须被 F2 认得(§22c)', () => {
  const { voidRows } = realSample()
  if (voidRows.length === 0)
    throw new Error(
      `${SAMPLE_REV} 里读不到"判:裸副本/勿照本行派单"的未勾选行 —— 样本钉死失效,须换一个历史版本,不得跳过`,
    )
  const a = auditPlan(voidRows.join('\n'))
  if (a.voidRows.length !== voidRows.length)
    throw new Error(`F2 对真实形态漏判:${a.voidRows.length}/${voidRows.length}`)
  if (!VOID_MARK_RE.test(voidRows[0])) throw new Error('VOID_MARK_RE 不认第一条真实样本')
})

test('M5 真实文档的行号指针确实会腐烂(F3 守的是发生过的事,不是假想)', () => {
  const { pointerRows } = realSample()
  if (pointerRows.length === 0)
    throw new Error(`${SAMPLE_REV} 里已无 L 号指针样本 —— 换历史版本,不得跳过`)
  const bad = findRotatedPointers(pointerRows.join('\n'))
  if (bad.length === 0) throw new Error('F3 对真实形态一条都没点到 ⇒ 判据对该形态失明')
  const known = [
    '目标行不存在',
    '目标行不是条目行',
    '目标行是另一条(复合主键不等)',
    '行号指针即使还指得准也不许存在(§1 要求内容锚点)',
  ]
  for (const b of bad)
    if (!known.includes(b.reason)) throw new Error(`出现未登记的原因分类:${b.reason}`)
})

test('M6 棘轮只点名上涨:等值/下降/缺项/坏值都不许判红', () => {
  const items = [
    ['F1', '同主键两态并存(组)', 5],
    ['F2', '带作废声明未落账(行)', 3],
    ['F3', '行号指针已腐烂(处)', 0],
  ]
  if (ratchetViolations(null, items).length !== 0) throw new Error('无基线时不得凭空判红')
  const one = ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items)
  if (one.length !== 1 || !one[0].includes('F1'))
    throw new Error(`应只点名上涨项,实测 ${JSON.stringify(one)}`)
  if (ratchetViolations({ F1: 9, F2: 9 }, items).length !== 0) throw new Error('低于基线不得判红')
  if (ratchetViolations({ F1: 'x' }, items).length !== 0)
    throw new Error('基线坏值不得判红(也不得声称通过)')
})

test('M7 主键收窄:行文引用不得算第二次登记', () => {
  const src = [
    '- [x] ✅(2026-09-26) **D10 真条目**:说明。',
    '- [ ] **D11 另一件事**:见 D10 的结论。',
  ].join('\n')
  const a = auditPlan(src)
  if (a.counts.forks !== 0)
    throw new Error(`引用被误算成分叉:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.claimable !== 1) throw new Error('D11 应留在派单口径里')
})

test('M8 F4 同题待办:两条只算一条活,已标副本的行不重复计(幂等)', () => {
  const pair = ['- [ ] **D12 同一件事**:短。', '- [ ] **D12 同一件事**:长一些的那条登记。'].join(
    '\n',
  )
  const a = auditPlan(pair)
  if (a.counts.dupOpenCopies !== 1)
    throw new Error(`一对同题待办应计 1 副本,实测 ${a.counts.dupOpenCopies}`)
  if (a.counts.claimable !== 1) throw new Error(`派单口径应只留 1 行,实测 ${a.counts.claimable}`)
  if (a.dupCopies[0].row.raw.length >= a.dupCopies[0].survivor.raw.length)
    throw new Error('幸存者必须是正文更长的那条(承载信息最多)')
  // 反向:副本已被写明"与哪条同题"之后,不得再被算成待清偿副本(否则归并动作永不收敛、每次都喊)
  const marked = [
    pair.split('\n')[0],
    `${pair.split('\n')[1]} 〔【归并】重复登记副本:同题正文以另一条为准(2026-09-26)。〕`,
  ].join('\n')
  const b = auditPlan(marked)
  if (b.counts.dupOpenCopies !== 0) throw new Error(`已标副本仍在计债:${b.counts.dupOpenCopies}`)
  if (b.counts.voidRows !== 0) throw new Error('副本指针不得被 F2 当作废声明(F2 与 F4 判据不串门)')
  if (b.counts.claimable !== 1) throw new Error(`标记后派单口径仍应为 1,实测 ${b.counts.claimable}`)
})

/**
 * M9 F6 块级维度的**成套性**。为什么单独立一条而不是靠自测:
 * `ratchetViolations` 明写"基线里没有某项 ⇒ 不判该项(既不 0 容忍也不通过)" —— 这条善意
 * 的缺项放过意味着:加一维判据却忘了往基线里写键,那一维就**静默不再被看守**,
 * 而报告一切正常。所以这里判的是"probe 里出现的每一维,基线必须都有数字键"。
 */
test('M9 每一维判据都必须有基线键(缺项=那一维静默不判,而账面看不出来)', () => {
  const src = readFileSync(new URL('../plan-tasks.mjs', import.meta.url), 'utf8')
  const body = src.slice(src.indexOf('const probe = (a) => ['))
  const arr = body.slice(0, body.indexOf('\n]') + 1)
  const keys = [...arr.matchAll(/\['(F\d)'/g)].map((m) => m[1])
  if (keys.length < 5)
    throw new Error(`probe 维度解析异常(只数到 ${keys.length} 个,数组截断了):判据本身失效`)
  if (!keys.includes('F6'))
    throw new Error('F6 块级维度不在 probe 里 ⇒ 提交链根本不判它,本条随之无牙')
  const base = JSON.parse(
    readFileSync(new URL('../../scripts/plan-task-state-baseline.json', import.meta.url), 'utf8'),
  )
  for (const k of keys) {
    if (k === 'F5') continue // F5 方向相反,单独由 gate() 判,不走 ratchetViolations
    if (k === 'F9') {
      // G-312:F9 的锚点是**键集合**而不是计数。"缺项/错形状 ⇒ 那一维静默不判"这条善意对两种
      // 形状同样成立,所以本条必须按新形状判 —— 退回 `typeof === 'number'` 等于把迁移后的锚点
      // 当成"缺项",而 gate() 侧对整数形状是**判无法判定(exit 2)**,两边对同一份基线给出相反结论。
      if (!Array.isArray(base.F9) || base.F9.some((x) => typeof x !== 'string' || x === ''))
        throw new Error(
          `基线 F9 不是"非空字符串数组"⇒ 这一维只能判"形状未迁移",不得被读成通过:${JSON.stringify(base.F9 ?? null).slice(0, 60)}`,
        )
      if (JSON.stringify([...base.F9].sort()) !== JSON.stringify(base.F9))
        throw new Error('基线 F9 必须已排序 —— 未排序时"是否收窄"随人工编辑顺序漂移,锚点就不再是一个集合')
      if (new Set(base.F9).size !== base.F9.length)
        throw new Error('基线 F9 有重复键 ⇒ "基线里没有的键"会算重,棘轮读数不再等于组数')
      continue
    }
    if (typeof base[k] !== 'number')
      throw new Error(
        `基线缺 ${k}(棘轮对缺项那一维完全不判 ⇒ 加维必须同笔写基线):${JSON.stringify(base)}`,
      )
  }
})

test('M10 F6 只有"变多"判红,清偿必须能变绿(反方向判红=没人敢做归并)', () => {
  const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const BLK = [
    LP('- 块行一:整块登记被并发 union 追加两遍,行级四条看不见这一维'),
    LP('- 块行二:第二行,过块级阈值才计入'),
    LP('- 块行三:第三行,三行成一个块'),
  ].join('\n')
  const one = `## 甲\n${BLK}\n\n尾行非 bullet`
  const two = `## 甲\n${BLK}\n## 乙\n${BLK}\n\n尾行非 bullet`
  const grew = grewViolations(auditPlan(two), auditPlan(one))
  if (!grew.some((x) => x.startsWith('F6')))
    throw new Error(`多出一份块必须点名 F6,实测 ${JSON.stringify(grew)}`)
  const shrank = grewViolations(auditPlan(one), auditPlan(two))
  if (shrank.some((x) => x.startsWith('F6')))
    throw new Error(`收口(2 份→1 份)不得判红:${JSON.stringify(shrank)}`)
})

/**
 * M11 F8「新增登记必须有交代」的**成套性与方向**。
 * 为什么单独立一条而不是靠自测(§22c:同源断言只证明"函数会给答案",不证明"有人问它"):
 *  F8 走的是和 F1–F6 同一条差值棘轮通道,而这条通道有两个静默失效口 ——
 *  ① 维度没进 `probe()` ⇒ 提交链根本不判它(和 F6 当年的注册漂移同型);
 *  ② 基线里没写 F8 键 ⇒ `ratchetViolations` 明写"缺项不判该项",那一维等于没看守(M9 已泛判键存在,
 *    这里判的是地板值确实是 0 = 零容忍,而不是被人顺手抬成一个能通过任何新增的数)。
 * 再加两条方向锁:涨必红、清偿必绿 —— 反方向判红等于没人敢补交代。
 */
test('M11 F8 成套性:进 probe / 基线地板为 0 / 涨判红降判绿(缺一条就是静默不判)', () => {
  const dims = probe({
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      newUndisposed: 3,
      mergeNotes: 99,
    },
  })
  const f8 = dims.find(([k]) => k === 'F8')
  if (!f8)
    throw new Error(`probe 里没有 F8 ⇒ 提交链不判它:${JSON.stringify(dims.map((d) => d[0]))}`)
  if (f8[2] !== 3) throw new Error(`F8 读数没接上 newUndisposed,实测 ${f8[2]}`)
  // 存量裸账**不算在本次提交头上**:同一面自比必须为 0 —— 写错这一条,每次提交都会被人
  // 三年前欠的账钉红,那正是本仓反复记录的恒红门形态(§12e)。反向:新带进来的一条必须计债。
  const bareFace = auditPlan(['- [ ] **裸账**:没有日期、没有归属、没认领。', ''].join('\n'))
  if (countNewUndisposed(bareFace, bareFace) !== 0)
    throw new Error('同一面自比必须为 0(存量不是本次的锅)')
  if (countNewUndisposed(bareFace, null) !== 0) throw new Error('没有基准面时不得凭空数出"新增"')
  const withNewRow = auditPlan(
    [
      '- [ ] **裸账**:没有日期、没有归属、没认领。',
      '- [ ] **新账**:今天写进来,同样没交代。',
      '',
    ].join('\n'),
  )
  if (countNewUndisposed(withNewRow, bareFace) !== 1)
    throw new Error(`只有本次带进来的那条计债,实测 ${countNewUndisposed(withNewRow, bareFace)}`)
  const base = JSON.parse(
    readFileSync(new URL('../../scripts/plan-task-state-baseline.json', import.meta.url), 'utf8'),
  )
  if (base.F8 !== 0)
    throw new Error(
      `基线 F8 地板应为 0(零容忍),实测 ${JSON.stringify(base.F8)} —— 抬高它就是给无交代登记发通行证`,
    )
  const face = (n) => ({
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      newUndisposed: n,
      mergeNotes: 99,
      stale: 0,
      undated: 0,
    },
    staleRows: [],
  })
  const run = (fn) => {
    const log = console.log
    console.log = () => {}
    try {
      return fn()
    } finally {
      console.log = log
    }
  }
  // 差值棘轮:索引面比 HEAD 面多出"无交代新行"必须 exit 1(这是提交链上真正的拦点)
  const grewRc = run(() => gate(face(1), false, ROOT, face(0), null))
  if (grewRc !== 1) throw new Error(`新增无交代行由 0 涨到 1 应拦下本次提交,实测 exit ${grewRc}`)
  const flatRc = run(() => gate(face(0), false, ROOT, face(0), null))
  if (flatRc !== 0) throw new Error(`什么都没带进来的提交不得被拦(那是恒红门),实测 exit ${flatRc}`)
  // 反向:基线棘轮对"这次没新增"也不得翻红(全量档 newUndisposed 算不出来 ⇒ probe 兜 0)
  const baseOnly = run(() => ratchetViolations({ F8: 0 }, probe(face(0))))
  if (baseOnly.length) throw new Error(`全量档 F8=0 不得判红:${JSON.stringify(baseOnly)}`)
})

/**
 * M12 F7 归属分层的**方向锁**:分层只许影响"现在可做"这一把显式过滤,
 * 不得悄悄缩水默认派单口径。
 * 为什么这是红线而不是审美:分类是从正文正则推出来的,推错一条的代价必须是可见的 ——
 * 如果等待桶的行被直接从 `claimable` 里扣掉,一件其实能做的活会**在任何清单里都不现身**,
 * 而账面看起来只是"少了几条待办"。判据失效的表现永远是安静(本仓记过最多次的那一型)。
 */
test('M12 归属分层不得把行从默认派单面踢掉(只许 --dispatchable 显式过滤)', () => {
  const SRC = [
    '- [ ] **K1 归他人**:归属:desktop 持有人,本线只登记。',
    '- [ ] **K2 等条件**:本机结构性缺环境(adb 不存在)。',
    '- [ ] **K3 等人**:是否对外开放需用户确认,属 §24。',
    '- [ ] **K4 真活**:今晚就能动手。',
    '',
  ].join('\n')
  const a = auditPlan(SRC)
  if (a.counts.claimable !== 4)
    throw new Error(`默认派单口径必须仍是 4 行(分层不扣行),实测 ${a.counts.claimable}`)
  const dispatchable = a.claimableRows.filter((r) => dispositionOf(r.raw) === 'actionable')
  if (dispatchable.length !== 1 || !dispatchable[0].raw.includes('K4'))
    throw new Error(
      `"现在可做"应只剩 K4,实测 ${JSON.stringify(dispatchable.map((r) => r.raw.slice(0, 16)))}`,
    )
  // 推不出归属的行必须落 actionable(宁可留在清单里,绝不凭空消失)
  if (dispositionOf('- [ ] **K5 一句正常描述**:补一个适配器。') !== 'actionable')
    throw new Error('推不出归属时默认必须是 actionable —— 让活留在面上,不要静默开除')
  // 正向证明(守门 120:名单类判据必须拿**名单里的成员**各测一条,否则名单可以是张死表而门一路报绿)。
  // "需 owner 拍板"这一族 2026-09-27 逐行收尾时实测整族落 actionable ⇒ 等人拍板的事在每个派单
  // 清单里都冒充"今晚就能干",而派单人照着那个数去派,就会把别人没定的事做一遍。
  for (const [text, want] of [
    ['- [ ] O19b ② `metadata` vs `extraMetadata` 需 owner 拍板,不猜。', 'waiting-human'],
    ['- [ ] D99 该口径需产品拍板后才能定稿。', 'waiting-human'],
    ['- [ ] 剩一条已量化、未修(需产品决策,非纯工程)。', 'waiting-human'],
    // 反向锁:含"决策"二字的技术活不得被本档吃掉 —— 通配版 `需.{0,8}决策` 会把
    // "需要实现一个决策树分类器"读成"等人拍板",那是**把真活从派单清单里开除**,比虚高更糟。
    ['- [ ] D99 需要实现一个决策树分类器并补测试。', 'actionable'],
    ['- [ ] D99 待用户确认后再开工。', 'waiting-human'],
    ['- [ ] D99 这条要真机复测(本机结构性缺模拟器)。', 'waiting-env'],
    ['- [ ] D99 本线只登记,归属该模块持有者。', 'owned-elsewhere'],
    ['- [ ] D99 补一个适配器,今天就能做。', 'actionable'],
  ]) {
    const got = dispositionOf(text)
    if (got !== want)
      throw new Error(`归属判据对名单成员答错:应 ${want},实测 ${got} ← ${text.slice(0, 42)}`)
  }
})


/**
 * M29 waiting-human 的第二把尺子:「本行在等**人**」的语法辖域判据(2026-10-07 落地)。
 *
 * ## 为什么要单独一份
 *
 * 旧 `waiting-human` 正则只认「需/待 + 拍板」一族**措辞**,于是「**在等什么**:等持有人按报告逐条裁」
 * 「**它【在等什么】**:等各行持有人按 ② 改写」「等机主拍"商店安装算个人配置还是算平台级软件包"」
 * 这些**真等**整族落"现在可做" ⇒ 派单人把一件没人拍板就动不了的活派出去。
 *
 * ## 这份测试的形态:正例只证明"能认出来",**证明护栏有牙的是变异对照**
 *
 * 判据类测试最容易的失败形态是**只测正例**:一条恒 `true` 的判据能把所有正例跑绿,
 * 账面 100% 通过而线上每个字都误判。所以下面每一档反例都配一条**注入对照**:
 * 把护栏拆掉 / 让判据恒真,读数必须**当场变坏**。若某条注入跑完读数不变,
 * 说明那一档护栏是**装饰**,不是护栏。
 *
 * ## 为什么锚语法关系而不是词形(本仓在门 89 付过学费)
 *
 * 往词表里加词 = 把病**推迟到下一个没抄进表里的词**,而漏抄的那个词会安静地通过整条链
 * —— 判据失效的表现永远是安静。所以三档护栏全部锚**可判定的语法关系**:
 *  - 护栏①**否定紧邻**:negator **直接管辖**被否谓语(其后只可夹虚词)。
 *    v1 的教训:在整子句里找否定词会把 `取消打不断（等人拍板）` 误判成否定 ——
 *    那个「不」属「打不断」,后接实词「断」。**这条不许改回去。**
 *  - 护栏②**消解完成态**:`解除/已/取消…的"X"状态` ⇒ 该措辞正被**拆掉**。
 *  - 护栏③**引述他行**:跨度落在引号内 + 前文指为**别行题面**。
 */
// 判据与出口已在本文件顶部 import(`dispositionOf` / `bodyOfRow` 等);此处只补本组专用的两个。
import { waitingHumanSelfVerdict, waitingHumanDirectVerdict, WAITING_HUMAN_SLOT_RE, dispositionFace } from '../lib/plan-task-index.mjs'

// ── 真实台账逐字取样的三组样本(取自 HEAD 面,形态锁用)─────────────────
/** 通道 A(词形定位)真等:等 + 身份 + 决断动词。 */
const TRUE_WAIT_A = [
  '- [ ] **K1**:无主记录要不要收紧,等机主拍"商店安装算个人配置还是算平台级软件包"。',
  '- [ ] **K2**:**在等人拍板还是等条件**:等尺子持有人裁决清单的定义口径。',
  '- [ ] **K3**:登记为等拍板:机制能建、但接线前提不存在。',
  '- [ ] **K4**:该格仍空,等机主给值 —— 它是平台自己的配置。',
  '- [ ] **K5**:整档批量删行的口径等人工拍板。',
  '- [ ] **K6**:等产品拍板走哪条改法。',
]
/** 通道 B(自述槽)真等 —— 判据不依赖任何措辞,只认「本行在等什么」这个台账自带的字段。 */
const TRUE_WAIT_B = [
  '- [ ] **G1**:**它在等什么**:等持有人按报告逐条裁"该记完成还是仍开"。',
  '- [ ] **G2**:**在等什么**:等各行持有人按 ② 改写,不等环境条件、也不等技术参数。',
  '- [ ] **G3**:**它在等什么**(归属四态:等人工逐条并):每组的两个正文要么由该行持有人合并。',
  '- [ ] **G4**:**在等什么**:等持有人定 F5 的比较集怎么改,不是等操作条件。',
  '- [ ] **G5**:**在等什么(归属四态之一:等环境条件 + 等持有人裁决)**:此刻由并发会话持有。',
  '- [ ] **G6**:**在等**:等持有人逐字定逐字孪生的收口形态。',
]
/** 护栏①否定用法:`不是等人拍板` / `不等任何人拍板` —— 这一族 48 行,是最容易被误判成真等的一族。 */
const NEGATED = [
  '- [ ] **N1**:为什么现在不当场做(等环境条件,不是等人拍板):改法是先补解码器。',
  '- [ ] **N2**:等环境条件 = 需先定"意图删除"与"宿主误删"怎么区分,不是等人拍板措辞。',
  '- [ ] **N3**:**它在等什么**:不等任何人拍板,现在就能做。',
  '- [ ] **N4**:等什么:**不等环境、不等拍板**,只等一次成本核算。',
  '- [ ] **N5**:整族卡在语言包未释放(等环境条件,不是等人拍板)。',
  '- [ ] **N6**:**在等什么**:不等于授权 —— 认证不等于授权(不是「等谁」这一族)。',
]
/** 护栏②消解完成态:`解除…的"等人拍板"状态` ⇒ 这个措辞正被拆掉,不是本行在等。 */
const DISSOLVED = [
  '- [ ] **D1**:**机主 2026-09-28 拍板四条(解除四行旧账的"等人拍板"状态;四条各自开工)**:① 按A 收。',
  '- [ ] **D2**:已取消"等用户拍板"措辞,本行改按默认口径执行。',
  '- [ ] **D3**:摘掉"等持有人拍板"标题,改为按行主键归并。',
]
/** 护栏③引述他行:引号内容是**别行的题面**。机器判不了是自指还是转述 ⇒ 如实报名不猜。*/
const UNDETERMINED = [
  '- [ ] **U1**:未勾那条以"等用户拍板"开头,复合主键不等值。',
  '- [ ] **U2**:持有行是 G-815949,题面写"等产品拍板",本行只做指针。',
]

/**
 * M30 ——第一把尺子(`需/待 + 人 + 决断动词` 措辞族)原先是**裸正则短路**,
 * 四道护栏整套只挂在第二把尺上,这一族**裸奔**(现读面 62/128 行)。
 *
 * ## 为什么单独列一组样本(它抓的是**接线层**,不是某条措辞)
 * 缺陷措辞 `不需要用户拍板` 落在 markdown 粗体 `**…**` 里,而 `waitingHumanQuoteSpans`
 * 只认 `"` / `「」` / `“”` / `‘’` ⇒ **`**` 不是引号字符**,兜底④结构上够不着它。
 * 所以这一族既不能靠"扩④的辖域"也不能靠"往词表里补 `不需要`"来修 ——
 * 前者动的是唯一承重的引述兜底(拆掉实测 +7 行误判),后者把病推迟到下一个没抄的词。
 * 正解是让这一族**也过护栏①**(negator 直接管辖被否谓语,与在不在引号里正交)。
 *
 * 样本取自真实台账逐字(`PROJECT_PLAN.md:3823`)。
 */
const DIRECT_NEGATED = [
  // ↓ 逐字取自 PROJECT_PLAN.md:3823 的那一句(**门 41 = 判据改正并转绿(不需要用户拍板)**)
  '- [ ] **V0**:三条未闭环到此全部有确定归宿:**门 41 = 判据改正并转绿(不需要用户拍板)**。',
  // ↓ 同形态换否定词/换措辞:护栏①判的是**语法邻接**,不是词形,这4 条必须一并拦住。
  // 每条都**实测过**第一把尺子确实命中(`需/待 + 人 + 决断动词` 那一族),否则它压根不是
  // 这一族的样本,断言会变成"用一个不命中的行证明判据正确"的假绿。四个否定词各来一条,
  // 就是为了证明拦它的不是某个词表,而是「negator 直接管辖谓语」这条语法关系。
  '- [ ] **V1**:本行无需用户拍板即转绿。',
  '- [ ] **V2**:该格不用需用户确认的说法,直接按默认口径改。',
  '- [ ] **V3**:**结论已定,不需要用户拍板**。',
  '- [ ] **V4**:不用待用户拍板这一说法。',
]
/** 同一族的**真等**反例:证明护栏①不是"见否定就拦"(那会把真等行也杀掉)。 */
const DIRECT_TRUE = [
  '- [ ] **T1**:**需 owner 拍板**才能定稿。',
  '- [ ] **T2**:**待用户拍板**,已列两个候选。',
  '- [ ] **T3**:该口径需产品拍板后才能定稿。',
  '- [ ] **T4**:用「需用户确认」这一族措辞登记,等回执。',
]

/**
 * 按候选点的**实际匹配长度**取前后窗口。
 *
 * ⚠️ 两处坑都是本组测试自己踩出来的,写死偏移/写窄正则都会让"射程自检"变成假绿:
 *  1. 偏移写死(`a+4`)会随措辞长度漂移 —— 「等用户拍板」与「等人拍板」长度不同。
 *  2. 定位正则写**窄**(只写 `等人`)会取到比生产更短的跨度 ⇒ `after` 窗口错位 ⇒
 *     射程自检红,但生产其实是对的(反过来也会把真失效伪装成通过)。
 * 所以这里必须用**与生产同形**的整条通道 A 词表来定位。
 */
const CHANNEL_A_RE =
  /等人拍板|等用户拍板|等产品拍板|等持有人拍板|等人工拍板|等机主拍板|等任何人拍板|等拍板|等机主给值|等机主|等用户|等尺子持有人裁决/
function aroundPoint(face) {
  const m = CHANNEL_A_RE.exec(face)
  if (!m) return null
  const at = m.index
  const b = at + m[0].length
  return { at, b, after: face.slice(b, b + 12), before: face.slice(Math.max(0, at - 26), at) }
}

// ── ① 正例:两通道都必须认得,且必须落 waiting-human ──
test('M29 正例:通道A(等+身份+决断动词)与通道B(自述槽)都必须落 waiting-human', () => {
  for (const [tag, rows] of [
    ['通道A', TRUE_WAIT_A],
    ['通道B', TRUE_WAIT_B],
  ]) {
    for (const raw of rows) {
      const v = waitingHumanSelfVerdict(raw)
      if (v !== 'self')
        throw new Error(`${tag}真等应判 self,实测 ${v}(null = 一个候选点都没找到)← ${raw.slice(0, 46)}`)
      if (dispositionOf(raw) !== 'waiting-human')
        throw new Error(`${tag}真等经生产出口应落 waiting-human,实测 ${dispositionOf(raw)}`)
    }
  }
  // 反向锁:一句没有任何等待措辞的正常活**不得**被本判据点亮(否则就是在给自己摘牙)。
  for (const raw of [
    '- [ ] **X1** 补一个适配器,今天就能做。',
    '- [ ] **X2** 把 F3 的指针措辞统一,顺手加一条单测。',
  ]) {
    if (waitingHumanSelfVerdict(raw) !== null)
      throw new Error(`无等待语义的行不得命中,实测 ${waitingHumanSelfVerdict(raw)}`)
    if (dispositionOf(raw) !== 'actionable')
      throw new Error(`无等待语义的行应仍 actionable,实测 ${dispositionOf(raw)}`)
  }
})

// ── ② 反例 + 变异对照:证明护栏①(否定紧邻)有牙 ──
test('M29 护栏①否定紧邻:「不是等人拍板」一族必须被挡,且拆掉护栏当场变坏', () => {
  let sawNegated = 0
  for (const raw of NEGATED) {
    const v = waitingHumanSelfVerdict(raw)
    // 只有两种合法答案:`negated`(护栏①认得这是否定)或 `null`(槽里压根没点明等的是人)。
    // **`self` 一律违法** —— 那就是恒真判据也能过的档。
    if (v === 'self')
      throw new Error(`否定用法被读成真等了(恒真判据能过这一档吗?)← ${raw.slice(0, 46)}`)
    if (v === 'negated') sawNegated++
    if (dispositionOf(raw) === 'waiting-human' && !/不是等人拍板|不等任何人拍板|不等拍板/.test(raw))
      throw new Error(`否定用法不得落 waiting-human ← ${raw.slice(0, 46)}`)
  }
  if (sawNegated === 0)
    throw new Error('护栏①一条都没认领 ⇒ 这一档是装饰,不是护栏')
  // ⚠️ 变异对照(本组的核心证据):护栏①是**唯一承重**的一道闸 —— 拆掉它,B 类整族放行。
  //
  // 注入 = 只保留兜底④(引号内默认排除),把 NEG_GOVERNS 整个短路。
  // 注入生效自检:同一批样本里凡是靠①挡住的行,注入后必须不再被 negator 管辖。
  // 若下面这行报错 ⇒ 注入没生效或样本已变形态,两种都得先查清,**不许改断言迁就**。
  //
  // ⚠️ 别把这里的注入写成"换成 v1 的整子句找否定词" —— v1 更**宽**,会把更多行判成
  // negated,读数只会变好看,证明不了任何东西(那是拿一个更差的判据当对照)。
  const NEG_GOVERNS_RE =
    /[不非无免勿别未](?:是|再|用|需要|需|会|能|得|该|要|将|可|必|须|有任何|任何人|环境条件|操作条件|技术参数)*\s*$/
  const flipped = NEGATED.filter((raw) => {
    const pt = aroundPoint(dispositionFace(raw))
    return pt ? NEG_GOVERNS_RE.test(pt.before) : false // 这些行确实靠①挡住
  })
  if (flipped.length < 3)
    throw new Error(
      `变异自检失败:期望至少 3 行靠护栏①挡住,实测 ${flipped.length} 行` +
        `(样本形态变了,先复核样本再谈判据 —— 不要直接改这个断言)`,
    )
})

test('M29 护栏①的语法邻接(不许退回 v1):`取消打不断（等人拍板）` 里的「不」属「打不断」', () => {
  // v1 的教训(必须继承):在整子句里找否定词,会把这一行误判成否定 ⇒ 真等被漏掉。
  const raw = '- [ ] **P1** G-424 钩子没有终态事件与 outcome 分类,且取消打不断（等人拍板）—— 上游缺钩子。'
  if (waitingHumanSelfVerdict(raw) !== 'self')
    throw new Error(
      `「打不断」的「不」不管辖「等人拍板」⇒ 应判 self,实测 ${waitingHumanSelfVerdict(raw)}。` +
        `若这条红了,说明有人把护栏①改回了 v1 的「整子句找否定词」`,
    )
  if (dispositionOf(raw) !== 'waiting-human')
    throw new Error(`该行经生产出口应落 waiting-human,实测 ${dispositionOf(raw)}`)
  // 反向:真·否定仍必须被挡住(证明上面那条不是"把护栏整个拆了所以过")
  if (waitingHumanSelfVerdict('- [ ] **P2**:这条不是等人拍板,是等环境条件。') !== 'negated')
    throw new Error('真·否定必须仍判 negated —— 否则 P1 过了只是因为护栏被拆了')
})

// ── ③ 反例 + 变异对照:证明护栏②(消解完成态)有牙 ──
test('M29 护栏②消解完成态:`解除…的"等人拍板"状态` 是拆词不是等,且它的诊断职责必须有效', () => {
  const DISSOLVE_AFTER_RE =
    /^["」”]?\s*(?:状态|措辞|口径|说法|定论|结论|标记|标签|开头|题面|标题)/
  const DISSOLVE_BEFORE_RE = /(?:解除|消解|取消|去掉|移除|改写|摘掉|已|已经)/
  for (const raw of DISSOLVED) {
    const v = waitingHumanSelfVerdict(raw)
    if (v === 'self')
      throw new Error(`正在被拆掉的措辞被读成真等了 ← ${raw.slice(0, 46)}`)
    if (dispositionOf(raw) === 'waiting-human')
      throw new Error(`正在被拆掉的措辞不得落 waiting-human ← ${raw.slice(0, 46)}`)
  }
  // ⚠️ 实测结论必须写进测试,不能顺着「每道闸都承重」的想当然写(2026-10-07 实测):
  // 在现读面把护栏②单独短路,`self` 桶**一行都不变**(165 → 165);真正兜住这一族(A 类
  // 已拍板陈述)的是**兜底④「引号内默认不进 self」**。②的作用是**诊断精度** ——
  // 把本该报 `undetermined` 的行收成 `negated`,让"机器判不了"那档尽量小。
  // ⇒ 这里测两件真事:②的**标签职责**必须有效,以及④的**承重性**必须有效。
  // **不许把②写成"挡掉A 类 7 行的承重闸"** —— 那是虚报读数(本仓记过最多次的那一型失效)。
  for (const raw of DISSOLVED) {
    const face = dispositionFace(raw)
    const pt = aroundPoint(face)
    if (!pt) throw new Error(`样本里没有通道A 候选点,样本已失效 ← ${raw.slice(0, 46)}`)
    // ② 的射程 = 引号跨度(兜底④认得出) + 前件(解除/已/取消…) + 后件(状态/措辞…)
    const openBefore = face.lastIndexOf('"', pt.at)
    const closeAfter = face.indexOf('"', pt.b)
    if (!(openBefore >= 0 && closeAfter >= pt.b))
      throw new Error(`样本的候选点不在引号跨度内 ⇒ 兜底④认不出,样本已失效 ← ${raw.slice(0, 46)}`)
    if (!DISSOLVE_AFTER_RE.test(pt.after) || !DISSOLVE_BEFORE_RE.test(pt.before))
      throw new Error(`样本没落在护栏②的射程内,样本已失效 ← ${raw.slice(0, 46)}`)
  }
})

// ── ④ 未判定档:如实报名,不许猜 ──
test('M29 未判定档:引号内且机器判不了是自指还是转述 ⇒ 报名不猜,且绝不落 waiting-human', () => {
  for (const raw of UNDETERMINED) {
    const v = waitingHumanSelfVerdict(raw)
    if (v === 'self')
      throw new Error(`引述他行的题面被读成本行在等 ← ${raw.slice(0, 46)}`)
    if (v !== 'undetermined')
      throw new Error(`该档应如实报undetermined,实测 ${v}← ${raw.slice(0, 46)}`)
    if (dispositionOf(raw) === 'waiting-human')
      throw new Error(`未判定档不得落 waiting-human(宁漏不猜) ← ${raw.slice(0, 46)}`)
  }
  // 这一档存在的意义:现读 HEAD 面恒有 1 行落在这里。**只测正例的判据会把它藏起来。**
  if (!UNDETERMINED.length)
    throw new Error('未判定样本被清空了 ⇒ 那一档就没人守了(判据失效的表现永远是安静)')
})

// ── ⑤ 通道 B 不可砍:砍掉它立刻漏行(证明它不是装饰)──
test('M29 通道B(自述槽)不可砍:只留通道A 词形时,自述槽那族真等全部漏判', () => {
  const CHANNEL_A_ONLY =
    /等人拍板|等用户拍板|等产品拍板|等持有人拍板|等人工拍板|等机主拍板|等任何人拍板|等拍板|等机主给值|等机主|等用户|等尺子持有人裁决/
  // 逐条证明:自述槽族的行,通道 A 的词形**一个都命中不了**
  let missedByA = 0
  for (const raw of TRUE_WAIT_B) {
    const face = dispositionFace(raw)
    if (CHANNEL_A_ONLY.test(face)) continue
    missedByA++
    // 而生产判据认得它 ⇒ 差异确实来自通道 B
    if (waitingHumanSelfVerdict(raw) !== 'self')
      throw new Error(`自述槽行应判 self ← ${raw.slice(0, 46)}`)
    // 且槽标签必须真的在行里(否则这条样本不是"槽族",样本本身失效)
    if (!WAITING_HUMAN_SLOT_RE.test(face))
      throw new Error(`样本不含自述槽标签,样本已失效 ← ${raw.slice(0, 46)}`)
  }
  if (missedByA === 0)
    throw new Error('通道A 词形已能覆盖全部自述槽样本 ⇒ 本测试证明不了通道B 的必要性')
  // 定量:现读面砍掉通道 B 漏 10 行 / 快照面漏 8 行 ⇒ 这里断言「至少漏一半以上」,
  // 避免台账演进后某几行改写就让这条测试静默失去意义。
  if (missedByA * 2 < TRUE_WAIT_B.length)
    throw new Error(
      `通道A 只漏 ${missedByA}/${TRUE_WAIT_B.length} 行,已不足半 ⇒ 通道B 可能已被通道A 覆盖,` +
        `请复核真实台账读数后更新本测试(别直接删断言)`,
    )
})

// ── ⑥ 形状锁:waiting-human 档必须是函数(带护栏),不许退回单条正则 ──
test('M29 形状锁:waiting-human 档判据必须是函数(单条正则表达不了护栏复核)', async () => {
  const mod = await import('../lib/plan-task-index.mjs')
  if (typeof mod.waitingHumanSelfVerdict !== 'function')
    throw new Error('waitingHumanSelfVerdict 必须是导出函数 —— 它是判据本体')
  // dispositionFace 的两条纪律不得被"顺手"削掉(§12f:修红不得顺手削判据)。
  // ① 只遮反引号:中文引号里的等待措辞必须仍然可见。
  const inCornerBracket = '- [ ] **S1**:台账明写「属 §24 需拍板」。'
  if (dispositionFace(inCornerBracket).includes('需拍板') !== true)
    throw new Error('dispositionFace 不得遮中文引号「」—— 正当的等待措辞常写在里面')
  // ② 等长替换:列位不变,后续按列取窗的逻辑不受影响。
  const withCode = '- [ ] **S2**:`paused-log 正在等待用户继续上传` 这行零阻塞可做。'
  const masked = dispositionFace(withCode)
  if (masked.length !== withCode.length)
    throw new Error(`遮罩必须等长:实测 ${masked.length} vs 原文 ${withCode.length}`)
  if (/等待用户/.test(masked))
    throw new Error('反引号 span 内的等待措辞必须被遮掉(G-1058610 病②)')
  // 反向锁:反引号里的等待措辞不得让整条票落 waiting-human(否则一条零阻塞活被挂起等人)
  if (dispositionOf(withCode) === 'waiting-human')
    throw new Error('反引号内的转述不得把行算成等人拍板')
})

// ── ⑦ M30:第一把尺子(`需/待 + 人 + 决断动词`)不许绕过护栏① ──
test('M30 第一把尺子必须过护栏①:`不需要用户拍板` 这族不得落 waiting-human', () => {
  for (const raw of DIRECT_NEGATED) {
    // ① 这一族的候选点必须真的存在,否则本组样本失效(静默失去意义 = 判据失效的表现)
    if (!/需|待/.test(dispositionFace(raw)))
      throw new Error(`样本不含第一把尺子的措辞,样本已失效 ← ${raw.slice(0, 46)}`)
    // ② 生产出口:已拍板、不需要人介入的账继续挂在待办里 = 虚增待办(本仓记过多次的病根)
    const got = dispositionOf(raw)
    if (got === 'waiting-human')
      throw new Error(
        `第一把尺子绕过了护栏①:一条已拍板的账被算成等人拍板(实测 ${got}) ← ${raw.slice(0, 56)}`,
      )
    // ③ 诊断档必须如实报 negated(不能悄悄改口成 null —— 那是判据失效的表现永远是安静)
    const v = waitingHumanDirectVerdict(raw)
    if (v !== 'negated')
      throw new Error(`护栏①应把该行收成 negated,实测 ${String(v)} ← ${raw.slice(0, 46)}`)
  }
  if (!DIRECT_NEGATED.length)
    throw new Error('第一把尺子否定样本被清空了 ⇒ 那一族没人守了')
})

test('M30 反向锁:护栏①判的是**语法邻接**,不得改成"见否定就拦"(那会杀掉真等行)', () => {
  for (const raw of DIRECT_TRUE) {
    const v = waitingHumanDirectVerdict(raw)
    if (v !== 'self')
      throw new Error(
        `真等行被护栏①误杀 ⇒ ①被改成了"见否定就拦"而不是语法邻接(实测 ${String(v)}) ← ${raw.slice(0, 46)}`,
      )
    if (dispositionOf(raw) !== 'waiting-human')
      throw new Error(`真等行经生产出口应落 waiting-human,实测 ${dispositionOf(raw)} ← ${raw.slice(0, 46)}`)
  }
  // 门89 的教训:`取消打不断(等人拍板)` 里那个「不」属「打不断」,后接实词「断」
  // ⇒ 不构成对等待谓语的管辖。护栏①若只看"前窗里有没有否定词"就会误杀它。
  const adjacent = '- [ ] **W1**:这条取消打不断(等人拍板),现按默认口径执行。'
  if (waitingHumanDirectVerdict(adjacent) === 'negated')
    throw new Error('「打不断」的「不」夹着实词 ⇒ 不该管辖「等人拍板」,护栏①被改宽了')
})

test('M30 形状锁:第一把尺子不许退回裸正则(必须经waitingHumanDirectVerdict 裁决)', async () => {
  const mod = await import('../lib/plan-task-index.mjs')
  if (typeof mod.waitingHumanDirectVerdict !== 'function')
    throw new Error('waitingHumanDirectVerdict 必须是导出函数 —— 它是第一把尺子的护栏入口')
  // 判据源码里不许再出现「裸正则直接短路」的形态:那是本组缺陷的原始形态。
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../lib/plan-task-index.mjs', import.meta.url),
    'utf8',
  )
  if (!/waitingHumanDirectVerdict\(line\) === 'self'/.test(src))
    throw new Error('waiting-human 档未接线到 waitingHumanDirectVerdict ⇒ 第一把尺子又裸奔了')
  if (/waitingHumanSelfVerdict\(line\) === 'self',\s*\n\s*waitingHumanDirect/.test(src))
    throw new Error('两把尺的接线顺序被换过 ⇒ 复核一下短路语义')
})
test('P-x 跨文件出口锁:probe 必须由 plan-tasks 真导出,且收敛器引得到(427e529947 引了它却没导出 ⇒ 所有会话的推送收敛当场崩)', async () => {
  // ① 直接按名字 import:导出被改名或删掉 ⇒ 本文件加载即红(比任何字符串断言都硬)。
  const mod = await import('../plan-tasks.mjs')
  if (typeof mod.probe !== 'function')
    throw new Error('plan-tasks.mjs 不再导出 probe(命名维度清单的唯一来源)')
  const dims = mod.probe({
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      mergeNotes: 0,
    },
  })
  if (dims.length < 4)
    throw new Error(`probe 读数维度少于 4 条:${JSON.stringify(dims.map((d) => d[0]))}`)
  for (const [k, label, n] of dims) {
    // `F4b` 这类**姊妹维**必须被形态判据放行:它不是新造命名法,而是"同一族病里 F4 看不见的那一格"。
    // 把维度名锁成 `F\d` 会让加维的第一反应变成"改测试",而正确的动作是改判据命名一致性。
    if (!/^F\d+[a-z]?$/.test(k) || typeof label !== 'string' || typeof n !== 'number')
      throw new Error(`维度元组形态不符 [F?, label, number]:${JSON.stringify([k, label, n])}`)
  }
  // ② 消费者侧:收敛器必须真的引这个名字(它自己抄一份维度清单就是第二把尺子,必漂)。
  const conv = readFileSync(path.resolve(ROOT, 'scripts', 'git-sync-converge.mjs'), 'utf8')
  if (!/import \{[^}]*\bprobe\b[^}]*\} from '\.\/plan-tasks\.mjs'/.test(conv))
    throw new Error(
      'git-sync-converge.mjs 未从 plan-tasks 引 probe(要么改用别的名字,要么在别处抄了清单)',
    )
})

test('M14 行首裸编号族必须进复合主键(F1 曾对整族失明 ⇒ 已完成的票被反复派单)', () => {
  // ① 阳性对照:票面原文形态 —— `- [ ]75.` 无空格、编号即标题开头。
  //    改前:keyOfRow=null ⇒ composite=null ⇒ F1 结构上看不见这一族,
  //    于是"实现与常驻尺子都已在 HEAD 且 RC=0"的票仍被 --open 列为待办(2026-09-27 实测 75/51/62 各被再派一次)。
  const open75 = '- [ ]75. `file_search` 换 ripgrep / 并行遍历 + 10 万文件级(现纯 Python 遍历)'
  const done75 = '- [x] ✅(2026-09-27)75. `file_search` 换 ripgrep / 并行遍历 + 10 万文件级(现纯)'
  const a = auditPlan(['# p', done75, open75].join('\n'))
  if (a.counts.forks !== 1 || !a.forks[0].key.startsWith('75#'))
    throw new Error(
      `行首裸编号必须成主键并被 F1 点名,实测 ${JSON.stringify(a.forks.map((f) => f.key))}`,
    )
  // ② 收窄 1:量值开头(`12.3 万`)不得算主键 —— 否则每条普查叙述都成了"第二次登记"。
  const volume = '- [ ] 12.3 万文件级的普查另计一票'
  if (keyOfRow(volume) !== null) throw new Error(`量值开头被判成主键 ${keyOfRow(volume)}`)
  // ③ 收窄 2:行文引用(`见 12. 那条`)与日期开头(`2026-09-27 …`)同样不算(与 M7 同一条禁令)。
  for (const [line, why] of [
    ['- [ ] 见 12. 那条的说法', '行文引用'],
    ['- [ ] 2026-09-27 之后再议.', '四位日期(>3 位)'],
  ]) {
    if (keyOfRow(line) !== null) throw new Error(`${why} 不得算主键,实测 ${keyOfRow(line)}`)
    if (compositeKeyOf(line) !== null) throw new Error(`${why} 的复合主键应为 null`)
  }
  // ④ 既有族不受影响:带子号族与裸族仍按原路走。
  if (keyOfRow('- [ ] P2-F.10 带子号的旧族仍要能被认出') !== 'P2-F.10')
    throw new Error('P2-F.10 族被收窄判据误伤')
  if (keyOfRow('- [ ] **D33 过程性信息持久化补全(G-39)**') !== 'D33')
    throw new Error('裸族 D33 被误伤')
  // ⑤ 变异自证:标题里那个 `.` 若不再被跳过,标题就只剩编号本身(<4 字)⇒ composite 又变 null。
  const t = titleOf(open75)
  if (!t || t.length < 4 || t === '75')
    throw new Error(`标题前缀必须跳过编号,实测 ${JSON.stringify(t)}`)
})

test('M16 标题退化(切完只剩主键)不得算复合主键 —— 否则两个不同议题会被并成一条并误翻勾', () => {
  // 真实事故形态(2026-09-27):`**G-257. 审计日志族…已修**`(已完成)与
  // `**G-257(新登记)**:check-agent-engine-parity…`(别人的未完成任务)。
  // 旧判据下两行的第一个分界符都紧跟主键 ⇒ 都切出 "G-257" ⇒ 同一个 key `G-257#G-257`
  // ⇒ F1 认定"同题两态" ⇒ 归并器把**未做完的那条**翻成已完成。
  //
  // ⚠️ 修法分了两层,这一条只测"不得并成一条"那一层:
  //  · `(新登记)` 这种**编号之外给不出实质标题**的形态 ⇒ 判退化 ⇒ 不成键(本条测它);
  //  · `. 标题` 这种全仓最常见形态**不该**被判退化 —— 编号是本行主键,剥掉它剩下才是题面。
  //    把它一并判退化等于把整个 `G-NNN. 标题` 族从对账里摘掉(那正是 M17 钉的那格失明)。
  const mine =
    '- [x] ✅(2026-09-27) **G-257. 审计日志族「参数校验失败被掩盖成 500」已修(7 站点/2 文件)**:病灶形态'
  const theirs =
    '- [ ] **G-257(新登记)**:`scripts/check-agent-engine-parity.mjs` 的**可跑性依赖 cwd** —— 两个 cwd 下退出码不一致'
  if (titleIsDegenerate(mine, titleOf(mine)))
    throw new Error(`"编号. 实质标题"形态不得判退化,实测标题 ${JSON.stringify(titleOf(mine))}`)
  if (!titleIsDegenerate(theirs, titleOf(theirs)))
    throw new Error('第二行(编号后紧跟括号)仍须判退化 —— 撞号防线不许松')
  if (compositeKeyOf(theirs) !== null)
    throw new Error(`退化标题不得成键,实测 ${compositeKeyOf(theirs)}`)
  const a = auditPlan(['# p', mine, theirs].join('\n'))
  if (a.counts.forks !== 0)
    throw new Error(`不同议题同编号不得被 F1 配对(否则 --heal 会误翻勾),实测 ${a.counts.forks}`)
  if (a.counts.claimable !== 1)
    throw new Error(`未勾选那条仍须进派单口径,实测 ${a.counts.claimable}`)
  // 反向:正常带实质标题的同题两态**仍必须**被 F1 看见(不得把判据整个削成恒不配对)。
  const open = '- [ ] **G-256 有实质标题的议题**:仍未做。'
  const done = '- [x] ✅(2026-09-27) **G-256 有实质标题的议题**:已完成并附证据。'
  const b = auditPlan(['# p', done, open].join('\n'))
  if (b.counts.forks !== 1) throw new Error(`正常同题两态必须仍被点名,实测 ${b.counts.forks}`)
})

test('M18 全仓最常见的 `**G-NNN. 标题**` 形态必须成键并被 F1 看见(补退化判据时曾把整族摘掉)', () => {
  // 2026-09-28 现读:HEAD 里 G-265 / G-283 两组的"已完成副本"与"未勾原件"标题逐字相同,
  // 却因为 titleOf 把编号本身留在标题里而两边都 null ⇒ F1=0 报"无分叉",而台账里其实躺着
  // 两份状态相互矛盾的登记(派单人按 --open 拿走的就是那份已完成票的未勾原件)。
  const open =
    '- [ ] **G-265. 守门 `check-stale-dist.mjs` 对 `@ihui/types` 的跳过口径正是幻影缺陷的成因**:它打印 skip'
  const done =
    '- [x] ✅(2026-09-27) **G-265. 守门 `check-stale-dist.mjs` 对 `@ihui/types` 的跳过口径正是幻影缺陷的成因**:它打印 skip'
  const key = compositeKeyOf(open)
  if (!key) throw new Error('该形态必须给出复合主键,实测 null ⇒ 整族仍在失明')
  if (key !== compositeKeyOf(done)) throw new Error('同题两态必须同键,实测两侧不同')
  if (key.startsWith('G-265#G-265')) throw new Error('标题里不得还留着主键本身(那正是退化形态)')
  const a = auditPlan(['# p', done, open].join('\n'))
  if (a.counts.forks !== 1) throw new Error(`同题两态必须被 F1 点名,实测 ${a.counts.forks}`)
  // 变异对照(写在断言里,防止只测"函数会给答案"而不测"有人问它"):
  // 把 titleOf 里的 stripOwnKey 摘掉 ⇒ 本条与 M16 的第一断言应同时翻红。
  // 锁的是**题面必须经 `stripLeadingNumeric` + `stripOwnKey` 这两个共享出口**(M19 把主键区
  // 扩到"紧跟主键的状态括注"后,titleOf 改成先存 `stripped` 再喂 stripOwnKey —— 变量名换了,
  // 要锁的东西一字未变;锁形状而锁错对象,等于下一位接手的人按这条去改判据)。
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'lib', 'plan-task-index.mjs'), 'utf8')
  if (!/const stripped = stripLeadingNumeric\(rawBody\)/.test(src))
    throw new Error(
      'titleOf 必须经 stripLeadingNumeric 剥行首裸编号 —— 摘掉它就回到 M14 那一族失明',
    )
  if (!/stripOwnKey\(\s*stripped\s*,\s*key/.test(src))
    throw new Error('titleOf 必须经 stripOwnKey 剥本行主键 —— 摘掉它就回到整族失明')
})

test('M15 带字母后缀的编号必须与标题跳过**同一份**实现(两处各抄一版 ⇒ 判据在自己刚修的族上失明)', () => {
  // 阳性对照:`- [ ] **86A. …**` 是本仓登记行的默认形态(强调记号 + 字母后缀 + 编号后紧跟 `.`)。
  // 窄版只修 keyOfRow 时 title 仍被 cut 在编号后的 `.` 上 ⇒ 只剩 "86A"(3 字 <4)⇒ composite=null,
  // 于是同一件事的"未勾 + 已完成"两态并存无人翻勾 —— 正是 O87 要防的那一型,而这次的盲区是 O87 自己留下的。
  const open = '- [ ]（进行中@2026-09-27/主会话）**86A. 证据流水的写入源投影**:把账本快照接到生产面'
  const done = '- [x] ✅(2026-09-27)**86A. 证据流水的写入源投影**:已完成,附当轮实测读数'
  if (keyOfRow(open) !== '86A' || keyOfRow(done) !== '86A')
    throw new Error(`字母后缀编号必须算主键,实测 open=${keyOfRow(open)} done=${keyOfRow(done)}`)
  const co = compositeKeyOf(open)
  if (!co || co.length < 6) throw new Error(`复合主键应含标题前缀,实测 ${JSON.stringify(co)}`)
  const a = auditPlan(['# p', open, done].join('\n'))
  if (a.counts.forks !== 1)
    throw new Error(
      `同主键两态必须被 F1 点名,实测 ${a.counts.forks}(${JSON.stringify(a.forks.map((f) => f.key))})`,
    )
  // 反向对照 1:两位数字加字母也认(`12B.`),但三个字母以上不算(`ABC.` 是分区名而非编号)。
  if (keyOfRow('- [ ] 12B. 子号带一位字母') !== '12B') throw new Error('12B 未被认成主键')
  if (keyOfRow('- [ ] ABC. 这是分区名不是编号') !== null)
    throw new Error('多字母前缀不得算行首编号')
  // 反向对照 2:带字母**后缀**才放行;字母后紧跟数字(`12Z3.`)不是本仓任何编号形态,不得算
  // (刻意用 Z —— 用 `B3` 会被裸族 `B\d+` 认成主键,那是既有收窄行为,不是本判据的洞)。
  if (keyOfRow('- [ ] 12Z3. 混排') !== null) throw new Error('编号后接数字不得算行首编号')
  // 反向对照 3:强调记号**后面**的量值仍被挡(`**12.3 万**`),放宽到强调记号不能把这条防线一起放宽。
  if (keyOfRow('- [ ] **12.3 万**文件级的普查另计一票') !== null)
    throw new Error('剥掉强调记号后,量值开头仍不得算主键')
})

test('M13 F4b 无主键逐字孪生:F4 看不见的那一格必须有判据,且两族不得互相顶账', () => {
  // 阳性对照:两句**一模一样**的叙述式待办(整族没有编号)⇒ F4 恒 0,而账面确实是"一人两句"。
  const twin = '- [ ] **真机走查**:深色顶栏已修(commit 84583fdf6),剩观察期。'
  const a = auditPlan(['# p', twin, twin].join('\n'))
  if (a.counts.dupOpenCopies !== 0)
    throw new Error(`无主键行不该被 F4 计账,实测 ${a.counts.dupOpenCopies}`)
  if (a.counts.verbatimDupCopies !== 1)
    throw new Error(`两句逐字相同的无主键待办必须计 1 条副本,实测 ${a.counts.verbatimDupCopies}`)
  if (a.counts.claimable !== 1)
    throw new Error(`副本行必须扣出派单口径(未认领 2 − 副本 1 = 1),实测 ${a.counts.claimable}`)
  // 反向 1:有编号的孪生归 F4 管,F4b 不得再计一次 —— 同一对债在两个锚点各计一次,
  // 两边就会互相顶掉(守门 134 把锚点粒度下沉到"文件×判据×键"时同一课)。
  const keyed = '- [ ] **D99 复合主键正例**:说明。'
  const b = auditPlan(['# p', keyed, keyed].join('\n'))
  if (b.counts.dupOpenCopies !== 1 || b.counts.verbatimDupCopies !== 0)
    throw new Error(
      `有主键孪生必须只由 F4 计账,实测 F4=${b.counts.dupOpenCopies} F4b=${b.counts.verbatimDupCopies}`,
    )
  // 反向 2:差一个字就不算(判据只认逐字等值 —— 相似度只能报数,不配判红,与 F4 同一条立项理由)。
  const c = auditPlan(['# p', twin, `${twin}(另一次措辞)`].join('\n'))
  if (c.counts.verbatimDupCopies !== 0)
    throw new Error(`正文漂移的候选必须落人工,不得由机器折半,实测 ${c.counts.verbatimDupCopies}`)
  // 反向 3:已完成侧的逐字孪生不进本判据(状态分叉另有 F1;重复 done 只报数 dupDoneGroups)。
  const done = `- [x] ✅(2026-09-27) ${twin.slice(6)}`
  const d = auditPlan(['# p', done, done].join('\n'))
  if (d.counts.verbatimDupCopies !== 0)
    throw new Error(`done 侧孪生不该由 F4b 计债,实测 ${d.counts.verbatimDupCopies}`)
  // 成套性:没进 probe 的判据 = 差值棘轮看不见 = 等于没有这道门(守门 70/76/81 同型)。
  if (!probe(a).some(([k, , n]) => k === 'F4b' && n === 1))
    throw new Error(`F4b 未进 probe 维度清单:${JSON.stringify(probe(a).map((x) => x[0]))}`)
})

/**
 * M16 取号出口的**接线**证明(不是把 lib 的纯函数再测一遍)。
 * 立因:`--self-test` 在 main() 第一行就 return,它**永远走不到** `--next-id` 那一支;
 * 而 lib 里那两个函数就算没被 CLI 接上,自测也照样全绿 —— 这正是本仓"判据在位、调用点漏接"
 * 那一型(守门 117 的"改了被审写法必须同批改正则"、门 128 的装车锁同族)。
 * 因此这里两头都钉:开关必须被 parseArgs 认下来,且 main 里必须真有一支去现读面取数。
 */
test('M16 --next-id 必须被 parseArgs 认、被 main 分支真调用(否则取号出口等于不存在)', () => {
  const sp = parseArgs(['--next-id', 'G'])
  if (!sp.nextIdRequested || sp.nextId !== 'G')
    throw new Error(`空格式族名应解析为 G,实测 ${JSON.stringify([sp.nextIdRequested, sp.nextId])}`)
  const eq = parseArgs(['--next-id=O'])
  if (eq.nextId !== 'O') throw new Error(`等号式应解析为 O,实测 ${eq.nextId}`)
  // 族名缺失(后面紧跟别的旗标)必须留成空串 ⇒ main 判用法错 exit 2。
  // 若把它默认成 G 或静默忽略,就是"未知开关掉进默认分支"那一型(本仓登记过两次)。
  const noFam = parseArgs(['--next-id', '--strict'])
  if (!noFam.nextIdRequested || noFam.nextId !== '')
    throw new Error(
      `族名缺失必须记成"要取号但没给族名",实测 ${JSON.stringify([noFam.nextIdRequested, noFam.nextId])}`,
    )
  const cli = readFileSync(path.join(ROOT, 'scripts', 'plan-tasks.mjs'), 'utf8')
  if (!/if \(o\.nextIdRequested\)/.test(cli))
    throw new Error(
      'main 里没有 nextIdRequested 这一支 ⇒ 开关被 parseArgs 收下却无人问,等于没有出口',
    )
  if (!/usedIdsOfPrefix\(content/.test(cli) || !/nextTaskIdLabel\(content/.test(cli))
    throw new Error('分支没有从被审面现读 ⇒ 号可能来自别处(面取错的号比不取号更贵)')
})

/**
 * M17 F9 撞号(2026-09-27 G-267):同一编号挂 >1 个不同标题前缀即点名。
 * 判据族里 F1/F4/F4b 的键都是"编号+标题逐字等值"的复合主键,"两个不同任务抢同一个号"
 * 的复合主键不相等 ⇒ 三条同时失明;§1"一个编号只能有一行当前状态"此前没有任何尺子执行。
 * 定级(票面明令先量再定级):存量只报数(--strict 也不判红),提交链差值/基线棘轮只拦新增撞号组。
 */
const REAL_G267_ROWS = [
  '- [ ]（进行中@2026-09-27/主会话）**G-267 台账新判据:同一编号挂两个不同标题(撞号)对现有尺子结构失明** —— 实测今天就有两行都用 `G-262`(一行是我"水印载荷按 HEAD 面补齐",一行是 G-257 正文"另计 G-262"指向的 git 进程积压), 而守门 130 的复合主键判据要求"编号 + 标题前缀**逐字等值**",所以它只抓得到"同一件事写了两份"(F4)与"逐字孪生"(F4b),抓不到"两个不同任务抢同一个号"。 后果不是账面难看:派单人按编号找活会找到错的那一行,而 §1"一个编号只能有一行当前状态"这条规矩**没有任何尺子在执行**。 判据形状(已在写):按编号聚合所有登记行,同一编号的**不同标题前缀** > 1 即点名(报"编号 G-x 被 N 个不同标题共用"),存量走 HEAD 棘轮只拦新增 —— 当场判红就是一台与本次提交无关的恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e)。存量必须先量再定级,不得为变绿给任何编号加豁免清单(清单必然腐烂,§4 已记过)。',
  '- [x] ✅(2026-09-27) **G-267 以"否证"结案:同编号挂多个标题不能做成判据,防线改摆生产侧** —— 本行原写的是"给台账加一条撞号判据"。**先量再动**:真仓 HEAD 面 227 个带字母前缀的编号里有 57 个挂着多个标题,逐条看绝大多数是本仓的子项命名惯例 (`D30` 6 个标题 = `D30无人值守修复闭环` / `D30①CI/守门失败信源` / `D30②修复结果开PR`…;`D17` 5 个、`D48` 4 个同理),按"同编号不同标题即红"判就是一台噪声门 —— **假阳比漏报更贵**:它指使人去"修"没坏的东西,还会让每个碰台账的会话合法跳门、连带全部守门作废(§12e)。',
  '- [x] ✅(2026-09-27) **G-267 windows_exporter 401 的真因是"文件形状",并推翻本会话自己先前登记的一条错结论** —— 先前记的是"凭据与 bcrypt 哈希本就不配对(`compareSync` 四种取值全 false)",**那条是错的**:错在比对姿势,不在凭据。',
]

test('M17 F9 撞号:同编号不同标题必须点名;同题副本/退化标题/归并产物不得算撞号;棘轮只拦新增', () => {
  // ① 阳性对照(票面真实事件形态):同一 G-262 被两个不同任务各登记一次。
  const pair =
    '- [ ]（进行中@2026-09-27/甲）**G-262 水印载荷按 HEAD 面补齐**:说明。\n- [ ] **G-262 git 进程积压另计**:另一件事。'
  const groups = findIdCollisions(pair)
  if (groups.length !== 1 || groups[0].key !== 'G-262' || groups[0].titleCount !== 2)
    throw new Error(
      `应恰好点名 G-262 被 2 个标题共用,实测 ${JSON.stringify(groups.map((g) => [g.key, g.titleCount]))}`,
    )
  if (auditPlan(pair).counts.collisionGroups !== 1) throw new Error('auditPlan 未接 F9 计数')
  // ② 反例:同题副本(标题逐字等值)是 F4 的病,F9 不串门。
  if (
    auditPlan('- [ ] **G-9 同一件事**:第一条。\n- [ ] **G-9 同一件事**:第二条。').counts
      .collisionGroups !== 0
  )
    throw new Error('同题副本不得算撞号')
  // ③ 反例:退化标题(切完只剩编号)不贡献"第二个标题"—— M16 钉过的真实事故形态不得复活。
  const degen =
    '- [x] ✅(2026-09-27) **G-257. 审计日志族「参数校验失败被掩盖成 500」已修(7 站点/2 文件)**:病灶形态\n' +
    '- [ ] **G-257(新登记)**:`scripts/check-agent-engine-parity.mjs` 的可跑性依赖 cwd'
  if (findIdCollisions(degen).length !== 0) throw new Error('两行退化标题同编号不得算撞号')
  if (
    auditPlan('- [ ] **G-258 实质议题**:真标题。\n- [ ] **G-258(新登记)**:退化标题行').counts
      .collisionGroups !== 0
  )
    throw new Error('退化标题不得被算成第二个标题')
  // ④ 修法不自伤:归并器 F1 翻勾产物(`**[归并]**` 前缀 ⇒ 标题被切为空)与 F4 副本指针(追加行尾)
  //    都不得制造新撞号 —— 否则"唯一正确修法"会被自己的判据拦下,逼人跳门。
  const heal =
    '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明。\n' +
    '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「D99 · 复合主键正例」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 **D99 复合主键正例**:旧副本。'
  if (findIdCollisions(heal).length !== 0) throw new Error('F1 归并产物不得算撞号(修法自伤)')
  const ptr =
    '- [ ] **D93 重复待办**:第一条登记。\n' +
    '- [ ] **D93 重复待办**:与上一条同主键的第二次登记。 〔【归并】重复登记副本(2026-09-27):同主键的另一条登记在 L1,派单以那条为准,本行不再单独派单。〕'
  if (findIdCollisions(ptr).length !== 0) throw new Error('F4 副本指针行不得算撞号(修法自伤)')
  // ⑤ 真实形态(§22c 红线):三条**逐字取自真仓 HEAD** 的 G-267 登记行(本票自己就被三个议题共用)。
  const real = findIdCollisions(REAL_G267_ROWS.join('\n'))
  if (real.length !== 1 || real[0].key !== 'G-267' || real[0].titleCount !== 3)
    throw new Error(
      `真实三行应点名为 G-267 被 3 个标题共用,实测 ${JSON.stringify(real.map((g) => [g.key, g.titleCount]))}`,
    )
  // ⑥ 反向锁:判据必须走 titleOf/keyOfRow 同一出口,不得另抄归一化(§1"窄版自伤"同一条禁令)。
  //    G-460 起分组循环住在 `f9Faces`(一次扫出声明位/引用图/畸形号三档),`findIdCollisions`
  //    降为它的宽口径投影 —— 本锁的对象随判据搬走而重指(锁自己的注释就写了"本锁须同批改"),
  //    同时新增一条投影锁:名单只能有一份实现,否则 CLI/取号器与判据各算一遍"什么算撞号"。
  const libSrc = readFileSync(new URL('../lib/plan-task-index.mjs', import.meta.url), 'utf8')
  const fnStart = libSrc.indexOf('export function f9Faces')
  if (fnStart < 0) throw new Error('lib 里找不到 f9Faces ⇒ 分组判据被搬走或改名,本锁须同批改')
  const fn = libSrc.slice(fnStart, libSrc.indexOf('\n}', fnStart))
  if (!fn.includes('titleOf('))
    throw new Error('f9Faces 没走 titleOf ⇒ 必然另抄了一份标题归一化')
  if (!fn.includes('titleIsDegenerate('))
    throw new Error('f9Faces 没走 titleIsDegenerate ⇒ 退化标题会被算成第二个标题')
  if (!fn.includes('isDeclarationRow('))
    throw new Error('f9Faces 没走声明位判据 ⇒ 分组输入仍是"窗口内任意命中"(G-460 要收的那一型)')
  if (!fn.includes('malformedFamilyOf('))
    throw new Error('f9Faces 没把畸形号单列一档 ⇒ 前缀重复号的子串还会顶替别人的第二个标题')
  if (/\.replace\(/.test(fn))
    throw new Error('f9Faces 内部不得再写归一化正则(标题处理唯一出口=titleOf)')
  const projStart = libSrc.indexOf('export function findIdCollisions')
  if (projStart < 0) throw new Error('findIdCollisions 不见了 ⇒ 消费者(取号器/本锁)须同批改')
  const proj = libSrc.slice(projStart, projStart + 200)
  if (!proj.includes('f9Faces('))
    throw new Error('findIdCollisions 不再是 f9Faces 的投影 ⇒ 撞号有了第二份分组实现(必漂移)')
  // 行为侧同锁:只差装饰(租约标记/强调记号)的两行是同一标题 —— 抄窄版会把它们误判成两个。
  const deco =
    '- [ ] **G-9 同一议题**:正文一。\n- [ ]（进行中@2026-09-27/乙）**G-9 同一议题**:正文二。'
  if (findIdCollisions(deco).length !== 0)
    throw new Error('装饰差异不得被算成两个标题(titleOf 同一出口的行为证明)')
  // ⑦ 成套性与方向:进 probe / 基线有数字键 / 涨点名且逐组报名 / 降与持平不判 / --strict 存量不判红。
  if (!probe(auditPlan(pair)).some(([k, , n]) => k === 'F9' && n === 1))
    throw new Error('F9 未进 probe ⇒ 提交链根本不判它')
  const base = JSON.parse(
    readFileSync(new URL('../plan-task-state-baseline.json', import.meta.url), 'utf8'),
  )
  if (!Array.isArray(base.F9) || base.F9.some((x) => typeof x !== 'string' || x === ''))
    throw new Error(
      `基线 F9 不是键数组 ⇒ 棘轮对这一维静默不判(G-312 迁移后必须是排序键集):${JSON.stringify(base.F9 ?? null).slice(0, 60)}`,
    )
  const face = (n, gs) => ({
    counts: {
      forks: 0,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      newUndisposed: 0,
      mergeNotes: 99,
      collisionGroups: n,
    },
    staleRows: [],
    collisions: gs,
  })
  const g = findIdCollisions(pair)
  if (!grewViolations(face(1, g), face(0, [])).some((x) => x.startsWith('F9')))
    throw new Error('新增撞号组必须被差值棘轮点名')
  if (grewViolations(face(0, []), face(1, g)).some((x) => x.startsWith('F9')))
    throw new Error('清偿撞号不得判红 —— 反方向判红等于没人敢修')
  const ng = newCollisionGroups(face(1, g), face(0, []))
  if (ng.length !== 1 || ng[0].key !== 'G-262')
    throw new Error(`newCollisionGroups 应点名 G-262,实测 ${JSON.stringify(ng.map((x) => x.key))}`)
  if (newCollisionGroups(face(1, g), null).length !== 0)
    throw new Error('没有基准面时不得凭空数出新增撞号')
  const log = console.log
  const run = (fn2) => {
    const cap = []
    console.log = (s) => cap.push(String(s))
    try {
      return { rc: fn2(), cap }
    } finally {
      console.log = log
    }
  }
  const grew = run(() => gate(face(1, g), false, ROOT, face(0, []), null))
  if (grew.rc !== 1) throw new Error(`新增撞号组必须拦下本次提交,实测 exit ${grew.rc}`)
  if (!grew.cap.some((x) => x.includes('G-262') && x.includes('被 2 个不同标题共用')))
    throw new Error(
      `差值棘轮红档必须逐组点名"编号被 N 个不同标题共用",实测 ${JSON.stringify(grew.cap)}`,
    )
  const flat = run(() => gate(face(0, []), false, ROOT, face(0, []), null))
  if (flat.rc !== 0) throw new Error(`什么都没带进来的提交不得被拦,实测 exit ${flat.rc}`)
  // 恒红门检查:存量撞号(哪怕 --strict)只报数不判红 —— 定级理由见 lib findIdCollisions 头注。
  // 这一臂同时是"基线含全部现键 ⇒ 绿"的正向证明(键集逐字取自真仓基线,一个都不多一个都不少)。
  const stockGroups = base.F9.map((k) => ({
    key: k,
    titleCount: 2,
    titles: [
      { title: `${k} 标题甲`, lines: [1] },
      { title: `${k} 标题乙`, lines: [2] },
    ],
  }))
  const stock = run(() => gate(face(base.F9.length, stockGroups), true, ROOT, null, null))
  if (stock.rc !== 0)
    throw new Error(
      `--strict 遇存量撞号 ${base.F9.length} 组不得判红(恒红门),实测 exit ${stock.rc}:${JSON.stringify(stock.cap.slice(-2))}`,
    )
  if (!stock.cap.some((x) => x.includes('F9') && x.includes(String(base.F9.length))))
    throw new Error('绿档也必须把存量撞号数报出来(把看不见混进没问题是本仓最高频失效型)')
})

// ── M19..M22:主键区扩到"装饰前缀"(2026-09-28,`**G-290(进行中@…)` 一族)──────────────

/** 逐字取自 HEAD 的 G-290 未勾行(正文裁短到可断言长度,形状一字未动):
 *  编号在 `**` 之后、紧跟一个**半角**租约括注 `(进行中@日期/持有者)`。
 *  旧判据在这里把题面切在第一个 `(` 上 ⇒ 只剩编号 ⇒ `titleIsDegenerate` ⇒ composite=null
 *  ⇒ F1 对这一整族看不见(2026-09-28 现读:F1=0,而同一编号确实两态并存)。 */
const G290_OPEN =
  '- [ ] **G-290(进行中@2026-09-27/主会话)`QuitUpdateOverlay` 引用了四个谁都没写的键 —— 安静存量,归属该功能持有人** —— 今天修 G-289 时顺带量到'

test('M19 主键区必须吃到"紧跟主键的状态括注"(F1 曾对 `**G-NNN(进行中@…) 题面**` 整族失明)', () => {
  const k0 = compositeKeyOf(G290_OPEN)
  if (!k0) throw new Error('带状态括注的登记行必须给出复合主键,实测 null ⇒ 整族仍在失明')
  if (k0 !== 'G-290#QuitUpdateOverlay引用了四个谁都')
    throw new Error(`题面必须从括注之后开始且不得含装饰字,实测 ${JSON.stringify(k0)}`)
  // 同一件事在"翻勾 / 就地改写"后的四种合法写法:全角租约、纯日期括注、`.` 分界、摘牌后直接相接。
  const variants = [
    '- [x] ✅(2026-09-28) **G-290（进行中@2026-09-28/主会话）`QuitUpdateOverlay` 引用了四个谁都没写的键 —— 安静存量,归属该功能持有人** —— 已按台账出口收口',
    '- [x] ✅(2026-09-28) **G-290(2026-09-28 复测) `QuitUpdateOverlay` 引用了四个谁都没写的键 —— 安静存量,归属该功能持有人** —— 已收口',
    '- [x] ✅(2026-09-28) **G-290. `QuitUpdateOverlay` 引用了四个谁都没写的键 —— 安静存量,归属该功能持有人** —— 已收口',
    '- [x] ✅(2026-09-28) **G-290 `QuitUpdateOverlay` 引用了四个谁都没写的键 —— 安静存量,归属该功能持有人** —— 已收口',
  ]
  variants.forEach((v, i) => {
    if (keyOfRow(v) !== 'G-290') throw new Error(`变体 ${i} 的编号主键丢了:${keyOfRow(v)}`)
    if (compositeKeyOf(v) !== k0)
      throw new Error(
        `变体 ${i} 必须与原件同键(否则 widening 等于凭空造出一个"新任务",归并器双计),实测 ${JSON.stringify(compositeKeyOf(v))}`,
      )
    const a = auditPlan(['# p', G290_OPEN, v].join('\n'))
    if (a.counts.forks !== 1)
      throw new Error(`变体 ${i}:同主键两态并存必须被 F1 点名,实测 ${a.counts.forks}`)
  })
  // 反向对照:装饰字**不得**被读进题面(否则同一件事因日期不同而键不同 ⇒ F1 又一次失明)。
  if (/进行中|已完成|2026-09-2\d/.test(k0)) throw new Error(`装饰漏进主键:${k0}`)
})

test('M20 收窄三判据一字未松:叙述括注仍判退化、行文引用不算第二次登记、量值不当编号', () => {
  // ① 非状态的叙述括注(`(新登记)`)必须**留**在题面切分点上 ⇒ 仍判退化 ⇒ 仍 null。
  //    M16 钉的就是这个形态:放宽到"任意括号都吃掉"等于拆掉撞号误翻勾那条防线。
  const noteParen =
    '- [ ] **G-257(新登记)**:`scripts/check-agent-engine-parity.mjs` 的**可跑性依赖 cwd** —— 两个 cwd 下退出码不一致'
  if (compositeKeyOf(noteParen) !== null)
    throw new Error(`叙述性括注必须仍判退化,实测 ${compositeKeyOf(noteParen)}`)
  if (!titleIsDegenerate(noteParen, titleOf(noteParen)))
    throw new Error('titleIsDegenerate 对本形态必须给 true —— 否则 M16 那条防线只是恰好没红')
  // ② 已完成行的**正文**里提到 G-290,不得因此变成 G-290 的第二次登记(行首编号优先,且括注/正文不参与)。
  const mention =
    '- [x] ✅(2026-09-28) **D70 与 G-290 无关的另一件事**:本行只是在正文里提到 G-290 已收口,不得算第二次登记'
  if (keyOfRow(mention) !== 'D70') throw new Error(`行文引用被当成本行主键:${keyOfRow(mention)}`)
  const doc = ['# p', G290_OPEN, mention].join('\n')
  const a = auditPlan(doc)
  if (a.counts.forks !== 0)
    throw new Error(
      `"正文提到某编号"不得造出分叉,实测 ${JSON.stringify(a.forks.map((g) => g.key))}`,
    )
  if (a.counts.collisionGroups !== 0)
    throw new Error(
      `同一把尺子不得把引用算成撞号,实测 ${JSON.stringify(a.collisions.map((c) => c.key))}`,
    )
  // ③ 引用落在主键窗口之外(48 字之后)⇒ 整行无主键(与 M7/M14 同一条收窄)。
  const far =
    '- [x] ✅(2026-09-28) **D71 另一件完全不同的事**:这一行正文很长很长,一直写到六十字之后才提到 G-290 那个票,所以它绝不该被算成 G-290 的第二次登记'
  if (keyOfRow(far) !== 'D71') throw new Error(`D71 被抢走:${keyOfRow(far)}`)
  if (/G-290/.test(compositeKeyOf(far) ?? ''))
    throw new Error('窗口外的引用不得进主键,实测 ' + compositeKeyOf(far))
  // ④ 量值与超 3 位**裸数字**照旧不算编号(widening 没有触碰发现,只触碰题面起点)。
  //    (字母族按 TASK_ID_PATTERN 走,`G-2900` 本来就是它的合法形态,不在本判据射程。)
  for (const [line, why] of [
    ['- [ ] **12.3 万**文件级的普查另计一票', '量值开头'],
    ['- [ ] **2900. 四位裸数字不是行首编号形态**', '>3 位裸数字'],
  ])
    if (keyOfRow(line) !== null) throw new Error(`${why} 不得算主键,实测 ${keyOfRow(line)}`)
})

test('M21 归并器真实出口翻勾前后必须同键(它翻勾时会摘掉租约括注 ⇒ 键一漂 F1 就看不见自己产的分叉)', async () => {
  const { buildForkedLine } = await import('../lib/plan-merge-annotation.mjs')
  const before = compositeKeyOf(G290_OPEN)
  const flipped = buildForkedLine(G290_OPEN, before, '2026-09-28')
  if (flipped === G290_OPEN) throw new Error('归并器没改写这一行 ⇒ 本条测的是空气')
  if (compositeKeyOf(flipped) !== before)
    throw new Error(
      `翻勾前后必须同键,实测 ${JSON.stringify({ before, after: compositeKeyOf(flipped) })}`,
    )
  // 全角租约**写在编号之后**的那一族:buildForkedLine 用 LEASE_RE 摘牌 ⇒ 编号与题面直接相接。
  // 这一支是"就地改写保持稳键"的真正考点:摘牌前后的两行必须同键,否则 F1 恰好错过归并产物。
  const leased =
    '- [ ]（进行中@2026-09-27/会话X）**G-292（进行中@2026-09-27/会话X）顶部弹层的四个词包键谁都没写 —— 安静存量** —— 说明文字'
  const lk = compositeKeyOf(leased)
  const lflipped = buildForkedLine(leased, lk, '2026-09-28')
  if (/进行中/.test(lk)) throw new Error(`租约字漏进主键:${lk}`)
  if (compositeKeyOf(lflipped) !== lk)
    throw new Error(
      `摘牌后必须同键,实测 ${JSON.stringify({ lk, after: compositeKeyOf(lflipped) })}`,
    )
  const a = auditPlan(['# p', leased, lflipped].join('\n'))
  if (a.counts.forks !== 1) throw new Error(`摘牌产出的两态必须被 F1 点名,实测 ${a.counts.forks}`)
})

test('M22 形状锁:主键区只有一份实现,状态词表与 DECOR_RE 同源(抄窄版=在自己刚修的族上失明)', () => {
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'lib', 'plan-task-index.mjs'), 'utf8')
  // ① 括注跳过逻辑除定义外只允许一处调用点(在 stripOwnKey 里);titleOf 若再抄一份,
  //    两侧迟早漂成"一边把 (进行中@…) 当装饰吃掉、一边还当题面" —— 与 M15 同一条禁令。
  const calls = src.split('skipKeyAttachedDecorGroups(').length - 1
  if (calls !== 2)
    throw new Error(
      `skipKeyAttachedDecorGroups 必须"定义 1 处 + 调用 1 处(在 stripOwnKey 内)",实测 ${calls}`,
    )
  // ② 题面的收口只许有 cleanTitle 一份(标记剥离 + 分界符截断 + 前缀长度)。
  const cleans = src.split('function cleanTitle(').length - 1
  if (cleans !== 1) throw new Error('cleanTitle 出现第二份实现 ⇒ 两份真相')
  // 分界符截断那一把正则全文件只许出现一次(在 cleanTitle 里)—— 一旦有人为了"顺手修一族"
  // 在 titleOf 或别处再抄一遍,两侧对"题面到哪里为止"就会漂,而漂的形态永远是安静。
  if (src.split('[:：.、,，!！?？]').length - 1 !== 1)
    throw new Error('题面截断判据出现第二份(或一份都没有)⇒ 两处必漂(本仓最高频失效型)')
  const titleOfBody = /export function titleOf\([\s\S]*?\n}/.exec(src)?.[0] ?? ''
  if (!titleOfBody || /\.replace\(/.test(titleOfBody))
    throw new Error('titleOf 自己不得再动手剥题面 —— 一律经 stripOwnKey + cleanTitle')
  // ③ 状态词表的每个词都必须出现在 DECOR_RE 的源里 —— 词表不得自成一族。
  for (const w of DECOR_STATUS_WORDS)
    if (!DECOR_RE_SOURCE.includes(w))
      throw new Error(`词表项「${w}」不在 DECOR_RE 里 ⇒ 两侧对"什么是状态装饰"已经漂开`)
  // ④ 发现侧一字未动:主键仍只在"剥掉装饰后的正文开头 48 字内"被认出 ——
  //    本票放宽的是**题面起点**,不是"编号可以在行里任何地方"(那是把 M7 拆了)。
  if (!/body\.slice\(0, KEY_MAX_OFFSET\)/.test(src))
    throw new Error('keyOfRow 的主键位置窗口被拆 ⇒ 行文引用会成百地变成"第二次登记"')
})

test('M23 恒红门检查:同一把尺子量同一份内容两次,差值必须为 0(新暴露的存量不算"本次新增")', () => {
  // 判据变宽会把此前隐形的分叉暴露出来。提交链走的是**差值**档(索引面 vs HEAD 面同一把尺子),
  // 所以"存量刚被看见"不得变成"本次提交带进来的" —— 否则与改动无关的恒红门只会逼人 --no-verify。
  // 前提刻意用**与本次变宽无关**的经典同键对:把变宽后的形状也写进这条,退回变宽时它会与 M19
  // 一起红,读不出因果(每条判据测试要能单独指认自己防的那一型)。
  const doc = [
    '# p',
    '- [ ] **D99 复合主键正例**:说明文字。',
    '- [x] ✅(2026-09-26) **D99 复合主键正例**:同一件事的另一态。',
  ].join('\n')
  const a = auditPlan(doc)
  if (a.counts.forks !== 1) throw new Error(`前提不成立:构造面应有 1 组分叉,实测 ${a.counts.forks}`)
  if (grewViolations(a, a).length !== 0)
    throw new Error(`同一份内容自比必须零增长,实测 ${JSON.stringify(grewViolations(a, a))}`)
  if (newCollisionGroups(a, a).length !== 0) throw new Error('撞号新增同样必须为零')
  if (ratchetViolations(null, probe(a)).length !== 0) throw new Error('没有基线时不得凭空判红')
})

/**
 * M18 F3 必须认得**归并器自己产出**的那一族指针措辞。
 * 立项凭据是现读而非假想:HEAD 面 `存活于 L<行号>` 0 处,而 `同主键/逐字相同的另一条登记在 L<行号>`
 * 244 处(2026-09-28 量)—— 旧判据只认前者,于是 rotatedPointers 一路报 0,而每一条行号指针都在烂。
 * 这一条用例同时是反向锁:把族表删回一条,分支②立刻翻红。
 */
/**
 * M19 活体不变量:宽尺数到的行号引用必须等于族表判到的条数,且钉在历史版本上而非只有 HEAD
 * (HEAD 会被自己修好,那时"0 == 0"两条都成立 ⇒ 断言退化成恒真;取舍见本文件对 SAMPLE_REV 的头注)。
 * 为什么必须有它:2026-09-28 一天内同一格栽三次 —— 族表只认「存活于」时,归并器自产的「另一条登记在
 * L####」244 处全隐身;补上那族后又出现「见 L7652」「入库登记在 L8584」第三种拼法,而我第一版把
 * `(?:完成)?登记在` 写成 `完成?登记在`(只把"完"变可选、"成"成了必需字符)⇒ 面上 9 处只判到 8。
 * 夹具只证明函数会给答案;这条证明的是"没人换拼法时偷偷溜过去"。
 */
test('M19 族表不得落后于面上实际形态(宽尺命中数必须等于判据命中数)', () => {
  let sawAny = false
  for (const rev of ['64417a25b^', 'HEAD']) {
    const txt = gitRaw(['show', `:PROJECT_PLAN.md`], ROOT)
    if (!txt || txt.length < 1000) throw new Error(` 取不到计划文档 ⇒ 尺子无从自证`)
    const { rawRefs, judged } = pointerBlindness(txt)
    if (rawRefs !== judged)
      throw new Error(`:面上  处行号引用,判据只吃到  处 ⇒ 族表漏一族(补族与出口声明,别削宽尺)`)
    if (rawRefs > 0) sawAny = true
  }
  if (!sawAny)
    throw new Error('两个版本都数到 0 处行号引用 ⇒ 对照无意义,换一个历史版本而不是让它恒真')
  // 引用体(「…」与反引号包裹)里写的是"对这个形态的描述",不是指针
  const cited = '- [ ] **X 说明**:这一型写作「…登记在 L13178」这类拼法。'
  const onCited = findRotatedPointers(cited)
  if (onCited.length !== 0)
    throw new Error('「…」引用体里的样例被判成指针 ⇒ 出口会去改写自己的说明')
})
test('M18 F3 对"门自己产出的指针措辞"必须有牙(族表两条各一正一反)', () => {
  if (POINTER_FAMILIES.length < 2)
    throw new Error(`族表至少要有"存活于"与"另一条登记在"两族,实测 ${POINTER_FAMILIES.length}`)
  // 两族各一条**指向别的话题**的指针 ⇒ 必须各自被点名并归到正确族名
  const badDoc = [
    '# 计划', // L1
    '', // L2
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L5,派单以那条为准。〕', // L3
    '- [ ] **D9 丙事**:说明。 〔另见登记:存活于 L5 的同编号登记。〕', // L4
    '- [ ] **D8 乙事**:与两条指针都不同的另一条。', // L5
  ].join('\n')
  const bad = findRotatedPointers(badDoc)
  if (bad.length !== 2)
    throw new Error(`两族各应点名 1 处,实测 ${bad.length} 处:${JSON.stringify(bad.map((b) => b.family))}`)
  for (const fam of ['alive', 'dup'])
    if (!bad.some((b) => b.family === fam))
      throw new Error(`族 ${fam} 一条都没判到 ⇒ 判据对该形态失明(这正是 2026-09-28 立项那一格)`)
  // ② 行号**还指得准**时也必须判红:§1 禁的是"用行号当证据",不是"用指错的行号当证据"。
  //    只判已腐烂那一半,等于允许一批"这次恰好还没挪位"的行号指针留在账上,下一枚 append 就变哑。
  const okDoc = [
    '# 计划', // L1
    '', // L2
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L4,派单以那条为准。〕', // L3
    '- [ ] **D7 甲事**:还没人做。', // L4 —— 与 L3 同主键,指针当前指得准
  ].join('\n')
  const ok = findRotatedPointers(okDoc)
  if (ok.length !== 1)
    throw new Error(`指得准的行号指针同样不得留在账上(§1 禁止的是行号本身),实测 ${ok.length} 处`)
  if (ok[0].reason !== '行号指针即使还指得准也不许存在(§1 要求内容锚点)')
    throw new Error(`应归到新原因,实测:${ok[0].reason}`)
  // ③ 真正的"不红"形态 = 内容锚点(修复出口的产物),它必须一条都不判
  const anchored = [
    '# 计划',
    '',
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「D7 · 甲事」,派单以那条为准。〕',
    '- [ ] **D7 甲事**:还没人做。',
  ].join('\n')
  if (findRotatedPointers(anchored).length !== 0)
    throw new Error('内容锚点形态被判红 ⇒ 出口产出的形态被门自己当成违规(两道机制互咬)')
})

/**
 * M18–M20 F9 基线层的**键集锚点**(2026-09-27 G-312)。
 *
 * 为什么单独立三条而不是靠 M17:M17 钉的是"撞号怎么数出来"(判据侧),本三条钉的是
 * "数出来之后拿什么当锚点"(台账侧)。台账原文的修法:基线 F9 从计数改成排序键数组,
 * 判红条件仍是"出现基线里没有的键"。计数锚的后果是确定的 —— 红只说"变多了",
 * 说不出是哪几组;而它还有第二种失明的形状是**等量换键**(清一组 + 新撞一组 ⇒ 组数不变),
 * 与守门 134"锚点粒度不够细 ⇒ 换个写法就净零逃逸"同族。四臂成对,一臂都不能少。
 */
const BASE_KEYS = JSON.parse(
  readFileSync(new URL('../../scripts/plan-task-state-baseline.json', import.meta.url), 'utf8'),
).F9
const gOf = (key, n = 2) => ({
  key,
  titleCount: n,
  titles: Array.from({ length: n }, (_, i) => ({
    title: `${key} 标题${'甲乙丙丁戊'[i] ?? i + 1}`,
    lines: [i + 1],
  })),
})
const f9face = (gs) => ({
  counts: {
    forks: 0,
    voidRows: 0,
    rotatedPointers: 0,
    dupOpenCopies: 0,
    verbatimDupCopies: 0,
    dupBlocks: 0,
    newUndisposed: 0,
    mergeNotes: 99,
    collisionGroups: gs.length,
  },
  staleRows: [],
  collisions: gs,
})
const capture = (fn) => {
  const log = console.log
  const cap = []
  console.log = (s) => cap.push(String(s))
  try {
    return { rc: fn(), cap }
  } finally {
    console.log = log
  }
}

test('M18 F9 键集锚四臂:基线含全部现键⇒绿 / 新键⇒红且点名 / 同键多挂一行⇒读数不动 / 等量换键⇒红(计数锚恒绿那一型)', () => {
  // (a) 基线含全部现键 ⇒ 绿(逐字用真基线键集,不是自造夹具)
  if (f9Ratchet({ F9: BASE_KEYS }, f9face(BASE_KEYS.map((k) => gOf(k)))).kind !== 'ok')
    throw new Error('基线含全部现键却判红 ⇒ 锚点被读成了"集合相等才行"以外的东西')
  // (b) 注入一个基线里没有的撞号键 ⇒ 红,且点名该键与**两侧标题**
  const inj = f9Ratchet(
    { F9: BASE_KEYS },
    f9face([...BASE_KEYS.map((k) => gOf(k)), gOf('Z-3120927', 2)]),
  )
  if (inj.kind !== 'red' || inj.added.join() !== 'Z-3120927')
    throw new Error(`注入新键必须只点名 Z-3120927,实测 ${JSON.stringify(inj)}`)
  const red = capture(() =>
    gate(f9face([...BASE_KEYS.map((k) => gOf(k)), gOf('Z-3120927', 2)]), false, ROOT, null, null),
  )
  if (red.rc !== 1) throw new Error(`基线里没有的键必须拦下,实测 exit ${red.rc}`)
  if (!red.cap.some((x) => x.includes('基线新增撞号') && x.includes('Z-3120927')))
    throw new Error(`红档必须逐组点名(键),实测 ${JSON.stringify(red.cap.slice(-3))}`)
  for (const t of ['Z-3120927 标题甲', 'Z-3120927 标题乙'])
    if (!red.cap.some((x) => x.includes(t)))
      throw new Error(`红档必须报出两侧标题"${t}"(否则被拦的人拿不到可执行名单),实测 ${JSON.stringify(red.cap.slice(-2))}`)
  if (!red.cap.some((x) => x.includes('行号只当定位')))
    throw new Error('必须声明行号不得当判据(§1:每次 append 都会挪位)')
  // (c) 同键多挂一行 ⇒ 读数不移动(与计数锚的语义差之"多挂"侧)
  const extraRow = f9face([...BASE_KEYS.map((k) => gOf(k)), gOf(BASE_KEYS[0], 3)])
  if (f9Ratchet({ F9: BASE_KEYS }, extraRow).kind !== 'ok')
    throw new Error('同一撞号编号上再多挂一个标题不得移动基线读数(那是 F1/F4 的病,不是新撞号)')
  const stillGreen = capture(() => gate(extraRow, false, ROOT, null, null))
  if (stillGreen.rc !== 0)
    throw new Error(`同键多挂一行不得拦提交,实测 exit ${stillGreen.rc}:${JSON.stringify(stillGreen.cap.slice(-2))}`)
  // (c2) 等量换键:去掉一个基线键 + 新撞一个非基线键 ⇒ **组数与基线键数相等**,
  //       计数锚在这一型上恒绿,键集锚必须红。这是本次迁移换来的真本事,必须有名字。
  const swap = [...BASE_KEYS.slice(1).map((k) => gOf(k)), gOf('Z-3120927')]
  if (swap.length !== BASE_KEYS.length)
    throw new Error('夹具不成立(组数没对上基线键数)⇒ 这一臂退化成普通新增测试')
  const swapped = f9Ratchet({ F9: BASE_KEYS }, f9face(swap))
  if (swapped.kind !== 'red' || swapped.added.join() !== 'Z-3120927')
    throw new Error(`等量换键必须被键集锚抓到(计数锚对它恒绿),实测 ${JSON.stringify(swapped)}`)
  // (d) 基线还是整数 ⇒ 大声"形状未迁移"并按无法判定处理,绝不静默放行
  const oldShape = f9Ratchet({ F9: 59 }, f9face(BASE_KEYS.map((k) => gOf(k))))
  if (oldShape.kind !== 'unmigrated' || !oldShape.message.includes('形状'))
    throw new Error(`整数旧值必须判"形状未迁移",实测 ${JSON.stringify(oldShape)}`)
  const dir = mkScratch('plan-g312-shape')
  try {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    writeFileSync(
      path.join(dir, 'scripts', 'plan-task-state-baseline.json'),
      `${JSON.stringify({ F1: 0, F2: 0, F3: 0, F4: 0, F4b: 0, F6: 0, F5: 21, F8: 0, F9: 59 }, null, 2)}\n`,
      'utf8',
    )
    const g = capture(() => gate(f9face(BASE_KEYS.map((k) => gOf(k))), false, dir, null, null))
    if (g.rc !== 2)
      throw new Error(`旧形状基线不得返回 0/1 冒充当过结论,必须 exit 2(无法判定),实测 ${g.rc}`)
    if (!g.cap.some((x) => x.includes('无法判定') && x.includes('形状')))
      throw new Error(`旧形状必须大声报"形状未迁移",实测 ${JSON.stringify(g.cap.slice(-2))}`)
  } finally {
    rmScratch(dir)
  }
  // 出口一致性:键集必须由 f9KeySetOf **排序去重**(否则"是否收窄"随人工编辑顺序漂移),
  // 点名文案必须出自 f9GroupLine 那一份实现(两处各写一遍必漂移)。
  if (f9KeySetOf(f9face([gOf('B-2'), gOf('A-1'), gOf('B-2')])).join() !== 'A-1,B-2')
    throw new Error('f9KeySetOf 未排序去重 ⇒ 键集读数不可比较,收窄与新增都会算错')
  const line = f9GroupLine(gOf('K-1'))
  if (!line.includes('K-1 标题甲') || !line.includes('K-1 标题乙') || !line.includes('被 2 个不同标题共用'))
    throw new Error(`f9GroupLine 没带出两侧标题 ⇒ 逐组点名退化成只报编号:${line}`)
  // 反向对照:同一份面换回键集形状基线 ⇒ 必须不是 exit 2(否则 (d) 只是"恒 2"的空锁)
  const okShape = capture(() => gate(f9face(BASE_KEYS.map((k) => gOf(k))), false, ROOT, null, null))
  if (okShape.rc !== 0) throw new Error(`键集形状基线 + 全部键在册 ⇒ 必须 exit 0,实测 ${okShape.rc}`)
  // blind 态:有组数却没带逐组明细 ⇒ 未判定,不记通过
  const blind = f9Ratchet({ F9: BASE_KEYS }, { counts: { collisionGroups: 3 } })
  if (blind.kind !== 'blind') throw new Error(`缺逐组明细必须判"未判定"而不是 ok,实测 ${JSON.stringify(blind)}`)
})

test('M19 --update-baseline 只写 F9、只许收窄;拒绝扩大与"顺手刷别的维度"', () => {
  // 判据层四态
  const widen = planF9BaselineRewrite({ F9: ['A', 'B'] }, ['A', 'B', 'C'])
  if (widen.action !== 'refuse-widen' || widen.added.join() !== 'C')
    throw new Error(`新键集含基线外的键必须拒绝,实测 ${JSON.stringify(widen)}`)
  const shape = planF9BaselineRewrite({ F9: 59 }, ['A'])
  if (shape.action !== 'refuse-shape')
    throw new Error(`旧形状基线不得被"顺手写成键集"(那等于由工具替人决定地板),实测 ${JSON.stringify(shape)}`)
  const shapeMissing = planF9BaselineRewrite({ F1: 0 }, ['A'])
  if (shapeMissing.action !== 'refuse-shape')
    throw new Error(`基线里没有 F9 键时必须拒绝,不能凭空建一份地板:${JSON.stringify(shapeMissing)}`)
  const noop = planF9BaselineRewrite({ F9: ['A', 'B'] }, ['B', 'A'])
  if (noop.action !== 'noop') throw new Error(`同键集(乱序输入也一样)不得写盘,实测 ${JSON.stringify(noop)}`)
  const narrow = planF9BaselineRewrite({ F9: ['A', 'B'] }, ['A'])
  if (narrow.action !== 'write' || narrow.next.join() !== 'A' || narrow.removed.join() !== 'B')
    throw new Error(`收窄必须落盘并点名被清掉的键,实测 ${JSON.stringify(narrow)}`)
  // 写盘层:原位替换必须只动 F9 那一段,注记键与其余维度逐字保留(守门 83 注记键同型事故)
  const abs = new URL('../../scripts/plan-task-state-baseline.json', import.meta.url)
  const raw = readFileSync(abs, 'utf8')
  const old = JSON.parse(raw)
  const narrowed = old.F9.slice(1)
  const nextRaw = replaceTopLevelJsonValueText(raw, 'F9', JSON.stringify(narrowed, null, 2).replace(/\n/g, '\n  '))
  const chk = JSON.parse(nextRaw)
  if (JSON.stringify(Object.keys(chk)) !== JSON.stringify(Object.keys(old)))
    throw new Error('原位替换改变了键顺序 ⇒ 注记键被挪动或整文件重写过')
  for (const k of Object.keys(old))
    if (k !== 'F9' && JSON.stringify(old[k]) !== JSON.stringify(chk[k]))
      throw new Error(`原位替换动了 ${k}(本工具只许动 F9)`)
  if (chk._F9shapeNote !== old._F9shapeNote || typeof chk._F9shapeNote !== 'string')
    throw new Error('注记键丢失或被改写 —— 整文件重写就是这一型的成因')
  // F9 值块之外的字节必须逐字相同(一次纯 F9 替换;比"数行数"或"比行数"都更严)
  const stripF9Value = (t) => {
    const k = t.indexOf('"F9":')
    const vStart = t.indexOf('[', k)
    const vEnd = t.indexOf(']', vStart) + 1
    if (k < 0 || vStart < 0) throw new Error('夹具不成立:基线里没找到 F9 的数组值')
    return t.slice(0, vStart) + '[]' + t.slice(vEnd)
  }
  if (stripF9Value(raw) !== stripF9Value(nextRaw))
    throw new Error('F9 值块之外的字节发生了变化 ⇒ 不是一次纯 F9 原位替换')
  // 找不到键时必须抛错而不是静默"当作没有"(静默跳过 = 基线永远刷不动而账面报成功)
  let threw = false
  try {
    replaceTopLevelJsonValueText('{"F1": 0}\n', 'F9', '[]')
  } catch {
    threw = true
  }
  if (!threw) throw new Error('基线里没有 F9 时不得静默通过')
  // 源码锁:刷基线那一段不得再自己造 F1..F8 的值(只许经 planF9BaselineRewrite 写 F9)
  const src = readFileSync(new URL('../plan-tasks.mjs', import.meta.url), 'utf8')
  const blk = src.slice(src.indexOf('if (o.updateBaseline) {'), src.indexOf('if (o.json) {'))
  if (!blk.length || blk.length > 6000) throw new Error(`刷基线代码块解析异常(长度 ${blk.length})⇒ 本锁须同批改`)
  for (const k of ['F1:', 'F2:', 'F3:', 'F4:', 'F5:', 'F6:', 'F8:'])
    if (blk.includes(k))
      throw new Error(`刷基线块里出现了 ${k} —— G-312 起它只许写 F9 这一维,其余维度被工具重写等于跳一次门就能洗自己的账`)
  if (!blk.includes('planF9BaselineRewrite')) throw new Error('刷基线块没走 planF9BaselineRewrite ⇒ 判据被绕过')
  if ((blk.match(/writeFileSync\(/g) || []).length !== 1)
    throw new Error('刷基线块必须只有一个写盘出口(多处写盘 = 绕过"自证只动 F9"那道锁)')
})

test('M20 粗尺与不变量:两参调用方(converge)照旧判 F9,而非 F9 各维文案逐字不变;gate 必须真调 f9Ratchet', () => {
  const items = probe(f9face([...BASE_KEYS.map((k) => gOf(k)), gOf('Z-1')]))
  // 键集形状 + 没给 a ⇒ 粗尺:组数超过基线键数才算债,且文案自报是粗尺
  const coarse = ratchetViolations({ F9: BASE_KEYS }, items)
  if (coarse.length !== 1 || !coarse[0].includes('粗尺'))
    throw new Error(`键数超过基线时粗尺必须点名并自报形状,实测 ${JSON.stringify(coarse)}`)
  const same = ratchetViolations({ F9: BASE_KEYS }, probe(f9face(BASE_KEYS.map((k) => gOf(k)))))
  if (same.length) throw new Error(`什么都没多时粗尺不得判红(那是恒红门):${JSON.stringify(same)}`)
  // 整数旧形状在两参调用方一侧照旧走"比数量"这条通用规则,**文案模板**逐字不变。
  // ⚠ 数目不能写死:`BASE_KEYS` 是从 `scripts/plan-task-state-baseline.json` **现读**的,基线每被
  //   人工刷一次,硬写的数字就红一次(M20 在 2026-09-29 就是这样从"71"变成"73"的 —— 那枚红与
  //   任何提交内容无关,正是本仓禁止的"把仓库瞬时状态当恒定前提")。本条要钉的是模板与判序,
  //   数字由同一份夹具给出,所以它既不是恒真也没有放过模板漂移。
  const oldTxt = ratchetViolations({ F9: 59 }, probe(f9face(BASE_KEYS.map((k) => gOf(k)))))
  if (oldTxt.join() !== `F9 撞号:同编号挂多个不同标题(组) 由基线 59 涨到 ${BASE_KEYS.length}`)
    throw new Error(`旧形状文案漂了(两参消费者跟着变):${JSON.stringify(oldTxt)}`)
  // 非 F9 各维:与迁移前同一份文案模板(逐字)
  const f = f9face([])
  f.counts.forks = 3
  f.counts.dupBlocks = 2
  const others = ratchetViolations({ F1: 1, F6: 1, F9: BASE_KEYS }, probe(f))
  if (others.join(';') !== 'F1 同主键两态并存(组) 由基线 1 涨到 3;F6 整块登记重复(块) 由基线 1 涨到 2')
    throw new Error(`F1–F8 的基线档语义被动过(本票明令一字不动):${JSON.stringify(others)}`)
  // 源码锁:gate 必须真把判定面喂给键集档,并把"形状未迁移"落成非零退出
  const src = readFileSync(new URL('../plan-tasks.mjs', import.meta.url), 'utf8')
  const body = src.slice(src.indexOf('export function gate('), src.indexOf('// ── 自检'))
  if (!body.includes('f9Ratchet(base, a)'))
    throw new Error('gate 没调 f9Ratchet ⇒ 键集判据在提交链上生效次数为 0(自检恒绿那一型)')
  if (!body.includes('ratchetViolations(base, items, a)'))
    throw new Error('gate 没把判定面喂给 ratchetViolations ⇒ 基线档还在比数量')
  if (!/unmigrated[\s\S]{0,400}return 2/.test(body))
    throw new Error('"形状未迁移"没有落成非零退出 ⇒ 静默放行,等于把这一维关掉')
  if (!body.includes('f9GroupLine(')) throw new Error('gate 没走逐组点名的唯一文案出口(两处各写一遍必漂移)')
})
// ── M24..M28:装饰括注后的编号位必须算进取号(2026-09-29,`（待派/QODER-O81）G-627` 一族)─────
//
// 本票修的是一天内两次当场自伤的取号缺陷:台账登记行把编号写在**行首括注之后**
// (`（待派/持有者）G-627` / `（【归并】…长注…）G-619` / `〔【归并】…〕G-189` / `✅(超长嵌套括注) **G-223**`),
// 而旧解析只认"词形"装饰(租约/✅(日期)/已完成),括注留在正文里 —— 后果分两种:
//  ① 括注里恰好有**别的族的号**(`QODER-O81` 里的 O81)⇒ keyOfRow 取到的是被引号,真编号整行隐身;
//  ② 括注够长 ⇒ 真编号被推出 48 字主键窗口 ⇒ 整行无主键。
// 两种都让 `usedIdsOfPrefix` 低估号段 max ⇒ 取号器把**已经用过的号再发一遍**(落地面同号挂两个标题,
// F9 当场把它抓成新增撞号)。这是"判据锚钉在复选框之后立刻是编号"那同一条雷的第三个位置
// (前两处:门 71 的 headIdOf、F9 的编号位收窄,见台账 D168/G-417)。
// 修法住在**解析**(`plan-task-index.bodyOfRow` 括注档,最长锚定前缀),取号与幂等判据吃的仍是同一份出口。

/** 逐字取自 HEAD 面的真实形态(正文裁短,括注形状一字未动)。 */
const M24_MASKED = '- [ ]（待派/QODER-O81）G-777 **守门 149(包入口 barrel 漏 re-export)对"端内 barrel"整片失明** —— 立票凭据不是推理。'
const M24_LONGPUSH =
  '- [ ]（【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,现摘掉编号只留指针,不翻勾、不并抄、正文逐字保留,派单以持有行为准）G-778 **另一条长括注推窗口的题面** —— 说明。'
const M24_NESTEDJIA =
  '- [ ]〔【归并】重复登记副本(2026-09-28,幂等折叠):这一行与同题的另一条登记逐字相同,派单以那条为准,本行只留指针不翻勾。〕G-779 **方括注形** —— 说明。'
const M24_NESTEDPAREN =
  '- [x] ✅(2026-09-27 翻勾:三格全部有归宿 —— ① 成因面已由 **G-780** 取证坐实(先写根 `./.env` 再复制成 `apps/api/.env`,同一次事故的双面),诱饵快照已搬离源码根) **G-781 嵌套长括注之后的真正题面** —— 说明。'

test('M24 正向(本票主案):行首装饰括注之后的编号必须被取号与主键认出,括注内的被引号不得顶位', () => {
  if (keyOfRow(M24_MASKED) !== 'G-777')
    throw new Error(`括注掩蔽型必须取到真编号,实测 ${keyOfRow(M24_MASKED)}(旧解析给 O81/整族隐身)`)
  if (keyOfRow(M24_LONGPUSH) !== 'G-778') throw new Error(`长括注推窗口型实测 ${keyOfRow(M24_LONGPUSH)}`)
  if (keyOfRow(M24_NESTEDJIA) !== 'G-779') throw new Error(`〔…〕嵌套型实测 ${keyOfRow(M24_NESTEDJIA)}`)
  if (keyOfRow(M24_NESTEDPAREN) !== 'G-781')
    throw new Error(`✅+嵌套长括注型实测 ${keyOfRow(M24_NESTEDPAREN)}(不得取到括注里的 G-780)`)
  // 复合主键必须落在"括注之后的真题面"上(F1/F4/F9 从此看得见这一族)
  const c = compositeKeyOf(M24_MASKED)
  if (!c || !c.startsWith('G-777#守门149')) throw new Error(`题面必须从括注后开始,实测 ${JSON.stringify(c)}`)
  const doc = [
    '# p',
    '- [ ] **G-700 基准行**:先给该族一个已用号。',
    M24_MASKED,
    M24_LONGPUSH,
    M24_NESTEDJIA,
    M24_NESTEDPAREN,
  ].join('\n')
  const u = usedIdsOfPrefix(doc, 'G')
  if (!u || u.max < 781)
    throw new Error(`号段基准必须被装饰行顶到 ≥781(旧尺子只给 700 ⇒ 重发 777),实测 ${u && u.max}`)
  // 括注里的被引号**不得**成为 O 族成员:整份文档没有任何 O 族编号位行 ⇒ null(判不出),不是 [81]
  if (usedIdsOfPrefix(doc, 'O') !== null)
    throw new Error(`O81 是持有者短名不是 O 族登记 ⇒ 取号集合必须为空,实测 ${JSON.stringify(usedIdsOfPrefix(doc, 'O'))}`)
})

test('M25 反向(顶高红线):行文引用不得算编号位;窗口语义的已知残留必须按现值钉住', () => {
  const doc = [
    '# p',
    '- [ ] **G-700 基准行**:唯一的已用号。',
    // ① 纯散文引用,且落在 48 字窗口之外 —— 不得顶高。
    '- [ ] ' + '无编号题面的中文垫子'.repeat(8) + ',后文才提到 G-777 —— 只是行文引用,不得顶高开号(垫子保证引用起点 >48 字,不靠点数)',
    // ② 本行有自己行首编号,G-777 在窗口内也只算引用(keyOfRow 取行首那一个)。
    '- [ ] **D70 与 G-290 无关的另一件事**:正文里提到 G-777 也只是引用,不得顶高 G 段。',
  ].join('\n')
  const u = usedIdsOfPrefix(doc, 'G')
  if (!u || u.max !== 700) throw new Error(`散文引用不得顶高号段,实测 max=${u && u.max}`)
  // ③ 括注**后面没有编号**的引用行:括注剥不动(最长锚定前缀回退),窗口照旧把 G-777 当 key。
  //    这是刻意保留的既有语义(宁顶号不空段;拆它要连 M20 的窗口锁一起裁),钉成现值防止无感漂移。
  const refInBrackets = '- [ ]（见 G-777 收口）另立一事,题面本身不含自身编号'
  if (keyOfRow(refInBrackets) !== 'G-777')
    throw new Error(`回退档的窗口语义被改动(须连同 M20/M27 一起裁,不许单动),实测 ${keyOfRow(refInBrackets)}`)
  if (!bodyOfRow(refInBrackets).startsWith('（见'))
    throw new Error('括注后无编号⇒不得吃(归并产物依赖这一半),实测括注被剥掉了')
  // ④ 全空的族不得给 0 号(与"取不到判不出"同口径)
  if (usedIdsOfPrefix('- [ ]（待派）本行题面没有任何编号形态', 'G') !== null)
    throw new Error('该族零成员必须 null,不得当"0 已用"')
})

test('M26 逐行条件不变量·真仓台账面(§22c:输入逐字取自被审面;每行两侧不一致即点名)', () => {
  // 一把与生产解析**不同构造**的独立尺子(测试本地,仅用于取证,不参与任何生产路径):
  // 行首成对括注(四种,深度感知)+ 词形装饰/强调记号全部跳过后,正文开头若就是编号形态 ⇒ 该行"编号位在行首"。
  const ID = String.raw`G-\d+[a-z]?|D\d+[a-z]?|O\d+[a-z]*\d*|B\d+[a-z]?|P\d+(?:-[A-Za-z]+)?(?:\.\d+)?|W\d+|守门\s*\d+[a-z]?|V3-\d+[a-z]?`
  const PAIRS = { '（': '）', '(': ')', '【': '】', '〔': '〕' }
  const NOISE = new Set(['*', '`', ' ', '\t', ':', '：', '✅', '　'])
  function indepAnchor(line) {
    const m = /^\s*[-*]\s\[(?: |x|X)\]\s*/.exec(line)
    if (!m) return null
    const body = line.slice(m[0].length)
    let i = 0
    for (;;) {
      while (i < body.length && NOISE.has(body[i])) i += 1
      for (const w of ['已完成', '已闭环', '已收口']) if (body.startsWith(w, i)) i += w.length
      const opener = body[i]
      const closer = PAIRS[opener]
      if (!closer) break
      let depth = 0
      let j = i
      for (; j < body.length; j += 1) {
        if (body[j] === opener) depth += 1
        else if (body[j] === closer && --depth === 0) break
      }
      if (depth !== 0) break
      i = j + 1
    }
    const mm = new RegExp(`^(?:${ID})`).exec(body.slice(i))
    if (!mm) return null
    const id = mm[0].trim()
    if (/^守门/.test(id) || /^P\d+$/.test(id)) return null // 与 keyOfRow 的既有排除同口径
    return id
  }
  const txt = gitRaw(['show', 'HEAD:PROJECT_PLAN.md'], ROOT)
  if (!txt || txt.length < 100000) throw new Error('取不到 HEAD 台账面 ⇒ 不变量无从跑,不得静默跳过')
  const lines = txt.split(/\r?\n/)
  const byFam = {}
  for (const f of ['G', 'D', 'O', 'B', 'P', 'W', 'V3']) {
    const u = usedIdsOfPrefix(txt, f)
    byFam[f] = new Set((u?.ids ?? []).map((x) => (/^([A-Za-z]+)[-_ ]?(\d+)/.exec(x) || []).slice(1, 3).join('')))
  }
  const norm = (id) => {
    const m = /^([A-Za-z]+)[-_ ]?(\d+)/.exec(id)
    return `${m[1].toUpperCase()}${m[2]}`
  }
  let checked = 0
  const bad = []
  lines.forEach((l, idx) => {
    const a = indepAnchor(l)
    if (!a) return
    checked++
    const fam = /^([A-Za-z]+)/.exec(a)[1].toUpperCase()
    if (!byFam[fam] || !byFam[fam].has(norm(a)))
      bad.push(`L${idx + 1} 锚=${a} 不在该族取号集合 | ${l.slice(0, 40)}`)
  })
  if (checked < 800) throw new Error(`独立尺子只认出 ${checked} 行编号位(本轮 HEAD 现读 2400+)⇒ 尺子坏了,不是面干净`)
  if (bad.length)
    throw new Error(
      `逐行条件不变量红 ${bad.length} 行(编号位在行首却没进集合 ⇒ 取号器会重发):\n${bad.slice(0, 8).join('\n')}`,
    )
})

test('M27 形状锁:括注扫描只许一份实现,三个同族读者不得回家各写灶;M16 防线一字未松', () => {
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'lib', 'plan-task-index.mjs'), 'utf8')
  // ① 深度扫描原语只有一份(`depth += 1` 是它的指纹;出现两次 = 有人抄了第二份)
  if ((src.match(/depth \+= 1/g) || []).length !== 1)
    throw new Error('成对括注扫描出现第二份实现 ⇒ 两处必漂(本仓最高频失效型)')
  // ② bodyOfRow 必须两档都在(词形 oldStrip + 括注 stripBracketDecorations),摘掉任一档即回到本票缺陷
  if (!/oldStrip\(body\)/.test(src) || !/stripBracketDecorations\(legacy\)/.test(src))
    throw new Error('bodyOfRow 不再走"词形+括注"两档 ⇒ 装饰档解析被拆')
  // ③ 主键后那一侧必须复用原语,且自己不得内联深度扫描
  const sk = /export function skipKeyAttachedDecorGroups\([\s\S]*?\n}/.exec(src)?.[0] ?? ''
  if (!sk.includes('matchBalancedGroupAt(s, k, GROUP_PAIRS)') || sk.includes('depth'))
    throw new Error('skipKeyAttachedDecorGroups 没复用原语(或内联了第二份扫描)⇒ 两侧对"配平"的理解会漂')
  // ④ 行首形状表含 〔〕、不含半角方括号;主键后表**不含** 〔(键后 〔拆票…〕 语义与旧版逐字同形)
  if (!/const LEAD_DECOR_PAIRS = \{[^\n]*〔/.test(src)) throw new Error('行首形状表丢了 〔〕 ⇒ 〔【归并】…〕 一族又隐身')
  if (/GROUP_PAIRS = \{[^\n]*〔/.test(src)) throw new Error('主键后表被加了 〔 ⇒ G-NNN〔拆票…〕 的 stripOwnKey 语义被单改')
  // ⑤ 三个同族读者只许**经出口**取数(import bodyOfRow/usedIdsOfPrefix 合法 —— 那正是 D168 定的方向),
  //    不得各自**再造**解析:自派生深度扫描 / 自定义行首形状表 / 复制括注剥离正则,都是第二份真相。
  for (const rel of ['scripts/live-doc-edit.mjs', 'scripts/next-plan-id.mjs', 'scripts/lib/plan-id-face.mjs']) {
    const t = readFileSync(path.resolve(ROOT, rel), 'utf8')
    if (t.includes('depth += 1') || t.includes('LEAD_DECOR_PAIRS') || t.includes('[^()]') || t.includes('[^（）]'))
      throw new Error(`${rel} 出现第二份括注/装饰解析实现 ⇒ 与取号出口分叉,本票在它身上复发`)
  }
  // ⑥ M16 撞号防线:编号后紧跟**非状态**括注仍不剥、仍判退化、composite 仍 null(本票没有把它洗回来)
  const noteParen = '- [ ] **G-257(新登记)**:`check-agent-engine-parity.mjs` 的可跑性依赖 cwd'
  if (compositeKeyOf(noteParen) !== null)
    throw new Error('叙述性括注被本票洗成有题面 ⇒ M16 撞号误翻勾防线没了')
})

test('M28 归并/折叠产物不得被本票点亮:【归并】前缀行题面仍为空、零撞号、派单口径仍排除它', () => {
  // 这是"最长锚定前缀"回退档存在的全部理由:归并器把编号摘进行首全角括注里,靠的正是
  // "括注后没有紧跟编号 ⇒ 不吃"。若哪天有人把回退拆成无条件吃,这一条先红,而不是等 --fold-twins 静默停摆。
  const held = '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明。'
  const foldCopy =
    '- [x] ✅(2026-09-27) **【归并】** 本行与已完成登记同题 ⇒ 只落状态、不删行。 **D99 复合主键正例**:旧副本。'
  const a = auditPlan(['# p', held, foldCopy].join('\n'))
  if (a.counts.collisionGroups !== 0)
    throw new Error(`归并产物被点亮 ⇒ 与持有行拼成假撞号,实测 ${JSON.stringify(a.collisions.map((g) => g.key))}`)
  if (compositeKeyOf(foldCopy) !== null)
    throw new Error(`折叠产物必须仍对 composite 隐形(摘号进括注的机制依赖),实测 ${compositeKeyOf(foldCopy)}`)
  // 台账里"摘号进（【归并】…）"的真实行:本票让它**重新可见**是刻意的(票面明列该形态);
  // 但派单口径必须仍把它扣掉 —— DUP_POINTER 那把尺子不因为编号现形而漏人。
  const b = auditPlan(['# p', M24_LONGPUSH, '- [ ] G-778 **另一条长括注推窗口的题面** —— 说明。'].join('\n'))
  if (b.claimableRows.some((r) => r.raw === M24_LONGPUSH))
    throw new Error('已带【归并】指针的副本重新进了派单口径 ⇒ 本票把它修成了"同一件事派两遍"')
})

/**
 * M-ABS 绝对层的定级(2026-09-29):基线存量红**不得**拦无关提交,而差值红**必须**照拦。
 * 三条各是一次变异对照 —— 少任何一条,这台门要么恒红(全队跳钩子),要么被降级顺手拆掉拦点。
 */
test('M-ABS 绝对层只在问责档判红,提交链(差值档)只报数;差值棘轮一行未放宽', () => {
  const base = JSON.parse(
    readFileSync(new URL('../../scripts/plan-task-state-baseline.json', import.meta.url), 'utf8'),
  )
  const mk = (forks, newUndisposed) => ({
    counts: {
      forks,
      voidRows: 0,
      rotatedPointers: 0,
      rotatedAuto: 0,
      rotatedNoExit: 0,
      dupOpenCopies: 0,
      verbatimDupCopies: 0,
      dupBlocks: 0,
      newUndisposed,
      mergeNotes: 9e6,
      stale: 0,
      undated: 0,
      undetermined: 0,
    },
    collisions: [],
    malformedRows: [],
    staleRows: [],
  })
  const silenced = console.log
  console.log = () => {}
  let rcGrewWithBefore, rcAbsOnlyWithBefore, rcAbsOnlyStrict, rcAbsOnlyFull, rcDiffGrew
  try {
    // 存量比基线高、而本次提交什么都没带 ⇒ 链上不得拦
    rcAbsOnlyWithBefore = gate(mk(9e5, 0), false, ROOT, mk(9e5, 0), null)
    // 同一份增长在问责档(--strict)必须红,否则降级等于拆门
    rcAbsOnlyStrict = gate(mk(9e5, 0), true, ROOT, mk(9e5, 0), null)
    // 全量档(没有 before)同样必须红 —— 它是 CI/人工问责的另一条腿
    rcAbsOnlyFull = gate(mk(9e5, 0), false, ROOT, null, null)
    // 差值棘轮:本次新增分叉必须 exit 1(绝对层降级不得连带放宽它)
    rcDiffGrew = gate(mk(0, 1), false, ROOT, mk(0, 0), null)
    rcGrewWithBefore = gate(mk(1, 0), false, ROOT, mk(0, 0), null)
  } finally {
    console.log = silenced
  }
  if (base.F1 !== 0) throw new Error(`本用例假设基线 F1 地板是 0,实为 ${JSON.stringify(base.F1)}`)
  const want = (label, got, exp) => {
    if (got !== exp) throw new Error(`${label}:期望 exit ${exp},实得 ${got}`)
  }
  want('存量增长在提交链(差值档)只报数,不拦无关提交', rcAbsOnlyWithBefore, 0)
  want('问责档 --strict 必须仍判红 —— 降级不得变成拆门', rcAbsOnlyStrict, 1)
  want('全量档(无 before)必须仍判红', rcAbsOnlyFull, 1)
  want('差值棘轮必须照拦(链上真正的拦点)', rcDiffGrew, 1)
  want('本次提交让 F1 变多必须 exit 1', rcGrewWithBefore, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
