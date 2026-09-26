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

import { VOID_MARK_RE, auditPlan, findRotatedPointers } from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { grewViolations, ratchetViolations } from '../plan-tasks.mjs'

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
  if (a.counts.forks !== 1 || !a.forks[0].key.startsWith('D99')) throw new Error(`F1 判歪:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.voidRows !== 1 || !a.voidRows[0].raw.includes('D97')) throw new Error(`F2 判歪:${JSON.stringify(a.voidRows.map((r) => r.line))}`)
  if (a.counts.rotatedPointers !== 1 || a.rotated[0].target !== 1) throw new Error(`F3 判歪:${JSON.stringify(a.rotated)}`)
  if (a.counts.claimable !== 2) throw new Error(`派单口径应为 2,实测 ${a.counts.claimable}`)
  const opened = a.claimableRows.map((r) => r.raw)
  if (!opened.some((s) => s.includes('D98')) || !opened.some((s) => s.includes('D96'))) throw new Error('派单口径漏掉真待办')
})

test('M2 反向对照:干净文档三条全零(判据不得无牙地一直红)', () => {
  const a = auditPlan(['- [ ] **D90 干净任务**:无人认领。', '- [x] ✅(2026-09-26) **D91 干净完成**:已落账。'].join('\n'))
  for (const k of ['forks', 'voidRows', 'rotatedPointers']) if (a.counts[k] !== 0) throw new Error(`${k} 应为 0,实测 ${a.counts[k]}`)
  if (a.counts.claimable !== 1) throw new Error(`派单口径应为 1,实测 ${a.counts.claimable}`)
})

test('M3 变异对照:把 F1 的判据对象拆开写,分叉必须消失(证明 F1 靠的是主键相等而非巧合)', () => {
  const mutated = FIXTURE.replace('- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着', '- [ ] **D99 已被改写成另一件事**:内容完全不同')
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
  if (voidRows.length === 0) throw new Error(`${SAMPLE_REV} 里读不到"判:裸副本/勿照本行派单"的未勾选行 —— 样本钉死失效,须换一个历史版本,不得跳过`)
  const a = auditPlan(voidRows.join('\n'))
  if (a.voidRows.length !== voidRows.length) throw new Error(`F2 对真实形态漏判:${a.voidRows.length}/${voidRows.length}`)
  if (!VOID_MARK_RE.test(voidRows[0])) throw new Error('VOID_MARK_RE 不认第一条真实样本')
})

test('M5 真实文档的行号指针确实会腐烂(F3 守的是发生过的事,不是假想)', () => {
  const { pointerRows } = realSample()
  if (pointerRows.length === 0) throw new Error(`${SAMPLE_REV} 里已无 L 号指针样本 —— 换历史版本,不得跳过`)
  const bad = findRotatedPointers(pointerRows.join('\n'))
  if (bad.length === 0) throw new Error('F3 对真实形态一条都没点到 ⇒ 判据对该形态失明')
  const known = ['目标行不存在', '目标行不是条目行', '目标行是另一条(复合主键不等)']
  for (const b of bad) if (!known.includes(b.reason)) throw new Error(`出现未登记的原因分类:${b.reason}`)
})

test('M6 棘轮只点名上涨:等值/下降/缺项/坏值都不许判红', () => {
  const items = [['F1', '同主键两态并存(组)', 5], ['F2', '带作废声明未落账(行)', 3], ['F3', '行号指针已腐烂(处)', 0]]
  if (ratchetViolations(null, items).length !== 0) throw new Error('无基线时不得凭空判红')
  const one = ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items)
  if (one.length !== 1 || !one[0].includes('F1')) throw new Error(`应只点名上涨项,实测 ${JSON.stringify(one)}`)
  if (ratchetViolations({ F1: 9, F2: 9 }, items).length !== 0) throw new Error('低于基线不得判红')
  if (ratchetViolations({ F1: 'x' }, items).length !== 0) throw new Error('基线坏值不得判红(也不得声称通过)')
})

test('M7 主键收窄:行文引用不得算第二次登记', () => {
  const src = ['- [x] ✅(2026-09-26) **D10 真条目**:说明。', '- [ ] **D11 另一件事**:见 D10 的结论。'].join('\n')
  const a = auditPlan(src)
  if (a.counts.forks !== 0) throw new Error(`引用被误算成分叉:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.claimable !== 1) throw new Error('D11 应留在派单口径里')
})

test('M8 F4 同题待办:两条只算一条活,已标副本的行不重复计(幂等)', () => {
  const pair = ['- [ ] **D12 同一件事**:短。', '- [ ] **D12 同一件事**:长一些的那条登记。'].join('\n')
  const a = auditPlan(pair)
  if (a.counts.dupOpenCopies !== 1) throw new Error(`一对同题待办应计 1 副本,实测 ${a.counts.dupOpenCopies}`)
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
  if (keys.length < 5) throw new Error(`probe 维度解析异常(只数到 ${keys.length} 个,数组截断了):判据本身失效`)
  if (!keys.includes('F6')) throw new Error('F6 块级维度不在 probe 里 ⇒ 提交链根本不判它,本条随之无牙')
  const base = JSON.parse(
    readFileSync(new URL('../../scripts/plan-task-state-baseline.json', import.meta.url), 'utf8'),
  )
  for (const k of keys) {
    if (k === 'F5') continue // F5 方向相反,单独由 gate() 判,不走 ratchetViolations
    if (typeof base[k] !== 'number')
      throw new Error(`基线缺 ${k}(棘轮对缺项那一维完全不判 ⇒ 加维必须同笔写基线):${JSON.stringify(base)}`)
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
  if (!grew.some((x) => x.startsWith('F6'))) throw new Error(`多出一份块必须点名 F6,实测 ${JSON.stringify(grew)}`)
  const shrank = grewViolations(auditPlan(one), auditPlan(two))
  if (shrank.some((x) => x.startsWith('F6'))) throw new Error(`收口(2 份→1 份)不得判红:${JSON.stringify(shrank)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('P-x 跨文件出口锁:probe 必须由 plan-tasks 真导出,且收敛器引得到(427e529947 引了它却没导出 ⇒ 所有会话的推送收敛当场崩)', async () => {
  // ① 直接按名字 import:导出被改名或删掉 ⇒ 本文件加载即红(比任何字符串断言都硬)。
  const mod = await import('../plan-tasks.mjs')
  if (typeof mod.probe !== 'function') throw new Error('plan-tasks.mjs 不再导出 probe(命名维度清单的唯一来源)')
  const dims = mod.probe({ counts: { forks: 0, voidRows: 0, rotatedPointers: 0, dupOpenCopies: 0, dupBlocks: 0, mergeNotes: 0 } })
  if (dims.length < 4) throw new Error(`probe 读数维度少于 4 条:${JSON.stringify(dims.map((d) => d[0]))}`)
  for (const [k, label, n] of dims) {
    if (!/^F\d$/.test(k) || typeof label !== 'string' || typeof n !== 'number')
      throw new Error(`维度元组形态不符 [F?, label, number]:${JSON.stringify([k, label, n])}`)
  }
  // ② 消费者侧:收敛器必须真的引这个名字(它自己抄一份维度清单就是第二把尺子,必漂)。
  const conv = readFileSync(path.resolve(ROOT, 'scripts', 'git-sync-converge.mjs'), 'utf8')
  if (!/import \{[^}]*\bprobe\b[^}]*\} from '\.\/plan-tasks\.mjs'/.test(conv))
    throw new Error('git-sync-converge.mjs 未从 plan-tasks 引 probe(要么改用别的名字,要么在别处抄了清单)')
})
