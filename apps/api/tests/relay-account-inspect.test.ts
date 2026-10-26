// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号体检速查脚本(relay-account-inspect)纯函数单测(2026-10-26 立)。
 * 零 IO / 零 DB / 零网络:只测「凭据 → 人话结论」的投影判据;CLI 参数面由脚本自身把。
 * 立测点:①四种到期形态必须给出四种不同下一步(把「能不能用」压成一格就是没做);
 * ②信封凭据必须如实标「仅同机可解」,不得冒判 usable/过期;③输出永不回显凭据明文。
 */
import { describe, it, expect } from 'vitest'

import {
  formatVerdicts,
  inspectAccountExport,
  inspectDesktopAuthFile,
  inspectEntry,
  remainingDays,
} from '../scripts/relay-account-inspect.js'

const NOW = Date.parse('2026-10-26T00:00:00.000Z')

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}
const DAY = 86_400_000
const IN_30D = Math.floor((NOW + 30 * DAY) / 1000)
const IN_6H = Math.floor((NOW + 6 * 3600 * 1000) / 1000)
const D_5 = Math.floor((NOW - 5 * DAY) / 1000)

describe('inspectEntry:四种形态四条下一步', () => {
  it('JWT 远期 + 有 refreshToken ⇒ usable,指明「无需处理,调度自动续」', () => {
    const v = inspectEntry(
      { name: '甲', token: jwt({ sub: 'u-a', exp: IN_30D }), refreshToken: 'r' },
      'workbuddy',
      NOW,
    )
    expect(v.verdict).toBe('usable')
    expect(v.canSelfRenew).toBe(true)
    expect(v.tokenRemainingDays).toBeCloseTo(30, 0)
    expect(v.nextAction).toContain('保活')
  })

  it('1 天内到期 ⇒ expiring-soon(哪怕带 rt 也不冒充「无需处理」)', () => {
    const v = inspectEntry(
      { token: jwt({ sub: 'u-b', exp: IN_6H }), refreshToken: 'r' },
      'workbuddy',
      NOW,
    )
    expect(v.verdict).toBe('expiring-soon')
  })

  it('已过期 + 带 rt ⇒ expired-renewable;不带 rt ⇒ expired-dead(两条出路天差地别)', () => {
    const alive = inspectEntry(
      { token: jwt({ sub: 'u-c', exp: D_5 }), refreshToken: 'r' },
      'workbuddy',
      NOW,
    )
    expect(alive.verdict).toBe('expired-renewable')
    expect(alive.nextAction).toContain('refreshToken')
    const dead = inspectEntry({ token: jwt({ sub: 'u-d', exp: D_5 }) }, 'workbuddy', NOW)
    expect(dead.verdict).toBe('expired-dead')
    expect(dead.nextAction).toContain('只能重新登录')
  })

  it('WorkBuddy 5.6 加密信封 ⇒ envelope-only,既不报能用也不报过期', () => {
    const v = inspectEntry(
      {
        token: { $wbEncrypted: 1, envelope: 'opaque' },
        refreshToken: { $wbEncrypted: 1, envelope: 'x' },
        uid: 'u-env',
      },
      'workbuddy',
      NOW,
    )
    expect(v.verdict).toBe('envelope-only')
    expect(v.canSelfRenew).toBe(false)
    expect(v.tokenRemainingDays).toBeNull()
    expect(v.nextAction).toContain('同机')
  })

  it('opaque 单段票 + 秒制 expires_at ⇒ 认秒不放大(量纲判据与导入共用)', () => {
    const v = inspectEntry(
      { token: 'dt-abc', expiresAt: Math.floor((NOW + 2 * DAY) / 1000) },
      'trae',
      NOW,
    )
    expect(v.verdict).toBe('usable')
    expect(v.tokenRemainingDays).toBeCloseTo(2, 0)
  })

  it('外来格式字段(access_token/expires_at 毫秒/uid)直接读出,并带 foreignShape 标记', () => {
    const v = inspectEntry(
      {
        access_token: jwt({ sub: 'u-key', exp: IN_30D }),
        refresh_token: 'rt-k',
        nickname: '192****0269',
        uid: 'u-key',
        expires_at: NOW + 30 * DAY,
      },
      'workbuddy',
      NOW,
    )
    expect(v.foreignShape).toBe(true)
    expect(v.uid).toBe('u-key')
    expect(v.label).toBe('192****0269')
    expect(v.verdict).toBe('usable')
  })

  it('取不到到期 ≠ 已过期(§0.3 不得冒判)', () => {
    const v = inspectEntry({ token: 'not-a-jwt' }, 'trae', NOW)
    expect(v.verdict).toBe('indeterminate')
    expect(v.tokenRemainingDays).toBeNull()
  })
})

describe('inspectAccountExport / inspectDesktopAuthFile:整份形状', () => {
  it('裸数组与 {accounts:[…]} 两种顶层形状都吃', () => {
    const rows = [
      { token: jwt({ sub: 'u-1', exp: IN_30D }) },
      { token: jwt({ sub: 'u-2', exp: D_5 }) },
    ]
    expect(inspectAccountExport(JSON.stringify(rows), 'workbuddy', NOW).map((r) => r.uid)).toEqual([
      'u-1',
      'u-2',
    ])
    const wrapped = inspectAccountExport(JSON.stringify({ accounts: rows }), 'workbuddy', NOW)
    expect(wrapped[1].verdict).toBe('expired-dead')
  })

  it('本机认证文件:当前号出结论,allAccounts 里其他号如实标「不带凭据」', () => {
    const doc = {
      auth: {
        accessToken: jwt({ sub: 'u-cur', exp: IN_30D }),
        refreshToken: 'r',
        tokenType: 'Bearer',
        domain: 'www.workbuddy.cn',
      },
      account: { uid: 'u-cur', nickname: '李总' },
      allAccounts: [
        { uid: 'u-cur', nickname: '李总' },
        { uid: 'u-other', nickname: '另一号' },
      ],
    }
    const rows = inspectDesktopAuthFile(JSON.stringify(doc), 'workbuddy', NOW)
    expect(rows[0].uid).toBe('u-cur')
    expect(rows[0].verdict).toBe('usable')
    expect(rows[1]).toMatchObject({ uid: 'u-other', verdict: 'indeterminate' })
    expect(rows[1].nextAction).toContain('切到它')
  })

  it('本机信封态(认证文件里 accessToken 是密文信封)⇒ envelope-only,不冒判过期', () => {
    const doc = {
      auth: {
        accessToken: { $wbEncrypted: 1, envelope: 'e' },
        refreshToken: { $wbEncrypted: 1, envelope: 'f' },
      },
      account: { uid: 'u-env', nickname: { $wbEncrypted: 1, envelope: 'g' } },
    }
    const rows = inspectDesktopAuthFile(JSON.stringify(doc), 'workbuddy', NOW)
    expect(rows[0].verdict).toBe('envelope-only')
  })
})

describe('formatVerdicts / remainingDays:展示面安全', () => {
  it('任意含凭据的输入,人话表里都搜不到凭据子串', () => {
    const secret = 'SECRETTOKEN-abcdef-9f8e7d'
    const rows = [
      inspectEntry(
        { token: jwt({ sub: secret, exp: IN_30D }), refreshToken: secret },
        'workbuddy',
        NOW,
      ),
    ]
    const out = formatVerdicts(rows, 'accounts.json')
    expect(out).not.toContain(secret)
    expect(out).toContain('uid=')
    expect(out).toContain('结论:')
  })

  it('remainingDays:未来正/过去负/未知 null(±1 位小数)', () => {
    expect(remainingDays(NOW + 1.25 * DAY, NOW)).toBe(1.3)
    expect(remainingDays(NOW - 1000, NOW)).toBe(-0)
    expect(remainingDays(null, NOW)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
