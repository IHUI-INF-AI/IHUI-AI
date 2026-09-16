// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CSV 预览解析(P3 #32 PDF/CSV 消息内富预览,2026-09-16 立)。
 *
 * 手写状态机解析而非 naive split(',')——CSV 的引号字段里可以含逗号、
 * 换行、转义双引号(""),naive split 会把一行数据撕成多段。
 */

/** 预览默认最大行数(超出截断,UI 提供"展开全部")。 */
export const CSV_PREVIEW_MAX_ROWS = 50

/**
 * 解析 CSV 文本为二维数组(状态机,RFC 4180 为主的双引号语义)。
 *
 * @returns 行数组;空输入返回 [];每行单元格数可能不等(脏数据不抛错,原样保留)。
 */
export function parseCsv(text: string): string[][] {
  if (!text) return []
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    // 全空行(仅一个空单元格)在首行之前跳过;行尾空单元格保留(合法 CSV 语义)
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i] ?? ''
    if (inQuotes) {
      if (ch === '"') {
        // "" 转义为字面引号;否则引号闭合
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushCell()
      i++
      continue
    }
    if (ch === '\r') {
      // \r\n 与裸 \r 都当行结束
      if (text[i + 1] === '\n') i++
      pushRow()
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      i++
      continue
    }
    cell += ch
    i++
  }

  // 收尾:末尾无换行时还有最后一个 cell/row
  if (cell !== '' || row.length > 0) {
    // cell 为空但 row 已有内容(如 "a,b," 结尾)→ 保留尾空单元格
    pushRow()
  }

  // 过滤纯空白行(表格预览不需要空行)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * 裁剪预览行数。
 *
 * @returns { rows, total, truncated } 供 UI 展示"前 N 行/共 M 行"。
 */
export function clipCsvRows(
  rows: string[][],
  maxRows = CSV_PREVIEW_MAX_ROWS,
): { rows: string[][]; total: number; truncated: boolean } {
  const total = rows.length
  return {
    rows: rows.slice(0, maxRows),
    total,
    truncated: total > maxRows,
  }
}
