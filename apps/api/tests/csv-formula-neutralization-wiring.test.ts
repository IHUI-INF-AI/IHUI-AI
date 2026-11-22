// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815997:CSV/Excel 公式注入中和 —— api 面装车与行为判据。
 *
 *  1. 出口行为:sanitizeCsvCell 危险首字符前缀单引号、数字/普通文本直通、幂等。
 *  2. 装车证明(判据存在但没人调用 = 没有):developer-relay-usage-analytics.ts 的 esc
 *     与 edu-canteen.ts 的 csvEscape 必须经出口取数 —— 源面 grep,漂移即红。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sanitizeCsvCell } from '../src/utils/csv-utils.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')

describe('sanitizeCsvCell(api 面唯一出口)', () => {
  it("以 = 开头的单元格导出后带前缀(票面点名)'=SUM(A1)", () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)")
  })
  it('以 + / @ 开头:前缀单引号', () => {
    expect(sanitizeCsvCell('+1+1')).toBe("'+1+1")
    expect(sanitizeCsvCell('@SUM(1,2)')).toBe("'@SUM(1,2)")
  })
  it('字符串以 - 开头:前缀单引号', () => {
    expect(sanitizeCsvCell('-2-3')).toBe("'-2-3")
  })
  it('幂等:已中和的值再中和一次不变', () => {
    const once = sanitizeCsvCell('=SUM(A1)')
    expect(sanitizeCsvCell(once)).toBe(once)
  })
  it('普通正文逐字不变;空串原样(空值归一发生在调用方,见下方装车证明)', () => {
    expect(sanitizeCsvCell('gpt-4o')).toBe('gpt-4o')
    // 出口的契约是 string-in(空值归一发生在调用方,由下面两条装车证明逐字核对)
    expect(sanitizeCsvCell('')).toBe('')
  })
})

describe('装车证明:两处独立 csvEscape/esc 必须经出口(G-815997)', () => {
  it('developer-relay-usage-analytics.ts 的 esc 先过 sanitizeCsvCell 再引号转义', () => {
    const src = readFileSync(join(SRC, 'routes', 'developer-relay-usage-analytics.ts'), 'utf8')
    expect(src).toMatch(/from '\.\.\/utils\/csv-utils\.js'/)
    expect(src).toMatch(/const s = sanitizeCsvCell\(/)
    // 空值归一发生在调用方,出口只收 string —— 逐字核对那一条三元式在位
    expect(src).toContain("sanitizeCsvCell(v === null || v === undefined ? '' : String(v))")
    // 引号转义仍在其后(顺序不得反:先中和后转义)
    expect(src.indexOf('sanitizeCsvCell(')).toBeLessThan(src.indexOf('replace(/"/g'))
  })

  it('edu-canteen.ts 的 csvEscape 先过 sanitizeCsvCell 再引号转义', () => {
    const src = readFileSync(join(SRC, 'routes', 'edu-canteen.ts'), 'utf8')
    expect(src).toMatch(/from '\.\.\/utils\/csv-utils\.js'/)
    expect(src).toMatch(/const s = sanitizeCsvCell\(/)
    expect(src).toContain("sanitizeCsvCell(v === null || v === undefined ? '' : String(v))")
    expect(src.indexOf('sanitizeCsvCell(')).toBeLessThan(src.indexOf('replace(/"/g'))
  })
})
