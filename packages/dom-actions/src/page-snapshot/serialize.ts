// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主侧序列化：把页内交回的原始快照按预算装配成给模型看的形态。
 *
 * 为什么这一层必须在**页外**：页内只知道 DOM，不知道这次调用还剩多少上下文预算；
 * 而宿主（CLI / 扩展 background / Node 侧）才是决定"这一轮给模型看多少"的那一方。
 * 两层分工的另一个好处是截断规则可被纯函数测试覆盖，不依赖任何浏览器。
 */
import {
  SNAPSHOT_ROW_DROP_ORDER,
  SNAPSHOT_ROW_FIELD_ORDER,
  SNAPSHOT_ROW_PROTECTED_FIELDS,
  type PageElementRow,
  type PageSnapshotBudget,
  type PageSnapshotRaw,
  type PageSnapshotResult,
} from './contract.js'

/** 行渲染时已丢弃的字段集合。 */
type Dropped = Set<string>

function renderRow(row: PageElementRow, dropped: Dropped): string {
  const bits: string[] = []
  for (const field of SNAPSHOT_ROW_FIELD_ORDER) {
    if (dropped.has(field)) continue
    const value = row[field]
    if (value === undefined || value === false) continue
    if (field === 'attrs' && typeof value === 'object' && value !== null) {
      const pairs = Object.entries(value as Record<string, string>)
        .map(([key, item]) => `${key}=${item}`)
        .join(' ')
      if (pairs) bits.push(pairs)
      continue
    }
    if (field === 'rect' && Array.isArray(value)) {
      bits.push(`rect=${value.join(',')}`)
      continue
    }
    bits.push(`${String(field)}=${String(value)}`)
  }
  return bits.join(' ')
}

/**
 * 单行装得下就整行交；装不下就**自队尾起逐字段丢**，直到进得去预算。
 * 保护字段（语义 + 句柄）不在丢弃阶梯里，所以"被截断"永远不等于"这一行读不懂或动不了"。
 */
function dropOrderFor(row: PageElementRow, budget: PageSnapshotBudget): Dropped {
  const dropped: Dropped = new Set()
  for (const field of SNAPSHOT_ROW_DROP_ORDER) {
    if (renderRow(row, dropped).length <= budget.maxRowChars) return dropped
    dropped.add(field)
  }
  return dropped
}

function formatBody(raw: PageSnapshotRaw, budget: PageSnapshotBudget, notices: string[]): PageSnapshotResult['body'] {
  const blocks: PageSnapshotResult['body'] = []
  let used = 0
  for (const block of raw.body) {
    if (used >= budget.bodyChars) break
    const heading = block.heading ? `[${block.heading}] ` : ''
    const room = budget.bodyChars - used - heading.length
    if (room <= 0) break
    const text = block.text.length > room ? block.text.slice(0, Math.max(1, room - 1)) + '…' : block.text
    blocks.push(heading ? { heading: block.heading as string, text } : { text })
    used += heading.length + text.length
  }
  const dropped = Math.max(0, raw.counts.bodyCharsFound - used)
  if (dropped > 0) {
    notices.push(`正文截去 ${dropped} 字符（正文预算 ${budget.bodyChars}）；句柄配额与此互不占用`)
  }
  return blocks
}

/** 快照 → 按预算装配的结构化结果（行 + 正文 + 逐条截断说明）。 */
export function serializeSnapshotResult(
  raw: PageSnapshotRaw,
  budget: PageSnapshotBudget,
): PageSnapshotResult {
  const notices: string[] = []
  const rows: PageElementRow[] = []
  // 页内是按"安装期上限"采集的（换预算不重装，否则上一轮句柄整批作废），
  // 所以真正的行数配额必须在**宿主**这一侧裁：谁定的预算谁负责收口。
  const admitted = raw.rows.slice(0, budget.maxRows)
  for (const row of admitted) {
    const dropped = dropOrderFor(row, budget)
    // 保留原对象、只删被丢的字段：给付程序的 rows 与给模型的 text 必须同源。
    const kept: PageElementRow = { handle: row.handle, role: row.role }
    for (const field of SNAPSHOT_ROW_FIELD_ORDER) {
      if (dropped.has(field)) continue
      const value = row[field]
      if (value === undefined || value === false) continue
      ;(kept as unknown as Record<string, unknown>)[field] = value
    }
    if (dropped.size > 0) {
      notices.push(`${row.handle} 超单行预算 ${budget.maxRowChars}，已丢弃 ${Array.from(dropped).join(',')}`)
    }
    rows.push(kept)
  }
  // 页内采集与宿主配额是两本账：页内可能已经裁过一轮（counts 差额），宿主又按本次预算
  // 再裁一轮。提示必须按**最终交付行数**算，否则会出现"表被截了一半却报告没截"。
  const hidden = Math.max(0, raw.counts.interactiveFound - rows.length)
  if (hidden > 0) {
    notices.push(
      `另有 ${hidden} 个可交互元素未出表（句柄配额 ${budget.maxRows}）；需要时对目标区域滚动后重拍`,
    )
  }
  if (raw.counts.crossOriginFrames > 0) {
    notices.push(
      `${raw.counts.crossOriginFrames} 个跨域 iframe 未解析（同源策略所限），其内元素不在表内`,
    )
  }
  return {
    schema: raw.schema,
    scope: raw.scope,
    title: raw.title,
    url: raw.url,
    rows,
    body: formatBody(raw, budget, notices),
    counts: raw.counts,
    notices,
  }
}

/** 结构化快照 → 模型可读文本。 */
export function renderSnapshot(result: PageSnapshotResult): string {
  const lines: string[] = []
  lines.push(`# ${result.title || '(untitled)'}`)
  lines.push(`URL: ${result.url}`)
  lines.push(
    `scope: ${result.scope} · interactive=${result.counts.interactiveFound} emitted=${result.counts.rowsEmitted} body=${result.counts.bodyCharsEmitted}/${result.counts.bodyCharsFound} chars`,
  )
  lines.push('')
  lines.push('## 可动作元素（handle 为页内活引用，跨轮有效）')
  if (result.rows.length === 0) lines.push('（本轮无可动作元素出表）')
  for (const row of result.rows) {
    const dropped: Dropped = new Set()
    lines.push(`- ${renderRow(row, dropped)}`)
  }
  if (result.body.length > 0) {
    lines.push('')
    lines.push('## 正文语义')
    for (const block of result.body) {
      lines.push(block.heading ? `[${block.heading}] ${block.text}` : block.text)
    }
  }
  if (result.notices.length > 0) {
    lines.push('')
    lines.push('## 截断说明')
    for (const notice of result.notices) lines.push(`- ${notice}`)
  }
  return lines.join('\n')
}

/** 一步到位的便捷入口（页内宿主与 CLI 共用）。 */
export function snapshotToText(raw: PageSnapshotRaw, budget: PageSnapshotBudget): string {
  return renderSnapshot(serializeSnapshotResult(raw, budget))
}

/** 空表 / 结构缺失时的降级文本：显式说明"没抓到"，不交付空串。 */
export function renderEmptySnapshot(reason: string): string {
  return `（快照不可用：${reason}）`
}

/** 丢弃阶梯的自检出口：受保护字段必须永不出现在丢弃集里。 */
export function protectedRowFields(): readonly (keyof PageElementRow)[] {
  return SNAPSHOT_ROW_PROTECTED_FIELDS
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
