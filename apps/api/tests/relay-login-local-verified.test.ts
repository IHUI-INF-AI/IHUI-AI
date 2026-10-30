// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-login-local-verified 镜像测试(§22c:判据 import 源 __test__,不复制)。
 * 全注入:loadRow/writeBack/snapshot/compare 四腿全假件 —— 零真库、零真写本机客户端。
 */
import { describe, expect, it, vi } from 'vitest'

// 静态 import 链上 db/index.ts 顶层做 env schema 校验 ⇒ 先注入 fake env(与
// relay-account-pool-login-local.test.ts 同款;注入面保证测试永不连真库)
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'test-credentials-encryption-key-32-bytes!'
})

import { __test__ } from '../scripts/relay-login-local-verified.js'
import type { VerifiedSwitchResult } from '../scripts/relay-login-local-verified.js'

const { CONTINUITY_FACE, runVerifiedSwitch } = __test__

const FAKE_ROW = { id: 'pool-x', uid: 'auto:testuid', providerCode: 'minimax' } as never

const snapOk = (n: number) => ({
  app: 'minimax',
  label: 'MiniMax Code',
  state: 'ok' as const,
  dbFile: 'X:\\fake.sqlite',
  walMerged: true,
  takenAt: new Date().toISOString(),
  sessions: { count: n, digest: 'd'.repeat(16) },
  messageRows: { count: n * 10, digest: 'e'.repeat(16) },
  sessionsWithMessages: n,
  accountDigests: [],
  sessionIds: Array.from({ length: n }, (_, i) => `fp${i}`),
})

const fakeCompare =
  (lost: number) => (before: { sessionIds: string[] }, after: { sessionIds: string[] }) => ({
    verdict: lost > 0 ? 'continuity-broken' : 'continuity-ok',
    beforeSessions: before.sessionIds.length,
    afterSessions: after.sessionIds.length,
    lostFp: before.sessionIds.slice(0, lost),
    gainedFp: [],
    messageRowsBefore: 100,
    messageRowsAfter: 100,
    note: 'fake',
  })

describe('runVerifiedSwitch(全注入,零真库零真写)', () => {
  it('dry-run:拍 before、不写回、verdict=not-run', async () => {
    const written: unknown[] = []
    const r = await runVerifiedSwitch({
      provider: 'minimax',
      dryRun: true,
      loadRow: async () => FAKE_ROW,
      writeBack: async (row) => {
        written.push(row)
        throw new Error('dry-run 不得写回')
      },
      snapshot: () => snapOk(3),
      compare: fakeCompare(0),
    })
    expect(written).toHaveLength(0)
    expect(r.verdict).toBe('not-run')
    expect(r.dryRun).toBe(true)
    expect(r.before?.sessions.count).toBe(3)
    expect(r.after).toBeNull()
  })

  it('有对账面且 compare ok ⇒ continuity-ok 且真调写回腿', async () => {
    let called = 0
    const r: VerifiedSwitchResult = await runVerifiedSwitch({
      provider: 'minimax',
      loadRow: async () => FAKE_ROW,
      writeBack: async () => {
        called++
        return {
          ok: true,
          notes: [],
          targetFile: 'X:\\auth.json',
          backupFile: 'X:\\auth.bak',
        } as never
      },
      snapshot: () => snapOk(61),
      compare: fakeCompare(0),
    })
    expect(called).toBe(1)
    expect(r.verdict).toBe('continuity-ok')
    expect(r.wroteBack).toBe(true)
    expect(r.ok).toBe(true)
  })

  it('compare broken ⇒ verdict=continuity-broken、ok=false(切号真丢会话必须显性失败)', async () => {
    const r = await runVerifiedSwitch({
      provider: 'qoder',
      loadRow: async () => FAKE_ROW,
      writeBack: async () => ({ ok: true, notes: [], targetFile: 'X', backupFile: 'X' }) as never,
      snapshot: () => snapOk(5),
      compare: fakeCompare(1),
    })
    expect(r.verdict).toBe('continuity-broken')
    expect(r.ok).toBe(false)
  })

  it('无对账面(workbuddy,对话在云端)⇒ no-continuity-face、写回照常执行、不冒 continuity', async () => {
    let snapped = 0
    const r = await runVerifiedSwitch({
      provider: 'workbuddy',
      loadRow: async () => FAKE_ROW,
      writeBack: async () => ({ ok: true, notes: [], targetFile: 'X', backupFile: 'X' }) as never,
      snapshot: () => {
        snapped++
        return snapOk(0)
      },
      compare: fakeCompare(0),
    })
    expect(snapped).toBe(0)
    expect(r.continuityFace).toBe(false)
    expect(r.verdict).toBe('no-continuity-face')
    expect(r.wroteBack).toBe(true)
    expect(r.ok).toBe(true)
  })

  it('多票不点名 ⇒ loadRow 抛 AMBIGUOUS_UID(绝不猜票)', async () => {
    await expect(
      runVerifiedSwitch({
        provider: 'minimax',
        loadRow: async () => {
          throw Object.assign(new Error('池内有 2 枚 minimax 票且未点名 --uid(未判定,绝不猜)'), {
            code: 'AMBIGUOUS_UID',
          })
        },
      }),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_UID' })
  })
})

describe('CONTINUITY_FACE 映射(与 switch-continuity-check APPS 同源口径)', () => {
  it('本地正库五平台齐:qoder/minimax/codex/zcode/opencode', () => {
    for (const k of ['qoder', 'minimax', 'codex', 'zcode', 'opencode']) {
      expect(CONTINUITY_FACE[k]).toBe(k)
    }
  })
  it('云端对话/携对话自证/未装平台一律不映射(接了会冒充可对账)', () => {
    for (const k of ['workbuddy', 'codearts', 'loomy', 'doubao', 'trae', 'lingma', 'grokbot']) {
      expect(CONTINUITY_FACE[k]).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
