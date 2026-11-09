// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-shell-worklist.mjs — 小程序「生成式薄壳」工作表(2026-11-07 立,只读纯函数)。
 *
 * 为什么需要有这一件:台账 `scripts/data/miniapp-shell-copy-ledger.jsonl` 只回答
 * 「这页是不是复制页」,不回答「这页现在能不能一键生成、卡在哪、下一步该敲哪条命令」。
 * 本文件把分类器(miniapp-shell-form)与规划器(plan-hand-mirror-conversion)的现成结论
 * 汇成一张**可执行**工作表;不新造判据、不新造门,也不碰任何业务代码。
 *
 * 字段口径(全部现算,不缓存):
 *   · loc       = 该面页面正文行数;
 *   · openTags  = 导出组件 return 树里的 JSX 开标签数(JsxOpeningElement + JsxSelfClosingElement,
 *                 Fragment 不计)。2 枚 = `<ThemeRoot><Shell/></ThemeRoot>` 的薄壳极值;
 *   · shell     = 分类器现读 impl==='shell'(结构 + 入口双证,判据在 miniapp-shell-form);
 *   · missing   = 「缺什么」逐条机械枚举(不写空话);
 *   · nextAction= 可生成时给出**可直接复制执行**的命令;不可生成时明确点名原因。
 *
 * 不可生成绝不静默跳过:每一条 blocked 都必须带 ≥1 条 missing。
 */

import { createHash } from 'node:crypto'
import ts from 'typescript'

const sha256Text = (t) => createHash('sha256').update(String(t ?? '')).digest('hex')
// 空文本 = 0 行(新建文件的前后行数必须是 0 → N,不能写成 1 → N)
const lineCount = (t) => {
  const s = String(t ?? '')
  return s.length === 0 ? 0 : s.split('\n').length
}

/**
 * 写盘台账(单源):dry-run 与真写共用同一份前后行数/sha256 计算。
 * @returns {{path:string, op:'create'|'overwrite', beforeLines:number, afterLines:number, deltaLines:number, sha256:string}}
 */
export function buildWriteAccount({ pageRel, beforeText, finalText }) {
  return {
    path: pageRel,
    op: String(beforeText ?? '').length > 0 ? 'overwrite' : 'create',
    beforeLines: lineCount(beforeText),
    afterLines: lineCount(finalText),
    deltaLines: lineCount(finalText) - lineCount(beforeText),
    sha256: sha256Text(finalText),
  }
}

export { lineCount, sha256Text }

// ─────────────────────────────────────────────────────────────────────────────
// 开标签计数(纯 AST,不依赖分类器的宿主骨架豁免 —— 这是「开标签」而非「业务 JSX」)
// ─────────────────────────────────────────────────────────────────────────────

function parseTsx(text) {
  return ts.createSourceFile('page.tsx', String(text ?? ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function unwrapParens(n) {
  let cur = n
  while (cur && ts.isParenthesizedExpression(cur)) cur = cur.expression
  return cur
}

function findExportedComponent(sf) {
  const decls = new Map()
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) decls.set(st.name.text, st)
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) decls.set(d.name.text, d)
      }
    }
  }
  for (const st of sf.statements) {
    if (!ts.isExportAssignment(st)) continue
    return ts.isIdentifier(st.expression) ? (decls.get(st.expression.text) ?? null) : st.expression
  }
  for (const st of sf.statements) {
    if (!st.modifiers) continue
    const has = (k) => st.modifiers.some((m) => m.kind === k)
    if (has(ts.SyntaxKind.ExportKeyword) && has(ts.SyntaxKind.DefaultKeyword)) return st
  }
  return null
}

function returnRoots(comp) {
  const out = []
  if (!comp) return out
  const body = ts.isVariableDeclaration(comp) ? comp.initializer : comp.body
  if (!body) return out
  if (!ts.isBlock(body)) {
    out.push(unwrapParens(body))
    return out
  }
  const walk = (n) => {
    if (ts.isFunctionLike(n)) return // 嵌套函数(render prop/回调)不并入 return 树
    if (ts.isReturnStatement(n) && n.expression) out.push(unwrapParens(n.expression))
    ts.forEachChild(n, walk)
  }
  walk(body)
  return out
}

/**
 * 页面开标签数。
 * @param {string|null|undefined} text 页面正文
 * @returns {number} 解析不出导出组件 ⇒ 0(调用方须同时报「不可判定」,不得把 0 当薄壳)
 */
export function countOpenTags(text) {
  if (typeof text !== 'string' || text.length === 0) return 0
  let sf
  try {
    sf = parseTsx(text)
  } catch {
    return 0
  }
  const roots = returnRoots(findExportedComponent(sf))
  let n = 0
  const walk = (node) => {
    if (!node) return
    if (ts.isFunctionLike(node)) return
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) n += 1
    ts.forEachChild(node, walk)
  }
  for (const r of roots) walk(r)
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// 工作表(纯函数)
// ─────────────────────────────────────────────────────────────────────────────

const PLANNER_KIND_LABEL = {
  convertible: '可转',
  'page-only-capability': '页面独有能力',
  'no-shell': '无承载壳',
  'shell-not-rendering': '壳不渲染本屏',
  undetermined: '不可判定',
}

/** 台账在册行 + 当前面分类结果 + 规划器行 → 逐页「缺什么」。 */
export function collectMissing({ row, plannerRow, registered, fileReadable, refusedReason }) {
  if (row?.impl === 'shell') return []
  const out = []
  if (!registered) out.push('路由清单(app.config.ts)无此 route')
  if (!fileReadable) out.push('页面文件在该面读不到')
  if (!row) out.push('当前面无分类结果')
  if (row) {
    if (row.impl === 'not-applicable') out.push(`台账显式 not-applicable:${row.note || '无说明'}`)
    if (row.impl === 'undetermined') out.push(`形态不可判:${row.note || '未取证'}`)
    if (row.impl === 'copy') {
      if (!row.shellEntry) out.push('未接共享壳入口(@rn-shells / @ihui/rn-app/features / barrel)')
      if (typeof row.businessJsx === 'number' && row.businessJsx > 2) {
        out.push(`业务 JSX ${row.businessJsx} > 2(宿主骨架豁免后仍超结构下限)`)
      }
      if (row.duplicateUi === true) out.push('与共享屏存在重复 UI 段')
      if (Array.isArray(row.singleEndProps) && row.singleEndProps.length > 0) {
        out.push(`单端消费 prop(${row.singleEndProps.join(', ')})`)
      }
      if (row.reasonClass === 'local-delta') out.push('页面自带数据层痕迹(已与共享屏行为分叉)')
      if (/共享屏正文读不到/.test(row.note || '')) out.push('共享屏正文读不到(重复段不可判)')
      if (/RN 对照读不到/.test(row.note || '')) out.push('RN 对照读不到(单端 prop 不可判)')
    }
  }
  if (plannerRow && plannerRow.kind && plannerRow.kind !== 'convertible') {
    out.push(
      `规划阻塞(${PLANNER_KIND_LABEL[plannerRow.kind] ?? plannerRow.kind}):${plannerRow.why || '无原因'}`,
    )
  } else if (!plannerRow) {
    out.push('规划器未覆盖该页(不在手写镜像清单 / 未声明共享屏)')
  }
  // 「规划器判可转但本器拒落」必须在这里留下原因,否则 blocked 页会出现空 missing(静默跳过)。
  if (refusedReason) out.push(`生成拒落:${refusedReason}`)
  return out
}

/**
 * 单页下一步动作。
 * @returns {{status:'done'|'ready'|'blocked'|'out-of-scope'|'undetermined', nextAction:string, blockedReason:string|null}}
 */
export function decideNextAction({ row, plannerRow, registered, fileReadable, refusedReason }) {
  if (!registered) {
    return { status: 'blocked', nextAction: '不可生成', blockedReason: '路由清单(app.config.ts)无此 route' }
  }
  if (row?.impl === 'shell') {
    return {
      status: 'done',
      nextAction: '无需生成(已薄壳);台账摘除走退休通道,本轮不动台账',
      blockedReason: null,
    }
  }
  if (!fileReadable) {
    return { status: 'blocked', nextAction: '不可生成', blockedReason: '页面文件在该面读不到(不回落另一面)' }
  }
  if (!row || row.impl === 'undetermined') {
    return {
      status: 'undetermined',
      nextAction: '不可生成(形态不可判,先补取证)',
      blockedReason: row?.note || '当前面无分类结果',
    }
  }
  if (row.impl === 'not-applicable') {
    return {
      status: 'out-of-scope',
      nextAction: '不在射程(台账显式 not-applicable)',
      blockedReason: row.note || 'not-applicable',
    }
  }
  if (row.impl === 'plain') {
    return { status: 'out-of-scope', nextAction: '不在射程(未被映射声明为镜像/委托)', blockedReason: null }
  }
  if (plannerRow?.kind === 'convertible' && !refusedReason) {
    return {
      status: 'ready',
      nextAction: `node scripts/upgrade-miniapp-shell-pages.mjs --generate --route=${row.route}`,
      blockedReason: null,
    }
  }
  const reason =
    refusedReason ||
    (plannerRow?.kind && plannerRow.kind !== 'convertible'
      ? `规划器判 ${plannerRow.kind}:${plannerRow.why || '无原因'}`
      : '规划器未覆盖该页(不在手写镜像清单 / 未声明共享屏)')
  return { status: 'blocked', nextAction: '不可生成(先解决「缺什么」里的阻塞)', blockedReason: reason }
}

/**
 * 汇成工作表。所有输入都是现成结论,本函数不读盘、不判红绿。
 * @param {object} p
 * @param {object[]} p.ledgerRows 台账在册行(已剔除退休行)
 * @param {object[]} p.classifiedRows classifyMiniappPages 的行
 * @param {object[]} p.plannerRows plan-hand-mirror-conversion 的 rows
 * @param {number} p.ledgerPhysicalCount 台账物理行数(含退休行)
 * @param {number} p.ledgerRetiredCount 退休行数
 * @param {Map<string,string>} [p.refusedReasons] route → planUpgrades 拒落原因
 * @param {Map<string,string|null>} [p.pageTexts] route → 页面正文(该面)
 * @param {string} [p.face]
 * @returns {{face:string, items:object[], stats:object, ledgerPhysical:number, ledgerActive:number, ledgerRetired:number}}
 */
export function buildWorklist({
  ledgerRows = [],
  classifiedRows = [],
  plannerRows = [],
  ledgerPhysicalCount = 0,
  ledgerRetiredCount = 0,
  refusedReasons = new Map(),
  pageTexts = new Map(),
  face = 'head',
}) {
  const byRoute = new Map(classifiedRows.map((r) => [r.route, r]))
  const planByRoute = new Map(plannerRows.map((r) => [r.route, r]))
  const routes = new Set(ledgerRows.map((r) => r.route))
  // 台账未登记但现读为复制页 ⇒ 必须出现在工作表里(否则等于静默跳过 S1 新增面)。
  for (const r of classifiedRows) {
    if (r.impl === 'copy' && r.mapStatus !== 'none') routes.add(r.route)
  }
  const items = []
  for (const route of [...routes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const row = byRoute.get(route) ?? null
    const plannerRow = planByRoute.get(route) ?? null
    const text = pageTexts.get(route) ?? null
    const fileReadable = Boolean(row?.file && text !== null)
    const registered = Boolean(row)
    const openTags = fileReadable ? countOpenTags(text) : 0
    const loc = fileReadable ? String(text).split('\n').length : (row?.loc ?? 0)
    const missing = collectMissing({
      row,
      plannerRow,
      registered,
      fileReadable,
      refusedReason: refusedReasons.get(route) ?? null,
    })
    const verdict = decideNextAction({
      row,
      plannerRow,
      registered,
      fileReadable,
      refusedReason: refusedReasons.get(route) ?? null,
    })
    items.push({
      route,
      file: row?.file ?? null,
      loc,
      openTags,
      impl: row?.impl ?? 'missing',
      shell: row?.impl === 'shell',
      businessJsx: typeof row?.businessJsx === 'number' ? row.businessJsx : null,
      mapStatus: row?.mapStatus ?? 'missing-file',
      planKind: plannerRow?.kind ?? null,
      inLedger: ledgerRows.some((l) => l.route === route),
      registered,
      status: verdict.status,
      missing,
      blockedReason: verdict.blockedReason,
      nextAction: verdict.nextAction,
    })
  }
  const count = (s) => items.filter((x) => x.status === s).length
  return {
    face,
    ledgerPhysical: ledgerPhysicalCount,
    ledgerActive: ledgerRows.length,
    ledgerRetired: ledgerRetiredCount,
    items,
    stats: {
      pages: items.length,
      done: count('done'),
      ready: count('ready'),
      blocked: count('blocked'),
      undetermined: count('undetermined'),
      outOfScope: count('out-of-scope'),
    },
  }
}

/** 给人读的工作表(Markdown;逐字确定,无时间戳)。 */
export function formatWorklistMarkdown(worklist) {
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const lines = []
  lines.push(
    `# 小程序生成式薄壳工作表(面=${worklist.face};台账物理 ${worklist.ledgerPhysical} 行 = 在册 ${worklist.ledgerActive} + 退休 ${worklist.ledgerRetired})`,
  )
  lines.push('')
  lines.push(
    `合计 ${worklist.stats.pages} 页:已薄壳 ${worklist.stats.done} / 可生成 ${worklist.stats.ready} / 不可生成 ${worklist.stats.blocked} / 不可判 ${worklist.stats.undetermined} / 射程外 ${worklist.stats.outOfScope}`,
  )
  lines.push('')
  lines.push('| 页面 | LOC | 开标签 | 形态 | 已达薄壳 | 缺什么 | 下一步动作 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const x of worklist.items) {
    const missing = x.missing.length === 0 ? '—' : x.missing.join(';')
    lines.push(
      `| ${cell(x.route)} | ${x.loc} | ${x.openTags} | ${cell(x.impl)} | ${x.shell ? '是' : '否'} | ${cell(missing)} | ${cell(x.nextAction)} |`,
    )
  }
  return `${lines.join('\n')}\n`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
