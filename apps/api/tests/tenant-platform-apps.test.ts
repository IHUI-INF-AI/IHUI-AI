// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('@ihui/database', () => ({ tenantPlatformApps: {} }))
vi.mock('../src/config/index.js', () => ({
  config: { PLATFORM_DEFAULT_TENANT_ID: '11111111-1111-1111-1111-111111111111' },
}))
vi.mock('../src/utils/crypto.js', () => ({
  encryptCredential: (plain: string) => (plain ? `enc:v1:${plain}` : ''),
  decryptCredential: (stored: string) => stored.replace(/^enc:v1:/, ''),
}))

import {
  buildTenantPlatformStatuses,
  canImportPlatformEnv,
  canUsePlatformEnv,
  envPlatformCredentials,
  importEnvPlatformCredentials,
  TENANT_PLATFORM_IDS,
} from '../src/services/tenant-platform-apps.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('租户平台应用凭据：环境凭据映射', () => {
  it('钉钉沿用项目里已有的 DINGTALK_APP_KEY/SECRET 键', () => {
    vi.stubEnv('DINGTALK_APP_KEY', 'ding-test-key')
    vi.stubEnv('DINGTALK_APP_SECRET', 'ding-test-secret')
    expect(envPlatformCredentials('dingtalk')).toMatchObject({
      appId: 'ding-test-key',
      appSecret: 'ding-test-secret',
    })
  })

  it('企微把 corpId 当 appId、agentId 放 extra', () => {
    vi.stubEnv('WECOM_CORP_ID', 'ww-test-corp')
    vi.stubEnv('WECOM_SECRET', 'wecom-test-secret')
    vi.stubEnv('WECOM_AGENT_ID', '1000002')
    expect(envPlatformCredentials('wecom')).toMatchObject({
      appId: 'ww-test-corp',
      appSecret: 'wecom-test-secret',
      extra: { agent_id: '1000002' },
    })
  })

  it('公众号服务号使用独立的 WECHAT_MP_* 键，不混用网站扫码应用', () => {
    vi.stubEnv('WECHAT_APP_ID', 'wx-web-app')
    vi.stubEnv('WECHAT_MP_APP_ID', 'wx-mp-app')
    vi.stubEnv('WECHAT_MP_APP_SECRET', 'mp-secret')
    expect(envPlatformCredentials('wechat_mp')).toMatchObject({
      appId: 'wx-mp-app',
      appSecret: 'mp-secret',
    })
  })
})

describe('租户平台应用凭据：环境回退边界', () => {
  it('没有租户上下文（单租户/主域）可回退环境凭据', () => {
    expect(canUsePlatformEnv(null)).toBe(true)
    expect(canUsePlatformEnv(undefined)).toBe(true)
  })

  it('显式默认租户可使用环境凭据，其他租户一律不可', () => {
    expect(canUsePlatformEnv('11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(canUsePlatformEnv('22222222-2222-2222-2222-222222222222')).toBe(false)
  })

  it('非默认租户导入环境凭据在服务层就被拒绝，不依赖路由闸', async () => {
    expect(canImportPlatformEnv('11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(canImportPlatformEnv('22222222-2222-2222-2222-222222222222')).toBe(false)
    await expect(
      importEnvPlatformCredentials({
        tenantId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toMatchObject({ code: 'ENV_SCOPE_FORBIDDEN' })
  })
})

describe('租户平台应用凭据：状态表不含 secret', () => {
  it('租户行只回掩码，不把密文/明文 secret 漏进状态', () => {
    const statuses = buildTenantPlatformStatuses(
      [
        {
          platform: 'feishu',
          enabled: true,
          appId: 'cli_tenant_a',
          appSecret: 'enc:v1:very-secret',
          extra: { redirect_uri: 'https://a.example.com/callback' },
        },
      ],
      false,
    )
    const feishu = statuses.find((s) => s.platform === 'feishu')!
    expect(feishu).toMatchObject({
      configured: true,
      enabled: true,
      appId: 'cli_tenant_a',
      source: 'tenant',
    })
    expect(feishu.appSecretMasked).toBe('••••••')
    expect(JSON.stringify(statuses)).not.toContain('very-secret')
  })

  it('租户行 enabled=false 时显示已配置但停用，且不回退环境凭据', () => {
    vi.stubEnv('WECHAT_MP_APP_ID', 'wx-env-should-not-leak')
    vi.stubEnv('WECHAT_MP_APP_SECRET', 'env-secret-should-not-leak')
    const statuses = buildTenantPlatformStatuses(
      [
        {
          platform: 'wechat_mp',
          enabled: false,
          appId: 'wxcfed1973106a1b31',
          appSecret: 'enc:v1:tenant-secret',
          extra: {},
        },
      ],
      true,
    )
    const mp = statuses.find((s) => s.platform === 'wechat_mp')!
    expect(mp).toMatchObject({
      configured: true,
      enabled: false,
      appId: 'wxcfed1973106a1b31',
      source: 'tenant',
    })
    expect(JSON.stringify(statuses)).not.toContain('env-secret-should-not-leak')
    expect(JSON.stringify(statuses)).not.toContain('tenant-secret')
  })

  it('其他租户没有自己的行时，不会把平台环境凭据显示成可用', () => {
    vi.stubEnv('FEISHU_APP_ID', 'cli_platform_env')
    vi.stubEnv('FEISHU_APP_SECRET', 'platform-secret')
    const statuses = buildTenantPlatformStatuses([], false)
    const feishu = statuses.find((s) => s.platform === 'feishu')!
    expect(feishu).toMatchObject({ configured: false, enabled: false, source: 'none' })
    expect(feishu.appId).toBe('')
  })

  it('允许回退时，环境凭据以 platform_env 来源展示完整平台列表', () => {
    vi.stubEnv('FEISHU_APP_ID', 'cli_platform_env')
    vi.stubEnv('FEISHU_APP_SECRET', 'platform-secret')
    const statuses = buildTenantPlatformStatuses([], true)
    expect(statuses).toHaveLength(TENANT_PLATFORM_IDS.length)
    const feishu = statuses.find((s) => s.platform === 'feishu')!
    expect(feishu).toMatchObject({
      configured: true,
      enabled: true,
      appId: 'cli_platform_env',
      source: 'platform_env',
    })
    expect(JSON.stringify(statuses)).not.toContain('platform-secret')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
