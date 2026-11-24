// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  __test__,
  applyTenantProviderConfig,
  getPlatformConfig,
  validatePlatformConfig,
} from '../third-party-config'

beforeEach(() => {
  __test__.resetTenantProviderConfig()
})

describe('多租户登录运行时配置', () => {
  it('按当前租户覆盖飞书 appId / redirectUri', () => {
    applyTenantProviderConfig([
      {
        platform: 'feishu',
        enabled: true,
        appId: 'cli_tenant_b',
        extra: { redirect_uri: 'https://b.example.com/callback?platform=feishu' },
        source: 'tenant',
      },
    ])
    const config = getPlatformConfig('feishu')
    expect(config.appId).toBe('cli_tenant_b')
    expect(config.redirectUri).toContain('b.example.com')
    expect(config.enabled).toBe(true)
  })

  it('企微 corpId 与 agentId 同时覆盖', () => {
    applyTenantProviderConfig([
      {
        platform: 'wecom',
        enabled: true,
        appId: 'ww_tenant_b',
        extra: { agent_id: '1000042' },
        source: 'tenant',
      },
    ])
    const config = getPlatformConfig('enterpriseWechat')
    expect(config.appId).toBe('ww_tenant_b')
    expect(config.agentId).toBe('1000042')
  })

  it('租户未配置的平台不会被点亮', () => {
    applyTenantProviderConfig([
      { platform: 'dingtalk', enabled: false, appId: '', extra: {}, source: 'none' },
    ])
    expect(getPlatformConfig('dingtalk').enabled).toBe(false)
  })

  it('未知平台忽略，不污染前端配置', () => {
    applyTenantProviderConfig([
      { platform: 'wechat_mp', enabled: true, appId: 'wx_mp', extra: {}, source: 'tenant' },
    ])
    expect(getPlatformConfig('wechat').appId).not.toBe('wx_mp')
  })

  it('登录前置校验认运行时租户配置，不再只看编译期 env', () => {
    applyTenantProviderConfig([
      {
        platform: 'feishu',
        enabled: true,
        appId: 'cli_tenant_b',
        extra: { redirect_uri: 'https://b.example.com/callback?platform=feishu' },
        source: 'tenant',
      },
    ])
    expect(validatePlatformConfig('feishu')).toEqual({ valid: true, missing: [] })

    applyTenantProviderConfig([
      { platform: 'feishu', enabled: false, appId: '', extra: {}, source: 'none' },
    ])
    expect(validatePlatformConfig('feishu').valid).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
