// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 显示面凭据遮挡(D222):用户气泡默认遮住已发送的密钥,原文仍在 store / 复制路径里。
//
// 判据:
//  ① 正文与围栏代码块里的 sk- 密钥都不得完整出现在 DOM;
//  ② 前 8 字符保留(能认出是哪家/哪个前缀),其余逐字符 ∗;
//  ③ 点一次展开后原文可见,再点一次回到遮挡态;
//  ④ 没有凭据的消息不出现这个按钮(不给每条消息加噪音)。
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UserMessageBody } from '../message-list/user-message-body'

const openPanel = vi.fn()
vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: { getState: () => ({ openPanel }) },
}))

const LABELS = { show: '显示凭据', hide: '隐藏凭据' }
const FULL_KEY = 'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
const SECRET_TAIL = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'

describe('用户气泡显示面凭据遮挡', () => {
  afterEach(() => cleanup())

  it('正文里的密钥默认只露前 8 字符,展开后原文可见并可再收回', () => {
    const { container } = render(
      <UserMessageBody content={`帮我检查 key: ${FULL_KEY}`} secretMaskLabels={LABELS} />,
    )
    expect(container.textContent).toContain('sk-proj-')
    expect(container.textContent).not.toContain(SECRET_TAIL)
    expect(container.textContent).toContain('∗')

    const toggle = container.querySelector('[data-testid="user-message-secret-toggle"]')
    expect(toggle).not.toBeNull()
    expect(toggle?.getAttribute('aria-pressed')).toBe('false')
    expect(toggle?.textContent).toContain('显示凭据')

    fireEvent.click(toggle as Element)
    expect(container.textContent).toContain(FULL_KEY)
    expect(toggle?.getAttribute('aria-pressed')).toBe('true')
    expect(toggle?.textContent).toContain('隐藏凭据')

    fireEvent.click(toggle as Element)
    expect(container.textContent).not.toContain(SECRET_TAIL)
  })

  it('围栏代码块里的密钥同样遮住,展开后随正文一起恢复', () => {
    const { container } = render(
      <UserMessageBody content={'```\nAuthorization: Bearer ' + FULL_KEY + '\n```'} secretMaskLabels={LABELS} />,
    )
    const code = container.querySelector('[data-testid="user-message-code"]')
    expect(code?.textContent).not.toContain(SECRET_TAIL)
    expect(container.textContent).toContain('∗')

    fireEvent.click(container.querySelector('[data-testid="user-message-secret-toggle"]') as Element)
    expect(code?.textContent).toContain(FULL_KEY)
  })

  it('没有凭据的消息不渲染遮挡按钮,正文逐字不变', () => {
    const { container } = render(
      <UserMessageBody content="今天把登录页文案改成一句话" secretMaskLabels={LABELS} />,
    )
    expect(container.querySelector('[data-testid="user-message-secret-toggle"]')).toBeNull()
    expect(container.textContent).toContain('今天把登录页文案改成一句话')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
