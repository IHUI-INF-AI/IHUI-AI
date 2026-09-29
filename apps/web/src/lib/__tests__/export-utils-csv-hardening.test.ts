// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { neutralizeFormulaCell } from '@/lib/export-utils'

// G-823 电子表格公式注入中和(CSV/Excel 导出单元格)
describe('neutralizeFormulaCell', () => {
  it("以 = 开头的单元格前缀单引号(票面点名: '=SUM(A1)' → \"'=SUM(A1)\")", () => {
    expect(neutralizeFormulaCell('=SUM(A1)')).toBe("'=SUM(A1)")
  })

  it("以 + 开头: 前缀单引号", () => {
    expect(neutralizeFormulaCell('+1+1')).toBe("'+1+1")
  })

  it("以 - 开头的字符串: 前缀单引号", () => {
    expect(neutralizeFormulaCell('-2-3')).toBe("'-2-3")
  })

  it("以 @ 开头: 前缀单引号", () => {
    expect(neutralizeFormulaCell('@SUM(1,2)')).toBe("'@SUM(1,2)")
  })

  it('前导空白后跟 = 同样中和(不可信文本可藏 DDE 载荷)', () => {
    expect(neutralizeFormulaCell("   =cmd|' /C calc'!A0")).toBe("'   =cmd|' /C calc'!A0")
  })

  it('数字原始值是正当用法,不因负号前缀被中和', () => {
    expect(neutralizeFormulaCell(-5)).toBe('-5')
    expect(neutralizeFormulaCell(0)).toBe('0')
  })

  it('幂等:对已中和的值再中和一次不变', () => {
    const once = neutralizeFormulaCell('=SUM(A1)')
    expect(neutralizeFormulaCell(once)).toBe(once)
    expect(neutralizeFormulaCell(neutralizeFormulaCell("  =cmd|' /C calc'!A0"))).toBe(
      neutralizeFormulaCell("  =cmd|' /C calc'!A0"),
    )
  })

  it("已以单引号开头的文本不叠加前缀", () => {
    expect(neutralizeFormulaCell("'hello")).toBe("'hello")
  })

  it('反向对照:普通中文/英文正文单元格逐字不变', () => {
    expect(neutralizeFormulaCell('Hello world')).toBe('Hello world')
    expect(neutralizeFormulaCell('张三,来自中国的用户')).toBe('张三,来自中国的用户')
  })

  it('前导制表符触发中和(分隔符注入面)', () => {
    expect(neutralizeFormulaCell('\tfoo')).toBe("'\tfoo")
  })

  it('null/undefined 归一为空字符串且不中和', () => {
    expect(neutralizeFormulaCell(null)).toBe('')
    expect(neutralizeFormulaCell(undefined)).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
