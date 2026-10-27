// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 社交登录两道闸的契约锁(2026-10-27 P0 修正配套)。
 *
 * 修的两条接管链:
 * ① 未验证邮箱自动关联 —— 攻击者在自己控制的 IdP 上把邮箱声明成受害者邮箱,首登即
 *    绑定进受害者账号并拿完整 token;现要求 IdP 出示 email_verified/verified 才许关联。
 * ② 社交登录绕过 2FA —— 已开 TOTP 的账号经 OIDC/Discord/Telegram 直接拿 token 对;
 *    现与三条密码/验证码路同一状态机,返回 5min challengeToken 走 /auth/2fa/login-verify。
 *
 * 成对夹具即变异自证:摘掉 emailVerified 判据 ⇒ 用例①翻红(binding 被真实创建);
 * 摘掉 twoFactorEnabled 判据 ⇒ 用例③翻红(gate 会被调用、响应里出现 accessToken)。
 * 判据本体从 routes/auth-extended.ts 的 __test__ 导出取用(§22c,不复制)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'test-cred-enc-key-32-chars-minimum-0k!'
})

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    findThirdPartyAccount: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createUser: vi.fn(),
    createThirdPartyBinding: vi.fn(),
  }
})

vi.mock('../src/db/oauth-queries.js', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    findThirdPartyAccount: vi.fn(),
    createThirdPartyBinding: vi.fn(),
  }
})

vi.mock('../src/routes/user/ip-whitelist-guard.js', () => ({
  gateLoginIpWhitelist: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, signChallengeToken: vi.fn().mockResolvedValue('challenge-token-test') }
})

import { __test__ } from '../src/routes/auth-extended.js'
// 注意:findUserByEmail/findUserById/createUser 在 db/queries.js,而
// findThirdPartyAccount/createThirdPartyBinding 的 auth-extended 消费源是
// db/oauth-queries.js(queries.js 里另有同名物)—— mock 必须落在消费的那个模块上,
// 否则判据永远吃不到你设的返回值。
import { findUserByEmail, findUserById, createUser } from '../src/db/queries.js'
import { findThirdPartyAccount, createThirdPartyBinding } from '../src/db/oauth-queries.js'
import { gateLoginIpWhitelist } from '../src/routes/user/ip-whitelist-guard.js'
import { signChallengeToken } from '../src/services/totp-service.js'

const VICTIM_EMAIL = 'victim@example.com'
const VICTIM_ID = 'victim-user-id'
const CALL = (extra: Record<string, unknown>) =>
  __test__.loginWithOAuthAccount({
    request: {} as never,
    reply: {} as never,
    platform: 'oidc',
    openId: 'attacker-oid',
    ...extra,
  } as never)

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks 会清掉 vi.mock factory 里预设的实现 ⇒ 每轮重设
  vi.mocked(signChallengeToken).mockResolvedValue('challenge-token-test')
  vi.mocked(createUser).mockResolvedValue({
    id: VICTIM_ID,
    status: 1,
    twoFactorEnabled: false,
    roleId: 0,
  } as never)
  vi.mocked(gateLoginIpWhitelist).mockResolvedValue({ allowed: false } as never)
})

describe('社交登录 · 未验证邮箱不得自动关联既有账号', () => {
  it('IdP 未确认邮箱归属(emailVerified=false)⇒ 拒绝关联,绑定零发生', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue(undefined as never)
    vi.mocked(findUserByEmail).mockResolvedValue({ id: VICTIM_ID, status: 1 } as never)
    const result = await CALL({ email: VICTIM_EMAIL, emailVerified: false })
    expect(result).toMatchObject({ emailUnverified: true })
    // 副作用没发生:绝不允许把攻击者的 openId 绑进受害者账号
    expect(vi.mocked(createThirdPartyBinding)).not.toHaveBeenCalled()
  })

  it('emailVerified 缺省按未验证处理(宁可错拒,不可静默接管)', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue(undefined as never)
    vi.mocked(findUserByEmail).mockResolvedValue({ id: VICTIM_ID, status: 1 } as never)
    const result = await CALL({ email: VICTIM_EMAIL })
    expect(result).toMatchObject({ emailUnverified: true })
    expect(vi.mocked(createThirdPartyBinding)).not.toHaveBeenCalled()
  })

  it('IdP 确认了归属(emailVerified=true)⇒ 正常关联并走到登录闸(正向对照)', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue(undefined as never)
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: VICTIM_ID,
      status: 1,
      twoFactorEnabled: false,
    } as never)
    const result = await CALL({ email: VICTIM_EMAIL, emailVerified: true })
    // 先证明确实走到了"同邮箱已注册"分支(而不是悄悄走了别的路)
    expect(vi.mocked(findUserByEmail)).toHaveBeenCalledWith(VICTIM_EMAIL)
    expect(vi.mocked(createThirdPartyBinding)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(gateLoginIpWhitelist)).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ blocked: true })
  })

  it('邮箱未注册 ⇒ 走新用户建号路径,不受验证位影响', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue(undefined as never)
    vi.mocked(findUserByEmail).mockResolvedValue(undefined as never)
    await CALL({ email: 'brand-new@example.com', emailVerified: false })
    expect(vi.mocked(createThirdPartyBinding)).toHaveBeenCalledTimes(1)
  })
})

describe('社交登录 · 已开 2FA 的账号必须过第二因子', () => {
  it('已绑定账号开启 TOTP ⇒ 返回 challengeToken,不签发任何可用凭据', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue({ userId: VICTIM_ID } as never)
    vi.mocked(findUserById).mockResolvedValue({
      id: VICTIM_ID,
      status: 1,
      twoFactorEnabled: true,
      roleId: 0,
    } as never)
    const result = await CALL({})
    expect(result).toMatchObject({
      twoFactorRequired: true,
      challengeToken: 'challenge-token-test',
    })
    expect(vi.mocked(signChallengeToken)).toHaveBeenCalledTimes(1)
    // 副作用没发生:连登录闸都没走到 —— 挑战先于一切凭据签发
    expect(vi.mocked(gateLoginIpWhitelist)).not.toHaveBeenCalled()
    expect('accessToken' in (result as object)).toBe(false)
    expect('refreshToken' in (result as object)).toBe(false)
  })

  it('已绑定账号未开 TOTP ⇒ 不被 2FA 分支误拦,照常走到登录闸(正向对照)', async () => {
    vi.mocked(findThirdPartyAccount).mockResolvedValue({ userId: VICTIM_ID } as never)
    vi.mocked(findUserById).mockResolvedValue({
      id: VICTIM_ID,
      status: 1,
      twoFactorEnabled: false,
      roleId: 0,
    } as never)
    const result = await CALL({})
    expect(vi.mocked(gateLoginIpWhitelist)).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ blocked: true })
    expect('twoFactorRequired' in (result as object)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
