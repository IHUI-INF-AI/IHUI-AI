// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-579 回归锁(2026-11-13)。
 *
 * 病灶:routes/edu-canteen.ts 的 todayStr() 用 toISOString().slice(0,10) 取 UTC 日,
 * 上海 00:00–08:00 上传的验收单在 AI 未返回 receiptDate 时落到前一天,
 * 采购台账日/月汇总与供应商对账整体前移一天。
 *
 * 不连 DB/网络:日键纯函数边界 + 源码形状断言。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bizDayKey } from '../src/utils/biz-day.js'

describe('上海业务日边界', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('UTC 18:30(上海次日 02:30)取次日上海日', () => {
    expect(bizDayKey(new Date('2026-11-12T18:30:00.000Z'))).toBe('2026-11-13')
  })

  it('UTC 03:00(上海 11:00)取当天上海日', () => {
    expect(bizDayKey(new Date('2026-11-13T03:00:00.000Z'))).toBe('2026-11-13')
  })

  it('默认参数按当前时刻取上海日', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T18:30:00.000Z'))
    expect(bizDayKey()).toBe('2026-11-13')
  })
})

describe('edu-canteen 源码形状', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/routes/edu-canteen.ts', import.meta.url)),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('todayStr 复用 bizDayKey(),不再用 UTC 日键', () => {
    expect(code).not.toMatch(/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
    expect(source).toMatch(/import\s*\{\s*bizDayKey\s*\}\s*from\s*'\.\.\/utils\/biz-day\.js'/)
    expect(code).toMatch(/function todayStr\(\): string \{\s*return bizDayKey\(\)/)
  })

  it('AI 返回 receiptDate 时优先使用返回值,仅缺失时兜底 todayStr()', () => {
    expect(code).toMatch(/procurementDate:\s*final\.receiptDate\s*\|\|\s*todayStr\(\)/)
  })
})
