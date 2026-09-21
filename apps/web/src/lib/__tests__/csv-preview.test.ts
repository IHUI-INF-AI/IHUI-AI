// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { CSV_PREVIEW_MAX_ROWS, clipCsvRows, parseCsv } from '../csv-preview'

/**
 * P3 #32 CSV 解析测试(2026-09-16 立,RFC 4180 引号语义)
 */
describe('parseCsv', () => {
  it('空输入返回空数组', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('基础逗号分隔', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('引号字段内的逗号不拆分', () => {
    expect(parseCsv('name,age\n"Zhang, San",30')).toEqual([
      ['name', 'age'],
      ['Zhang, San', '30'],
    ])
  })

  it('引号字段内的换行不分行', () => {
    expect(parseCsv('a,b\n"x\ny",2')).toEqual([
      ['a', 'b'],
      ['x\ny', '2'],
    ])
  })

  it('"" 转义为字面双引号', () => {
    expect(parseCsv('a\n"he said ""hi"""')).toEqual([['a'], ['he said "hi"']])
  })

  it('\\r\\n 与裸 \\r 都按行结束', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('末尾无换行时收尾行保留;尾空单元格保留', () => {
    expect(parseCsv('a,b\n1,')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ])
  })

  it('纯空白行被过滤', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('脏数据(行单元格数不等)不抛错原样保留', () => {
    expect(parseCsv('a,b\n1')).toEqual([['a', 'b'], ['1']])
  })
})

describe('clipCsvRows', () => {
  it('不超限:truncated=false', () => {
    const rows = [['a'], ['1'], ['2']]
    expect(clipCsvRows(rows)).toEqual({ rows, total: 3, truncated: false })
  })

  it('超限:截断到上限并标注', () => {
    const rows = Array.from({ length: CSV_PREVIEW_MAX_ROWS + 10 }, (_, i) => [String(i)])
    const out = clipCsvRows(rows)
    expect(out.rows).toHaveLength(CSV_PREVIEW_MAX_ROWS)
    expect(out.total).toBe(CSV_PREVIEW_MAX_ROWS + 10)
    expect(out.truncated).toBe(true)
  })
})
