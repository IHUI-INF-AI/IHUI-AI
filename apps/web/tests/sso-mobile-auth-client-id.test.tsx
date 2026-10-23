// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /sso/mobile-auth 的 clientId 不许烘死在一个端上(2026-10-22 立,承台账 G-957)。
 *
 * 本页是全仓**唯一**已跑通的"WebView 里拿 sso_code → POST /api/auth/sso/exchange 换 httpOnly
 * cookie → location.replace(redirect)"闭环。但它把 clientId 写死 'mobile-rn',而该页自己的注释
 * 就写着"交换 clientId 必须与生成端一致,否则后端判不匹配 → 401"。⇒ 小程序要复用这条腿,
 * 第一块砖就是让它可配;否则任何复用都要复制整页(必然漂移,§6 单一真相源)。
 *
 * 向后兼容是判据的一半:不带 client_id 时必须仍然是 mobile-rn,否则现在就上路的 RN 腿会断。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'

const queryRef = vi.hoisted(() => ({ current: '' }))
const bodies = vi.hoisted(() => [] as string[])
const replaceMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(queryRef.current),
}))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// 页里取的是共享注册表的缺省值;mock 只为不依赖该包的构建产物,键值与源头逐字一致
vi.mock('@ihui/shared', () => ({
  SSO_CLIENT_IDS: { MOBILE_RN: 'mobile-rn', MINIAPP_TARO: 'miniapp-taro', WEB: 'web' },
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={String(href)}>{children}</a>,
}))

import SsoMobileAuthPage from '../app/sso/mobile-auth/PageClient'

function stubLocation() {
  const def = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'http://localhost:8801/sso/mobile-auth',
      replace: (v: string) => replaceMock(String(v)),
      assign: (v: string) => replaceMock(String(v)),
    },
  })
  return () => {
    if (def) Object.defineProperty(window, 'location', def)
    else delete (window as any).location
  }
}

let restore: (() => void) | null = null

beforeEach(() => {
  replaceMock.mockReset()
  bodies.length = 0
  queryRef.current = ''
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body?: string }) => {
      bodies.push(String(init?.body ?? ''))
      return { ok: true, json: async () => ({ code: 0 }) } as unknown as Response
    }),
  )
  restore = stubLocation()
})

afterEach(() => {
  cleanup()
  restore?.()
  restore = null
  vi.unstubAllGlobals()
})

const sentClientId = () => JSON.parse(bodies[0]).clientId as string

describe('/sso/mobile-auth 的 clientId 来源', () => {
  it('带 client_id 参数 ⇒ exchange 用它(小程序等新端复用不必复制整页)', async () => {
    queryRef.current = 'sso_code=CODE1&client_id=miniapp-taro&redirect=%2Fme'
    render(<SsoMobileAuthPage />)
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(sentClientId()).toBe('miniapp-taro')
  })

  it('不带 client_id ⇒ 仍然烘死 mobile-rn(现役 RN 腿不许被我改断)', async () => {
    queryRef.current = 'sso_code=CODE2&redirect=%2Fme'
    render(<SsoMobileAuthPage />)
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(sentClientId()).toBe('mobile-rn')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
