// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax 会话回灌判据锁(2026-10-31 立,第四条腿)。
 * 复灌决策本身走 relay-trae-session-sync.ts 的 decideSync(单一判据源,已由其测试覆盖);
 * 本文件只钉 MiniMax 专属的四件事:身份匹配(uid/recordKey 两级)、自动入池条目形状、
 * 健康态恢复判据(只上行)、secrets 合并语义。不连库,不 spawn 真流程。
 */
import { describe, it, expect, vi } from 'vitest'

// 兜底 env:静态 import 链会走 config/crypto 的校验(setup-env.ts 已提供,这里再兜一层,
// 保证单文件直跑也不崩)。vi.hoisted 在 import 之前执行。
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:8810/ihui_test'
  process.env.JWT_SECRET ??= 'minimax-sync-test-jwt-secret-0123456789abcdef'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'minimax-sync-test-cred-key-0123456789abcd'
})

import { __test__ } from '../scripts/relay-minimax-session-sync.js'
import { __test__ as traeTest } from '../scripts/relay-trae-session-sync.js'

const {
  decideSync,
  parseArgs,
  tokenOf,
  expiryOf,
  recordKeyOfSecrets,
  recordKeyLabel,
  matchPoolRow,
  buildMinimaxAutoImportInput,
  revivePatchOf,
  buildSecretsPatch,
} = __test__

const RECORD_KEY =
  'com.minimax.mcode.oauth.prod.cn\u0000pn7olbPZk-liTDivJTlyUgyJxgtXvTojk5gKj6qHfMI'

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    uid: 'auto:aaaa',
    tokenPlain: 'old-access-token',
    tokenExpiresAt: new Date('2026-10-30T16:48:02.730Z'),
    refreshExpiresAt: null,
    secrets: { recordKey: RECORD_KEY, region: 'cn' },
    healthStatus: 'down',
    refreshFailureCount: 0,
    tempUnschedulable: false,
    ...over,
  } as Parameters<typeof matchPoolRow>[0][number]
}

describe('判据单源 · decideSync 必须是 Trae 那一个函数对象', () => {
  it('同一引用(复制一份判据就当场翻红)', () => {
    expect(decideSync).toBe(traeTest.decideSync)
  })
})

describe('凭据/到期取值', () => {
  it('accessToken 优先,token 是别名', () => {
    expect(tokenOf({ accessToken: ' a ' })).toBe('a')
    expect(tokenOf({ token: 'b' })).toBe('b')
    expect(tokenOf({ accessToken: '  ', token: 'b' })).toBe('b')
    expect(tokenOf({})).toBe('')
  })

  it('显式 ISO 优先于 expiresAtMs;非法值不猜', () => {
    const ms = Date.parse('2026-11-30T00:00:00.000Z')
    expect(
      expiryOf({ expiresAt: '2026-11-29T00:00:00.000Z', expiresAtMs: ms })?.toISOString(),
    ).toBe('2026-11-29T00:00:00.000Z')
    expect(expiryOf({ expiresAtMs: ms })?.toISOString()).toBe('2026-11-30T00:00:00.000Z')
    expect(expiryOf({ expiresAt: 'not-a-date' })).toBeNull()
    expect(expiryOf({})).toBeNull()
  })

  it('UID 不是凭据:recordKeyLabel 只回尾 8 位,不出整键', () => {
    expect(recordKeyLabel(RECORD_KEY)).toBe(`rk:…${RECORD_KEY.slice(-8)}`)
    expect(recordKeyLabel('')).toBe('(无 recordKey)')
    expect(recordKeyLabel(RECORD_KEY)).not.toContain('com.minimax.mcode')
  })
})

describe('身份匹配 · uid 优先,recordKey 兜底(token 轮换后 uid 会变)', () => {
  it('uid 精确命中', () => {
    const hit = matchPoolRow([row({ uid: 'auto:bbbb' }), row({ uid: 'auto:aaaa' })], {
      uid: 'auto:aaaa',
    })
    expect(hit?.uid).toBe('auto:aaaa')
  })

  it('uid 不在池内 ⇒ 按 secrets.recordKey 命中(轮换后仍认得出同一枚号)', () => {
    const hit = matchPoolRow([row()], { uid: 'auto:轮换后的新哈希', recordKey: RECORD_KEY })
    expect(hit?.id).toBe('row-1')
  })

  it('两级都不中 ⇒ null(调用方走自动入池)', () => {
    expect(
      matchPoolRow([row()], { recordKey: 'com.minimax.mcode.oauth.prod.global\u0000other' }),
    ).toBeNull()
    expect(matchPoolRow([], { recordKey: RECORD_KEY })).toBeNull()
  })

  it('secrets 解不出的行不参与 recordKey 匹配(不猜)', () => {
    expect(matchPoolRow([row({ secrets: null })], { recordKey: RECORD_KEY })).toBeNull()
    expect(recordKeyOfSecrets(null)).toBeNull()
    expect(recordKeyOfSecrets({ recordKey: '  ' })).toBeNull()
  })
})

describe('自动入池条目 · 与手动导入同一键位面', () => {
  it('只搬 token 面 + 溯源键,不给 uid/name(判据交服务端单源)', () => {
    const input = buildMinimaxAutoImportInput({
      accessToken: 'acc',
      refreshToken: 'rt',
      expiresAtMs: 1790000000000,
      region: 'cn',
      recordKey: RECORD_KEY,
      clientId: 'cid',
      audience: 'aud',
      tokenType: 'Bearer',
      loginEpoch: 'epoch-1',
      sourcePath: 'C:/Users/x/.minimax/auth/prod/cn/mcode-public/auth.json',
      scopes: ['a', ''],
    })
    expect(input).not.toBeNull()
    const keys = Object.keys(input ?? {}).sort()
    expect(keys).toEqual(
      [
        'accessToken',
        'audience',
        'clientId',
        'expiresAtMs',
        'loginEpoch',
        'recordKey',
        'refreshToken',
        'region',
        'scopes',
        'sourcePath',
        'tokenType',
      ].sort(),
    )
    // token/uid 刻意不出现:要么由 mapMinimaxImport 从 accessToken 派生,要么不猜
    expect('token' in (input ?? {})).toBe(false)
    expect('uid' in (input ?? {})).toBe(false)
    expect((input as Record<string, unknown>).scopes).toEqual(['a'])
  })

  it('缺 accessToken ⇒ null(不推空票)', () => {
    expect(buildMinimaxAutoImportInput({ refreshToken: 'rt' })).toBeNull()
  })

  it('空串/空白键一律不带(不拿脏值覆盖池内档)', () => {
    const input = buildMinimaxAutoImportInput({ accessToken: 'acc', region: '  ', recordKey: '' })
    expect(Object.keys(input ?? {})).toEqual(['accessToken'])
  })
})

describe('健康态恢复 · 只上行、要证据', () => {
  const now = new Date('2026-11-01T00:00:00.000Z')
  const future = new Date('2026-11-10T00:00:00.000Z')
  const past = new Date('2026-10-31T00:00:00.000Z')

  it('down + 未过期新票 ⇒ 放回 unknown 并清零失败面', () => {
    expect(
      revivePatchOf(
        { healthStatus: 'down', refreshFailureCount: 2, tempUnschedulable: true },
        future,
        now,
      ),
    ).toEqual({
      healthStatus: 'unknown',
      refreshFailureCount: 0,
      lastErrorMessage: null,
      tempUnschedulable: false,
    })
  })

  it('healthy 不动(不回退健康态,也不替 admin 解摘)', () => {
    expect(
      revivePatchOf(
        { healthStatus: 'healthy', refreshFailureCount: 0, tempUnschedulable: true },
        future,
        now,
      ),
    ).toBeNull()
  })

  it('票已过期 / 无到期 ⇒ 不恢复(过期票不是"账号活着"的证据)', () => {
    expect(
      revivePatchOf(
        { healthStatus: 'down', refreshFailureCount: 1, tempUnschedulable: false },
        past,
        now,
      ),
    ).toBeNull()
    expect(
      revivePatchOf(
        { healthStatus: 'down', refreshFailureCount: 1, tempUnschedulable: false },
        null,
        now,
      ),
    ).toBeNull()
  })

  it('unknown 且失败面干净 ⇒ 不写(不产生无意义写)', () => {
    expect(
      revivePatchOf(
        { healthStatus: 'unknown', refreshFailureCount: 0, tempUnschedulable: false },
        future,
        now,
      ),
    ).toBeNull()
  })

  it('unknown 但被临时摘除/有失败计数 ⇒ 也要救(与巡检刷新成功分支同形)', () => {
    expect(
      revivePatchOf(
        { healthStatus: 'unknown', refreshFailureCount: 3, tempUnschedulable: false },
        future,
        now,
      ),
    ).not.toBeNull()
  })
})

describe('secrets 合并 · 以既有为底,只覆盖本次提供的键', () => {
  it('无变化 ⇒ null', () => {
    expect(
      buildSecretsPatch(
        { region: 'cn', recordKey: RECORD_KEY },
        { region: 'cn', recordKey: RECORD_KEY },
      ),
    ).toBeNull()
  })

  it('新值合并进旧档,旧键一个不丢', () => {
    expect(
      buildSecretsPatch(
        { region: 'cn', recordKey: RECORD_KEY, audience: 'aud-old' },
        { region: 'global', scopes: ['s1'] },
      ),
    ).toEqual({ region: 'global', recordKey: RECORD_KEY, audience: 'aud-old', scopes: ['s1'] })
  })

  it('既有坏档(null)⇒ 以本次重建;空白值不入档', () => {
    expect(buildSecretsPatch(null, { region: '  ', clientId: 'cid' })).toEqual({ clientId: 'cid' })
    expect(buildSecretsPatch(null, {})).toBeNull()
  })
})

describe('CLI 参数面(未判定不猜)', () => {
  it('缺 --stdin ⇒ 报错(凭据必须走标准输入,不落盘)', () => {
    expect(parseArgs([]).error).toContain('--stdin')
  })

  it('未知参数 ⇒ 报错;--stdin/--dry-run/--json 合法', () => {
    expect(parseArgs(['--bogus']).error).toBe('未知参数: --bogus')
    const ok = parseArgs(['--stdin', '--dry-run', '--json'])
    expect(ok.error).toBeNull()
    expect(ok.dryRun).toBe(true)
    expect(ok.json).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
