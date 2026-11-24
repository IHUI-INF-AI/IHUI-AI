// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-417 回归锁(2026-11-13)。
 *
 * 病灶:xlsx 解析无条件同时生成 text 与 markdown 两份全量副本,
 * 内存翻倍;唯一调用方(document-parser)只取 `.text`。
 *
 * 本文件锁:
 *   ① 未请求 markdown 时不构建(纯函数层返回 null + 结果对象为惰性 getter);
 *   ② 同时请求两种形态时,矩阵只遍历一次(用 Proxy 统计行访问次数);
 *   ③ 小样本输出与旧实现逐字等价(text 与 markdown 各自比对);
 *   ④ 超过 XLSX_MAX_OUTPUT_ROWS 的表被截断并追加中文标注。
 */
import { describe, it, expect } from 'vitest'
import exceljs from 'exceljs'
import {
  parseXlsx,
  parseCsv,
  renderMatrixLines,
  XLSX_MAX_OUTPUT_ROWS,
} from '../src/services/xlsx-parser.js'

const { Workbook } = exceljs

/** 把矩阵包一层 Proxy,统计数字下标(即行)被读取的次数 */
function countingMatrix(rows: string[][]): { proxy: string[][]; reads: () => number } {
  let indexReads = 0
  const proxy = new Proxy(rows, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) indexReads++
      return Reflect.get(target, prop, receiver)
    },
  })
  return { proxy, reads: () => indexReads }
}

describe('F-417 xlsx 按需渲染', () => {
  it('① 不请求 markdown 时返回 null;结果对象的 markdown 是惰性 getter', async () => {
    const matrix = [
      ['name', 'age'],
      ['张三', '30'],
    ]
    expect(renderMatrixLines(matrix, ['text']).markdown).toBeNull()

    const wb = new Workbook()
    const ws = wb.addWorksheet('s')
    ws.getCell('A1').value = 'name'
    ws.getCell('B1').value = 'age'
    ws.getCell('A2').value = '张三'
    ws.getCell('B2').value = 30
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    const out = await parseXlsx(buf)
    expect(typeof Object.getOwnPropertyDescriptor(out, 'markdown')?.get).toBe('function')
    expect(out.text).toBe('name\tage\n张三\t30')
    // 取用后才构建,内容与旧实现一致
    expect(out.markdown).toBe('| name | age |\n| --- | --- |\n| 张三 | 30 |')
  })

  it('② 同时请求 text + markdown 时每行只遍历一次(旧实现为 2n)', () => {
    const rows = Array.from({ length: 6 }, (_, i) => [`a${i}`, `b${i}`])
    const { proxy, reads } = countingMatrix(rows)
    const { text, markdown } = renderMatrixLines(proxy, ['text', 'markdown'])
    expect(text).toHaveLength(rows.length)
    expect(markdown).not.toBeNull()
    // 逐行 + 一次表头读取;旧实现 text/markdown 各遍历一遍 = 2n 次
    expect(reads()).toBe(rows.length + 1)
    expect(reads()).toBeLessThan(rows.length * 2)
  })

  it('③ 小样本输出与旧实现逐字等价(含多 sheet 标题)', async () => {
    const wb = new Workbook()
    const a = wb.addWorksheet('Alpha')
    a.getCell('A1').value = 'k'
    a.getCell('B1').value = 'v'
    a.getCell('A2').value = 'x'
    a.getCell('B2').value = 1
    const b = wb.addWorksheet('Beta')
    b.getCell('A1').value = 'only'
    const buf = Buffer.from(await wb.xlsx.writeBuffer())

    const out = await parseXlsx(buf, { formats: ['text', 'markdown'] })
    expect(out.text).toBe('## Alpha\n\nk\tv\nx\t1\n\n## Beta\n\nonly')
    expect(out.markdown).toBe(
      '### Alpha\n\n| k | v |\n| --- | --- |\n| x | 1 |\n\n### Beta\n\n| only |\n| --- |',
    )
    expect(out.totalRows).toBe(3)

    // 缺省(text only)与显式双形态的 text 完全一致
    const textOnly = await parseXlsx(buf)
    expect(textOnly.text).toBe(out.text)
    expect(textOnly.markdown).toBe(out.markdown)
  })

  it('④ 超过行数上限被截断并标注,未请求的形态不生成', async () => {
    const rowCount = XLSX_MAX_OUTPUT_ROWS + 7
    const csv = Array.from({ length: rowCount }, (_, i) => `r${i}`).join('\n')
    const out = await parseCsv(Buffer.from(csv, 'utf8'), { formats: ['text'] })

    const parts = out.text.split('\n\n')
    expect(parts).toHaveLength(2)
    expect(parts[0]?.split('\n')).toHaveLength(XLSX_MAX_OUTPUT_ROWS)
    expect(parts[1]).toContain('已截断')
    expect(parts[1]).toContain(`仅输出前 ${XLSX_MAX_OUTPUT_ROWS} 行`)
    expect(parts[1]).toContain(`共 ${rowCount} 行`)
    // totalRows 保留截断前真实行数(元信息不撒谎)
    expect(out.totalRows).toBe(rowCount)
    expect(typeof Object.getOwnPropertyDescriptor(out, 'markdown')?.get).toBe('function')
    expect(renderMatrixLines([['a']], ['text']).markdown).toBeNull()
  })
})
