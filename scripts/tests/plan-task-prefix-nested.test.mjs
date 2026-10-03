// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-task-prefix-nested.test.mjs —— G-814403 F4c「同题前缀套叠副本」的镜像测试
 *
 * 这一族为什么值得单独立一枚文件(而不是并进 plan-tasks.test.mjs):那一份文件在 HEAD 里挂着
 * 一条**别人已入库**的 eslint 错误(见 plan-task-f3-autofixable.test.mjs 头注),lint-staged 对
 * 暂存文件跑 `eslint --fix` 时那条不可自动修的错误会挡住每一次提交。本仓镜像文件本就按题分枚
 * (plan-task-headings / plan-tasks-ledger-age / plan-task-index-f9-declaration-face),另起一题不破坏约定。
 *
 * 这一格判的是什么:**同一件事的不同增长阶段各带回一份**时,A 的整行是 B 的精确前缀
 * (票面实测 754 ⊂ 1372 ⊂ 1767 逐层包含)。三把既有尺子同时看不见它(机制逐条量化在
 * `findPrefixNestedCopies` 头注:实测 223 组里 0 组两态并存 ⇒ F1 结构性不命中;
 * 199/223 组剥掉副本指针后 `live.length < 2` ⇒ F4 直接 `continue`;F4b 显式跳过有主键的行)。
 * 后果不是"账面多几行",而是**已闭环的票在派单口径里仍是活账**。
 *
 * 下面 8 例的分工:
 *  · C1/C2/C3 正面:三层套叠要被数出来、逐层都要报(少报一层 = 放过一次重放)。
 *  · C4 **反向对照①**(票面明写):前缀关系不成立时**不得计入** —— 否则任何同前缀开头但
 *    互不包含的两件事都会被并成一条。
 *  · C5 **反向对照②**(票面明写):holder 不在被审面 / 命中不唯一 / 已是副本 ⇒ **大声失败**,
 *    不得静默退化成"这一族没配上"(那是本仓最高频的失效型)。
 *  · C6 **成对自检①**(票面明写):加一行新前缀副本 ⇒ 报数上升。
 *  · C7 **成对自检②**(票面明写):副本被人工指定 holder 并加指针后 ⇒ 该族清零。
 *  · C8 真仓面性质复核 + 源码反向锁(不许把"精确前缀"换成相似度/长度猜测)。
 */

import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  DUP_POINTER_RE,
  auditPlan,
  compositeKeyOf,
  findPrefixNestedCopies,
  planPrefixNestedPointer,
  prefixNestedCopies,
} from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

/** 三层逐层前缀包含(票面实测形态:754 ⊂ 1372 ⊂ 1767 的同型,长度取小值只为可读)。
 *  ⚠ 复选框逐字相同 ⇒ 三行同态(`open`)⇒ F1 结构上不可能命中,这正是本族要单立一维的原因。 */
const NESTED3 = [
  '# 计划',
  '- [ ] **G-900 同一件事**:甲阶段取证完成,已落第一段证据。',
  '- [ ] **G-900 同一件事**:甲阶段取证完成,已落第一段证据。第二段证据也补齐了。',
  '- [ ] **G-900 同一件事**:甲阶段取证完成,已落第一段证据。第二段证据也补齐了。第三段收尾。',
].join('\n')

test('C1 三层逐层前缀包含 ⇒ 恰好 3 对(逐层都报,少报一层等于放过一次重放)', () => {
  const r = findPrefixNestedCopies(NESTED3)
  if (r.pairs.length !== 3)
    throw new Error(`三层套叠应产出 3 对(1⊂2 / 1⊂3 / 2⊂3),实测 ${r.pairs.length}`)
  if (r.groupKeys.length !== 1) throw new Error(`应归为 1 组,实测 ${r.groupKeys.length}`)
  // 逐字复核每一对:A 必须是 B 的精确前缀且更短(判据本体可被独立重算,不信返回值自述)
  for (const p of r.pairs) {
    if (!p.long.raw.startsWith(p.short.raw))
      throw new Error(`L${p.short.line} 不是 L${p.long.line} 的前缀 ⇒ 判据报了一对不成立的关系`)
    if (p.lenShort >= p.lenLong) throw new Error('短行不得长于等于长行')
  }
})

test('C2 本族对 F1/F4b 结构性失明;对 F4 只在"指针剥离后的残余"上失明(逐条钉死,不把机制说过头)', () => {
  const a = auditPlan(NESTED3)
  if (a.counts.forks !== 0)
    throw new Error(`夹具假设破了:这 3 行同态,不该有 F1 分叉,实测 ${a.counts.forks}`)
  if (a.counts.verbatimDupCopies !== 0)
    throw new Error(`F4b 只认逐字等值,应量不到本族,实测 ${a.counts.verbatimDupCopies}`)
  if (a.counts.prefixNestedPairs !== 3 || a.counts.prefixNestedGroups !== 1)
    throw new Error(
      `F4c 必须在这一族上给出读数,实测 pairs=${a.counts.prefixNestedPairs} groups=${a.counts.prefixNestedGroups}`,
    )
  // ⚠ 机制如实校准(第一版把 F4 写成"结构上量不到本族",**是错的**,现按真读数逐条改写):
  //  ① F4 对**全 open 且无指针**的形态是**看得见的**(数出 2 个副本)⇒ F4c 不是它的重复劳动。
  //  ② F4 真正的漏口是 `findDupOpenCopies` 的两道闸:if(带副本指针)剔掉 + 要求 `live>=2`。
  //     真仓面上本族的**长行几乎都已被标过副本指针**(实测 1054 对里 long 带指针 981 对、
  //     short 带指针 **0** 对)⇒ 每组剥完指针只剩 1 行 ⇒ `live<2` ⇒ 直接 `continue`
  //     (223 组里 200 组走这条分支)。F4 副本行读数因此是 0,而"同题前缀套叠"这件事确实在。
  //  ③ short 带指针 0 对这一项不是巧合:副本指针追加在**行尾**,而行尾正是长行多出来的那一段
  //     ⇒ 一旦给短行加了指针,`long.startsWith(short)` 立刻为假,这一对从 F4c 面前消失。
  //     **所以"清零"的成因是"前缀关系被指针本身破坏",不是"判据把带指针的行剔掉了"。**
  //     C7 那一格必须按这个真机制写,否则下一个人会以为"加指针 = 被过滤",而实际上
  //     F4c 判据里根本没有 DUP_POINTER_RE 那一行(它在 F4 里)。这一条是本组最易被写错的机制。
  if (a.counts.dupOpenCopies !== 2)
    throw new Error(`全 open 无指针形态下 F4 应数出 2 个副本,实测 ${a.counts.dupOpenCopies}(若此处变了须重读机制,别沿用旧说法)`)
  const lines = NESTED3.split('\n')
  const partial = [lines[0], lines[1] + '【归并】重复登记副本', lines[2] + '【归并】重复登记副本', lines[3]].join('\n')
  const b = auditPlan(partial)
  if (b.counts.dupOpenCopies !== 0)
    throw new Error(`两份加指针后 F4 应归零,实测 ${b.counts.dupOpenCopies}`)
  if (b.counts.prefixNestedPairs !== 0)
    throw new Error(
      `给短行加指针会破坏 startsWith ⇒ 这一族应清零,实测 ${b.counts.prefixNestedPairs}(若非零则说明判据里另有一道指针过滤,机制描述要重读)`,
    )
})

test('C3 逐条点名:每对都带行号与两侧长度(不给名单就下一个人得重新发现一遍)', () => {
  const r = findPrefixNestedCopies(NESTED3)
  for (const p of r.pairs) {
    if (!Number.isInteger(p.short.line) || !Number.isInteger(p.long.line))
      throw new Error('点名必须带两侧行号(定位用),缺一条就等于只给了计数')
    if (!(p.lenShort > 0 && p.lenLong > p.lenShort)) throw new Error('点名必须带两侧长度')
    if (typeof p.key !== 'string' || !p.key) throw new Error('点名必须带复合主键(复用 compositeKeyOf 那一份)')
  }
})

test('C4 反向对照①:前缀关系不成立 ⇒ 一律不得计入(否则任何同前缀开头但互不包含的两件事都会被并成一条)', () => {
  const NOT_NESTED = [
    '# 计划',
    '- [ ] **G-901 同一件事**:甲段落写完了。',
    '- [ ] **G-901 同一件事**:乙段落写完了(与甲无任何包含关系)。',
  ].join('\n')
  if (findPrefixNestedCopies(NOT_NESTED).pairs.length !== 0)
    throw new Error('互不包含的两行被算成前缀套叠 ⇒ 判据被放宽成"同开头就算"')
  // 同主键但**长度相等**、逐字不同 ⇒ 也不是前缀关系(等长时 startsWith 必为 false,此处钉住边界)
  const SAME_LEN = ['# 计划', '- [ ] **G-902 甲**:正文甲。', '- [ ] **G-902 乙**:正文乙。'].join('\n')
  if (findPrefixNestedCopies(SAME_LEN).pairs.length !== 0)
    throw new Error('等长两行被算成前缀套叠 ⇒ 长度守卫失效')
  // 短行**不是**长行的开头(只是共有开头几个字)⇒ 不得计入
  const SHARED_HEAD = [
    '# 计划',
    '- [ ] **G-903 同一件事**:甲在这里分叉走了。',
    '- [ ] **G-903 同一件事**:甲在这里分叉去了别处。',
  ].join('\n')
  if (findPrefixNestedCopies(SHARED_HEAD).pairs.length !== 0)
    throw new Error('共有开头但互不包含 ⇒ 被误并(这正是"不得靠相似度"要防的那一型)')
  // 复合主键不同 ⇒ 即使逐字前缀也**不得**计入(否则"什么算同一件事"就有第二份了)
  const DIFF_KEY = ['# 计划', '- [ ] **G-904 甲一件事**:正文。', '- [ ] **G-905 乙一件事**:正文。'].join('\n')
  if (findPrefixNestedCopies(DIFF_KEY).pairs.length !== 0)
    throw new Error('主键不同的两行被并成一条 ⇒ 判据绕开了 compositeKeyOf,自造了第二份"同一件事"')
})

test('C5 反向对照②:holder 不在被审面 / 命中不唯一 / 已是副本 ⇒ 大声失败(不得静默退化成"这一族没配上")', () => {
  const miss = planPrefixNestedPointer(NESTED3, '这一族在本文档里根本不存在的一行原文')
  if (miss.ok !== false) throw new Error('holder 0 命中时必须拒绝执行')
  if (!/不等于"这一族没配上"/.test(miss.reason))
    throw new Error(`失败文案必须当场区分"配不上"与"这一族没配上",实测 ${miss.reason}`)

  const ambiguous = planPrefixNestedPointer(NESTED3, '甲阶段取证完成')
  if (ambiguous.ok !== false) throw new Error('holder 命中多行时必须拒绝执行(机器不替你挑正本)')
  if (!/唯一定位/.test(ambiguous.reason))
    throw new Error(`命中不唯一的文案必须点名"机器不替你挑正本",实测 ${ambiguous.reason}`)

  const empty = planPrefixNestedPointer(NESTED3, '   ')
  if (empty.ok !== false) throw new Error('空片段必须拒绝执行')

  // 指定最长的那一份为 holder ⇒ 另两份都该被加指针
  const holderRaw = NESTED3.split('\n')[3]
  const holderKey = compositeKeyOf(holderRaw)
  if (!holderKey) throw new Error('夹具假设破了:holder 行应有复合主键')
  const ok = planPrefixNestedPointer(NESTED3, '第三段收尾')
  if (ok.ok !== true) throw new Error(`唯一定位的 holder 应可执行,实测 ${ok.reason}`)
  if (ok.pointered.length !== 2)
    throw new Error(`指定最长行为正本后另两份都该加指针,实测 ${ok.pointered.length}`)
  if (!ok.pointered.every((t) => t.key === holderKey))
    throw new Error('出口加的指针必须归属 holder 的复合主键(复用同一份实现)')
  if (ok.holderLine !== 4) throw new Error(`出口必须报出 holder 行号,实测 ${ok.holderLine}`)

  // holder 自己已带副本指针 ⇒ 拒绝(它已是副本,不能当正本)。静默接受会把指针堆成两段同文。
  const selfPointed = [
    '# 计划',
    NESTED3.split('\n')[1],
    NESTED3.split('\n')[2],
    NESTED3.split('\n')[3] + '【归并】重复登记副本',
  ].join('\n')
  const asCopy = planPrefixNestedPointer(selfPointed, '第三段收尾')
  if (asCopy.ok !== false) throw new Error('已带指针的行被当正本接受 ⇒ 指针会重复堆叠')
  if (!/不能当正本/.test(asCopy.reason)) throw new Error(`文案须点明"不能当正本",实测 ${asCopy.reason}`)

  // holder 无复合主键 ⇒ 拒绝(不属 F4c 族)。这一格防的是"出口脱离 compositeKeyOf 自行其是"。
  const noKey = ['# 计划', '- [ ] 无主键的叙述式待办:正文甲。', '- [ ] 无主键的叙述式待办:正文甲,还有乙。'].join('\n')
  const nk = planPrefixNestedPointer(noKey, '无主键的叙述式待办:正文甲。')
  if (nk.ok !== false) throw new Error('无主键行被当 holder 接受 ⇒ 出口绕开了同一份主键实现')
})

test('C6 成对自检①:加一行新前缀副本 ⇒ 报数上升(这一格证明判据有牙,不是恒 0 的死尺子)', () => {
  const before = findPrefixNestedCopies(NESTED3)
  const grown = NESTED3 + '\n- [ ] **G-900 同一件事**:甲阶段取证完成,已落第一段证据。第二段证据也补齐了。第三段收尾。第四段。'
  const after = findPrefixNestedCopies(grown)
  if (!(after.pairs.length > before.pairs.length))
    throw new Error(`加一行新前缀副本后报数必须上升,实测 ${before.pairs.length} → ${after.pairs.length}`)
  if (!(after.groupKeys.length >= before.groupKeys.length))
    throw new Error('组数不得因新增副本而下降')
})

test('C7 成对自检②:副本被人工指定 holder 并加指针后 ⇒ 该族清零(且不动勾选)', () => {
  // 走真出口:先经 planPrefixNestedPointer 取得该加指针的行,再逐行构造(不经正则模拟出口行为)。
  const lines = NESTED3.split('\n')
  const plan = planPrefixNestedPointer(NESTED3, '第三段收尾')
  if (!plan.ok) throw new Error(`出口应可执行,实测 ${plan.reason}`)
  const byLine = new Map(lines.map((l, i) => [i + 1, l]))
  for (const t of plan.pointered) byLine.set(t.line, byLine.get(t.line) + '【归并】重复登记副本')
  const pointered = [...byLine.values()].join('\n')
  // 出口绝不许动勾选(F4 口径:只加指针)
  for (const l of pointered.split('\n')) {
    if (/^\s*[-*]\s\[x\]/i.test(l) && l.includes('G-900'))
      throw new Error('出口绝不许动勾选(F4 口径)')
    if (l.includes('【归并】重复登记副本【归并】'))
      throw new Error('同一次落笔把指针堆了两段 ⇒ 出口没有"已带指针就跳过"的守卫')
  }
  const a = auditPlan(pointered)
  // ⚠ 清零的**真机制**(第一版写成"带指针的行被剔",错了):副本指针追加在**行尾**,
  // 而行尾正是长行比短行多出来的那一段 ⇒ 给短行加指针后 `long.startsWith(short)` 立刻为假
  // ⇒ 这一对从 F4c 面前消失。F4c 判据里**没有** DUP_POINTER_RE 那一道过滤(那道在 F4 里)。
  // 钉住这一点很重要:否则下一个人会以为本判据"过滤了带指针的行",而真相比那更硬 ——
  // 它连前缀关系本身都不成立了。
  if (a.counts.prefixNestedPairs !== 0)
    throw new Error(`加指针后该族应清零,实测 ${a.counts.prefixNestedPairs}`)
  // 反向:摘掉指针后读数必须回来(证明上面那个 0 是"前缀关系被破坏"造成的,不是判据失明)
  const unpointered = pointered.replaceAll('【归并】重复登记副本', '')
  if (auditPlan(unpointered).counts.prefixNestedPairs !== 3)
    throw new Error('摘掉指针后报数必须回到 3 ⇒ 上一个 0 来自前缀关系被破坏,而不是判据失明')
})

test('C8 真仓面性质复核 + 源码反向锁(性质判据不判数量 ⇒ 不因并发提交闪红;且不许换成相似度/长度猜测)', () => {
  const txt = gitRaw(['show', 'HEAD:PROJECT_PLAN.md'], process.cwd())
  if (!txt || txt.length < 100000) throw new Error('取不到 HEAD 版计划文档 ⇒ 无从复核,不算通过')
  const a = auditPlan(txt)
  if (!(a.counts.prefixNestedGroups > 0) || !(a.counts.prefixNestedPairs > 0))
    throw new Error('真仓面上本族读数为 0 ⇒ 尺子对这一型失明(本仓 2026-09-29 现读为 223 组这一档)')
  // 逐条独立复核:每一对都必须是"同复合主键 + 精确前缀",否则就是判据报错了
  const lines = txt.split('\n')
  for (const p of a.prefixNested.pairs) {
    const s = lines[p.short.line - 1]
    const l = lines[p.long.line - 1]
    if (!l.startsWith(s)) throw new Error(`L${p.short.line} 不是 L${p.long.line} 的精确前缀(判据报错了)`)
    if (compositeKeyOf(s) !== compositeKeyOf(l))
      throw new Error(`L${p.short.line}/L${p.long.line} 复合主键不等 ⇒ 判据绕开了同一份实现`)
  }
  // 真仓 composition 锁(**性质**,不判数量 ⇒ 不因并发提交闪红):本族的**长行几乎都已带副本指针**,
  // 而 F4 的第一道闸就是"带指针的剔掉" + 要求 `live>=2` ⇒ F4 副本行读 0 而本族真实存在。
  // 这一格是"为什么 F4c 不是 F4 的重复劳动"的**现读证据**;机制描述一旦漂(比如哪天有人给
  // 短行也加上了指针 ⇒ short 带计数上升),这里的下限会先红,提醒下一个人重读机制。
  const pairsWithPtrLong = a.prefixNested.pairs.filter((p) => DUP_POINTER_RE.test(p.long.raw)).length
  if (pairsWithPtrLong * 2 < a.prefixNested.pairs.length)
    throw new Error(
      `长行带副本指针的比例 ${pairsWithPtrLong}/${a.prefixNested.pairs.length} 掉到一半以下 ⇒ F4 漏口的成因已变,机制描述要按现读重写`,
    )
  if (a.counts.dupOpenCopies !== 0)
    throw new Error(
      `真仓面 F4 副本行读数应为 0(这正是本族"对全部判据隐身"的读数证据),实测 ${a.counts.dupOpenCopies}(若非零说明 F4 已被改宽,机制描述要重读)`,
    )
  // 定级锁:只报数 ⇒ **不得**出现在 probe 差值棘轮里(接 blocking = 恒红门,§12e/§12f)。
  // `probe` 那份清单在 `plan-tasks.mjs`(它 import 本库,共用同一组 counts)——**只读不改**:
  // 本票的改动面收在库内,而"把 F4c 塞进棘轮"这件事必须被一道锁看住,故这里读它的源码断言。
  const planTasksSrc = readFileSync(new URL('../plan-tasks.mjs', import.meta.url), 'utf8')
  const probeAt = planTasksSrc.indexOf('export const probe')
  if (probeAt < 0) throw new Error('plan-tasks.mjs 里找不到 probe ⇒ 本锁锚点已漂')
  const probeBlock = planTasksSrc.slice(probeAt, planTasksSrc.indexOf('\n]', probeAt))
  if (/prefixNested/i.test(probeBlock))
    throw new Error('F4c 被接进了差值棘轮 ⇒ 存量 223 组会让每台每次提交都被逼跳门(票面明令起步只报数)')
  // 判据本体锁:必须仍是 startsWith 精确前缀 + 显式长度守卫,不得退化成相似度或"按长度猜正本"
  const lib = readFileSync(new URL('../lib/plan-task-index.mjs', import.meta.url), 'utf8')
  const fnAt = lib.indexOf('export function findPrefixNestedCopies')
  if (fnAt < 0) throw new Error('lib 里找不到 findPrefixNestedCopies ⇒ 本锁锚点已漂')
  // 取到**下一个顶层 export** 为止:用 `indexOf('\n}', fnAt)` 会在嵌套函数的第一个收尾处切段,
  // 而判据本体的三个不变量散在 for 循环体内 ⇒ 那种切法让锁的锚点随缩进漂移(第一版就踩了)。
  const fnEnd = lib.indexOf('\nexport ', fnAt + 10)
  const bodyFull = lib.slice(fnAt, fnEnd < 0 ? fnAt + 4000 : fnEnd)
  if (!/a\.raw\.length >= b\.raw\.length/.test(bodyFull) || !/b\.raw\.startsWith\(a\.raw\)/.test(bodyFull))
    throw new Error('前缀判据本体被改松(长度守卫或精确前缀判定缺失) ⇒ 这一族会开始并错行')
  if (/sort\([^)]*\.raw\.length/.test(bodyFull))
    throw new Error('判据里出现"按长度选正本" ⇒ 逐层包含时必然挑到缺证据的那一份(票面明令禁止)')
  // 出口锁:holder 0 命中必须是一条显式失败,不是 return 空
  const exitAt = lib.indexOf('export function planPrefixNestedPointer')
  if (exitAt < 0) throw new Error('lib 里找不到 planPrefixNestedPointer ⇒ 出口没接上')
  const exitEnd = lib.indexOf('\nexport ', exitAt + 10)
  const exitBody = lib.slice(exitAt, exitEnd < 0 ? exitAt + 4000 : exitEnd)
  if (!/hits\.length === 0/.test(exitBody) || !/ok: false/.test(exitBody))
    throw new Error('出口必须对"holder 不在被审面"大声失败,不得静默退化')
  // 复用锁:判据必须吃 compositeKeyOf(不得在本格自造第二份"什么算同一件事")
  if (!/compositeKeyOf\(r\.raw\)/.test(bodyFull))
    throw new Error('判据没有走 compositeKeyOf ⇒ 本格自造了第二份"什么算同一件事"(票面明令禁止)')
  // 证据入口锁:票面给的判据名必须可 grep,且别名必须**就是同一个函数引用**而不是第二份实现。
  // 这一格防的是"验收命令读 0 命中"——0 命中在这一仓里正是本票要消灭的那种读数,
  // 判据族自己的名字读 0 就等于把证据入口变瞎。
  if (prefixNestedCopies !== findPrefixNestedCopies)
    throw new Error('prefixNestedCopies 不是 findPrefixNestedCopies 的同一个引用 ⇒ 别名变成了第二份实现,两份判据必然漂移')
  if (!/export const prefixNestedCopies = findPrefixNestedCopies/.test(lib))
    throw new Error('票面判据名 prefixNestedCopies 在源码里不存在 ⇒ 按票面名 git grep 会读 0 命中(证据入口失明)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
