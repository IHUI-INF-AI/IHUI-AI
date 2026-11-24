// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序运行时租户配置薄取数层单测(2026-11-24)。
 *
 * 覆盖任务要求的五类用例:
 *  ① 运行时返回租户入口配置 ⇒ 解析器标 runtime(小程序端为入口可用态,不持有第三方 appId);
 *  ② 接口失败 / 超时(fail 回调)⇒ 回退编译期兜底且不抛错;
 *  ③ 返回 `tenant: null` ⇒ 回退兜底;
 *  ④ 某平台未在 providers 里 ⇒ 该入口走"未配置"(source=none);
 *  ⑤ 启动参数带 tenantId ⇒ 请求头 X-Tenant-Id 带上(断言真实拼装结果)。
 *
 * 取材纪律:lib 层走真实源码,只 mock 外部边界 @tarojs/taro。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  return {
    calls: [] as Array<Record<string, unknown>>,
    requestImpl: null as null | ((options: Record<string, unknown>) => void),
    getLaunchOptionsSync: vi.fn<() => { query: Record<string, unknown> }>(),
    getCurrentInstance: vi.fn<() => { router?: { params: Record<string, unknown> } }>(),
  }
})

vi.mock('@tarojs/taro', () => {
  const request = (options: Record<string, unknown>) => {
    mocks.calls.push(options)
    if (mocks.requestImpl) mocks.requestImpl(options)
  }
  return {
    default: {
      request,
      getLaunchOptionsSync: mocks.getLaunchOptionsSync,
      getCurrentInstance: mocks.getCurrentInstance,
    },
    request,
    getLaunchOptionsSync: mocks.getLaunchOptionsSync,
    getCurrentInstance: mocks.getCurrentInstance,
  }
})

import {
  __resetTenantProvidersForTest,
  __setTenantProvidersForTest,
  fetchTenantProviders,
  loadTenantProviders,
  resolveLiveTenantIdentifier,
  resolveProviderConfig,
  resolveTenantIdentifier,
  type TenantProvidersPayload,
} from '../tenant-providers'

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
    platform: overrides.platform ?? 'wechat_mp',
    configured: overrides.configured ?? true,
    enabled: overrides.enabled ?? true,
    appId: overrides.appId ?? 'mp-app-id',
    extra: overrides.extra ?? {},
    source: (overrides.source ?? 'tenant') as 'tenant' | 'platform_env' | 'none',
  }
}

function envelope(payload: TenantProvidersPayload) {
  return { code: 0, message: 'success', data: payload }
}

function successOptions(payload: TenantProvidersPayload) {
  return (options: Record<string, unknown>) => {
    const success = options.success as (res: { statusCode: number; data: unknown }) => void
    success({ statusCode: 200, data: envelope(payload) })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.calls.length = 0
  mocks.requestImpl = null
  __resetTenantProvidersForTest()
  mocks.getLaunchOptionsSync.mockReturnValue({ query: {} })
  mocks.getCurrentInstance.mockReturnValue({ router: { params: {} } })
})

describe('租户上下文优先级(纯函数 + 线上读取)', () => {
  it('启动 query 的 tenant 优先于路由参数与子域名', () => {
    const id = resolveTenantIdentifier({
      launchQuery: { tenant: 'launch-tenant' },
      routerParams: { tenant: 'router-tenant' },
      apiBaseUrl: 'https://www.aizhs.top/api',
    })
    expect(id).toBe('launch-tenant')
  })

  it('无启动 query 时回退路由参数 tenantId', () => {
    expect(
      resolveTenantIdentifier({ launchQuery: {}, routerParams: { tenantId: 'router-1' } }),
    ).toBe('router-1')
  })

  it('线上读取:getLaunchOptionsSync().query 是租户参数真实来源(scene 为入口枚举,不解码)', () => {
    mocks.getLaunchOptionsSync.mockReturnValue({ query: { tenant: 'aizhihui', scene: '1011' } })
    mocks.getCurrentInstance.mockReturnValue({ router: { params: {} } })
    expect(resolveLiveTenantIdentifier()).toBe('aizhihui')
  })

  it('保留段子域名 / 非法字符不猜租户,落 null', () => {
    expect(
      resolveTenantIdentifier({
        launchQuery: {},
        routerParams: {},
        apiBaseUrl: 'https://www.aizhs.top/api',
      }),
    ).toBeNull()
    expect(resolveTenantIdentifier({ launchQuery: { tenant: 'bad/slug' } })).toBeNull()
  })
})

describe('取数:请求拼装与失败静默', () => {
  it('⑤ 带 tenantId 时请求头 X-Tenant-Id 真实带上,路径为 /auth/tenant-providers', async () => {
    mocks.requestImpl = successOptions({ tenant: RUNTIME_TENANT, providers: [] })
    const payload = await fetchTenantProviders({ tenantId: 'aizhihui' })
    expect(mocks.calls).toHaveLength(1)
    const call = mocks.calls[0]!
    expect(String(call.url)).toBe('https://www.aizhs.top/api/auth/tenant-providers')
    expect((call.header as Record<string, string>)['X-Tenant-Id']).toBe('aizhihui')
    expect(payload?.tenant?.slug).toBe('aizhihui')
  })

  it('⑤ 启动 query tenant 经 live 解析链路进入请求头 X-Tenant-Id(端到端拼装)', async () => {
    mocks.getLaunchOptionsSync.mockReturnValue({ query: { tenant: 'live-tenant' } })
    mocks.getCurrentInstance.mockReturnValue({ router: { params: {} } })
    mocks.requestImpl = successOptions({ tenant: null, providers: [] })
    const payload = await loadTenantProviders()
    expect(payload).not.toBeNull()
    const call = mocks.calls[0]!
    expect((call.header as Record<string, string>)['X-Tenant-Id']).toBe('live-tenant')
  })

  it('② Taro.request fail 回调 ⇒ 返回 null,不向上抛', async () => {
    mocks.requestImpl = (options) => {
      const fail = options.fail as (err: { errMsg?: string }) => void
      fail({ errMsg: 'network down' })
    }
    expect(await fetchTenantProviders({})).toBeNull()
  })

  it('② 非 2xx ⇒ 返回 null', async () => {
    mocks.requestImpl = (options) => {
      const success = options.success as (res: { statusCode: number; data: unknown }) => void
      success({ statusCode: 503, data: {} })
    }
    expect(await fetchTenantProviders({})).toBeNull()
  })

  it('③ 返回 tenant: null 时 providers 面照常解出', async () => {
    mocks.requestImpl = successOptions({ tenant: null, providers: [runtimeProvider({})] })
    const payload = await fetchTenantProviders({})
    expect(payload?.tenant).toBeNull()
    expect(payload?.providers).toHaveLength(1)
  })
})

describe('配置解析:运行时优先,缺失回退兜底,未配置落 none', () => {
  it('① 运行时租户行 enabled+configured ⇒ runtime 态,入口可用', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [
        runtimeProvider({
          platform: 'wechat_mp',
          appId: 'mp-app-id',
          extra: { redirect_uri: 'https://x/cb' },
        }),
      ],
    })
    const cfg = resolveProviderConfig('wechat')
    expect(cfg.source).toBe('runtime')
    expect(cfg.enabled).toBe(true)
    expect(cfg.appId).toBe('mp-app-id')
    expect(cfg.extra.redirect_uri).toBe('https://x/cb')
  })

  it('租户显式关停(enabled=false)⇒ none,不回退兜底', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [runtimeProvider({ enabled: false })],
    })
    const cfg = resolveProviderConfig('wechat')
    expect(cfg.source).toBe('none')
    expect(cfg.enabled).toBe(false)
  })

  it('② 取数失败缓存为 null ⇒ 回退兜底(微信入口容器内可用)', () => {
    __setTenantProvidersForTest(null)
    const cfg = resolveProviderConfig('wechat')
    expect(cfg.source).toBe('fallback')
    expect(cfg.enabled).toBe(true)
  })

  it('③ providers 为空但 tenant 非 null ⇒ 同样回退兜底', () => {
    __setTenantProvidersForTest({ tenant: RUNTIME_TENANT, providers: [] })
    expect(resolveProviderConfig('wechat').source).toBe('fallback')
  })

  it('④ 平台未出现在 providers ⇒ none,走现有未配置分支', () => {
    __setTenantProvidersForTest({
      tenant: RUNTIME_TENANT,
      providers: [runtimeProvider({})],
    })
    const feishu = resolveProviderConfig('feishu')
    expect(feishu.source).toBe('none')
    expect(feishu.enabled).toBe(false)
  })

  it('运行时行 source=platform_env 等价兜底,继续走编译期兜底链', () => {
    __setTenantProvidersForTest({
      tenant: null,
      providers: [runtimeProvider({ source: 'platform_env', appId: 'should-be-ignored' })],
    })
    expect(resolveProviderConfig('wechat').source).toBe('fallback')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
