// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it, vi } from 'vitest'
import {
  AGENT_REGISTRY_CHANNEL,
  publishAgentRegistryChanged,
  snapshotVersionFromUpdatedAt,
} from '../agent-registry-invalidation.js'

function fakeServer(publish: () => Promise<number>) {
  return {
    redis: { publish: vi.fn(publish) },
    log: { warn: vi.fn() },
  } as unknown as Parameters<typeof publishAgentRegistryChanged>[0]
}

describe('agent-registry invalidation', () => {
  it('uses updatedAt milliseconds as snapshot version', () => {
    expect(snapshotVersionFromUpdatedAt('2026-11-28T10:00:00.000Z')).toBe(
      Date.parse('2026-11-28T10:00:00.000Z'),
    )
    expect(snapshotVersionFromUpdatedAt(new Date('2026-11-28T10:00:00.000Z'))).toBe(
      Date.parse('2026-11-28T10:00:00.000Z'),
    )
    expect(snapshotVersionFromUpdatedAt(undefined)).toBeGreaterThan(0)
  })

  it('publishes compact JSON to the agreed channel', async () => {
    const server = fakeServer(async () => 1)
    const ok = await publishAgentRegistryChanged(server, {
      version: 1732788000000,
      ids: ['def-1'],
      action: 'definition.updated',
    })

    expect(ok).toBe(true)
    expect(server.redis.publish).toHaveBeenCalledWith(
      AGENT_REGISTRY_CHANNEL,
      JSON.stringify({ version: 1732788000000, ids: ['def-1'], action: 'definition.updated' }),
    )
  })

  it('does not fail business write when Redis is down', async () => {
    const server = fakeServer(async () => {
      throw new Error('redis down')
    })
    const ok = await publishAgentRegistryChanged(server, {
      version: 1,
      ids: [],
      action: 'definition.created',
    })

    expect(ok).toBe(false)
    expect(server.log.warn).toHaveBeenCalled()
  })
})
