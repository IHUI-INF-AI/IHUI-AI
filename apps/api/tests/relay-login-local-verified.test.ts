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
import { encryptField } from '../src/utils/crypto.js'

const {
  CONTINUITY_FACE,
  TEMPLATE_FALLBACK_PROVIDERS,
  hasSessionTemplate,
  templateMissingNote,
  exitWith,
  runVerifiedSwitch,
  main,
} = __test__

const FAKE_ROW = { id: 'pool-x', uid: 'auto:testuid', providerCode: 'minimax' } as never

/** 真库票形(secretsEnc 用真加密器造):证明默认判据走「解密 secrets」这一面,不是猜形状 */
const rowWithSecrets = (providerCode: string, secrets: Record<string, unknown>) =>
  ({
    id: 'pool-x',
    uid: 'auto:testuid',
    providerCode,
    tokenEnc: encryptField('tok'),
    secretsEnc: encryptField(JSON.stringify(secrets)),
  }) as never

/** 等 main() 里那条 promise 链落地(它本身同步返回 0) */
const tick = () => new Promise((r) => setImmediate(r))

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

  it('无对账面(豆包,对话是云端回包缓存)⇒ no-continuity-face、写回照常执行、不冒 continuity', async () => {
    let snapped = 0
    const r = await runVerifiedSwitch({
      provider: 'doubao',
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
  it('本地正库八平台齐:qoder/minimax/codex/zcode/opencode + workbuddy/codearts/loomy(2026-10-31 取证推翻旧口径)', () => {
    for (const k of [
      'qoder',
      'minimax',
      'codex',
      'zcode',
      'opencode',
      'workbuddy',
      'codearts',
      'loomy',
    ]) {
      expect(CONTINUITY_FACE[k]).toBe(k)
    }
  })
  it('云端缓存/携对话自证/未装平台一律不映射(接了会冒充可对账)', () => {
    for (const k of ['doubao', 'trae', 'lingma', 'grokbot']) {
      expect(CONTINUITY_FACE[k]).toBeUndefined()
    }
  })
})

describe('会话模板缺失告警(切号产出面必须可见,但绝不拦写回)', () => {
  const fakeWrite = async () =>
    ({ ok: true, notes: [], targetFile: 'X:\\auth.v1.dat', backupFile: 'X:\\auth.bak' }) as never

  it('默认判据读 secretsEnc 解密后的 sessionTemplate(形状猜不出模板)', () => {
    expect(hasSessionTemplate(rowWithSecrets('qoder', { sessionTemplate: { userId: 'u1' } }))).toBe(
      true,
    )
    expect(hasSessionTemplate(rowWithSecrets('qoder', { sessionTemplate: {} }))).toBe(false)
    expect(hasSessionTemplate(rowWithSecrets('qoder', { recordKey: 'k' }))).toBe(false)
    // 无 secretsEnc / 加密面坏 ⇒ 按缺失(失效方向 = 多提示一次,不是漏提示)
    expect(hasSessionTemplate(FAKE_ROW)).toBe(false)
  })

  it('兜底平台清单 = local-login.mjs 里 `template ?? current/prev/row.session` 那四家', () => {
    for (const k of ['qoder', 'codearts', 'minimax', 'opencode']) {
      expect(TEMPLATE_FALLBACK_PROVIDERS.has(k)).toBe(true)
    }
    // workbuddy 无模板且跨号时显式 409;codex 无账号资料面;doubao 认 cookies、loomy 只建值
    for (const k of ['workbuddy', 'codex', 'doubao', 'loomy', 'zcode']) {
      expect(TEMPLATE_FALLBACK_PROVIDERS.has(k)).toBe(false)
    }
  })

  it('qoder 票无模板 ⇒ notes 带模板缺失告警(且文案点名重新导入出口)', async () => {
    const r = await runVerifiedSwitch({
      provider: 'qoder',
      loadRow: async () => rowWithSecrets('qoder', { recordKey: 'k' }),
      writeBack: fakeWrite,
      snapshot: () => snapOk(3),
      compare: fakeCompare(0),
    })
    const note = r.notes.find((n) => n.includes('模板缺失'))
    expect(note).toBeDefined()
    expect(note).toContain('仍沿用旧号')
    expect(note).toContain('relay-account-pool.mjs --from qoder')
    // 只告警不拦写回:凭证写回本身有效
    expect(r.wroteBack).toBe(true)
    expect(r.verdict).toBe('continuity-ok')
  })

  it('模板在场 ⇒ 无该告警', async () => {
    const r = await runVerifiedSwitch({
      provider: 'qoder',
      loadRow: async () => rowWithSecrets('qoder', { sessionTemplate: { userId: 'auto:testuid' } }),
      writeBack: fakeWrite,
      snapshot: () => snapOk(3),
      compare: fakeCompare(0),
    })
    expect(r.notes.some((n) => n.includes('模板缺失'))).toBe(false)
  })

  it('注入 hasTemplate=false 同样告警(测试免真库的唯一入口)', async () => {
    const r = await runVerifiedSwitch({
      provider: 'minimax',
      loadRow: async () => FAKE_ROW,
      hasTemplate: () => false,
      writeBack: fakeWrite,
      snapshot: () => snapOk(1),
      compare: fakeCompare(0),
    })
    expect(r.notes.some((n) => n.includes('模板缺失'))).toBe(true)
  })

  it('非兜底平台(workbuddy)无模板不告警:那家在跨号时显式 409,不会静默沿用旧号', async () => {
    const r = await runVerifiedSwitch({
      provider: 'workbuddy',
      loadRow: async () => rowWithSecrets('workbuddy', {}),
      writeBack: fakeWrite,
      snapshot: () => snapOk(0),
      compare: fakeCompare(0),
    })
    expect(r.notes.some((n) => n.includes('模板缺失'))).toBe(false)
  })

  it('dry-run 也带告警(切之前就该知道,而不是切完才发现)', async () => {
    const r = await runVerifiedSwitch({
      provider: 'qoder',
      dryRun: true,
      loadRow: async () => rowWithSecrets('qoder', {}),
      snapshot: () => snapOk(3),
    })
    expect(r.dryRun).toBe(true)
    expect(r.notes.some((n) => n.includes('模板缺失'))).toBe(true)
  })

  it('告警文案点名当前平台(不串号)', () => {
    expect(templateMissingNote('codearts')).toContain('--from codearts')
    expect(templateMissingNote('codearts')).not.toContain('--from qoder')
  })
})

describe('CLI 退出路径(失败必须显式 exit,只设 exitCode 会被 pg 句柄挂住)', () => {
  const fakeResult = (verdict: VerifiedSwitchResult['verdict']): VerifiedSwitchResult => ({
    ok: verdict !== 'continuity-broken',
    provider: 'minimax',
    uid: 'auto:testuid',
    dryRun: false,
    wroteBack: true,
    continuityFace: true,
    before: null,
    after: null,
    verdict,
    compare: null,
    writeBack: null,
    notes: [],
  })

  it('exitWith:先写 stderr(补换行)再按码退出', () => {
    const exit = vi.fn()
    const write: string[] = []
    exitWith(2, 'boom', { exit, write: (t) => write.push(t) })
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(2)
    expect(write.join('')).toBe('boom\n')
  })

  it('缺 --provider ⇒ 显式 exit(2) 并打用法', () => {
    const exit = vi.fn()
    const write: string[] = []
    expect(main([], { exit, write: (t) => write.push(t) })).toBe(2)
    expect(exit).toHaveBeenCalledWith(2)
    expect(write.join('')).toContain('用法')
  })

  it('切号失败 ⇒ exit(2) 且 NODE 错误码先落 stderr(缺陷 1 回归锁:不许只设 exitCode)', async () => {
    const exit = vi.fn()
    const write: string[] = []
    main(['--provider', 'minimax', '--uid', '__no_such_uid__'], {
      exit,
      write: (t) => write.push(t),
      log: () => {},
      run: () =>
        Promise.reject(
          Object.assign(new Error('池内无 uid=__no_such_uid__ 的 minimax 票(未判定)'), {
            code: 'NO_SUCH_UID',
          }),
        ),
    })
    await tick()
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(2)
    expect(write.join('')).toContain('未判定')
    expect(write.join('')).toContain('NO_SUCH_UID')
  })

  it('成功面:no-continuity-face ⇒ exit(0)、continuity-broken ⇒ exit(1)', async () => {
    const okExit = vi.fn()
    main(['--provider', 'minimax'], {
      exit: okExit,
      log: () => {},
      run: async () => fakeResult('no-continuity-face'),
    })
    await tick()
    expect(okExit).toHaveBeenCalledWith(0)

    const brokenExit = vi.fn()
    main(['--provider', 'minimax'], {
      exit: brokenExit,
      log: () => {},
      run: async () => fakeResult('continuity-broken'),
    })
    await tick()
    expect(brokenExit).toHaveBeenCalledWith(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
