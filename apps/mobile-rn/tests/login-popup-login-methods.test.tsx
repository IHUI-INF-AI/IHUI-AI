// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 门 285 B 组:LoginPopUp 的 onOneClickLogin / onPasswordLogin / onWebAuthLogin
// 由「仅小程序声明」收口为两端真实现。分别断言三个回调都被真实交互触发并收到入参。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const carrierLogin = vi.fn()
vi.mock('../src/lib/carrier-one-click', () => ({
  carrierLogin: () => carrierLogin(),
  getRecentPhone: () => '',
  CarrierOneClickError: class extends Error {},
}))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@ihui/rn-app', () => ({
  TextField: () => null,
}))
vi.mock('@ihui/ui-native', () => ({
  Tappable: ({ children, onPress }: { children: ReactNode; onPress?: () => void }) => (
    <div onClick={onPress}>{children}</div>
  ),
}))

import LoginPopUp from '../src/components/LoginPopUp'

describe('LoginPopUp 三种登录方式真消费', () => {
  beforeEach(() => {
    carrierLogin.mockReset()
  })

  it('网页授权入口回调被点击触发', () => {
    const onWebAuthLogin = vi.fn()
    render(<LoginPopUp visible onClose={() => {}} onWebAuthLogin={onWebAuthLogin} />)
    fireEvent.click(screen.getByText('login.webAuthLogin'))
    expect(onWebAuthLogin).toHaveBeenCalledTimes(1)
  })

  it('密码登录:展开两个字段后提交,回调收到账号与密码', async () => {
    const onPasswordLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginPopUp visible onClose={() => {}} onPasswordLogin={onPasswordLogin} />)
    fireEvent.click(screen.getByText('login.passwordLogin'))
    const inputs = screen.getAllByPlaceholderText(/login\.(account|password)Placeholder/)
    fireEvent.change(inputs[0]!, { target: { value: '13800000000' } })
    fireEvent.change(inputs[1]!, { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('login.login'))
    await waitFor(() => expect(onPasswordLogin).toHaveBeenCalledWith('13800000000', 'secret'))
  })

  it('一键登录:运营商取号结果按 loginCode/phoneCode 回传', async () => {
    carrierLogin.mockResolvedValue({ phone: '13800000000', accessToken: 'carrier-token' })
    const onOneClickLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginPopUp visible onClose={() => {}} onOneClickLogin={onOneClickLogin} />)
    fireEvent.click(screen.getByText('login.wechatOneClick'))
    await waitFor(() =>
      expect(onOneClickLogin).toHaveBeenCalledWith({
        loginCode: 'carrier-token',
        phoneCode: '13800000000',
      }),
    )
  })
})
