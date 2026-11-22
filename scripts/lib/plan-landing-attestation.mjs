// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旁路落地站点的「复验之后、索引对齐之前必须留痕」结构判据族
 * (门 103 C1 收口,2026-11-19 从 scripts/plan-tasks-merge.mjs 下沉)。
 * `plan-tasks-merge.mjs` 以转出口保持调用方与自检的 import 形态不变。
 */

import { maskCommentsStringsAndRegex } from './code-mask.mjs'

export const BYPASS_LANDING_SITES = [
  {
    fn: 'restoreTerminalsAndLand',
    source: 'plan-tasks-merge:restore-terminals',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (recheck.problems.length) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
  {
    fn: 'rowsDedupeAndLand',
    source: 'plan-tasks-merge:dedupe-rows',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (leftAfter.length > 0) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
  {
    fn: 'openRowsDedupeOnce',
    source: 'plan-tasks-merge:dedupe-open-rows',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (leftAfter.length > 0 || after.claimable !== c0.claimable) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
  {
    fn: 'twinFoldAndLand',
    source: 'plan-tasks-merge:fold-twins',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (recheck.problems.length) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
  {
    fn: 'dedupeAndLand',
    source: 'plan-tasks-merge:dedupe-blocks',
    cas: "['update-ref', 'HEAD', commit, head]",
    guard: 'if (after.dupBlocks >= b0.dupBlocks) {',
    rollback: "['update-ref', 'HEAD', head, commit]",
    // 锚点必须区分**共享主索引**与临时索引:两档都写 `'update-index', '--add'`,而临时索引那一次
    // 排在候选树构造里(在留痕之前)—— 拿它当锚点,判据就会把合规读成违规(本枚第一次自跑就是红在这)。
    before: "gitIn(null, ['update-index', '--add'",
  },
  {
    // 〈原 4 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l449(门 103 C1 收口)〉首意: 自愈档是六个站点里**唯一挂在提交链上自动跑**的那一个(.husky/post-commit 的 --heal --commit)。
    fn: 'healAndLand',
    source: 'plan-tasks-merge:heal',
    cas: "['update-ref', 'HEAD', commit, head]",
    guard: "if (gitIn(null, ['rev-parse', 'HEAD']) !== commit) {",
    rollback: null,
    before: "gitIn(null, ['update-index', '--add'",
  },
  {
    // 第 7 站(G-1111919):前缀套叠副本指定持有行。CAS 与复验形状同 heal 档 —— 裸 update-ref 带
    // 期望值,复验是紧随的 rev-parse 等值回读,**没有**"复验不过即回退"的分支,所以 `rollback: null`
    // 是声明而不是漏填。`before` 用的是本枚刚补上的共享索引对齐:补它之前这一站推进了 HEAD 却不动
    // 主索引(普通提交会把这一档写回旧版),那张表当时**无法**诚实地登记它 —— 判据要求留痕排在
    // 索引对齐之前,而"索引对齐"这一步根本不存在。判据不迁就现场,现场迁就判据。
    fn: 'healWithPrefixHolder',
    source: 'plan-tasks-merge:prefix-holder',
    cas: "['update-ref', 'HEAD', commitSha, head0]",
    guard: "if (gitIn(null, ['rev-parse', 'HEAD']) !== commitSha) {",
    rollback: null,
    before: 'alignSharedIndex(',
  },
  {
    // 第 8 站(G-1058524):漂开副本的人工归并出口。CAS/复验/回退形状同 twinFoldAndLand
    //(复验不过即回退),区别只在判据面与触发方式(必须 --keeper 人工点名持有行)。
    fn: 'driftedMergeAndLand',
    source: 'plan-tasks-merge:merge-drifted',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (problems.length) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
  {
    // 〈原 4 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l484(门 103 C1 收口)〉首意: 第 9 站(2026-10-25 立,--fold-drifted-families 的落地腿):CAS/复验/回退形状同 twinFoldAndLand。
    fn: 'foldDriftedFamiliesAndLand',
    source: 'plan-tasks-merge:fold-drifted-families',
    cas: 'casForward(landed.commit, parent',
    guard: 'if (recheck.problems.length) {',
    rollback: 'casUpdateRef(parent,',
    before: 'alignSharedIndex(',
  },
]

/** 顶层函数声明的位置清单(名字 + 起点)。列 0 起笔才算,缩进的内部函数不吃这一判据。 */
export function topLevelFunctionHeads(maskedText) {
  const heads = []
  for (const m of maskedText.matchAll(/^(?:export )?function ([A-Za-z0-9_$]+)\s*\(/gm))
    heads.push({ name: m[1], at: m.index })
  return heads.sort((a, b) => a.at - b.at)
}

/**
 * 判据表自身的成套性(输入是表本身,与被审文本无关):
 * 函数名互异、source 互异、四条锚点都非空(heal 一档的 `rollback` 例外 —— 它没有回退分支,
 * 那一格在 `landingAttestationStructure` 的站点循环里如实跳过并写进报告)。
 * 为什么单列:`landingAttestationStructure` 的站点循环读的是**本模块的表**,而被审文本只是输入 ——
 * 有人把两档的 source 写成同名(台账里就分不清是哪一档绕的门),改文本是改不到它的,只能按表判。
 * 镜像测试另有一条等值的断言,那条才是"有人动了表"的牙。
 */
export function landingSiteTableProblems(sites = BYPASS_LANDING_SITES) {
  const problems = []
  const fnSeen = new Map()
  const srcSeen = new Map()
  for (const s of sites ?? []) {
    if (!s || typeof s !== 'object') {
      problems.push('条目不是对象')
      continue
    }
    if (fnSeen.has(s.fn)) problems.push(`函数名重复登记:${s.fn}`)
    fnSeen.set(s.fn, true)
    if (srcSeen.has(s.source)) problems.push(`source 名重复:${s.source}(台账分不出是哪一档绕的门)`)
    srcSeen.set(s.source, true)
    for (const k of ['cas', 'guard', 'before'])
      if (typeof s[k] !== 'string' || s[k] === '') problems.push(`${s.fn} 缺 ${k} 锚点`)
  }
  return problems
}

/**
 * 「六个旁路落地站点是否都在复验之后、索引对齐之前写了留痕」的**纯函数结构判据**。
 *
 * 为什么行为测试不够(守门 70/76/81/115/138 那一族同一条理由):端到端只能证"某一臂写了一行",
 * 而本票的病灶形态恰恰是**插错位置** —— 复验之前写的那一臂照样能跑出"成功 ⇒ 写一行",
 * 只是回退那一臂也一并写了。只有按"站点体内相对次序"判,才能把那种插法当场判红。
 * 输入是被审的那份源码文本(镜像测试喂真仓现读,自检喂构造面),不碰磁盘、不派生 git。
 *
 * @returns {{sites:Array,bad:string[],unwired:string[],counts:{sites:number,wired:number,markers:number}}}
 *   `bad` 空 ∧ `unwired` 空 才算六个站点成套接好;取不到锚点**算红不算过**(判据失明不是通过)。
 */
export function landingAttestationStructure(srcText) {
  const text = String(srcText ?? '')
  const bad = []
  const unwired = []
  // 表自身的成套性先判:表坏了,后面每一站的"应当绿"都无从作保(与 §"判据必须覆盖门自己
  // 产出的形态"同一条:判据读的是这张表,表漂了它只会安静地判错东西)。
  for (const p of landingSiteTableProblems()) bad.push(`判据表:${p}`)
  if (text.trim() === '')
    return {
      sites: [],
      bad: [...bad, '输入为空 ⇒ 六个站点一个都判不到(不记为通过)'],
      unwired: ['(空输入)'],
      counts: { sites: 0, wired: 0, markers: 0 },
    }
  // 调用点/锚点必须落在**代码面**:本器六个档的提交信息正文里就写着 plumbing 字面量,
  // 不遮就是把散文读成调用点(守门 131 第一次自跑栽的同一处)。遮罩与原文等长 ⇒ 下标可直接混用。
  const masked = maskCommentsStringsAndRegex(text)
  const heads = topLevelFunctionHeads(masked)
  const bodyOf = (name) => {
    const i = heads.findIndex((h) => h.name === name)
    if (i < 0) return null
    const start = heads[i].at
    const end = i + 1 < heads.length ? heads[i + 1].at : text.length
    return text.slice(start, end)
  }
  const sites = []
  for (const s of BYPASS_LANDING_SITES) {
    const problems = []
    const body = bodyOf(s.fn)
    if (body === null) {
      problems.push(`找不到函数 ${s.fn}(改名/搬走 ⇒ 本判据对它失明,而不是它合规)`)
    } else {
      const calls = [...body.matchAll(/attestLanding\(\{/g)]
      const attest = calls.length ? calls[0].index : -1
      if (calls.length !== 1)
        problems.push(
          `留痕调用出现 ${calls.length} 次(必须恰好 1 次:0 次=没接,>1 次=同一枚落地写两行)`,
        )
      if (!body.includes(`source: '${s.source}'`))
        problems.push(`调用点没有点名 source='${s.source}' ⇒ 台账事后分不清是哪一档绕的门`)
      const casAt = body.indexOf(s.cas)
      const guardAt = body.indexOf(s.guard)
      const beforeAt = body.indexOf(s.before)
      for (const [role, at] of [
        ['正向 CAS', casAt],
        ['复验守卫', guardAt],
        ['索引对齐', beforeAt],
      ])
        if (at < 0)
          problems.push(
            `${role}锚点取不到:${JSON.stringify(role === '索引对齐' ? s.before : role === '复验守卫' ? s.guard : s.cas)}`,
          )
      if (attest >= 0) {
        if (casAt >= 0 && !(casAt < attest))
          problems.push('留痕排在正向 CAS 之前 ⇒ 抢输的尝试也会被记成旁路')
        if (guardAt >= 0 && !(guardAt < attest))
          problems.push('留痕排在复验守卫之前 ⇒ 复验未过时也会写(票面①禁止的插法)')
        if (beforeAt >= 0 && !(attest < beforeAt))
          problems.push('留痕排在共享索引对齐之后 ⇒ 对齐没成的那一支会被漏记(它同样是既成旁路)')
        // G-246(2026-10-15 立):本器是第四台"commit-tree + CAS"旁路落地器,钩子结构性不跑
        // ⇒ post-commit 第 6 节的台账自愈对本器从来不会触发,而本器改的正是登记行。判据必须
        // 在真跑它的那一刻才成立,所以这里把"就地补跑自愈"钉成次序臂:恰好 1 次、排在留痕之后、
        // 排在共享索引写回之前(自愈若建了恢复提交,随后的对齐要把索引对齐到恢复后的 blob,
        // 否则下一枚普通提交会把缺行那份写回旧版 —— 与 live-doc-edit / object-space-land 同形)。
        const heals = [...body.matchAll(/rerunLedgerHeal\(\{/g)]
        if (heals.length !== 1)
          problems.push(
            `台账自愈补跑出现 ${heals.length} 次(必须恰好 1 次:0 次=本站点仍对自愈失明,>1 次=同一枚落地跑两遍)`,
          )
        else {
          const healAt = heals[0].index
          if (beforeAt >= 0 && !(healAt < beforeAt))
            problems.push('台账自愈补跑排在共享索引写回之后 ⇒ 恢复提交会被这一次的索引写回盖掉')
          if (!(attest < healAt))
            problems.push('台账自愈补跑排在留痕之前 ⇒ 尚未确认落地的分支也会跑自愈')
        }
      }
      if (s.rollback) {
        const rb = body.lastIndexOf(s.rollback)
        if (rb < 0) problems.push(`回退锚点取不到:${JSON.stringify(s.rollback)}`)
        else if (attest >= 0 && !(rb < attest))
          problems.push('留痕排在回退动作之前 ⇒ 已回退的落地会被计成 bypass(那比不写更坏)')
      }
    }
    sites.push({ fn: s.fn, source: s.source, ok: problems.length === 0, problems })
    for (const p of problems) bad.push(`${s.fn}:${p}`)
  }
  // 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#plan-merge-l629(门 103 C1 收口)〉首意: 新站点不得悄悄漏接:**每一个**顶层函数体(而不是整份文件)在代码面上出现"正向落地的形状",
  const wired = new Set(BYPASS_LANDING_SITES.map((s) => s.fn))
  /**
   * "正向落地"的三种书写形态,**全部在抹掉注释与字符串的那一面**上取(等长 ⇒ 下标可与原文混用):
   *  - `commitTreeWithIndex({` / `casUpdateRef(landed.commit` 是标识符形态,抹不没;
   *  - 裸 git 那一型(`gitIn(null, ['update-ref', 'HEAD', commit, head])`)的动词整个写在串里,
   *    抹串后只剩 `gitIn(null, [ , , commit, head])` ⇒ 判据认的是**逗号后的标识符 `commit,`**,
   *    而回退那一支写的是 `head, commit]`(commit 在闭括号前,后面没有逗号)⇒ 天然不匹配。
   * ⚠️ 这里刻意**不**用"只抹注释"的那一面:`maskComments` 把行注释整段**删掉**(不等长),
   * 拿它的下标回原文会错位(本枚第一版就是这样把一句解释判据的注释读成了"一处未接留痕的落地调用",
   * 判据表与判据说明双双被算成站点)。判据不得依赖遮噪器的第二种形态。
   */
  const markerRe =
    /commitTreeWithIndex\(\{|casUpdateRef\(landed\.commit|gitIn\(null,\s*\[[^)\n]*commit,/g
  let markers = 0
  for (let k = 0; k < heads.length; k++) {
    const h = heads[k]
    const end = k + 1 < heads.length ? heads[k + 1].at : text.length
    const found = [...masked.slice(h.at, end).matchAll(markerRe)].map((m) => m[0])
    if (!found.length) continue
    markers += found.length
    if (!wired.has(h.name)) {
      unwired.push(`${h.name}@${found.length} 处正向落地形态`)
      continue
    }
    const body = bodyOf(h.name)
    if (!body || !/attestLanding\(\{/.test(body)) unwired.push(`${h.name}(在表里却无留痕调用)`)
  }
  return {
    sites,
    bad,
    unwired: [...new Set(unwired)],
    counts: { sites: sites.length, wired: sites.filter((x) => x.ok).length, markers },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
