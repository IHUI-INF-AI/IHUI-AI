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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  VOID_MARK_RE,
  auditPlan,
  compositeKeyOf,
  dispositionOf,
  findRotatedPointers,
  keyOfRow,
  titleOf,
} from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import {
  countNewUndisposed,
  gate,
  grewViolations,
  parseArgs,
  probe,
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
  const known = ['目标行不存在', '目标行不是条目行', '目标行是另一条(复合主键不等)']
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  if (!/usedIdsOfPrefix\(content/.test(cli) || !/nextTaskIdNumber\(content/.test(cli))
    throw new Error('分支没有从被审面现读 ⇒ 号可能来自别处(面取错的号比不取号更贵)')
})
