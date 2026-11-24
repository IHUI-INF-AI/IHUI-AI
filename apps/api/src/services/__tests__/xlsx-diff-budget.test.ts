// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-260 / F-261 资源预算夹具。
 *
 * F-260:稀疏/超宽 sheet 按坐标极值展开会卡死主线程;夹具用 6000 行表钉住
 *   「行数超预算 ⇒ XlsxSheetTooLargeError」,而不是慢慢解析。改前会正常返回,断言失败。
 * F-261:LCS 表按 m×n 分配,夹具用 3000×3000 行(9M > 4M 预算)钉住拒绝;
 *   另用 >2MB 临时文件钉住单文件字节预算。改前两种情况都会继续分配/读取。
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import exceljs from 'exceljs'
import { parseXlsx, XlsxSheetTooLargeError } from '../xlsx-parser.js'
import {
  computeTextDiff,
  compareTextFiles,
  DiffTooLargeError,
  MAX_DIFF_FILE_BYTES,
} from '../diff-service.js'

const { Workbook } = exceljs

describe('F-260 XLSX sheet 预算', () => {
  it('6000 行 sheet 被明确拒绝(不再按 rowCount 展开)', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('big')
    for (let r = 1; r <= 6000; r++) ws.getRow(r).getCell(1).value = `r${r}`
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    await expect(parseXlsx(buf)).rejects.toBeInstanceOf(XlsxSheetTooLargeError)
  })

  it('稀疏远坐标(XFD1048576)快速拒绝,不进入循环', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('sparse')
    ws.getCell('A1').value = 'ok'
    ws.getCell('XFD1048576').value = 'far'
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    await expect(parseXlsx(buf)).rejects.toBeInstanceOf(XlsxSheetTooLargeError)
  })

  it('预算内小表照常解析', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('small')
    ws.getCell('A1').value = 'hello'
    ws.getCell('B1').value = 'world'
    ws.getCell('A2').value = 42
    const buf = Buffer.from(await wb.xlsx.writeBuffer())
    const out = await parseXlsx(buf)
    expect(out.text).toContain('hello')
    expect(out.text).toContain('42')
  })
})

describe('F-261 diff 预算', () => {
  it('3000×3000 行 LCS 被拒绝(9M 单元格 > 4M)', () => {
    const text = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
    expect(() => computeTextDiff(text, text)).toThrow(DiffTooLargeError)
  })

  it('小文本 diff 不受影响', () => {
    const out = computeTextDiff('a\nb\nc', 'a\nc\nd')
    expect(out.some((l) => l.diffType === 'delete' && l.content === 'b')).toBe(true)
    expect(out.some((l) => l.diffType === 'add' && l.content === 'd')).toBe(true)
  })

  it('>2MB 文件在读取前被拒绝', () => {
    const dir = mkdtempSync(join(tmpdir(), 'diff-budget-'))
    try {
      const a = join(dir, 'a.txt')
      const b = join(dir, 'b.txt')
      writeFileSync(a, 'a'.repeat(MAX_DIFF_FILE_BYTES + 1))
      writeFileSync(b, 'small')
      expect(() => compareTextFiles(a, b)).toThrow(DiffTooLargeError)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
