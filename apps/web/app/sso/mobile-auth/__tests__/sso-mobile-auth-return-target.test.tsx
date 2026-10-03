// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 票 A3/G-780 —— /sso/mobile-auth 回跳落点的**调用点**断言。
 *
 * 为什么钉在这一层(而不是只钉 shared 守卫):`sso-redirect-guard.test.ts` 已经逐条判过
 * `isSafeNavigationTarget` 本身,但**没有任何测试渲染过本页**。判据在库里正确 ≠ 判据在
 * 这一跳被调用 —— 删掉本页第 63 行的 `if (!isSafeNavigationTarget(redirectUrl))` 之后,
 * 库层 34 条用例仍全绿,而本页会重新变成裸 `window.location.replace(redirectUrl)`。
 * 本文件把那一次调用钉住,让「守卫被拆掉」当场翻红。
 *
 * 断言落的是**实际跳转目标**(不是「守卫被调用过」):
 *  - 反例(必须被拒):自执行协议族、协议相对、反斜杠伪装站内 ⇒ `location.replace` 的参数
 *    一次都不得是原值,只能是站内首页 `/`;
 *  - 正例(必须放行):站内相对路径与**外站 http(s)** 逐字不变 —— 外站是 WebView 的设计意图
 *    (`WebViewScreen` 传任意 http(s) 目标),这一格同时是「不许顺手加严」的对照。
 *
 * 为什么反例不写成「非法 origin」:本页**刻意不套** origin 白名单(见 PageClient 第 58-62 行
 * 的自述:套上会砍断 App→Web 回跳)。它挡的是「会在本站源里执行」那一族,不是「站外」。
 * 若把判据改成 origin 白名单,那是产品决策(见交付报告),不在本测试内。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const queryRef = vi.hoisted(() => ({ current: '' }))
const replaceMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={String(href)}>{children}</a>,
}))

import SsoMobileAuthPage from '../PageClient'

/** 本页走的是 window.location.replace(不是 router.replace),故桩这一处 */
function stubLocationReplace() {
  const original = window.location
  const def = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return original.href
      },
      set href(v: string) {
        replaceMock(String(v))
      },
      replace: (v: string) => replaceMock(String(v)),
      assign: (v: string) => replaceMock(String(v)),
    },
  })
  return () => {
    if (def) Object.defineProperty(window, 'location', def)
    else delete (window as any).location
  }
}

let restoreLocation: (() => void) | null = null

beforeEach(() => {
  replaceMock.mockReset()
  queryRef.current = ''
  // exchange 成功 ⇒ 页面走到那一跳 redirect(判据本身在下面断言,不在这里)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ code: 0 }) }) as unknown as Response),
  )
})

afterEach(() => {
  cleanup()
  restoreLocation?.()
  restoreLocation = null
  vi.unstubAllGlobals()
})

function jumpedTo(): string[] {
  return replaceMock.mock.calls.map((c) => String(c[0]))
}

describe('/sso/mobile-auth 的 redirect 落点(本页调用点)', () => {
  it.each([
    ['自执行协议 javascript:', 'javascript:alert(document.cookie)'],
    ['自执行协议 data:', 'data:text/html,<script>1</script>'],
    ['协议相对 //host', '//evil.example.com/cb'],
    ['反斜杠伪装站内(浏览器按 //evil 解析)', '/\\evil.example.com/cb'],
  ])('%s:这一跳被改写为站内首页,原值一次都没进过 location.replace', async (_label, evil) => {
    queryRef.current = `sso_code=SSOCODE&redirect=${encodeURIComponent(evil)}`
    restoreLocation = stubLocationReplace()
    render(<SsoMobileAuthPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled()
    })
    const targets = jumpedTo()
    // 反例必须真成立:原值逐字没出现过,且确实落了站内首页
    expect(targets).not.toContain(evil)
    expect(targets.some((t) => t.includes('evil.example.com'))).toBe(false)
    expect(targets.some((t) => t.startsWith('javascript:'))).toBe(false)
    expect(targets.some((t) => t.startsWith('data:'))).toBe(false)
    expect(targets).toContain('/')
  })

  it('正向对照:站内相对路径逐字不变(判据没被顺手加严)', async () => {
    queryRef.current = 'sso_code=SSOCODE&redirect=%2Fedu%2Fstudy-plan'
    restoreLocation = stubLocationReplace()
    render(<SsoMobileAuthPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/edu/study-plan')
    })
    expect(replaceMock).not.toHaveBeenCalledWith('/')
  })

  it('正向对照:外站 http(s) 仍是合法落点(本页不套 origin 白名单,不得砍断 App→Web 回跳)', async () => {
    queryRef.current = 'sso_code=SSOCODE&redirect=https%3A%2F%2Fedu.example.com%2Fdashboard'
    restoreLocation = stubLocationReplace()
    render(<SsoMobileAuthPage />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('https://edu.example.com/dashboard')
    })
    expect(jumpedTo()).not.toContain('/')
  })

  it('对照:缺 code 时不发生任何跳转(失败分支不碰 redirect 判据)', async () => {
    queryRef.current = 'redirect=https%3A%2F%2Fevil.example.com%2Fcb'
    restoreLocation = stubLocationReplace()
    render(<SsoMobileAuthPage />)

    await waitFor(() => {
      expect(replaceMock).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
