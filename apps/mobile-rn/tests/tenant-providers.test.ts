// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 运行时租户配置薄取数层单测(2026-11-24)。
 *
 * 覆盖任务要求的五类用例:
 *  ① 运行时返回租户 appId ⇒ 登录用该 appId(解析器 + 飞书跳转 URL 双断言);
 *  ② 接口失败 / 超时 ⇒ 回退编译期 EXPO_PUBLIC_* 且不抛错;
 *  ③ 返回 `tenant: null` ⇒ 回退编译期配置;
 *  ④ 某平台未在 providers 里 ⇒ 该入口走"未配置"(source=none,appId 为空);
 *  ⑤ 启动参数带 tenantId ⇒ 请求头 X-Tenant-Id 带上(断言真实拼装结果)。
 *
 * 取材纪律:lib 层走真实源码,只 mock 外部边界(全局 fetch、expo WebBrowser、api-client 网络出口)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  // 编译期兜底默认值:用例内按需覆盖 / 清空,解析器在点击发起时才读 env(非模块加载期)。
  process.env.EXPO_PUBLIC_FEISHU_APP_ID = 'env-feishu-app'
  process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID = 'env-dingtalk-client'
  process.env.EXPO_PUBLIC_WECOM_CORP_ID = 'env-wecom-corp'
  process.env.EXPO_PUBLIC_WECOM_AGENT_ID = 'env-wecom-agent'
  return {
    openAuthSessionAsync: vi.fn(),
    getInitialURL: vi.fn<() => Promise<string | null>>(),
    recordOAuthConsent: vi.fn(),
    oauthCallback: vi.fn(),
    dingtalkLogin: vi.fn(),
    wecomLogin: vi.fn(),
  }
})

vi.mock('@/platform/linking', () => ({
  WebBrowser: { openAuthSessionAsync: mocks.openAuthSessionAsync },
  // 真实模块同时以 `export * as Linking` 与 `export *`(扁平)两种形态导出 expo-linking 成员。
  Linking: { getInitialURL: mocks.getInitialURL },
  getInitialURL: mocks.getInitialURL,
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>
  return {
    ...real,
    recordOAuthConsent: mocks.recordOAuthConsent,
    oauthCallback: mocks.oauthCallback,
    dingtalkLogin: mocks.dingtalkLogin,
    wecomLogin: mocks.wecomLogin,
  }
})

import {
  __resetTenantProvidersForTest,
  __setTenantProvidersForTest,
  fetchTenantProviders,
  loadTenantProviders,
  resolveProviderConfig,
  resolveTenantIdentifier,
  tenantFromBaseUrl,
  tenantFromQuery,
  type TenantProvidersPayload,
} from '../src/lib/tenant-providers'
import { loginByFeishuRedirect } from '../src/lib/oauth-redirect'

const RUNTIME_TENANT = { id: 't-1', slug: 'aizhihui', name: '爱智汇' }

function runtimeProvider(
  overrides: Partial<{
    platform: string
    appId: string
    enabled: boolean
    configured: boolean
    source: string
    extra: Record<string, string>
  }>,
) {
  return {
    platform: overrides.platform ?? 'feishu',
    configured: overrides.configured ?? true,
    enabled: overrides.enabled ?? true,
    appId: overrides.appId ?? 'runtime-feishu-app',
    extra: overrides.extra ?? {},
    source: (overrides.source ?? 'tenant') as 'tenant' | 'platform_env' | 'none',
  }
}

function envelope(payload: TenantProvidersPayload) {
  return { code: 0, message: 'success', data: payload }
}

function fakeFetch(responses: Array<{ ok: boolean; status?: number; json: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = []
  const impl = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} })
    const next = responses.shift()
    if (!next) throw new Error('fakeFetch 队列已空')
    return { ok: next.ok, status: next.status ?? 200, json: async () => next.json }
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetTenantProvidersForTest()
  mocks.getInitialURL.mockResolvedValue(null)
  mocks.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' })
  mocks.recordOAuthConsent.mockResolvedValue({ success: true, data: { ok: true } })
  mocks.oauthCallback.mockResolvedValue({ success: true, data: {} })
})

describe('租户上下文优先级(纯函数)', () => {
  it('deep link query 的 tenant 优先于 API 基址子域名', () => {
    const id = resolveTenantIdentifier({
      initialUrl: 'ihui://sso/callback?tenant=link-tenant',
      apiBaseUrl: 'https://api.aizhs.top',
    })
    expect(id).toBe('link-tenant')
  })

  it('tenantId / tenant_id 键同样识别', () => {
    expect(tenantFromQuery('ihui://x?tenantId=abc-123')).toBe('abc-123')
    expect(tenantFromQuery('ihui://x?tenant_id=slug_456')).toBe('slug_456')
  })

  it('无 query 时回退 API 基址子域名', () => {
    expect(
      resolveTenantIdentifier({ initialUrl: null, apiBaseUrl: 'https://acme.aizhs.top/api' }),
    ).toBe('acme')
  })

  it('保留段子域名 / IP / 非法字符不猜租户,落 null', () => {
    expect(tenantFromBaseUrl('https://www.aizhs.top')).toBeNull()
    expect(tenantFromBaseUrl('https://192.168.1.10')).toBeNull()
    expect(tenantFromQuery('ihui://x?tenant=bad/slug%20x')).toBeNull()
    expect(
      resolveTenantIdentifier({ initialUrl: null, apiBaseUrl: 'http://localhost:8802' }),
    ).toBeNull()
  })
})

describe('取数:请求拼装与失败静默', () => {
  it('⑤ 带 tenantId 时请求头 X-Tenant-Id 真实带上,URL 指向 /api/auth/tenant-providers', async () => {
    const { impl, calls } = fakeFetch([
      { ok: true, json: envelope({ tenant: RUNTIME_TENANT, providers: [] }) },
    ])
    const payload = await fetchTenantProviders({
      tenantId: 'aizhihui',
      fetchImpl: impl,
      apiBaseUrl: 'http://localhost:8802',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('http://localhost:8802/api/auth/tenant-providers')
    expect(calls[0]!.headers['X-Tenant-Id']).toBe('aizhihui')
    expect(payload?.tenant?.slug).toBe('aizhihui')
  })

  it('⑤ 深链 tenant 经 live 解析链路进入请求头 X-Tenant-Id(端到端拼装)', async () => {
    mocks.getInitialURL.mockResolvedValue('ihui://sso/callback?tenant=live-tenant')
    const calls: Array<{ url: string; headers?: Record<string, string> }> = []
    const globalFetch = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: init?.headers })
      return { ok: true, status: 200, json: async () => envelope({ tenant: null, providers: [] }) }
    })
    const savedFetch = globalThis.fetch
    globalThis.fetch = globalFetch as unknown as typeof fetch
    try {
      __resetTenantProvidersForTest()
      const payload = await loadTenantProviders()
      expect(payload).not.toBeNull()
      expect(calls[0]!.headers?.['X-Tenant-Id']).toBe('live-tenant')
    } finally {
      globalThis.fetch = savedFetch
      __resetTenantProvidersForTest()
    }
  })

  it('② fetch 抛错 / 非 2xx / 坏 JSON 一律返回 null,不向上抛', async () => {
    const boom = vi.fn(async () => {
      throw new Error('network down')
    })
    expect(
      await fetchTenantProviders({
        fetchImpl: boom as unknown as typeof fetch,
        apiBaseUrl: 'http://x',
      }),
    ).toBeNull()

    const notFound = fakeFetch([{ ok: false, status: 404, json: {} }])
    expect(
      await fetchTenantProviders({ fetchImpl: notFound.impl, apiBaseUrl: 'http://x' }),
    ).toBeNull()

    const badJson = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json')
      },
    }))
    expect(
      await fetchTenantProviders({
        fetchImpl: badJson as unknown as typeof fetch,
        apiBaseUrl: 'http://x',
      }),
    ).toBeNull()
  })

  it('③ 返回 tenant: null 时照样解出 providers 面,tenant 为 null', async () => {
    const { impl } = fakeFetch([
      { ok: true, json: envelope({ tenant: null, providers: [runtimeProvider({ appId: 'p' })] }) },
    ])
    const payload = await fetchTenantProviders({ fetchImpl: impl, apiBaseUrl: 'http://x' })
    expect(payload?.tenant).toBeNull()
    expect(payload?.providers).toHaveLength(1)
  })
})

describe('配置解析:运行时优先,缺失回退编译期,未配置落 none', () => {
  it('① 运行时租户行 enabled+configured+appId 齐备 ⇒ 取运行时 appId / agentId / scope / extra', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [
        runtimeProvider({
          platform: 'feishu',
          appId: 'runtime-feishu-app',
          extra: {
            agent_id: 'ag-1',
            scope: 'contact:user.base:readonly',
            redirect_uri: 'https://x/cb',
          },
        }),
      ],
    })
    const cfg = resolveProviderConfig('feishu')
    expect(cfg.source).toBe('runtime')
    expect(cfg.appId).toBe('runtime-feishu-app')
    expect(cfg.agentId).toBe('ag-1')
    expect(cfg.scope).toBe('contact:user.base:readonly')
    expect(cfg.redirectUri).toBe('https://x/cb')
  })

  it('租户显式关停(enabled=false)⇒ none,不回退编译期 env', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [runtimeProvider({ platform: 'feishu', enabled: false })],
    })
    const cfg = resolveProviderConfig('feishu')
    expect(cfg.source).toBe('none')
    expect(cfg.appId).toBe('')
  })

  it('② 请求失败缓存为 null ⇒ 回退编译期 env appId', () => {
    __setTenantProvidersForTest(null)
    const cfg = resolveProviderConfig('feishu')
    expect(cfg.source).toBe('fallback')
    expect(cfg.appId).toBe('env-feishu-app')
  })

  it('③ providers 为空但 tenant 非 null ⇒ 同样回退编译期 env', () => {
    __setTenantProvidersForTest({ tenant: RUNTIME_TENANT, providers: [] })
    expect(resolveProviderConfig('feishu').source).toBe('fallback')
  })

  it('④ 平台未出现在 providers 且编译期 env 也空 ⇒ none,走现有未配置分支', () => {
    const saved = process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID
    process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID = ''
    try {
      __setTenantProvidersForTest({
        tenant: RUNTIME_TENANT,
        providers: [runtimeProvider({ platform: 'feishu' })],
      })
      const ding = resolveProviderConfig('dingtalk')
      expect(ding.source).toBe('none')
      expect(ding.appId).toBe('')
    } finally {
      process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID = saved
    }
  })

  it('平台未出现在 providers 但编译期 env 存在 ⇒ 仍回退单租户兜底', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [runtimeProvider({ platform: 'feishu' })],
    })
    expect(resolveProviderConfig('dingtalk').source).toBe('fallback')
  })

  it('运行时行 source=platform_env 等价编译期,继续走 env 兜底链', () => {
    __setTenantProvidersForTest({
      tenant: null,
      providers: [
        runtimeProvider({
          platform: 'dingtalk',
          source: 'platform_env',
          appId: 'should-be-ignored',
        }),
      ],
    })
    expect(resolveProviderConfig('dingtalk').appId).toBe('env-dingtalk-client')
  })

  it('env 也为空 ⇒ none', () => {
    const saved = process.env.EXPO_PUBLIC_FEISHU_APP_ID
    process.env.EXPO_PUBLIC_FEISHU_APP_ID = ''
    try {
      __setTenantProvidersForTest(null)
      expect(resolveProviderConfig('feishu').source).toBe('none')
    } finally {
      process.env.EXPO_PUBLIC_FEISHU_APP_ID = saved
    }
  })
})

describe('跳转链路:发起时用解析后的 appId 拼授权 URL', () => {
  it('① 运行时 appId 进入飞书授权 URL', async () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [runtimeProvider({ appId: 'runtime-feishu-app' })],
    })
    const res = await loginByFeishuRedirect()
    expect(res.cancelled).toBe(true)
    const opened = mocks.openAuthSessionAsync.mock.calls[0]?.[0] as string
    expect(opened).toContain('app_id=runtime-feishu-app')
    expect(opened).not.toContain('env-feishu-app')
  })

  it('② 运行时缺失回退 env,授权 URL 用 env appId 且不报错', async () => {
    __setTenantProvidersForTest(null)
    const res = await loginByFeishuRedirect()
    // 用户关闭授权页:cancelled=true,授权会话已按 env appId 打开
    expect(res.cancelled).toBe(true)
    const opened = mocks.openAuthSessionAsync.mock.calls[0]?.[0] as string
    expect(opened).toContain('app_id=env-feishu-app')
  })

  it('④ env 与运行时都缺 ⇒ 返回未配置,不打开浏览器', async () => {
    const saved = process.env.EXPO_PUBLIC_FEISHU_APP_ID
    process.env.EXPO_PUBLIC_FEISHU_APP_ID = ''
    try {
      __setTenantProvidersForTest({ tenant: RUNTIME_TENANT, providers: [] })
      const res = await loginByFeishuRedirect()
      expect(res.success).toBe(false)
      expect(res.error).toBe('未配置 EXPO_PUBLIC_FEISHU_APP_ID')
      expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled()
    } finally {
      process.env.EXPO_PUBLIC_FEISHU_APP_ID = saved
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
