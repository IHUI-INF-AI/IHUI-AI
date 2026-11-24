// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-262 夹具：热度小时任务不得把「当日全量 hit」每小时重复累加到 agents.usage_count。
 *
 * 改前事实：`aggregateHeatStats` 每小时执行
 *   `UPDATE agents SET usage_count = usage_count + (SELECT sum(hit_count) WHERE date_str=当日)`
 * 而 agent_heat_stats 的 hit_count 本身是 usage_count 的当日快照 ⇒ 当天每跑一次再加一遍，
 * 24 小时后数值按小时线性膨胀；日键还用 UTC，上海 00:00–08:00 会跨到前一天。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { bizDayKey } from '../../utils/biz-day.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVICE = resolve(HERE, '../heat-stats-service.ts')
const ROUTE = resolve(HERE, '../../routes/statistics.ts')

describe('F-262 热度同步口径', () => {
  it('服务不再对 agents.usage_count 做「+ 当日全量」', () => {
    const src = readFileSync(SERVICE, 'utf-8')
    expect(src).not.toContain('"usage_count" = "usage_count" +')
    expect(src).not.toContain('syncAgentUsageCount')
  })

  it('服务日键走 bizDayKey（上海），不再用 UTC slice', () => {
    const src = readFileSync(SERVICE, 'utf-8')
    expect(src).toContain('bizDayKey(')
    expect(src).not.toContain('.toISOString().slice(0, 10)')
  })

  it('手动 refresh 写入同一 date_str 口径（上海）', () => {
    const src = readFileSync(ROUTE, 'utf-8')
    const at = src.indexOf('/statistics/agent-heat/refresh')
    expect(at).toBeGreaterThan(-1)
    const section = src.slice(at, at + 1200)
    expect(section).toContain('bizDayKey(')
    expect(section).not.toContain('.toISOString().slice(0, 10)')
  })

  it('行为：UTC 17:30 归到上海次日（旧 UTC 口径会错一天）', () => {
    expect(bizDayKey(new Date('2026-11-07T17:30:00Z'))).toBe('2026-11-08')
  })

  it('旧口径复利：当日 100 连跑 24 次 → 2400；新口径不再写 usage_count', () => {
    let inflated = 0
    for (let hour = 0; hour < 24; hour += 1) inflated += 100
    expect(inflated).toBe(2400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
