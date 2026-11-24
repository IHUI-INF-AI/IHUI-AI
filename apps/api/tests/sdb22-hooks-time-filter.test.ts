// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-22:Hook 日志时间过滤的判据回归测试(2026-11-11 立)。
 *
 * 旧实现用 `String(log.triggeredAt) < filter.since` 做字典序比较:
 *  - ai-service 写入形如 `...T12:00:00.123456Z`,带毫秒时 `'.'(46) < 'Z'(90)`,
 *    同一秒内的日志被误判成「更早」而过滤掉;
 *  - 边界带 `+08:00` 偏移时,`'1'(49) < '2'(50)` 之类的前缀差异会让窗口几乎全空。
 * 这里钉住 Date.parse 数值判据:同秒带毫秒、带偏移、边界相等、非法串四个方向。
 *
 * 测试模式:mock 掉 ai-service fetch,只验证 api 层兜底过滤(listHookLogs 的调用面)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
}))

import { listHookLogs } from '../src/services/hooks-service.js'

/** 让 ai-service 返回给定日志集合(其余字段与真实响应同形)。 */
function stubLogs(logs: Array<Record<string, unknown>>): void {
  mockAiServiceFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ code: 0, message: 'ok', data: { logs, count: logs.length } }),
  })
}

/** 取返回日志的 id 列表,便于断言窗口内到底剩了哪几条。 */
async function queryIds(filter: Parameters<typeof listHookLogs>[3]): Promise<string[]> {
  const data = await listHookLogs(null, 'hook-1', 100, filter)
  return data.logs.map((log) => (log as { id: string }).id)
}

describe('SDB-22 Hook 日志时间窗口判据', () => {
  beforeEach(() => {
    mockAiServiceFetch.mockReset()
  })

  it('同秒带毫秒不再被误判为更早', async () => {
    stubLogs([
      { id: 'same-second-ms', triggeredAt: '2026-11-11T12:00:00.123456Z' },
      { id: 'next-second', triggeredAt: '2026-11-11T12:00:01.000000Z' },
      { id: 'prev-second', triggeredAt: '2026-11-11T11:59:59.999999Z' },
    ])

    await expect(queryIds({ since: '2026-11-11T12:00:00Z' })).resolves.toEqual([
      'same-second-ms',
      'next-second',
    ])
  })

  it('带 +08:00 偏移的边界能正确落窗', async () => {
    stubLogs([
      // 11:59:00Z = 19:59:00+08:00,恰好等于 since
      { id: 'at-since', triggeredAt: '2026-11-11T11:59:00.000Z' },
      { id: 'inside-utc', triggeredAt: '2026-11-11T12:00:00.500Z' },
      { id: 'inside-offset', triggeredAt: '2026-11-11T20:00:30+08:00' },
      // 12:01:00.001Z 越过 until(20:01:00+08:00)
      { id: 'after-until', triggeredAt: '2026-11-11T12:01:00.001Z' },
    ])

    await expect(
      queryIds({
        since: '2026-11-11T19:59:00+08:00',
        until: '2026-11-11T20:01:00+08:00',
      }),
    ).resolves.toEqual(['at-since', 'inside-utc', 'inside-offset'])
  })

  it('非法时间串按不匹配处理(fail-closed),不影响其它过滤条件', async () => {
    stubLogs([
      { id: 'valid', triggeredAt: '2026-11-11T12:00:00Z' },
      { id: 'dirty', triggeredAt: 'not-a-date' },
      { id: 'missing', triggeredAt: null },
    ])

    // 日志侧不可解析 ⇒ 剔除该条,其余照常
    await expect(queryIds({ since: '2026-11-11T11:00:00Z' })).resolves.toEqual(['valid'])
    // 边界本身不可解析 ⇒ 判据不成立,整批剔除,绝不悄悄退化成「不过滤」
    await expect(queryIds({ since: 'boom' })).resolves.toEqual([])
    await expect(queryIds({ until: 'boom' })).resolves.toEqual([])
    // 未传时间边界时不解析 triggeredAt,脏数据不因缺字段被误伤
    await expect(queryIds({ event: undefined })).resolves.toEqual(['valid', 'dirty', 'missing'])
  })

  it('边界恰好相等时视为落窗(闭区间)', async () => {
    stubLogs([
      { id: 'one-ms-before', triggeredAt: '2026-11-11T11:59:59.999Z' },
      { id: 'equal-since', triggeredAt: '2026-11-11T12:00:00.000Z' },
      { id: 'equal-until', triggeredAt: '2026-11-11T12:05:00.000Z' },
      { id: 'one-ms-after', triggeredAt: '2026-11-11T12:05:00.001Z' },
    ])

    await expect(
      queryIds({ since: '2026-11-11T12:00:00.000Z', until: '2026-11-11T12:05:00.000Z' }),
    ).resolves.toEqual(['equal-since', 'equal-until'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
