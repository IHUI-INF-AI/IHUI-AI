// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 A3/G-413 的端到端落点断言(2026-09-28 立)。
 *
 * 判的不是"守卫函数被调用过",而是**这一跳真正落到了哪儿**:/sso/redirect 是唯一"带着刚落库的
 * sso_code 落地"的那一页(同源相对 ∪ env origin 白名单),所以"带外部 origin 的 redirect 参数
 * 不会产出对外跳转"必须在这条链上量。三种绕过形态各一条:协议相对 `//evil`、反斜杠 `/\evil`
 * (本票补的那一格 —— 旧判据只挡 `//`)、自执行协议 `javascript:`。
 *
 * 正向对照同样必给:站内相对路径带着 code 正常跳转,证明判据不是"逢 redirect 即拦"
 * (那等于把 SSO 回跳整条改坏,而账面仍在报"安全")。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const replaceMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
/** 当前这次渲染要喂给 useSearchParams 的查询串(每个用例自己设) */
const queryRef = vi.hoisted(() => ({ current: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// 判据必须是真身(整条测试的意义就在于"页面真的走了这把尺子"),所以只 mock 掉与本票无关的取源
vi.mock('@ihui/shared', () => ({
  buildSsoRedirectUrl: (target: string, code: string) =>
    `${target}${target.includes('?') ? '&' : '?'}sso_code=${code}`,
}))
vi.mock('@/lib/api-base-url', () => ({ resolveApiBaseUrl: () => '' }))
// 守卫模块本身是**真身**(判据必须走它),但它顶层 import 了 @ihui/api-client(用于静默续期);
// 本用例只测落点判定,续期链路由 sso-redirect-guard.test.ts 那套用例覆盖,这里按边界桩掉。
vi.mock('@ihui/api-client', () => ({ refreshAccessTokenOnce: vi.fn(async () => null) }))

import SsoRedirectPageClient from '../PageClient'

/** /api/auth/me 与 /api/auth/sso/code 的两段应答;第三段返回给调用方做断言 */
function stubFetch(opts: { meOk: boolean; code?: string }) {
  const fetchMock = vi.fn(async (input: string) => {
    if (String(input).endsWith('/api/auth/me')) {
      return { ok: opts.meOk, json: async () => ({}) } as unknown as Response
    }
    return {
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: { code: opts.code ?? 'SSOCODE' } }),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  replaceMock.mockReset()
  pushMock.mockReset()
  queryRef.current = ''
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/sso/redirect 的 redirect 落点', () => {
  it('白名单外的外部 origin 不产出对外跳转(既不 replace 也不发 code 请求)', async () => {
    queryRef.current = 'redirect=https%3A%2F%2Fevil.example.com%2Fcb&client_id=web'
    const fetchMock = stubFetch({ meOk: true })
    render(<SsoRedirectPageClient />)

    await waitFor(() => {
      expect(document.body.textContent).toContain('notAllowed')
    })
    // 实际行为:没有任何一次导航落在外部 origin 上
    expect(replaceMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    // 也没把外部地址送去换 code(code 压根不该为它签发)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['协议相对', '//evil.example.com/cb'],
    ['反斜杠(本票补的那一格)', '/\\evil.example.com/cb'],
    ['自执行协议', 'javascript:alert(1)'],
  ])('%s 形态一律判不安全,且不会产出对外跳转', async (_label, evil) => {
    queryRef.current = `redirect=${encodeURIComponent(evil)}&client_id=web`
    stubFetch({ meOk: true })
    render(<SsoRedirectPageClient />)

    await waitFor(() => {
      expect(document.body.textContent).toContain('notAllowed')
    })
    expect(replaceMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    const navigated = [...replaceMock.mock.calls, ...pushMock.mock.calls].flat()
    expect(navigated.some((h) => String(h).includes('evil.example.com'))).toBe(false)
  })

  it('正向对照:站内相对路径带 code 正常跳转(判据不是逢 redirect 即拦)', async () => {
    queryRef.current = 'redirect=%2Fedu%2Fedu-management%2Fstudy-plan&client_id=web'
    stubFetch({ meOk: true, code: 'ABC' })
    render(<SsoRedirectPageClient />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/edu/edu-management/study-plan?sso_code=ABC')
    })
  })

  it('正向对照:白名单内的外部 origin 放行(env NEXT_PUBLIC_SSO_ALLOWED_ORIGINS)', async () => {
    // 这一档由 Next 在构建期内联 process.env,测试里直接改全局对象即可命中同一个读取表达式
    const env = process.env as Record<string, string | undefined>
    const previous = env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS
    env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS = 'https://edu.example.com'
    try {
      queryRef.current = 'redirect=https%3A%2F%2Fedu.example.com%2Fcb&client_id=web'
      stubFetch({ meOk: true, code: 'ABC' })
      render(<SsoRedirectPageClient />)

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('https://edu.example.com/cb?sso_code=ABC')
      })
    } finally {
      env.NEXT_PUBLIC_SSO_ALLOWED_ORIGINS = previous
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
