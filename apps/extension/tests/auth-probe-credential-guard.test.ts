// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扩展端"打开界面时销毁凭据"判据守卫(2026-10-26,用户反馈「账号总是要重新登录」)。
 *
 * 射程:
 * 1. popup 的身份探测唯一出口 `probeIdentity` —— 成对行为锁:
 *    正例 401/403(rejected)⇒ 清凭据;反例 5xx / 无 status / 网络抛异常 /
 *    REFRESH_TOKEN_STALE ⇒ 一条都不清。
 * 2. 判据单源(AGENTS §0.6):popup 与 sidepanel 都必须复用
 *    `classifyRefreshFailureStatus`(@ihui/shared/auth/auto-login-policy)且透传 errorCode,
 *    端内不得再写 `status === 401` / `/401|未授权|unauthorized/` 这类第二份 401/403 判定。
 *    sidepanel(SidepanelApp.tsx)import 面是 40+ 页面模块,把它挂进测试环境得到的绿灯
 *    只证明夹具能跑(session-expired-exit.test.ts ④ 同一判例),故其接线用源码级锁;
 *    popup 侧行为锁走真函数(probeIdentity 依赖注入,不起 React 树)。
 */
import { describe, it, expect, vi } from 'vitest'
import type { AuthUser } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

// === popup App.tsx 的重依赖全部替身:本用例判的是 probeIdentity 的判据,不是登录界面 ===
vi.mock('../lib/token', () => ({
  initApi: vi.fn(async () => {}),
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  clearAllTokens: vi.fn(async () => {}),
}))
vi.mock('../lib/token-utils', () => ({
  startAutoRefresh: vi.fn(),
}))
vi.mock('../lib/login-api-client', () => ({
  createExtensionLoginApiClient: () => ({}),
}))
vi.mock('../lib/visit-tracker', () => ({
  reportExtensionView: vi.fn(),
}))
vi.mock('../lib/message-router', () => ({
  sendMessage: vi.fn(async () => null),
}))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../src/hooks/use-system-theme', () => ({
  useSystemTheme: () => undefined,
}))
vi.mock('../src/hooks/use-extension-third-party-auth', () => ({
  useExtensionThirdPartyAuth: () => ({ config: {} }),
}))
vi.mock('@ihui/ui-react', () => ({
  AuthShell: () => null,
  LoginForm: () => null,
}))
vi.mock('../entrypoints/components/QuickActionButton', () => ({
  QuickActionButton: () => null,
}))
vi.mock('../entrypoints/components/NotificationBell', () => ({
  NotificationBell: () => null,
}))
vi.mock('@ihui/api-client', () => ({
  getMe: vi.fn(),
  logout: vi.fn(),
}))

import { probeIdentity } from '../entrypoints/popup/App'
import { REFRESH_TOKEN_STALE_ERROR_CODE } from '@ihui/shared/auth/auto-login-policy'

async function readSource(rel: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  return readFile(resolve(import.meta.dirname!, rel), 'utf8')
}

const fakeUser = { id: 'u1', nickname: 'tester' } as unknown as AuthUser

describe('popup 身份探测:probeIdentity 只有服务端明确否定凭据才销毁', () => {
  const makeDeps = (getMeImpl: () => Promise<ApiResult<{ user: AuthUser }>>) => {
    const clearAllTokens = vi.fn(async () => {})
    return { deps: { getMe: getMeImpl, clearAllTokens }, clearAllTokens }
  }

  it('成功 → 返回 user,不清', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: true,
      data: { user: fakeUser },
    }))
    const user = await probeIdentity(deps)
    expect(user).toBe(fakeUser)
    expect(clearAllTokens).not.toHaveBeenCalled()
  })

  // ─── 正例:rejected ⇒ 清 ───
  it('正例:getMe 401 → 清凭据', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: false,
      error: 'unauthorized',
      status: 401,
    }))
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).toHaveBeenCalledTimes(1)
  })

  it('正例:getMe 403 → 清凭据(旧实现只判 401,403 漏网靠端内正则文案兜,本锁要求走单源判据)', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: false,
      error: 'forbidden',
      status: 403,
    }))
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).toHaveBeenCalledTimes(1)
  })

  // ─── 反例:transient / 判不出 ⇒ 一条都不清 ───
  it('反例:getMe 500 → 不清', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: false,
      error: 'Server Error',
      status: 500,
    }))
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).not.toHaveBeenCalled()
  })

  it('反例:getMe 无 status(网络错误/超时)→ 不清', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: false,
      error: 'network down',
    }))
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).not.toHaveBeenCalled()
  })

  it('反例:getMe 401 但 errorCode=REFRESH_TOKEN_STALE → 瞬时,不清', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => ({
      success: false,
      error: 'stale copy',
      status: 401,
      errorCode: REFRESH_TOKEN_STALE_ERROR_CODE,
    }))
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).not.toHaveBeenCalled()
  })

  it('反例:getMe 抛异常(网络层)→ 不清(旧实现 catch 里 clearAllTokens —— 一次抖动洗光登录态)', async () => {
    const { deps, clearAllTokens } = makeDeps(async () => {
      throw new Error('fetch failed')
    })
    expect(await probeIdentity(deps)).toBeNull()
    expect(clearAllTokens).not.toHaveBeenCalled()
  })
})

describe('判据单源接线(源码级锁;判据本体行为由上面的真函数用例与 shared 镜像负责)', () => {
  const CLASSIFY_CALL = /classifyRefreshFailureStatus\(\s*res\.status,\s*res\.errorCode\s*\)/

  it('popup App.tsx:身份探测走 probeIdentity(依赖注入)且在 initApi 就绪之后;判据复用单源且透传 errorCode', async () => {
    const src = await readSource('../entrypoints/popup/App.tsx')
    expect(src, 'probeIdentity 必须 import 单源判据').toContain(
      '@ihui/shared/auth/auto-login-policy',
    )
    expect(src).toMatch(CLASSIFY_CALL)
    expect(src).toMatch(/probeIdentity\(\s*\{\s*getMe,/)
    // 就绪判据:身份探测发生在 initApi() 落定的 .then 内(比对调用点,不比对定义处)
    const initIdx = src.indexOf('initApi()')
    const probeIdx = src.indexOf('probeIdentity({ getMe')
    expect(initIdx).toBeGreaterThanOrEqual(0)
    expect(probeIdx).toBeGreaterThan(initIdx)
    // 旧销毁通道不得回潮:探测失败无条件清、或 catch 里清
    expect(src).not.toMatch(/else\s+await\s+clearAllTokens\(\)/)
    expect(src).not.toMatch(/catch\s*\{[\s\S]{0,80}?await\s+clearAllTokens\(\)/)
  })

  it('SidepanelApp.tsx:isUnauthorized 复用单源判据并透传 errorCode,端内自写的 401/403 副本必须不存在', async () => {
    const src = await readSource('../entrypoints/sidepanel/SidepanelApp.tsx')
    expect(src, 'sidepanel 必须 import 单源判据').toContain('@ihui/shared/auth/auto-login-policy')
    expect(src).toMatch(CLASSIFY_CALL)
    // 旧副本两型都不许回潮:裸比较 401、以及拿 error 文案正则冒充判据
    expect(src).not.toMatch(/res\.status\s*===\s*401/)
    expect(src).not.toMatch(/401\|未授权\|unauthorized/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
