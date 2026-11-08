// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-45 夹具（纯静态，读路由/服务源码文本）。
 *
 * 缺陷：GET /relay/channels 对每个 key_pool 各查一次当日 + 一次当月，
 * N 个渠道 = 2N 次往返。
 * 判据：路由改调批量聚合（一次 groupBy），不再按行并发查询。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROUTE_SRC = readFileSync(join(HERE, '..', '..', 'routes', 'admin', 'channel-quota.ts'), 'utf8')
const SERVICE_SRC = readFileSync(join(HERE, '..', 'channel-quota-service.ts'), 'utf8')

describe('DB-45 渠道用量批量聚合', () => {
  it('路由不再逐渠道并发查询', () => {
    expect(ROUTE_SRC).not.toContain('Promise.all(rows.map')
    expect(ROUTE_SRC).toContain('getUsageSummaries(')
  })

  it('服务提供一次聚合的批量查询', () => {
    expect(SERVICE_SRC).toContain('export async function getUsageSummaries(')
    expect(SERVICE_SRC).toContain('inArray(aiRelayChannelDailyUsage.keyPoolId')
    expect(SERVICE_SRC).toContain('.groupBy(aiRelayChannelDailyUsage.keyPoolId)')
  })
})
