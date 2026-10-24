// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-944 fail-closed 前端臂:sponsor 页对「服务端明确未配置」的 USDT 收款方式隐藏卡片。
 *
 * 三臂:
 *  - TRC20 available=false ⇒ usdtTrc20 卡片消失,usdtErc20/其余照展示;
 *  - 两网络 available=true ⇒ 全展示;
 *  - 端点查询失败(未知)⇒ 维持全展示 —— 拒的是"明确未配置",不是"问不出答案"。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor, screen } from '@testing-library/react'
import type * as React from 'react'

const mocks = vi.hoisted(() => ({
  fetchApi: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({
  fetchApi: mocks.fetchApi,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@ihui/ui-react', () => ({
  Button: (props: { children?: React.ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props} />
  ),
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

import { CryptoDonation } from '../app/(main)/sponsor/CryptoDonation'

function okResponse(networks: { TRC20: { available: boolean }; ERC20: { available: boolean } }) {
  return { success: true, data: { networks } }
}

describe('sponsor 页 USDT 收款方式 fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('TRC20 未配置(available=false)⇒ 隐藏 usdtTrc20 卡片,其余不受牵连', async () => {
    mocks.fetchApi.mockResolvedValue(
      okResponse({ TRC20: { available: false }, ERC20: { available: true } }),
    )
    render(<CryptoDonation />)
    await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalled())
    expect(mocks.fetchApi.mock.calls[0][0]).toBe('/api/payment/usdt/public-config')
    await waitFor(() => expect(screen.queryByText('usdtTrc20.name')).toBeNull())
    // getByText 找不到即抛 ⇒ 存在性已由查询本身钉住
    expect(screen.getByText('usdtErc20.name')).toBeTruthy()
    expect(screen.getByText('bitcoin.name')).toBeTruthy()
  })

  it('两网络都有值 ⇒ 全展示(有值可用臂)', async () => {
    mocks.fetchApi.mockResolvedValue(
      okResponse({ TRC20: { available: true }, ERC20: { available: true } }),
    )
    render(<CryptoDonation />)
    await waitFor(() => expect(screen.getByText('usdtTrc20.name')).toBeTruthy())
    expect(screen.getByText('usdtErc20.name')).toBeTruthy()
  })

  it('端点查询失败(未知)⇒ 维持全展示,不误伤已配置方式', async () => {
    mocks.fetchApi.mockResolvedValue({ success: false, error: 'network down' })
    render(<CryptoDonation />)
    await waitFor(() => expect(mocks.fetchApi).toHaveBeenCalled())
    // 未知态不隐藏:两枚 USDT 卡片仍在
    expect(screen.getByText('usdtTrc20.name')).toBeTruthy()
    expect(screen.getByText('usdtErc20.name')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
