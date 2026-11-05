#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// onRetry「真重载」判据的唯一实现(§0.6 单一真相源)。
//
// 立因(2026-11-03):共享屏与 RN 壳曾把 `onRetry={onBack}`(返回上一页)、
// `onRetry={onRefresh}`(列表下拉刷新)、`onRetry={onLoadMore}`(翻页)、
// `onRetry={undefined}`(什么都不做)当成重试按钮的接线,点「重试」实际是退出/翻页/清空。
// 2026-11-05 扩面到 web 与小程序:同一份提取器/分类器同时供三端消费,禁止复制第二套实现。
//
// 分类口径(保守,绝不把"没判"写成"判过"):
//   alias/exit/paging/clear/null/noop ⇒ 假重载(带子类)
//   纯重载动词(load/refetch/reload/refresh/fetch/retry/run/...) ⇒ 真重载
//   回调透传(标识符以 on+大写 开头,如 onRetry/onPolishRetry/onGenerate)与混合体 ⇒ 未判定
//   —— 透传值的真实语义在宿主侧,本地无法判定,必须留在未判定桶,不得折成真重载。

/** 别名表达式(逐字判定,不做「含关键字」的宽匹配,避免误伤条件表达式) */
export const ALIAS_EXPRS = new Set([
  'onBack',
  'onRefresh',
  'onLoadMore',
  'undefined',
  'null',
  'onRetry ?? onRefresh',
])

/**
 * 抽出 `onRetry={...}` 的平衡花括号表达式。
 * 不能用 `[^}]*`:壳侧常见 `() => { void load() }`,第一个 `}` 只是内层块。
 */
export function onRetryExprs(text) {
  const out = []
  if (typeof text !== 'string') return out
  const re = /onRetry=\{/g
  while (re.exec(text)) {
    let i = re.lastIndex
    let depth = 1
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      i += 1
    }
    if (depth !== 0) break
    out.push(text.slice(re.lastIndex, i - 1).trim())
  }
  return out
}

/** 带行号的同一提取器:一行一个站点(基线台账要逐文件:行号)。 */
export function onRetrySites(text) {
  const out = []
  if (typeof text !== 'string') return out
  const re = /onRetry=\{/g
  while (re.exec(text)) {
    let i = re.lastIndex
    let depth = 1
    while (i < text.length && depth > 0) {
      const c = text[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      i += 1
    }
    if (depth !== 0) break
    const line = 1 + (text.slice(0, re.lastIndex).match(/\n/g) || []).length
    out.push({ line, expr: text.slice(re.lastIndex, i - 1).trim() })
  }
  return out
}

/** 该 onRetry 表达式是否是别名(返回上一页 / 列表刷新 / 加载更多 / 空值) */
export function isAliasExpr(expr) {
  if (typeof expr !== 'string') return false
  const compact = expr.replace(/\s+/g, ' ').trim()
  if (ALIAS_EXPRS.has(compact)) return true
  // `onRetry ?? onRefresh` 的括号变体:主值仍是列表刷新,不是真重载
  if (/^onRetry\s*\?\?\s*onRefresh$/.test(compact)) return true
  return false
}

/** 标识符按 camelCase / snake_case 切成小写词(用于分类,不用"含关键字"宽匹配) */
export function identWords(expr) {
  const out = []
  for (const m of String(expr || '').matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
    for (const part of m[0].split(/[_$]+|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
      if (part) out.push(part.toLowerCase())
    }
  }
  return out
}

const EXIT_WORDS = new Set(['back', 'navigateback', 'close', 'dismiss', 'hide', 'cancel', 'exit'])
const PAGING_WORDS = new Set(['loadmore', 'fetchmore', 'nextpage', 'gopage'])
const CLEAR_WORDS = new Set(['reset', 'clear', 'clearb', 'clean'])
const RELOAD_WORDS = new Set([
  'refetch',
  'reload',
  'refresh',
  'load',
  'fetch',
  'retry',
  'resubmit',
  'resend',
  'generate',
  'regenerate',
  'run',
  'reloaddata',
  'refetchlist',
])

/** 假重载子类的中文名(报告与台账共用,避免两处各写一份词表) */
export const FAKE_CATEGORY_LABEL = Object.freeze({
  exit: '假重载-退出/关闭',
  paging: '假重载-翻页/加载更多',
  clear: '假重载-清空/重置筛选',
  null: '假重载-空值/空操作',
  noop: '假重载-空回调',
})

/**
 * 单个 onRetry 表达式 → 判定。
 * @returns {{verdict:'真重载'|'假重载'|'未判定', category:string, reason:string}}
 */
export function classifyRetryExpr(expr) {
  const compact = String(expr ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!compact) return { verdict: '未判定', category: 'empty', reason: '表达式为空,无法判定' }

  // 1) 别名表(逐字;含 onRetry ?? onRefresh 括号变体)
  if (isAliasExpr(compact)) {
    if (/^onBack$/i.test(compact)) return { verdict: '假重载', category: 'exit', reason: '别名=返回上一页' }
    if (/^onLoadMore$/i.test(compact)) return { verdict: '假重载', category: 'paging', reason: '别名=加载更多' }
    if (compact === 'undefined' || compact === 'null')
      return { verdict: '假重载', category: 'null', reason: '别名=空值,点击无重载' }
    return { verdict: '假重载', category: 'clear', reason: '别名=列表下拉刷新,不是失败重载' }
  }

  // 2) 空回调(点击什么都不发生)
  if (/^(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*\{\s*\}$/.test(compact) || /^(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*undefined$/.test(compact))
    return { verdict: '假重载', category: 'noop', reason: '空回调,点击无任何动作' }

  const words = identWords(compact)
  const hit = (set) => [...new Set(words.filter((w) => set.has(w)))]
  const exitHits = hit(EXIT_WORDS)
  // camelCase 会被 identWords 切成 load+more,故翻页同时看原串连写形态
  const pagingHits = [
    ...hit(PAGING_WORDS),
    ...(/loadmore|fetchmore|nextpage|gonextpage/i.test(compact) ? ['loadmore/fetchmore/nextpage'] : []),
    ...(/\bpage(?:No|Num|Index)?\s*\+\s*1\b/i.test(compact) ? ['page+1'] : []),
  ]
  const clearHits = hit(CLEAR_WORDS)
  const reloadHits = hit(RELOAD_WORDS)

  // 3) 关闭弹窗/抽屉:setVisible(false) 一类
  const closeState =
    /\bset[A-Za-z0-9_$]*(?:Visible|Open|Show|ModalOpen|DialogOpen|Popover|Drawer|Sheet)\s*\(\s*false\s*\)/i.test(
      compact,
    )
  // 4) 清空/重置筛选:setKeyword('') / setFilters({}) / setCategory(null)
  const clearState =
    /\bset(?:Filters?|Keyword|Search|Query|Category|Status|Tab)\s*\(\s*(?:null|undefined|''|""|\{\})\s*\)/i.test(
      compact,
    )

  const fakeFamilies = [
    exitHits.length || closeState ? 'exit' : null,
    pagingHits.length ? 'paging' : null,
    clearHits.length || clearState ? 'clear' : null,
  ].filter(Boolean)

  // 5) 混合体(既退出又重载等):不能单一判定 ⇒ 未判定,不得折成真重载
  if (fakeFamilies.length > 1)
    return {
      verdict: '未判定',
      category: 'mixed',
      reason: `同时命中多类语义(${fakeFamilies.join('+')}),无法单一判定`,
    }

  if (fakeFamilies[0] === 'exit')
    return {
      verdict: '假重载',
      category: 'exit',
      reason: `命中退出/关闭语义: ${[...exitHits, ...(closeState ? ['closeState'] : [])].join(',')}`,
    }
  if (fakeFamilies[0] === 'paging')
    return { verdict: '假重载', category: 'paging', reason: `命中翻页语义: ${pagingHits.join(',')}` }
  if (fakeFamilies[0] === 'clear')
    return {
      verdict: '假重载',
      category: 'clear',
      reason: `命中清空/重置语义: ${[...clearHits, ...(clearState ? ['clearState'] : [])].join(',')}`,
    }

  if (reloadHits.length && !/^\s*on[A-Z]/.test(compact))
    return { verdict: '真重载', category: 'reload', reason: `命中重载动词: ${reloadHits.join(',')}` }

  if (/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(compact))
    return {
      verdict: '未判定',
      category: 'passthrough',
      reason: '单标识符/属性链回调透传,真实语义在宿主侧,本地无法判定',
    }

  return {
    verdict: '未判定',
    category: 'unknown',
    reason: reloadHits.length
      ? `含重载动词但形如透传回调: ${reloadHits.join(',')}`
      : '未命中任何已知语义',
  }
}

/** 一坨正文 → 逐站点判定(带行号、给出证据原文) */
export function judgeRetryText(text) {
  return onRetrySites(text).map((s) => ({ ...s, ...classifyRetryExpr(s.expr) }))
}

/** 台账键:文件 + 表达式 + 子类(行号会漂,不进键) */
export function siteKey(end, file, expr, category) {
  const compact = String(expr ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${end}\u0000${String(file).replace(/\\/g, '/')}\u0000${compact}\u0000${category}`
}

/** 台账行序列化(键序固定,diff 只随内容变) */
export function serializeBaseline(rows) {
  return rows
    .map((r) =>
      JSON.stringify({
        end: r.end,
        file: r.file,
        line: r.line,
        expr: r.expr,
        verdict: r.verdict,
        category: r.category,
        reason: r.reason,
        owner: r.owner || '',
        at: r.at || '',
      }),
    )
    .join('\n')
}

/** 解析台账文本;坏行不静默丢,拒收并点名(§0.3) */
export function parseBaseline(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      rows.push(JSON.parse(s))
    } catch {
      bad.push({ raw: s.slice(0, 120), why: '非 JSON' })
    }
  }
  return { rows, bad }
}

/** 逐端聚合:真重载/假重载/未判定各多少枚、多少文件 */
export function summarize(sites) {
  const byEnd = new Map()
  for (const s of sites) {
    if (!byEnd.has(s.end))
      byEnd.set(s.end, { end: s.end, files: new Set(), total: 0, real: 0, fake: 0, undetermined: 0, fakeByCategory: {} })
    const b = byEnd.get(s.end)
    b.files.add(String(s.file).replace(/\\/g, '/'))
    b.total += 1
    if (s.verdict === '真重载') b.real += 1
    else if (s.verdict === '假重载') {
      b.fake += 1
      b.fakeByCategory[s.category] = (b.fakeByCategory[s.category] || 0) + 1
    } else b.undetermined += 1
  }
  return [...byEnd.values()].map((b) => ({ ...b, files: b.files.size }))
}

/**
 * 棘轮:本次假重载不得多于台账存量。
 * 新增假重载 = 台账里同键计数不足(含全新文件/新表达式/新子类)。
 * 改善(存量假重载被删)不拦 —— 那是还账。
 * @returns {{newFake:object[], improved:object[], decided:number}}
 */
export function judgeFakeRatchet(sites, baselineRows) {
  const want = new Map()
  for (const r of baselineRows || []) {
    if (r && r.verdict === '假重载') {
      const k = siteKey(r.end, r.file, r.expr, r.category)
      want.set(k, (want.get(k) || 0) + 1)
    }
  }
  const have = new Map()
  for (const s of sites) {
    if (s.verdict !== '假重载') continue
    const k = siteKey(s.end, s.file, s.expr, s.category)
    have.set(k, (have.get(k) || 0) + 1)
  }
  const rankByKey = new Map()
  const newFake = []
  for (const s of sites) {
    if (s.verdict !== '假重载') continue
    const k = siteKey(s.end, s.file, s.expr, s.category)
    const allowed = want.get(k) || 0
    const rank = (rankByKey.get(k) || 0) + 1
    // 逐枚分配额度:同一键的第 n 枚只在台账允许 ≥n 枚时才放行
    rankByKey.set(k, rank)
    if (rank > allowed) newFake.push(s)
  }
  // 台账里有、当前面没有的 = 已还掉的存量(只报数,不判红)
  const improved = []
  for (const [k, n] of want) {
    const left = n - (have.get(k) || 0)
    if (left > 0) improved.push({ key: k, removed: left })
  }
  return { newFake, improved, decided: sites.filter((s) => s.verdict !== '未判定').length }
}

/** 复核真值:有 onRetry_{} 站点的文件数 / 全部含 onRetry 字样的文件数由调用方另行统计 */
export function siteFileCount(sites) {
  return new Set(sites.map((s) => String(s.file).replace(/\\/g, '/'))).size
}

export const __test__ = {
  ALIAS_EXPRS,
  FAKE_CATEGORY_LABEL,
  onRetryExprs,
  onRetrySites,
  isAliasExpr,
  identWords,
  classifyRetryExpr,
  judgeRetryText,
  siteKey,
  serializeBaseline,
  parseBaseline,
  summarize,
  judgeFakeRatchet,
  siteFileCount,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
