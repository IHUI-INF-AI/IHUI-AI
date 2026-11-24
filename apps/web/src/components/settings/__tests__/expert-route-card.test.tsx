// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// PLACEHOLDER

// @vitest-environment jsdom
/**
 * D09 设置项验收用例(2026-10-24):
 *   - 三档齐全,未表态时界面显示后端默认档 hint 并标出"默认"
 *   - 选择档位写入 chat store 与 localStorage(请求侧链路既有)
 *   - envLocked=true ⇒ 三档全只读 + 说明原因,点击不改任何偏好(不得谎报可改)
 *   - 镜像取不到 ⇒ 保持可改,但也不声称已锁定
 *
 * 词包取材面 = 工作树 JSON;断言按 `settings.expertRoute.*` 取值。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { NextIntlClientProvider } from 'next-intl'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchExpertRoute: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  fetchAiServiceJson: mocks.fetchExpertRoute,
}))

import { ExpertRouteCard } from '../expert-route-card'
import { useChatStore } from '@/stores/chat'

const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf-8'),
) as { settings: { expertRoute: Record<string, string> } }

const pack = messages.settings.expertRoute

function k(key: string): string {
  const value = pack[key]
  if (typeof value !== 'string') throw new Error(`词包缺键 settings.expertRoute.${key}`)
  return value
}

const MODES = ['hint', 'auto', 'off'] as const

function renderCard() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={{ settings: { expertRoute: pack } }}>
      <ExpertRouteCard />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchExpertRoute.mockResolvedValue({
    success: true,
    data: { code: 0, message: 'ok', data: { mode: 'hint', envLocked: false } },
  })
  useChatStore.setState({ expertAutoRoute: null })
  localStorage.removeItem('ihui_expert_auto_route')
})

afterEach(() => {
  cleanup()
  localStorage.removeItem('ihui_expert_auto_route')
})

describe('ExpertRouteCard', () => {
  it('三档齐全,未表态时显示默认档 hint 并标出默认', async () => {
    const ui = renderCard()
    await vi.waitFor(() => expect(mocks.fetchExpertRoute).toHaveBeenCalledWith('/llm/expert-route'))

    for (const m of MODES) {
      expect(ui.getByTestId(`expert-route-option-${m}`)).not.toBeNull()
    }
    expect(ui.getByTestId('expert-route-option-hint').getAttribute('aria-pressed')).toBe('true')
    expect(ui.getByTestId('expert-route-option-auto').getAttribute('aria-pressed')).toBe('false')
    expect(ui.getByTestId('expert-route-option-off').getAttribute('aria-pressed')).toBe('false')
    expect(ui.getByText(k('default'))).not.toBeNull()
    expect(ui.getByText(k('hintDesc'))).not.toBeNull()
  })

  it('选择档位写入 store 与 localStorage', async () => {
    const ui = renderCard()
    await vi.waitFor(() => expect(mocks.fetchExpertRoute).toHaveBeenCalled())

    fireEvent.click(ui.getByTestId('expert-route-option-auto'))
    expect(useChatStore.getState().expertAutoRoute).toBe('auto')
    expect(localStorage.getItem('ihui_expert_auto_route')).toBe('auto')
    expect(ui.getByTestId('expert-route-option-auto').getAttribute('aria-pressed')).toBe('true')
    expect(ui.queryByText(k('default'))).toBeNull()
  })

  it('envLocked 时三档只读并说明原因,点击不改偏好', async () => {
    mocks.fetchExpertRoute.mockResolvedValue({
      success: true,
      data: { code: 0, message: 'ok', data: { mode: 'off', envLocked: true } },
    })
    const ui = renderCard()
    await ui.findByText(k('envLockedNotice'))

    for (const m of MODES) {
      const button = ui.getByTestId(`expert-route-option-${m}`) as HTMLButtonElement
      expect(button.disabled).toBe(true)
    }
    // 部署方钉死 off ⇒ 界面如实显示 off 生效
    expect(ui.getByTestId('expert-route-option-off').getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(ui.getByTestId('expert-route-option-auto'))
    expect(useChatStore.getState().expertAutoRoute).toBeNull()
    expect(localStorage.getItem('ihui_expert_auto_route')).toBeNull()
  })

  it('镜像取不到时保持可改,不声称已锁定', async () => {
    mocks.fetchExpertRoute.mockRejectedValue(new Error('network down'))
    const ui = renderCard()
    await vi.waitFor(() => expect(mocks.fetchExpertRoute).toHaveBeenCalled())

    expect(ui.queryByText(k('envLockedNotice'))).toBeNull()
    const auto = ui.getByTestId('expert-route-option-auto') as HTMLButtonElement
    expect(auto.disabled).toBe(false)
    fireEvent.click(auto)
    expect(useChatStore.getState().expertAutoRoute).toBe('auto')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
