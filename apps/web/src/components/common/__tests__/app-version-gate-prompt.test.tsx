// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// AppVersionGatePrompt 的接线锁(2026-10-27 立)。
//
// 这组用例存在的唯一理由:此前"闸门有判定没渲染"这件事**没有任何机器判据** ——
// lib 单测 25 条全绿、服务端策略也真的在跑,但用户端一个像素都不出现。
// 所以这里只钉三件事:
//   ① 强更决策 ⇒ 真的渲染出阻塞弹窗(role=alertdialog),且 skip/cancel 侧门不渲染;
//   ② 普通更新 ⇒ 渲染成可关闭的卡片(与 PWA 提示同款),关闭后消失;
//   ③ 无更新 / fail-open ⇒ 什么都不渲染(不许无中生有地拦住用户)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) =>
    params ? `${key}(${Object.keys(params).sort().join(',')})` : key,
}))

// 只 mock 出用到的 CloseButton,不加载 @ihui/ui-react 的整个 barrel:
// 那条 barrel 会连带拉进 login-form 等一大片组件,别人在途改动的半成品会让本测试在
// 收集期就炸(实测 2026-10-27 别席改 third-party-login-buttons 时就是这样),
// 而本测试要验的是闸门渲染端,跟登录表单毫无关系。
vi.mock('@ihui/ui-react', async () => {
  const React = await import('react')
  return {
    CloseButton: (props: { onClick?: () => void; 'aria-label'?: string }) =>
      React.createElement(
        'button',
        { type: 'button', onClick: props.onClick, 'aria-label': props['aria-label'] },
        '×',
      ),
  }
})

vi.mock('@ihui/api-client/endpoints/system', () => ({
  checkAppVersion: vi.fn(),
}))

import { checkAppVersion } from '@ihui/api-client/endpoints/system'
import { appVersionGateCheck } from '@/lib/app-version-gate'
import { AppVersionGatePrompt } from '../AppVersionGatePrompt'

const mockedCheck = checkAppVersion as unknown as ReturnType<typeof vi.fn>

async function renderWithDecision(
  data: Record<string, unknown>,
  currentVersion = '1.0.0',
): Promise<void> {
  mockedCheck.mockResolvedValue({ success: true, data })
  render(<AppVersionGatePrompt />)
  await appVersionGateCheck({ currentVersion })
}

describe('AppVersionGatePrompt:强更决策必须真的渲染出阻塞弹窗', () => {
  beforeEach(() => mockedCheck.mockReset())
  afterEach(() => cleanup())

  it('forceUpdate ⇒ alertdialog 出现,且只有 manual/quit 两个动作', async () => {
    await renderWithDecision({ hasUpdate: true, forceUpdate: true, latestVersion: '2.0.0' })

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
    expect(screen.getByText('gateTitle')).toBeTruthy()
    // 强更会话里 skip/cancel 侧门被 gateAllowsAction 锁死 ⇒ 根本不渲染(不是渲染成死按钮)。
    // 钉死"恰好两个按钮":多一个就是又长回了点了没反应的东西。
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .sort()
    expect(labels).toEqual(['gateQuit', 'gateUpdateNow'])
  })

  it('普通更新 ⇒ 渲染成卡片,关闭后消失', async () => {
    await renderWithDecision({ hasUpdate: true, forceUpdate: false, latestVersion: '1.1.0' })

    await waitFor(() => expect(screen.getByText('title')).toBeTruthy())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    screen.getByLabelText('close').click()
    await waitFor(() => expect(screen.queryByText('title')).toBeNull())
  })

  it('无更新 ⇒ 什么都不渲染', async () => {
    await renderWithDecision({ hasUpdate: false, forceUpdate: false })
    await waitFor(() => expect(mockedCheck).toHaveBeenCalled())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('title')).toBeNull()
  })

  it('端点失败(fail-open)⇒ 不拦用户,不渲染任何东西', async () => {
    // 走"端点返回 success=false"这条 fail-open 分支(与抛错分支同归 kind='error',
    // 抛错分支的 catch 行为由 lib 单测钉住);渲染端对两者的反应必须一致:什么都不渲染。
    mockedCheck.mockResolvedValue({ success: false })
    render(<AppVersionGatePrompt />)
    await appVersionGateCheck({ currentVersion: '1.0.0' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('title')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
