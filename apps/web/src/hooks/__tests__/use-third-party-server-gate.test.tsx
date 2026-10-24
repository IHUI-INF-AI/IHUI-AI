// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方登录按钮的"启用"判据回归锁(2026-10-22 立)。
 *
 * 立因(实测,不是推想):`isPlatformEnabled` 之前只看构建期烘死的 `NEXT_PUBLIC_*_ENABLED`,
 * 从不问服务器。生产 web 烘了 `NEXT_PUBLIC_GITHUB_ENABLED=true`(还有 client_id),
 * 而在跑的那份 api `.env` 里 `GITHUB_CLIENT_SECRET` 整枚缺键 ⇒ 按钮亮着,
 * 用户点下去、厂商回跳带 code 回来,`POST /api/auth/github/callback` 必失败。
 * 账面"已启用"与线上"点了必挂"同时成立 —— 这正是 §0.7「验过才免」的反面:
 * 判据只验"有没有写这个开关",没验"对面到底能不能成"。
 *
 * 修法 = 按钮的 enabled 取"本地开关 ∧ 服务器 `GET /api/auth/oauth-status` 的答复"。
 * 本文件锁三档,且每档都有成对反例(§feedback-fix-must-carry-mutation-proof):
 *  ① 服务器明确报 false ⇒ 本地再怎么 true 也必须禁用(摘掉这一维,死按钮就回来了);
 *  ② 服务器报 true  ⇒ 保持启用(防止把它修成"一律隐藏");
 *  ③ **取不到** ⇒ 一行判据都不改(这条 GET 挂了不能把本来能用的微信登录一起关掉)。
 *
 * `packages/api-client` 那份 `getOAuthStatus()` 头注早就写着"前端按需渲染登录按钮",
 * 但全仓零消费方 —— 本文件同时把"声明必须有消费者"那一格钉上(守门 121 同族)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

const statusRef = { current: null as Record<string, boolean> | null | 'FAIL' }
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async (url: string) => {
    if (!url.includes('oauth-status')) return { success: true, data: [] }
    if (statusRef.current === 'FAIL') return { success: false, status: 500, error: 'boom' }
    return { success: true, data: statusRef.current }
  }),
}))

// 本地开关的唯一来源:这里当夹具用,值由每个用例自己给
vi.mock('@/lib/third-party-config', () => ({
  getAllPlatformConfigs: () => ({
    github: { enabled: true },
    wechat: { enabled: true },
    oidc: { enabled: true },
  }),
  getPlatformConfig: (p: string) =>
    (
      ({ github: { enabled: true }, wechat: { enabled: true }, oidc: { enabled: true } }) as Record<
        string,
        { enabled: boolean }
      >
    )[p],
  validatePlatformConfig: () => ({ valid: true, missing: [] }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: { error: toastError, success: vi.fn() },
    error: toastError,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

async function loadHook() {
  vi.resetModules()
  const mod = await import('@/hooks/use-third-party-auth')
  // 缓存是模块级"只取一次":不重置就同一进程里四档用例会读到同一份答复
  mod.__test__.resetOAuthStatusCache()
  return renderHook(() => mod.useThirdPartyAuth())
}

describe('第三方按钮 enabled = 本地开关 ∧ 服务器答复', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('服务器报 github:false ⇒ 本地 true 也必须禁用(死按钮就是这么亮起来的)', async () => {
    statusRef.current = { github: false, wechat: true, feishu: true, alipay: true }
    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(false))
    expect(result.current.isPlatformEnabled('wechat')).toBe(true)
    expect(result.current.enabledPlatforms).not.toContain('github')
    expect(result.current.enabledPlatforms).toContain('wechat')
  })

  it('成对反例:服务器报 github:true ⇒ 必须仍然启用(不许修成一律隐藏)', async () => {
    statusRef.current = { github: true, wechat: true }
    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))
  })

  it('第三档:这条 GET 取不到 ⇒ 一行判据都不改(不能因为监控自己挂了就把能用的登录关掉)', async () => {
    statusRef.current = 'FAIL'
    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))
    expect(result.current.isPlatformEnabled('wechat')).toBe(true)
  })

  it('服务器答复里没有的键(oidc 不走这套凭据)⇒ 保持本地值,不被 undefined 误关', async () => {
    statusRef.current = { github: false, wechat: true }
    const { result } = await loadHook()
    await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(false))
    expect(result.current.isPlatformEnabled('oidc')).toBe(true)
  })

  it('未配置且无 proxyPath ⇒ 不导航,明确报未配置(G-962:不再跳不存在的 /api/auth/<platform>)', async () => {
    statusRef.current = { github: true }
    const hrefSetter = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        get href() {
          return ''
        },
        set href(v: string) {
          hrefSetter(v)
        },
      },
    })
    try {
      const { result } = await loadHook()
      await waitFor(() => expect(result.current.isPlatformEnabled('github')).toBe(true))
      const ok = await result.current.startLogin('github')
      expect(ok).toBe(false)
      expect(hrefSetter).not.toHaveBeenCalled()
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining('GitHub'),
        expect.stringContaining('未配置'),
      )
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
