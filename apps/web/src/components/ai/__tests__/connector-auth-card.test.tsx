// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CONNECTOR_AUTH_STATES, type ConnectorAuthAction } from '../connector-auth-card'
import { ConnectorAuthCard } from '../connector-auth-card'

// 只断言**结构与判据**(五态 / 负向出口恒在 / 插值 / 拒绝不阻断),文案一律走 key;
// 真实文案与五语言 parity 由下面「读真实词包」那组用例守住。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D78 ConnectorAuthCard / 五态渲染(G-107)', () => {
  it('五态逐个渲染出 data-connector-auth-state 与状态标签', () => {
    for (const state of CONNECTOR_AUTH_STATES) {
      const { container, unmount } = render(
        <ConnectorAuthCard connectorName="飞书" state={state} />,
      )
      expect(
        container.querySelector(`[data-connector-auth-state="${state}"]`),
        state,
      ).not.toBeNull()
      const label = container.querySelector('[data-connector-auth-label]')
      expect((label?.textContent ?? '').length, state).toBeGreaterThan(0)
      unmount()
    }
  })

  it('未连接态:标题带 {connectorName} 插值,正向动作是「连接」', () => {
    const { container } = render(
      <ConnectorAuthCard connectorName="飞书" state="disconnected" onAction={vi.fn()} />,
    )
    const label = container.querySelector('[data-connector-auth-label="title"]')
    expect(label?.textContent).toBe('title({"connectorName":"飞书"})')
    expect(container.querySelector('[data-action="connect"]')).not.toBeNull()
  })

  it('连接中态:不渲染正向动作按钮(避免重复发起),状态标签可见', () => {
    const { container } = render(
      <ConnectorAuthCard connectorName="飞书" state="connecting" />,
    )
    expect(container.querySelector('[data-action="connect"]')).toBeNull()
    expect(
      container.querySelector('[data-connector-auth-label="connecting"]')?.textContent,
    ).toBe('connecting')
  })

  it('已连接态:渲染 connected 标签,无授权决策按钮', () => {
    const { container } = render(
      <ConnectorAuthCard connectorName="飞书" state="connected" />,
    )
    expect(
      container.querySelector('[data-connector-auth-label="connected"]')?.textContent,
    ).toBe('connected')
    expect(container.querySelector('[data-action="connect"]')).toBeNull()
    expect(container.querySelector('[data-action="reconnect"]')).toBeNull()
    expect(container.querySelector('[data-action="decline"]')).toBeNull()
  })

  it('需重连态:动作带 {connectorName} 插值(重新连接 {connectorName})', () => {
    const onAction = vi.fn()
    const { container } = render(
      <ConnectorAuthCard connectorName="语雀" state="reconnect" onAction={onAction} />,
    )
    const button = container.querySelector('[data-action="reconnect"]') as HTMLButtonElement
    expect(button.textContent).toBe('reconnect({"connectorName":"语雀"})')
    button.click()
    expect(onAction).toHaveBeenCalledWith('reconnect')
  })

  it('已拒绝态:渲染 declined 提示(含连接器名),无授权决策按钮', () => {
    const { container } = render(
      <ConnectorAuthCard connectorName="企业微信" state="declined" />,
    )
    expect(
      container.querySelector('[data-connector-auth-label="declined"]')?.textContent,
    ).toBe('declined({"connectorName":"企业微信"})')
    expect(container.querySelector('[data-action="decline"]')).toBeNull()
  })
})

describe('D78 ConnectorAuthCard / 负向出口与拒绝不阻断', () => {
  it('凡需授权决策的三态,「暂不」恒在(disconnected/connecting/reconnect)', () => {
    for (const state of ['disconnected', 'connecting', 'reconnect'] as const) {
      const { container, unmount } = render(
        <ConnectorAuthCard connectorName="飞书" state={state} onAction={vi.fn()} />,
      )
      expect(container.querySelector('[data-connector-auth-decline-available="true"]'), state).not.toBeNull()
      expect(container.querySelector('[data-action="decline"]'), state).not.toBeNull()
      unmount()
    }
  })

  it('点「暂不」→ onAction(decline) 不抛错,且同流后续消息照常渲染(对话继续语义)', () => {
    const onAction = vi.fn()
    const { container } = render(
      <div>
        <ConnectorAuthCard connectorName="飞书" state="disconnected" onAction={onAction} />
        <p data-next-message="true">本轮对话的后续内容</p>
      </div>,
    )
    const decline = container.querySelector('[data-action="decline"]') as HTMLButtonElement
    expect(() => decline.click()).not.toThrow()
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith<ConnectorAuthAction[]>('decline')
    // 拒绝后消息流未被卸载/破坏:后续消息仍在文档中
    expect(container.querySelector('[data-next-message="true"]')).not.toBeNull()
    // 卡片本体仍在(切换到 declined 提示态由宿主状态驱动,组件不做破坏性自毁)
    expect(container.querySelector('[data-testid="connector-auth-card"]')).not.toBeNull()
  })

  it('已拒绝态下对话流可继续:卡片不再索要授权,后续内容不受影响', () => {
    const onAction = vi.fn()
    const { container } = render(
      <div>
        <ConnectorAuthCard connectorName="飞书" state="declined" onAction={onAction} />
        <p data-next-message="true">后续回答</p>
      </div>,
    )
    expect(container.querySelector('[data-connector-auth-decline-available="false"]')).not.toBeNull()
    expect(container.querySelector('[data-next-message="true"]')).not.toBeNull()
  })

  it('不传 onAction ⇒ 决策按钮不渲染(纯展示形态不误导)', () => {
    const { container } = render(
      <ConnectorAuthCard connectorName="飞书" state="disconnected" />,
    )
    expect(container.querySelector('[data-action="connect"]')).toBeNull()
    expect(container.querySelector('[data-action="decline"]')).toBeNull()
    expect(container.querySelector('[data-action="moreInfo"]')).toBeNull()
  })
})

describe('D78 词表覆盖(读真实词包,不 mock)', () => {
  const KEYS = [
    'title',
    'connected',
    'reconnect',
    'connect',
    'connecting',
    'moreInfo',
    'decline',
    'declined',
  ] as const

  const readChat = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { chat?: { connectorAuth?: Record<string, unknown> } }
    const node = parsed.chat?.connectorAuth
    if (!node) throw new Error(`missing chat.connectorAuth in ${locale}.json`)
    return node
  }

  it('五语言 chat.connectorAuth 八键齐备且取值非空', () => {
    for (const locale of LOCALES) {
      const node = readChat(locale)
      for (const key of KEYS) {
        const value = node[key]
        expect(typeof value, `${locale} ${key}`).toBe('string')
        expect((value as string).trim().length, `${locale} ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('{connectorName} 插值占位符在 title/reconnect/declined 三键五语言一致', () => {
    for (const locale of LOCALES) {
      const node = readChat(locale) as Record<string, string>
      for (const key of ['title', 'reconnect', 'declined']) {
        expect(node[key], `${locale} ${key}`).toContain('{connectorName}')
      }
      for (const key of ['connected', 'connect', 'connecting', 'moreInfo', 'decline']) {
        expect(node[key], `${locale} ${key}`).not.toContain('{connectorName}')
      }
    }
  })

  it('zh-CN 负向出口逐字为「暂不」,标题逐字为「连接到 {connectorName}」(防自创措辞)', () => {
    const node = readChat('zh-CN') as Record<string, string>
    expect(node.decline).toBe('暂不')
    expect(node.title).toBe('连接到 {connectorName}')
    expect(node.connected).toBe('已连接')
    expect(node.reconnect).toBe('重新连接 {connectorName}')
    expect(node.moreInfo).toBe('更多信息')
  })

  it('zh-TW 走繁体正字(不得与 zh-CN 同形)', () => {
    const node = readChat('zh-TW') as Record<string, string>
    expect(node.decline).toBe('暫不')
    expect(node.title).toBe('連接到 {connectorName}')
    expect(node.moreInfo).toBe('更多資訊')
  })
})
// [IHUI-AI-PROVENANCE]:
