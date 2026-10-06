#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 台账「同一复合主键跨 `###` 区块分布」量表(G-1058622 立,2026-10-05)。
 *
 * ── 它量的是什么、为什么值得单独一把尺 ──────────────────────────────────
 * `scripts/plan-tasks.mjs` 的 **F1(同主键两态并存)** 只在 `- [x]` 与 `- [ ]` **同时存在**时
 * 才报一组。所以「同一件事在两个批次区块下各被登记一次、两次都还是 `- [ ]`(或都还是 `- [x]`)」
 * 这一整族**在 F1 眼里完全不存在** —— 它不是报得不准,是**根本不在判据射程内**。
 * 而 G-1058622 要回答的第一问正是:合并器 `scripts/lib/ledger-move-aware.mjs` 只认
 * 「已归档占位注释」、**不挡区块间搬移**,那么搬移留下的痕迹到底有多大?
 * 要回答"有多大"必须先量,不能靠 F1 的读数代答(F1 的读数按定义就看不到同态跨块)。
 *
 * ── 三条设计前提(照抄别重新发明)──────────────────────────────────────
 *  ① **主键口径不另写**。复合主键一律走 `lib/plan-task-index.mjs` 的 `compositeKeyOf`
 *     (编号 + 标题前缀,逐字等值)。本工具若自己抄一份编号正则或粗体匹配,量出来的组数
 *     与 F1 的组数**不可比**,而"与 F1 对齐"正是本工具存在的意义。历史上真踩过:
 *     初版用 `/\b([A-Z]{1,4}-\d{4,7})\b/` + 首个 `**…**` 粗体块,量出 932 组 / 117 组跨块;
 *     换成 `compositeKeyOf` 后两个数都变了(见提交正文)—— 粗口径量的是"编号+粗体"相近,
 *     不是尺子认的"同一件事"。
 *  ② **三态不并桶**。台账正文取不到 ⇒ 报 `ok:false` 且**不产出任何组数**,退出码 1。
 *     把"没读到台账"当成"零组跨块"是本仓最高频失效型(见 `lib/plan-id-face.mjs` 头注 ②)。
 *  ③ **只报数、不改一个字节**。本工具没有任何写路径:它是量表,不是归并器。
 *     收紧判据是持有人的决定(§12e「先量表不立刻收紧」),本工具的存在就是为了让那个决定
 *     有数字可依,而不是为了让本工具自己变成判红门。
 *
 * ── 形态分类(为什么必须分类,不能只报一个总数)────────────────────────
 * 跨块组不是同一种病,汇总成一个数会同时掩盖"该修的"和"不该修的"。三个标记是**互相独立的
 * 维度**(可同时为真),不是互斥分类,所以下面各档的数**不可相加当总数**:
 *  - `mixed`     :勾选态不一致 ⇒ **这才是 F1 报的那族**,也才是真搬移残留的最硬证据;
 *  - `verbatim`  :同组各行**逐字相同** ⇒ 引用/副本(归档件折叠、批次复述),不是搬移残留;
 *  - `annotated` :带 `【归并】重复登记副本` 注记 ⇒ 归并器**已经标注过**,是已知形态。
 * 剩下「同态 + 非逐字 + 无注记」这一档才是**未被任何现有机制覆盖**的部分,再按**是否含未勾选行**
 * 分成两半(`dispatchRiskCross`):
 *  - 含 `- [ ]` ⇒ **唯一有派单风险的一档**。前三个条件各自都有无害解释(引用、已标注、
 *    已完成票在多批区块被复述的快照),只有"含未勾选行"会让同一件事在两处同时进
 *    `plan-tasks.mjs` 的 `claimable` 派单口径 ⇒ 一个人被派两遍同一件活。
 *  - 全是 `- [x]` ⇒ 已完成票的复述快照,**当下无害**(只账面冗余,不影响派单)。
 * 2026-10-05 现读 HEAD 面:dispatchRiskCross = **0 组**(数字一律现跑,勿照抄)。
 *
 * ── 用法 ──────────────────────────────────────────────────────────────
 *   node scripts/measure-plan-block-migration.mjs                # 现读 HEAD 面(只报数)
 *   node scripts/measure-plan-block-migration.mjs --source origin/main
 *   node scripts/measure-plan-block-migration.mjs --json         # 机器可读(不含被审正文)
 *   node scripts/measure-plan-block-migration.mjs --limit 20     # 明细打印条数(缺省 20)
 *   node scripts/measure-plan-block-migration.mjs --self-test    # 合成台账夹具,零副作用于真仓
 *
 * 退出码:0 = 量到了(组数可以是 0)/ 1 = 判不出(台账取不到)/ 2 = 用法错或脚本自身异常。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { git } from './lib/bypass-git.mjs'
import { DUP_POINTER_RE, compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
/** 唯一台账(§1:项目唯一任务计划文档);与 `lib/plan-id-face.mjs` 的 LEDGER_DOC 同名同值。 */
const LEDGER_DOC = 'PROJECT_PLAN.md'

/**
 * 区块 = 最近的 `### ` 标题(去掉标题本身的 `# ` 与首尾空白)。
 *
 * 为什么只认 `###` 而不是任意标题层级:台账是 append-only 批次流水,`##` 是批次、
 * `###` 才是批次下的**条目区块**,`####` 是条目内部的子分区。F1 关心的"同一件事被登记两遍"
 * 发生在 `###` 粒度上;用 `##` 会把整批条目并成一块(恒为"不跨块",量不出东西),
 * 用 `####` 会把子分区当块(把同一区块内的正常分区误报成搬移)。
 * 标题前有缩进的不算标题(markdown 语义:缩进 `#` 是代码块内容)。
 */
export const BLOCK_HEADING_RE = /^### (.*)$/

/** 逐行扫出「每条复选框行属于哪个 `###` 区块」。返回 `[{line, state, raw, block}]`。 */
export function rowsWithBlocks(content) {
  const lines = String(content).split(/\r?\n/)
  const parsed = parseTaskRows(content)
  // parseTaskRows 已按 `\r?\n` 切行并给出行号 ⇒ 行号可与本处切分对齐;
  // 但它对 `\r\n` 与 `\n` 的切法必须一致,故这里**按它给的行号取**,不重算偏移。
  const rawByLine = new Map(parsed.map((r) => [r.line, r]))
  const out = []
  let block = '(文件头:首个 ### 之前)'
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const m = BLOCK_HEADING_RE.exec(l)
    if (m) {
      block = m[1].trim().slice(0, 80) || '(空标题)'
      continue
    }
    const row = rawByLine.get(i + 1)
    if (!row) continue
    out.push({ line: row.line, state: row.state, raw: row.raw, key: compositeKeyOf(row.raw), block })
  }
  return out
}

/** 一组内各行是否逐字相同(引用/副本形态;否则内容有分歧)。 */
function isVerbatimGroup(rows) {
  const first = rows[0].raw
  return rows.every((r) => r.raw === first)
}

/** 该组是否已被归并器标注过(`【归并】重复登记副本` 是 `plan-task-index.mjs` 的唯一口径)。 */
function isAnnotatedGroup(rows) {
  return rows.some((r) => DUP_POINTER_RE.test(r.raw))
}

/**
 * ── 混态组的第二层拆分(G-1058623 立,2026-10-06)──────────────────────────
 *
 * **它答的是另一个问,不能由上面那套跨块量表代答**:`measureBlockMigration` 只看**跨 `###` 块**的组,
 * 而 F1 判的是**同一主键下 `- [x]` 与 `- [ ]` 并存**,**与块无关**。两者的交集不等于任一方。
 *
 * **为什么要拆这一层(量表实测定死)**:立项当时真语料 F1 那组 `O19b#剩余4列故意不并` 的 13 个 open 行里,
 * **12 个带 `【归并】重复登记副本` 注记**(副本行,归并器已正确标注),**只有 1 个不带**
 * (= 归并的目标行/持有行,注记逐字写着"本行是两半…等 owner 拍板")。
 * ⇒ 把副本行剔掉(与 F4 同形)之后 F1 当时**仍不是 0** —— 剩下的那 1 行是**持有行**。
 * ⇒ 而持有行"是否真还有活"是**正文语义,行级判据判不了** —— 这正是本档存在的理由。
 *
 * ── 2026-10-06 现读复核:本档的读数已归零,且「持有行问责」改法判据不可实施 ──
 *  - `holderGroups` 现读 **0**;`node scripts/plan-tasks.mjs --forks` 现读 **0 组**
 *    (基线 `F1` 也是 0 ⇒ 棘轮当前是绿的)。`O19b` 那组现读 **14 行全done、0 行 open** ——
 *    拍板②已于2026-10-05 按 B 案执行(枚 `5c3abb296f`),票面自己写着"列+GIN 下线立迁移票 G-1058625"。
 *  - 「把持有行也剔掉/只报数不问责」这条路**已放弃**,三条理由与逐条实测读数见
 *    `scripts/lib/plan-task-index.mjs` 的 `findForks` 头注(档 B 段)。
 *    其中最硬的一条:**任何基于文本措辞的持有行判据,作用面恰好是档 A 豁免不掉的那 637 行**,
 *    实测三条候选的假阳性是 18 行里 17 行 / 7 行里 7 行 —— 被提议当判据的信号度量的是
 *    "这一行在谈论票据机制",不是"这一行是指针"。
 *  - **本档仍然保留**:它是 F1 的**只报数**侧信道(F1 判红、本档报数),两者口径必须可对账。
 *    存量归零不构成删量表的理由 —— 删掉它,下一组混态出现时就又只剩"红"没有"数"。
 *
 * @param content 台账正文
 * @returns `{ok, groups, holderGroups, openAnnotated, openHolders, notes[]}`
 *          `holderGroups` = 剔掉带注记 open 行后**仍然混态**的组(即"机器判不了的那一格";
 *          现读 0 组 —— 这不代表该形态不可判,而代表**面上此刻没有这种组可判**)。
 */
export function measureMixedSplit(content) {
  // ⚠️ 判不出 ≠ 量到 0(自检 M5 抓到的真 bug,曾返空数组):
  // 四个读数档**必须同时**为 null,否则调用方会把"尺子失明"当成"台账干净"。
  if (typeof content !== 'string')
    return {
      ok: false,
      groups: null,
      holderGroups: null,
      openAnnotated: null,
      openHolders: null,
      notes: [`台账正文不是字符串(${typeof content})`],
    }

  const byKey = new Map()
  for (const r of parseTaskRows(content)) {
    const k = compositeKeyOf(r.raw)
    if (!k) continue
    if (!byKey.has(k)) byKey.set(k, { key: k, open: [], done: [] })
    byKey.get(k)[r.state].push(r)
  }

  const groups = []
  let openAnnotated = 0
  let openHolders = 0
  for (const g of byKey.values()) {
    if (g.open.length === 0 || g.done.length === 0) continue
    const ann = g.open.filter((r) => DUP_POINTER_RE.test(r.raw))
    const hold = g.open.filter((r) => !DUP_POINTER_RE.test(r.raw))
    openAnnotated += ann.length
    openHolders += hold.length
    groups.push({
      key: g.key,
      done: g.done.map((r) => r.line),
      open: g.open.map((r) => r.line),
      openAnnotated: ann.map((r) => r.line),
      openHolders: hold.map((r) => r.line),
      // 剔掉带注记的 open 行之后**仍然混态** ⇒ 剩下的持有行是"机器判不了的那一格"
      holderOnlyFork: hold.length > 0,
    })
  }

  return {
    ok: true,
    groups,
    holderGroups: groups.filter((g) => g.holderOnlyFork),
    openAnnotated,
    openHolders,
    notes: [],
  }
}

/**
 * 量「同一复合主键跨 `###` 区块」的组。
 *
 * @param content 台账正文
 * @returns `{ok, totalRows, keyedGroups, crossGroups[], mixedGroups, sameStateGroups,
 *            verbatimCross, annotatedCross, divergentCross, rowsWithoutKey, notes[]}`
 *          `ok:false` 时其余计数一律 `null`(不是 0)。
 */
export function measureBlockMigration(content) {
  if (typeof content !== 'string')
    return {
      ok: false,
      totalRows: null,
      keyedGroups: null,
      crossGroups: null,
      mixedGroups: null,
      sameStateGroups: null,
      verbatimCross: null,
      annotatedCross: null,
      divergentCross: null,
      dispatchRiskCross: null,
      rowsWithoutKey: null,
      notes: [content === null ? '台账正文是 null' : `台账正文不是字符串(${typeof content})`],
    }

  const rows = rowsWithBlocks(content)
  const keyed = rows.filter((r) => r.key)
  const rowsWithoutKey = rows.length - keyed.length

  const groups = new Map()
  for (const r of keyed) {
    if (!groups.has(r.key)) groups.set(r.key, [])
    groups.get(r.key).push(r)
  }

  const crossGroups = []
  for (const [key, g] of groups) {
    const blocks = [...new Set(g.map((r) => r.block))]
    if (blocks.length <= 1) continue
    const states = [...new Set(g.map((r) => r.state))]
    const verbatim = isVerbatimGroup(g)
    const annotated = isAnnotatedGroup(g)
    const mixed = states.length > 1
    crossGroups.push({
      key,
      rows: g.map((r) => ({ line: r.line, state: r.state, block: r.block })),
      blocks,
      mixed,
      verbatim,
      annotated,
      hasOpen: states.includes('open'),
    })
  }

  return {
    ok: true,
    totalRows: rows.length,
    keyedGroups: groups.size,
    crossGroups,
    mixedGroups: crossGroups.filter((c) => c.mixed),
    sameStateGroups: crossGroups.filter((c) => !c.mixed),
    verbatimCross: crossGroups.filter((c) => c.verbatim),
    annotatedCross: crossGroups.filter((c) => c.annotated),
    divergentCross: crossGroups.filter((c) => !c.verbatim && !c.mixed),
    /**
     * **唯一有派单风险的那一档**:同态跨块 + 内容不同 + 归并器没标过 + **含未勾选行**。
     * 前三个条件各自都能解释(引用、已标注、已完成票的复述快照),只有"含未勾选行"这一条
     * 会让同一件事在两处同时进派单口径(`plan-tasks.mjs` 的 `claimable`)⇒ 它才是真风险面。
     * 2026-10-05 现读 HEAD 面:这一档 **0 组**(见提交正文)⇒ 本仓当下没有"重复派单"型搬移残留。
     */
    dispatchRiskCross: crossGroups.filter(
      (c) => !c.mixed && !c.verbatim && !c.annotated && c.hasOpen,
    ),
    rowsWithoutKey,
    notes: [],
  }
}

// ── 自检:合成台账夹具 ⇒ 确定性,不依赖真仓瞬时状态(§22c:判据的对象是"面"的形态,输入必须像真件) ──
function selfTest() {
  const results = []
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail })

  // 夹具覆盖六种形态。⚠️ 每一条都按 `compositeKeyOf` 的**真实语义**造:复合主键 = 编号 +
  // `titleOf()` 的**24 字标题前缀**,而 `titleOf` 把粗体后的正文也吃进前缀里 ——
  // 于是"同主键但注记不同"**必须让分叉点落在 24 字前缀之外**才成立。初版夹具写成
  // 「同一粗体标题 + 不同短注记」,实测那两行拿到**不同主键**,`mixedGroups` 直接空掉、S9 抛错:
  // 夹具照抄"看起来像重复登记"的形态,量到的却是"两件不同的事",那把尺就白量了。
  // 真实台账里重复登记的形态是**逐字复制整行**(plan-task-index 头注:实测 12/18/24/32/40
  // 五档前缀得到的分组完全相同,因为重复登记是整行逐字复制,不是"像")。
  //  A 混态跨块(F1 射程内) / B 同态跨块·逐字相同(F1 静默·引用)
  //  C 同态跨块·分叉点落在 24 字前缀之外(F1 静默·唯一值得人读) / D 已带归并注记
  //  E 同块内同主键(**不得**计入跨块)/ F 无主键行
  const LONG_TITLE = '前缀刻意写长以便分叉点落在标题前缀之外甲乙丙丁戊己庚辛壬癸子丑寅卯'
  const FIXTURE = [
    '### 批次一',
    '- [ ] G-5001 **混态跨块那件事** 甲批登记',
    '- [ ] G-5002 **逐字相同那件事** 甲批登记',
    `- [ ] G-5003 **${LONG_TITLE}** 甲批登记`,
    '- [ ] G-5004 **已归并那件事** 甲批登记 【归并】重复登记副本 见另一条',
    '- [ ] （无编号的纯叙述待办,没有主键）',
    '',
    '### 批次二',
    '- [x] G-5001 **混态跨块那件事** 甲批登记',
    '- [ ] G-5002 **逐字相同那件事** 甲批登记',
    `- [ ] G-5003 **${LONG_TITLE}** 乙批登记`,
    '',
    '### 批次三',
    '- [ ] G-5006 **同块内那件事** 只有一行',
    '- [x] G-5006 **同块内那件事** 只有一行',
    '',
  ].join('\n')

  const m = measureBlockMigration(FIXTURE)
  ok('S1 面可用(合成夹具必须量得出)', m.ok === true, `ok=${m.ok} notes=${JSON.stringify(m.notes)}`)
  ok(
    'S2 无主键行被单列(不算成"跨块" —— 算不出主键与"同一件事"无关)',
    m.rowsWithoutKey === 1 && m.totalRows === 10,
    `withoutKey=${m.rowsWithoutKey} total=${m.totalRows}`,
  )
  ok(
    'S3 混态跨块 = 1 组且正是 G-5001(这才是 F1 报的那族)',
    m.mixedGroups.length === 1 && m.mixedGroups[0].key.startsWith('G-5001#'),
    JSON.stringify(m.mixedGroups.map((c) => c.key)),
  )
  ok(
    'S4 同态跨块 = 2 组(G-5002 逐字 / G-5003 分叉在前缀外);G-5004 只出现一次不算',
    m.sameStateGroups.length === 2,
    JSON.stringify(m.sameStateGroups.map((c) => c.key)),
  )
  ok(
    'S5 逐字相同只认出 G-5002(逐字判定不得放宽成"像")',
    m.verbatimCross.length === 1 && m.verbatimCross[0].key.startsWith('G-5002#'),
    JSON.stringify(m.verbatimCross.map((c) => c.key)),
  )
  ok(
    'S6 已归并注记在本夹具里**不构成跨块**(G-5004 只登记一次)⇒ annotatedCross 为 0 组 —— ' +
      '判据不得因为"看见注记"就把单块行算成跨块',
    m.annotatedCross.length === 0 && !m.crossGroups.some((c) => c.key.startsWith('G-5004#')),
    `annotated=${m.annotatedCross.length} cross=${JSON.stringify(m.crossGroups.map((c) => c.key))}`,
  )
  ok(
    'S7 内容不同且同态 = G-5003(唯一值得人逐条读的形态)',
    m.divergentCross.length === 1 && m.divergentCross[0].key.startsWith('G-5003#'),
    JSON.stringify(m.divergentCross.map((c) => c.key)),
  )
  ok(
    'S8 同块内同主键(G-5006 两行同在批次三)不得计入跨块',
    !m.crossGroups.some((c) => c.key.startsWith('G-5006#')),
    JSON.stringify(m.crossGroups.map((c) => c.key)),
  )
  ok(
    'S9 跨块组的行号必须指回真件(块归属靠行号对齐,错位则整份报告失真)',
    m.mixedGroups[0].rows.map((r) => r.line).join('+') === '2+9',
    m.mixedGroups[0].rows.map((r) => r.line).join('+'),
  )
  ok(
    'S10 跨块组必须带全部区块名(报告要能指名"从哪搬到哪")',
    m.mixedGroups[0].blocks.join('|') === '批次一|批次二',
    JSON.stringify(m.mixedGroups[0].blocks),
  )
  ok(
    'S10b 行序必须与行号同序(报告要能读出"谁先谁后")',
    m.mixedGroups[0].rows.map((r) => r.block).join('→') === '批次一→批次二',
    m.mixedGroups[0].rows.map((r) => r.block).join('→'),
  )

  // D 形态单独一档:【归并】注记行**跨块**时必须被认出(上面对照的是"注记行不跨块 ⇒ 不该被算")
  const ANNO = [
    '### 甲块',
    '- [ ] G-7001 **已归并跨块那件事** 甲块原始登记',
    '### 乙块',
    '- [ ] G-7001 **已归并跨块那件事** 甲块原始登记 【归并】重复登记副本 见甲块那条',
    '',
  ].join('\n')
  const ma = measureBlockMigration(ANNO)
  ok(
    'S6b 注记行跨块时:既算 verbatim(逐字?否,注记不同)也必须算 annotated —— ' +
      '两个标记是**两个独立维度**,不得互斥(否则"已注记"这一族永远看不见)',
    ma.annotatedCross.length === 1 &&
      ma.annotatedCross[0].key.startsWith('G-7001#') &&
      ma.verbatimCross.length === 0 &&
      ma.sameStateGroups.length === 1,
    `anno=${ma.annotatedCross.length} verb=${ma.verbatimCross.length} same=${ma.sameStateGroups.length}`,
  )

  // 首个 ### 之前的行必须归到具名哨兵块,而不是被算进后一个块(否则报告会谎报搬移方向)
  const NO_HEADING = ['- [ ] G-6001 **没有块标题那件事** 孤行', '### 批次一', '- [x] G-6002 **有块那件事** 有块'].join('\n')
  const m2 = measureBlockMigration(NO_HEADING)
  ok(
    'S11 首个 ### 之前的行归哨兵块(不得被后一个 ### 吞掉)',
    m2.crossGroups.length === 0 && m2.crossGroups !== null,
    `cross=${m2.crossGroups.length}`,
  )

  // ── 块口径必须**只**认 `###`:台账现读 `####` 有 138 个,把它们当块会把同一个 ### 区块内的
  // 子分区误报成"跨块搬移"。这一条是**变异取证补上的**:初版自检 21 条全绿,但把
  // BLOCK_HEADING_RE 放宽成 `/^#{3,4} /` 之后 21 条**照样全绿** —— 夹具里根本没有 `####`,
  // 判据退一步没人看见。这与"拿自检绿当证据"是同一个坑,补法是**让夹具带上被漏掉的那一维**。
  {
    const SUBDIV = [
      '### 唯一批次',
      '#### 子分区甲',
      `- [ ] G-6101 **${'刻意写长的标题让分叉点落在标题前缀之外甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳'}** 甲`,
      '#### 子分区乙',
      `- [ ] G-6101 **${'刻意写长的标题让分叉点落在标题前缀之外甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳'}** 乙追加取证`,
      '',
    ].join('\n')
    const m3 = measureBlockMigration(SUBDIV)
    ok(
      'S14 同一个 ### 下的两个 #### 子分区**不算跨块**(台账现读 #### 有 138 个;' +
        '把它们当块会把子分区误报成搬移 —— 块口径只认 ###)',
      m3.crossGroups.length === 0 && m3.dispatchRiskCross.length === 0,
      `cross=${m3.crossGroups.length} risk=${m3.dispatchRiskCross.length}`,
    )
    ok(
      'S14b 但这两行仍必须算**同块**的同主键组(F1/F4 射程内,不是本工具的活 —— ' +
        '若这里 crossGroups 非空,说明块归属判错了)',
      m3.keyedGroups === 1 && m3.totalRows === 2,
      `keyed=${m3.keyedGroups} total=${m3.totalRows}`,
    )
  }

  // ── dispatchRiskCross:四个条件缺一不可,逐条退一个都必须让这一档涨起来 ──
  // 这是本工具唯一带"风险"字样的读数 ⇒ 判据退一步就静默失效,必须逐条件钉住。
  // ⚠️ 下面每条夹具的"内容不同"都必须分叉在标题前缀(24 字)**之外**,否则两行拿不到同一主键
  // —— 风险档量的是"同一件事",不是"两行长得有点像"(初版 R1/R5 就因此量成 0 组)。
  {
    const DIVERGE =
      '刻意写长的标题让分叉点落在标题前缀之外甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉'
    const RISK = [
      '### 甲块',
      `- [ ] G-8001 **${DIVERGE}** 甲块登记`,
      '### 乙块',
      `- [ ] G-8001 **${DIVERGE}** 乙块追加了另一段取证所以内容不同`,
      '',
    ].join('\n')
    const base = measureBlockMigration(RISK)
    ok(
      'R1 四条件全中的跨块组 = 1 组(同态+非逐字+无注记+含 open)',
      base.dispatchRiskCross.length === 1 && base.dispatchRiskCross[0].key.startsWith('G-8001#'),
      JSON.stringify(base.dispatchRiskCross.map((c) => c.key)),
    )

    // 退①:逐字相同 ⇒ 应退出风险档(引用形态不是重复派单)
    const c1 = measureBlockMigration(
      [
        '### 甲块',
        `- [ ] G-8002 **${DIVERGE}** 甲`,
        '### 乙块',
        `- [ ] G-8002 **${DIVERGE}** 甲`,
        '',
      ].join('\n'),
    )
    ok(
      'R2 退①变逐字 ⇒ 退出风险档(逐字相同是引用,重复登记同一行不是"派两遍")',
      c1.dispatchRiskCross.length === 0 && c1.verbatimCross.length === 1,
      `risk=${c1.dispatchRiskCross.length} verb=${c1.verbatimCross.length}`,
    )

    // 退②:带【归并】注记 ⇒ 应退出风险档(归并器已标注过)
    const c2 = measureBlockMigration(
      [
        '### 甲块',
        `- [ ] G-8003 **${DIVERGE}** 甲`,
        '### 乙块',
        `- [ ] G-8003 **${DIVERGE}** 甲 【归并】重复登记副本 见甲块`,
        '',
      ].join('\n'),
    )
    ok(
      'R3 退②带【归并】注记 ⇒ 退出风险档(已被归并器标注,不再是无主搬移)',
      c2.dispatchRiskCross.length === 0 && c2.annotatedCross.length === 1,
      `risk=${c2.dispatchRiskCross.length} anno=${c2.annotatedCross.length}`,
    )

    // 退③:混态 ⇒ 应退出风险档(那一族归 F1 管,不重复计数)
    const c3 = measureBlockMigration(
      [
        '### 甲块',
        `- [ ] G-8004 **${DIVERGE}** 甲`,
        '### 乙块',
        `- [x] G-8004 **${DIVERGE}** 甲`,
        '',
      ].join('\n'),
    )
    ok(
      'R4 退③变混态 ⇒ 退出风险档(那一族 F1 已经报,本工具不重复计派单风险)',
      c3.dispatchRiskCross.length === 0 && c3.mixedGroups.length === 1,
      `risk=${c3.dispatchRiskCross.length} mixed=${c3.mixedGroups.length}`,
    )

    // 退④:全部已勾选 ⇒ 应退出风险档(已完成票的复述快照不影响派单)
    const c4 = measureBlockMigration(
      [
        '### 甲块',
        `- [x] G-8005 **${DIVERGE}** 甲`,
        '### 乙块',
        `- [x] G-8005 **${DIVERGE}** 乙追加了另一段取证所以内容不同`,
        '',
      ].join('\n'),
    )
    ok(
      'R5 退④全是 - [x] ⇒ 退出风险档(已完成票的跨块复述只冗余,不重复派单)',
      c4.dispatchRiskCross.length === 0 && c4.sameStateGroups.length === 1,
      `risk=${c4.dispatchRiskCross.length} same=${c4.sameStateGroups.length}`,
    )

    // 正向对照:同块内的同态+非逐字+无注记+含 open **不构成跨块** ⇒ 也不该进风险档
    const c5 = measureBlockMigration(
      [
        '### 同一块',
        `- [ ] G-8006 **${DIVERGE}** 甲`,
        `- [ ] G-8006 **${DIVERGE}** 乙追加了另一段取证所以内容不同`,
        '',
      ].join('\n'),
    )
    ok(
      'R6 同块内即便四条件全中也不进风险档(本工具只量跨块;同块内重复归 F4/findDupOpenCopies)',
      c5.dispatchRiskCross.length === 0 && c5.crossGroups.length === 0,
      `risk=${c5.dispatchRiskCross.length} cross=${c5.crossGroups.length}`,
    )
  }

  // 三态不并桶:台账取不到 ⇒ 不产出任何组数
  const bad = measureBlockMigration(null)
  ok(
    'S12 正文不是字符串 ⇒ ok=false 且组数为 null(**不是 0** —— "没判"不等于"零组")',
    bad.ok === false &&
      bad.crossGroups === null &&
      bad.mixedGroups === null &&
      bad.notes.length === 1,
    `ok=${bad.ok} cross=${JSON.stringify(bad.crossGroups)} notes=${JSON.stringify(bad.notes)}`,
  )

  // 空台账:量到了、且真的是零组(与"判不出"必须可区分)
  const empty = measureBlockMigration('# 台账\n\n什么都没有。\n')
  ok(
    'S13 空台账 = 量到了且零组(与 S12 的判不出可区分)',
    empty.ok === true && empty.crossGroups.length === 0 && empty.totalRows === 0,
    `ok=${empty.ok} cross=${empty.crossGroups.length} total=${empty.totalRows}`,
  )

  // ── M 组:`measureMixedSplit` 的自检(2026-10-06 随 G-1058623 第二层同枚补)──
  // ⚠️ **这组是补出来的,不是一开始就有的**:两个变异(MV1 `holderOnlyFork` 恒真 / MV2 带注记与
  // 持有行判反)在真语料上**都让读数变了**(1 组→2 组;13/1→1/1),而当时 23 条自检**照样全绿** ——
  // 与本文件 S14 那次同型:**夹具缺这一维,判据退一步没人看见**。补法同样是让夹具带上它。
  {
    const D = '刻意写长的标题让分叉点落在标题前缀之外甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉'
    // ① 混态 + open 侧一行带注记(副本)、一行不带(持有)⇒ holderOnlyFork = true
    const MIXED = [
      '### 甲块',
      `- [x] G-9001 **${D}** 已完成`,
      '### 乙块',
      `- [ ] G-9001 **${D}** 甲 【归并】重复登记副本 见甲块那条`,
      `- [ ] G-9001 **${D}** 乙还开着`,
      '',
    ].join('\n')
    const a = measureMixedSplit(MIXED)
    ok(
      'M1 混态组:open 侧按【归并】注记拆成 副本/持有 两档,行号逐条对得上',
      a.ok === true &&
        a.groups.length === 1 &&
        a.openAnnotated === 1 &&
        a.openHolders === 1 &&
        a.groups[0].openAnnotated.length === 1 &&
        a.groups[0].openHolders.length === 1,
      JSON.stringify({ g: a.groups.length, ann: a.openAnnotated, hold: a.openHolders }),
    )
    ok(
      'M2 holderGroups(剔副本后仍混态)= 1 组 —— 这就是"机器判不了的那一格",与 MV1 直接对立',
      a.holderGroups.length === 1 && a.holderGroups[0].holderOnlyFork === true,
      `holderGroups=${a.holderGroups.length}`,
    )

    // ② 混态但 open 侧**全带注记** ⇒ 剔完副本不剩 open ⇒ holderOnlyFork = false
    const ALL_DUP = [
      '### 甲块',
      `- [x] G-9002 **${D}** 已完成`,
      '### 乙块',
      `- [ ] G-9002 **${D}** 甲 【归并】重复登记副本 见甲块`,
      '### 丙块',
      `- [ ] G-9002 **${D}** 丙 【归并】重复登记副本 见甲块`,
      '',
    ].join('\n')
    const b = measureMixedSplit(ALL_DUP)
    ok(
      'M3 open 侧全带注记 ⇒ 剔副本后不剩 open ⇒ **不算"机器判不了的那一格"**(与 M2 成对)',
      b.groups.length === 1 && b.openAnnotated === 2 && b.openHolders === 0 && b.holderGroups.length === 0,
      `ann=${b.openAnnotated} hold=${b.openHolders} holderGroups=${b.holderGroups.length}`,
    )

    // ③ **同块内**的混态也算混态 —— 本档与 `###` 块无关,这是它与跨块量表的根本区别
    const SAME_BLOCK = [
      '### 唯一块',
      `- [x] G-9003 **${D}** 已完成`,
      `- [ ] G-9003 **${D}** 还开着`,
      '',
    ].join('\n')
    const c = measureMixedSplit(SAME_BLOCK)
    ok(
      'M4 **同块内**的混态照样算混态(本档与 ### 块无关 —— 与 measureBlockMigration 的根本区别)',
      c.groups.length === 1 && c.holderGroups.length === 1,
      `groups=${c.groups.length} holderGroups=${c.holderGroups.length}`,
    )
    ok(
      'M4b 同一份内容在跨块量表眼里是 0 组(块内不跨)⇒ 两把尺交集不等于任一方,不可互相代答',
      measureBlockMigration(SAME_BLOCK).mixedGroups.length === 0,
      `blockMixed=${measureBlockMigration(SAME_BLOCK).mixedGroups.length}`,
    )

    // ④ 三态不并桶
    const bad = measureMixedSplit(null)
    ok(
      'M5 正文不是字符串 ⇒ ok=false 且两档皆 null(**不是 0**:量到了 0 与判不出必须可区分)',
      bad.ok === false && bad.groups === null && bad.holderGroups === null,
      `ok=${bad.ok} groups=${JSON.stringify(bad.groups)}`,
    )
  }

  const fail = results.filter((x) => !x.pass)
  for (const x of results)
    console.log(
      `  ${x.pass ? '✅' : '❌'} ${x.name}${x.detail && !x.pass ? ` —— ${x.detail}` : ''}`,
    )
  console.log(`\n跨区块量表自检:${results.length - fail.length} 通过 / ${fail.length} 失败`)
  return fail.length ? 1 : 0
}

const oneLine = (e) => String(e?.stderr ?? e?.message ?? e).split(/\r?\n/)[0].slice(0, 200)

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()

  const allowed = new Set(['--json', '--self-test', '--source', '--limit', '--mixed-only'])
  const takesValue = new Set(['--source', '--limit'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      console.error(`✗ 不接受位置参数 ${a}(可用:--source <rev> / --limit <n> / --mixed-only / --json / --self-test)`)
      return 2
    }
    if (!allowed.has(a)) {
      console.error(`✗ 未知参数 ${a}(可用:--source <rev> / --limit <n> / --mixed-only / --json / --self-test)`)
      return 2
    }
    if (takesValue.has(a)) i++ // 跳过取值 token(照抄 plan-id-face 的旗标口径,见其 iSrc 注释)
  }

  const iSrc = argv.indexOf('--source')
  let source = 'HEAD'
  if (iSrc >= 0) {
    const raw = argv[iSrc + 1]
    if (typeof raw === 'string' && raw !== '' && !raw.startsWith('-')) source = raw
    else console.error(`ℹ 忽略无效的 --source 值:${JSON.stringify(raw)},已退回默认 HEAD`)
  }
  let limit = 20
  const iLim = argv.indexOf('--limit')
  if (iLim >= 0) {
    const n = Number(argv[iLim + 1])
    if (Number.isInteger(n) && n >= 0) limit = n
    else {
      console.error(`✗ --limit 要非负整数,收到 ${JSON.stringify(argv[iLim + 1])}`)
      return 2
    }
  }

  let content
  try {
    content = git(['show', `${source}:${LEDGER_DOC}`], {
      root: REPO_ROOT,
      raw: true,
      timeout: 120_000,
    })
  } catch (e) {
    console.error(`❌ 台账 ${source}:${LEDGER_DOC} 取不到:${oneLine(e)} ⇒ 本次不判(不是"零组跨块")`)
    return 1
  }
  if (typeof content !== 'string') {
    console.error(`❌ 台账 ${source}:${LEDGER_DOC} 没读到正文 ⇒ 本次不判`)
    return 1
  }

  // ── `--mixed-only`:只答 F1 那一问(与跨块无关),G-1058623 的第二层量表 ──
  // 放在 `measureBlockMigration` **之前**返回:两把尺量的是不同维度,混在一起报会让人
  // 把"跨块"读成"混态"的前置条件(实测两者交集不等于任一方:现读跨块 656 组里混态 0 组,
  // 而 F1 的 1 组恰恰**同块**)。旗标在前 ⇒ 一把尺两个问,不另开脚本。
  if (argv.includes('--mixed-only')) {
    const mx = measureMixedSplit(content)
    if (!mx.ok) {
      for (const n of mx.notes) console.error(`❌ ${n}`)
      return 1
    }
    if (argv.includes('--json')) {
      console.log(JSON.stringify({ ...mx, source }, null, 2))
      return 0
    }
    console.log(`被审面:${source}:${LEDGER_DOC}(混态档 · **与 ### 块无关**)`)
    console.log(`F1 同主键两态并存: ${mx.groups.length} 组`)
    console.log(
      `  其中未勾选行:带【归并】注记(副本行) ${mx.openAnnotated} / 不带(持有行) ${mx.openHolders}`,
    )
    console.log(
      `\n★ **机器判不了的那一格**:剔掉带注记的 open 行后**仍然混态**的组 = ${mx.holderGroups.length} 组`,
    )
    if (mx.holderGroups.length === 0)
      console.log(`  ⇒ 剔副本行即可让 F1 归零。`)
    else
      console.log(
        `  ⇒ **只做"剔副本行"这一半不足以归零**:剩下的持有行"是否真还有活"是正文语义,行级判据判不了` +
          ` ⇒ 若要让 F1 归零,必须同时把这一档**单列、只报数不问责**。`,
      )
    if (limit > 0)
      for (const g of mx.groups.slice(0, limit)) {
        console.log(
          `\n  ${g.key}\n      done@${g.done.join('+')} | open@${g.open.join('+')}` +
            `\n      open 带注记(副本)@${g.openAnnotated.join('+') || '无'} | 不带注记(持有)@${g.openHolders.join('+') || '无'}` +
            `\n      剔副本后仍混态? ${g.holderOnlyFork ? '是 ← 机器判不了的那一格' : '否'}`,
        )
      }
    return 0
  }

  const m = measureBlockMigration(content)
  if (!m.ok) {
    for (const n of m.notes) console.error(`❌ ${n}`)
    return 1
  }

  if (argv.includes('--json')) {
    // **不打被审正文**:同 plan-id-face 的理由 —— 遥测不落被审内容。
    console.log(JSON.stringify({ ...m, source }, null, 2))
    return 0
  }

  console.log(`被审面:${source}:${LEDGER_DOC}(${Buffer.byteLength(content, 'utf8')} B)`)
  console.log(`复选框登记行 ${m.totalRows} 条(其中无主键 ${m.rowsWithoutKey} 条,按 plan-task-index 同形口径算不出主键)`)
  console.log(`带主键的组 ${m.keyedGroups} 组 / 同主键**跨 ### 区块** ${m.crossGroups.length} 组`)
  console.log(
    `  ├ 混态(F1 射程内,真搬移残留的下界): ${m.mixedGroups.length} 组`,
  )
  const unmarkedDivergent = m.sameStateGroups.filter((c) => !c.verbatim && !c.annotated)
  console.log(
    `  └ 同态(F1 **静默**,不在 F1 判据射程内): ${m.sameStateGroups.length} 组` +
      ` —— 其中逐字相同(引用/副本)${m.verbatimCross.length}、` +
      `已带【归并】注记 ${m.annotatedCross.length}(与逐字档有交集)、` +
      `**无注记且非逐字** ${unmarkedDivergent.length}`,
  )
  console.log(
    `\n★ 派单风险档(同态 + 非逐字 + 无【归并】注记 + **含未勾选行**)= ${m.dispatchRiskCross.length} 组`,
  )
  console.log(
    m.dispatchRiskCross.length === 0
      ? `  ⇒ 本仓当下**没有**"同一件事在两处同时进派单口径"的搬移残留(F1 的静默面在这条上无风险)。`
      : `  ⇒ 这 ${m.dispatchRiskCross.length} 组每一组都会让同一件事进两次 claimable —— 下面逐组列出,必须逐条判哪条作数(§1 一行不删,只能标注)。`,
  )
  console.log(
    `\n⚠️ 上面三个标记(mixed / verbatim / annotated)是**互相独立的维度**,可同时为真;`,
  )
  console.log(`⚠️ 各档数字**不可相加当总数**(会把同一组数两遍)。`)
  console.log(`⚠️ "同态跨块"这一族 F1 按定义看不到 —— 它的量只能从这里取,不能引用 F1 读数代答。`)

  const show = (label, list) => {
    if (limit === 0) return
    console.log(`\n--- ${label}(${list.length} 组,打印前 ${Math.min(limit, list.length)} 组)---`)
    for (const c of list.slice(0, limit))
      console.log(
        `  ${c.key}\n      行 ${c.rows.map((r) => `${r.line}[${r.state === 'done' ? 'x' : ' '}]`).join('+')}` +
          `\n      跨 ${c.blocks.length} 块: ${c.blocks.join(' ⟂ ')}` +
          `${c.verbatim ? '\n      形态: 逐字相同(引用/副本)' : ''}` +
          `${c.annotated ? '\n      形态: 已带【归并】注记' : ''}`,
      )
  }
  show('混态跨块(F1 会报)', m.mixedGroups)
  show('★ 派单风险档(同态+非逐字+无注记+含未勾选行)', m.dispatchRiskCross)
  show('同态跨块 · 无注记且非逐字 · 全已勾选(复述快照,只冗余不重复派单)', unmarkedDivergent)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    const code = main()
    if (code !== 0) process.exit(code)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  measureBlockMigration,
  measureMixedSplit,
  rowsWithBlocks,
  BLOCK_HEADING_RE,
  LEDGER_DOC,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
