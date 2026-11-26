// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { buildResultCsv } from '../copy-result-csv'

describe('问数结果 CSV 导出', () => {
  it('普通值按逗号拼接', () => {
    expect(buildResultCsv(['name', 'age'], [{ name: '小李', age: 30 }])).toBe('name,age\r\n小李,30')
  })

  it('含逗号的字段整体加双引号', () => {
    expect(buildResultCsv(['title'], [{ title: '客户,一组' }])).toBe('title\r\n"客户,一组"')
  })

  it('含双引号的字段内部引号翻倍', () => {
    expect(buildResultCsv(['content'], [{ content: '他说"你好"' }])).toBe('content\r\n"他说""你好"""')
  })

  it('含换行的字段整体加双引号', () => {
    expect(buildResultCsv(['content'], [{ content: '第一行\n第二行' }])).toBe('content\r\n"第一行\n第二行"')
  })

  it('null 与 undefined 输出空串', () => {
    expect(buildResultCsv(['a', 'b', 'c'], [{ a: null, b: undefined, c: 'x' }])).toBe('a,b,c\r\n,,x')
  })

  it('超过 10 行只输出前 10 行', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ id: index, label: `行${index}` }))
    const csv = buildResultCsv(['id', 'label'], rows)
    expect(csv.split('\r\n')).toHaveLength(11)
    expect(csv.split('\r\n')[10]).toBe('9,行9')
  })

  it('没有行时仍输出表头', () => {
    expect(buildResultCsv(['a', 'b'], [])).toBe('a,b')
  })

  it('列名同样走 CSV 转义', () => {
    expect(buildResultCsv(['姓名', '备注,分数'], [])).toBe('姓名,"备注,分数"')
  })
})

