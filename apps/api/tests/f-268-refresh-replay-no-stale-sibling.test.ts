// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-268 回归锁(2026-11-08)。
 *
 * 病灶:refresh token 被吊销超过 30s 后,只要「同族还有活 token」就按 stale-sibling
 *       放行轮转。攻击者拿到一次旧 refresh token 即可首次重放换到新的活 sibling,
 *       之后永远命中不到 reuse —— 一次凭据泄露被洗成无限续命的合法会话。
 * 判据:超出宽限期一律 reuse(吊销整族);仅 30s 内的并发竞态走 race。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findLiveFamilyToken: vi.fn(async () => ({ id: 'live-sibling' })),
  }
})

import { assessRefreshReplay } from '../src/services/refresh-replay-policy.js'

const REVOKED_AT = new Date('2026-11-08T00:00:00.000Z')
const FAMILY = 'family-1'

describe('F-268 refresh 重放裁决只保留 race / reuse', () => {
  it('吊销 5s 内的重放 → race(并发竞态放行)', async () => {
    const r = await assessRefreshReplay(REVOKED_AT, FAMILY, REVOKED_AT.getTime() + 5_000)
    expect(r.verdict).toBe('race')
    expect(r.revokedAgeMs).toBe(5_000)
  })

  it('吊销 60s 后即使同族有活 token → reuse(旧的 stale-sibling 放行档已删除)', async () => {
    const r = await assessRefreshReplay(REVOKED_AT, FAMILY, REVOKED_AT.getTime() + 60_000)
    expect(r.verdict).toBe('reuse')
  })

  it('吊销 60s 后无 familyId → reuse', async () => {
    const r = await assessRefreshReplay(REVOKED_AT, undefined, REVOKED_AT.getTime() + 60_000)
    expect(r.verdict).toBe('reuse')
  })

  it('恰好 30s 边界 → reuse(宽限期不包含等于)', async () => {
    const r = await assessRefreshReplay(REVOKED_AT, FAMILY, REVOKED_AT.getTime() + 30_000)
    expect(r.verdict).toBe('reuse')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
