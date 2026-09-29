// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D131 对话流保真③:连接状态件上屏的挂载判据。
//
// 钉三件事,缺一条就退化成"组件存在但没人挂":
//  ① 正向:异常态(重连中 / 已断开)必须真的出现在屏幕上;
//  ② **反向对照**:正常态(已连接 / 连接中)屏幕上必须**搜不到**该件 ——
//     用户批准的口径是"仅异常态常驻",没有这一条那句就只是文案;
//  ③ 装车证明:生产面(message-input.tsx 的输入区 chrome)必须 import 这条 chrome,
//     且 `progress-sections/connection-status` 的生产 importer 数 ≥ 1(排除测试面)。
//     —— 本票立项时它俩都是 0,而组件与 deriveConnectionState 的全部命中都在测试文件里。

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

const { mockT } = vi.hoisted(() => {
  const map: Record<string, string> = {
    'sseStatus.connected': '已连接',
    'sseStatus.connecting': '连接中',
    'sseStatus.reconnecting': '重连中',
    'sseStatus.disconnected': '已断开',
    'sseStatus.reconnectingShort': '重连 {n}/{max}',
    'sseStatus.disconnectedShort': '已断开',
  }
  const t = (key: string, values?: Record<string, string | number>) => {
    let out = map[key] ?? key
    for (const [k, v] of Object.entries(values ?? {})) out = out.replaceAll(`{${k}}`, String(v))
    return out
  }
  return { mockT: t }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

// Tooltip 自带 portal / 状态语义,本用例只判"件在不在屏上",不测提示浮层
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import {
  ConnectionStatusBar,
  clearStreamConnection,
  markStreamDisconnected,
  markStreamReconnecting,
} from '../../chat/connection-status-bar'

function renderBar(isStreaming: boolean, threadId: string | null = 'conv-1') {
  return render(<ConnectionStatusBar isStreaming={isStreaming} threadId={threadId} />)
}

function statusNodes(): Element[] {
  return Array.from(document.querySelectorAll('[data-testid^="connection-status-"]'))
}

beforeEach(() => {
  clearStreamConnection()
})

afterEach(() => {
  cleanup()
  clearStreamConnection()
})

describe('D131 ①:异常态必须上屏', () => {
  it('重连中:chrome 行里出现 reconnecting 态件,并带上第几次尝试', () => {
    markStreamReconnecting(2, 5)
    renderBar(true)

    const bar = screen.getByTestId('connection-status-bar')
    expect(bar.getAttribute('data-connection-state')).toBe('reconnecting')
    expect(screen.getByTestId('connection-status-reconnecting')).toBeTruthy()
    expect(bar.textContent).toContain('2/5')
  })

  it('已断开:落 disconnected,且断连原因跟着进 aria-label', () => {
    markStreamDisconnected('网络超时')
    renderBar(false)

    const bar = screen.getByTestId('connection-status-bar')
    expect(bar.getAttribute('data-connection-state')).toBe('disconnected')
    const status = screen.getByTestId('connection-status-disconnected')
    expect(status.getAttribute('aria-live')).toBe('assertive')
    expect(status.getAttribute('aria-label')).toContain('网络超时')
  })

  it('运行结束(true→false)兜底清账:重连中不得在流结束后继续占位', () => {
    markStreamReconnecting(3, 5)
    const { rerender } = renderBar(true)
    expect(screen.getByTestId('connection-status-reconnecting')).toBeTruthy()

    rerender(<ConnectionStatusBar isStreaming={false} threadId="conv-1" />)
    expect(statusNodes()).toHaveLength(0)
  })
})

describe('D131 ②:反向对照 —— 正常态屏幕上必须搜不到该件', () => {
  it('正在流式输出且无重连(=已连接):整条 chrome 不渲染不占位', () => {
    renderBar(true)
    expect(statusNodes()).toHaveLength(0)
    expect(screen.queryByTestId('connection-status-bar')).toBeNull()
    expect(document.body.textContent).not.toContain('已连接')
  })

  it('空闲且无错误(=连接中/待命):同样不渲染', () => {
    renderBar(false)
    expect(statusNodes()).toHaveLength(0)
    expect(screen.queryByTestId('connection-status-bar')).toBeNull()
  })

  it('没有会话(未打开对话):deriveConnectionState 会落 disconnected,但信号未置位时仍不得占位', () => {
    renderBar(false, null)
    // 会话为 null ⇒ 这一档不是"异常",而是"根本没在连";
    // chrome 只在被显式置位(markStream*)后才出现,所以这里必须为空。
    expect(screen.queryByTestId('connection-status-bar')).toBeNull()
  })
})

describe('D131 ③:装车证明(生产 importer,排除测试面)', () => {
  const repoRead = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('输入区 chrome 必须 import ConnectionStatusBar', () => {
    const src = repoRead('../../chat/message-input.tsx')
    expect(src).toContain("from '@/components/chat/connection-status-bar'")
    expect(src).toContain('<ConnectionStatusBar')
  })

  it('connection-status 四态件的生产 importer ≥1(命中不得只在测试面)', () => {
    const importer = repoRead('../../chat/connection-status-bar.tsx')
    expect(importer).toContain("from '@/components/ai/progress-sections/connection-status'")
    expect(importer).toContain('deriveConnectionState(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

describe('D131 ④:断开态不得被流收尾自己抹掉(生产者与清理必须能同时成立)', () => {
  it('流进行中落 disconnected 不占位(流还活着不算断开),而收尾后必须仍在屏上', () => {
    // 真实生产时序:onError 发生时 isStreaming 还挂着(收尾在同一轮里翻成 false)。
    // deriveConnectionState 认为"流还在跑"就不算断开 ⇒ 此刻不占位是**对的**;
    // 要判的是随后那次 true→false:若组件按"任何收尾都清账"处理,刚接上的通路会在
    // 同一帧内把自己关掉,屏幕上永远看不见断开态 —— 而从静态起点 render 的用例照样全绿。
    markStreamDisconnected('重连 5 次仍失败')
    const { rerender } = renderBar(true)
    expect(screen.queryByTestId('connection-status-disconnected')).toBeNull()

    rerender(<ConnectionStatusBar isStreaming={false} threadId="conv-1" />)
    expect(screen.getByTestId('connection-status-disconnected')).toBeTruthy()
  })

  it('反向对照:同一条 true→false 对 reconnecting 仍必须清账(不得把清理整条关掉)', () => {
    markStreamReconnecting(3, 5)
    const { rerender } = renderBar(true)
    rerender(<ConnectionStatusBar isStreaming={false} threadId="conv-1" />)
    expect(screen.queryByTestId('connection-status-reconnecting')).toBeNull()
  })

  it('下一轮发送开始(clearStreamConnection)⇒ 断开态归零,不留永久占位', () => {
    markStreamDisconnected('网络断开')
    renderBar(false)
    expect(screen.getByTestId('connection-status-disconnected')).toBeTruthy()
    clearStreamConnection()
    // 信号是模块级单例,组件经 useSyncExternalStore 订阅;清账后重渲染即应无件
    cleanup()
    renderBar(false)
    expect(statusNodes()).toHaveLength(0)
  })
})
