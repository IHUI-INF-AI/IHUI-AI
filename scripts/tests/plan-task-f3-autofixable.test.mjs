// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-task-f3-autofixable.test.mjs —— F3「可自动收口」资格的镜像测试(§22c:直接 import 判据本体)
 *
 * 为什么单独一枚文件(而不是并进 plan-tasks.test.mjs):那一份文件在 HEAD 里挂着一个**别人已入库**的
 * eslint error(`for (const rev of …)` 的 rev 从未被用),lint-staged 对暂存文件跑 `eslint --fix`
 * 时那条不可自动修的错误会挡住每一次提交 —— 而按 §12 边界,那属该文件持有人的判据语义问题
 * (他们那句"钉在历史版本上"的活体对照此刻其实只读一个面),不该由本票顺手替他改判据。
 * 本仓的镜像文件本来就是按题分枚的(plan-task-headings / plan-tasks-ledger-age / plan-tasks-merge),
 * 所以另起一题不破坏任何约定。
 *
 * 这一格判的是什么:归并器**能不能落笔**。它必须与"出口将要写进台账的那句话"同形,否则两种相反的
 * 失效都能发生:
 *  · 恒判可修(2026-09-28 之前的实际行为)——旧条件是 `compositeKeyOf(t) === compositeKeyOf(r.raw)`,
 *    而两边都没有主键时 `null === null` 成立 ⇒ 出口给一行"既不同主键、也无逐字孪生"的行写上
 *    "与本行正文逐字相同" = 替别人编证据;并且 F3 的"可自动收口"这一维挂在 **blocking 提交链**上,
 *    任何一次 append 挪行号都可能让某条无出口指针的目标恰好落到另一个无主键条目行上 ⇒ 红自己长回来
 *    (实测:清偿落地后 8 分钟内 0→1),每台每次提交被逼 --no-verify ⇒ 全部守门对该提交作废(§12f)。
 *  · 恒判不可修 —— 那一维永不为红,等于把自动档偷偷关掉而账面只看见绿。
 * 因此下面四条:三条构造面各钉一个方向(键等值 / 两边无键 / 无键但有逐字孪生),第四条把真仓整个
 * 面上的每一条 auto 逐条**独立复核**其依据是否真的成立(性质判据,不判数量 ⇒ 不会因并发提交而闪红)。
 */

import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { auditPlan, compositeKeyOf, findRotatedPointers } from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const KEYED = [
  '# 计划',
  '- [x] ✅(2026-09-26) **D90 权威登记**:正文。',
  '- [x] ✅(2026-09-26) **D90 权威登记**:副本,同主键的另一条登记在 L2。',
].join('\n')

const KEYLESS = [
  '# 计划',
  '- [x] ✅(2026-09-26) **[归并]** 无主键的行甲:正文不同。',
  '- [x] ✅(2026-09-27) **[归并]** 无主键的行乙:同主键的另一条登记在 L2。',
].join('\n')

const TWIN_LINE = '- [ ] 无主键行:存活于 L2 的同编号登记。〔孪生〕'
const TWIN = ['# 计划', '- [x] ✅(2026-09-26) **D91 权威登记**:正文。', TWIN_LINE, TWIN_LINE].join('\n')

test('F3-a 两侧都有主键且逐字等值 ⇒ 可自动收口(收紧之后不得把这一型一起关掉)', () => {
  const r = findRotatedPointers(KEYED)
  if (r.length !== 1) throw new Error(`夹具应恰好命中 1 处指针,实测 ${r.length}`)
  if (r[0].autoFixable !== true)
    throw new Error('同主键那一型必须仍可自动收口,否则归并器对它永不停手 ⇒ 这一维变恒绿')
})

test('F3-b 两边都没有主键 ⇒ null===null 不算同主键:不可自动收口,但仍须被点名', () => {
  const r = findRotatedPointers(KEYLESS)
  if (r.length !== 1)
    throw new Error(`收紧资格后这条指针仍须留在 F3 总数里(不判红≠不判),实测 ${r.length}`)
  if (r[0].autoFixable !== false)
    throw new Error('null===null 又被当成"同主键" ⇒ 出口会给无孪生的行写上核验不了的假话')
  if (compositeKeyOf(r[0].raw) !== null)
    throw new Error('夹具假设破了:这一行本应无主键(归并产物形态)')
  if (!/行号指针即使还指得准也不许存在/.test(r[0].reason))
    throw new Error(`应按"无出口交人工"定性,实测 ${r[0].reason}`)
})

test('F3-c 无主键**但有逐字孪生**:仍不进自动档(相对 HEAD 只减不增),但必须留在总数里被点名', () => {
  const r = findRotatedPointers(TWIN)
  if (r.length !== 2) throw new Error(`两行孪生各带一处指针,实测 ${r.length} —— 总数不得因收紧而缩水`)
  if (!r.every((x) => x.autoFixable === false))
    throw new Error(
      '给这一型开自动出口实测一次把 21 行拉进判红面 ⇒ 那是扩大判红面而不是修缺陷(§12f),出路归该行持有人',
    )
})

test('F3-d 真仓 HEAD 面上每一条 auto 都独立复核其依据(性质判据,不靠数量 ⇒ 不会因并发提交闪红)', () => {
  const txt = gitRaw(['show', 'HEAD:PROJECT_PLAN.md'], process.cwd())
  if (!txt || txt.length < 100000) throw new Error('取不到 HEAD 版计划文档 ⇒ 无从复核,不算通过')
  const a = auditPlan(txt)
  if (a.rotated.length === 0)
    throw new Error('真仓面上一条腐烂指针都没数到 ⇒ 尺子对这一型失明(实测应仍有 200 上下无出口)')
  const lines = txt.split('\n')
  for (const p of a.rotated.filter((x) => x.autoFixable)) {
    const self = lines[p.line - 1]
    const targ = lines[p.target - 1]
    const selfKey = compositeKeyOf(self)
    if (selfKey === null || selfKey !== compositeKeyOf(targ))
      throw new Error(
        `L${p.line} 被判定可自动修,但"两侧都有主键且逐字等值"复核不成立(本行键=${String(selfKey)})`,
      )
  }
  if (a.counts.rotatedNoExit < 100)
    throw new Error(
      `无出口读数 ${a.counts.rotatedNoExit} 低于本仓已知量级 ⇒ 判据大概被谁削窄了(2026-09-28 这一档为 200 上下)`,
    )
})

test('F3-e 源码反向锁:那句 vacuous 等值不得回到 autoFixable 的条件里', () => {
  const lib = readFileSync(new URL('../lib/plan-task-index.mjs', import.meta.url), 'utf8')
  const at = lib.indexOf('autoFixable:')
  if (at < 0) throw new Error('lib 里找不到 autoFixable 这一格 ⇒ 本锁的锚点已漂')
  const clause = lib.slice(at, at + 1200)
  if (/compositeKeyOf\(t\)\s*===\s*compositeKeyOf\(r\.raw\)\s*[,)]/.test(clause))
    throw new Error('旧条件(无主键两侧也判相等)回来了 ⇒ 假锚点与自长红两型同时复活')
  if (!clause.includes('compositeKeyOf(r.raw) !== null'))
    throw new Error('autoFixable 必须显式要求"主键存在",否则 null===null 那一型随时复活')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
