// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D45 ambient suggestions 环境建议条测试(2026-09-24 立;2026-11-14 改为模型生成指令)。
// 形态参照 components/ai/__tests__/injection-bar.test.tsx(vi.mock next-intl + 真实 zh-CN 词包)。
// 覆盖:① 模型建议上屏;② 采纳=一键发送(onAdopt 收到完整指令)且整组立即收起;
//      ③ 流式中/无助手回复/生成失败/空结果不渲染;④ 不侵入正文(无悬浮/遮罩/原生 title);
//      ⑤ 无固定标题/占位按钮/单条关闭按钮,只呈现真实模型建议。
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir } = await import('node:path')
  const { join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const node = resolve(ns)
        const raw = node?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

const apiMock = vi.hoisted(() => ({
  generateFollowUpSuggestions: vi.fn(),
}))
vi.mock('@ihui/api-client', () => ({
  generateFollowUpSuggestions: apiMock.generateFollowUpSuggestions,
}))

import { AmbientSuggestions } from '../ambient-suggestions'
import type { ChatMessage } from '@/stores/chat'

const PROMPTS = ['检查 src/auth.ts 的登录校验并补齐单元测试', '运行 pnpm test 验证本次改动']

const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: '帮我修复登录 bug', createdAt: 1 },
  { id: 'a1', role: 'assistant', content: '已完成修改。', createdAt: 2 },
]

let conversationSeq = 0

function renderBar(
  overrides: {
    messages?: ChatMessage[]
    isStreaming?: boolean
    onAdopt?: (prompt: string) => void
  } = {},
) {
  const onAdopt = overrides.onAdopt ?? vi.fn()
  const utils = render(
    <AmbientSuggestions
      messages={overrides.messages ?? messages}
      conversationId={`conv-${++conversationSeq}`}
      isStreaming={overrides.isStreaming ?? false}
      onAdopt={onAdopt}
    />,
  )
  return { ...utils, onAdopt }
}

beforeEach(() => {
  apiMock.generateFollowUpSuggestions.mockReset()
  apiMock.generateFollowUpSuggestions.mockResolvedValue({
    success: true,
    data: { suggestions: PROMPTS },
  })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('D45 模型建议条', () => {
  it('回合结束后展示模型生成的真实指令(而非固定标签)', async () => {
    const { container } = renderBar()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="ambient-suggestion-0"]')).not.toBeNull()
    })
    expect(container.textContent).toContain(PROMPTS[0])
    expect(container.textContent).toContain(PROMPTS[1])
    // 只呈现真实模型建议:不得出现「下一步建议」等固定标题文案
    expect(container.textContent).not.toContain('下一步建议')
    expect(apiMock.generateFollowUpSuggestions).toHaveBeenCalledTimes(1)
    // 只呈现真实模型建议:不得出现占位按钮、整体关闭按钮或单条关闭按钮
    expect(container.querySelector('[data-testid="ambient-suggestions-restore"]')).toBeNull()
    expect(container.querySelector('[data-testid="ambient-suggestions-close"]')).toBeNull()
    expect(container.querySelector('[data-testid="ambient-suggestion-dismiss-0"]')).toBeNull()
    const arg = apiMock.generateFollowUpSuggestions.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(arg.messages).toEqual([
      { role: 'user', content: '帮我修复登录 bug' },
      { role: 'assistant', content: '已完成修改。' },
    ])
  })

  it('采纳 = 一键发送:onAdopt 收到完整指令,整组建议立即收起', async () => {
    const onAdopt = vi.fn()
    const { container } = renderBar({ onAdopt })
    await waitFor(() => {
      expect(container.querySelector('[data-testid="ambient-suggestion-adopt-0"]')).not.toBeNull()
    })
    fireEvent.click(
      container.querySelector('[data-testid="ambient-suggestion-adopt-0"]') as HTMLElement,
    )
    expect(onAdopt).toHaveBeenCalledWith(PROMPTS[0])
    // 用户选完后整组消失,直到下一轮助手回复完成才会重新生成
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })
})

describe('D45 生成边界', () => {
  it('流式中不请求、不渲染(只在回合结束后给下一步)', () => {
    const { container } = renderBar({ isStreaming: true })
    expect(apiMock.generateFollowUpSuggestions).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })

  it('只有用户消息(无助手回复)不请求、不渲染', () => {
    const { container } = renderBar({
      messages: [{ id: 'u1', role: 'user', content: '你好', createdAt: 1 }],
    })
    expect(apiMock.generateFollowUpSuggestions).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })

  it('生成失败不渲染假建议', async () => {
    apiMock.generateFollowUpSuggestions.mockRejectedValueOnce(new Error('network down'))
    const { container } = renderBar()
    await waitFor(() => {
      expect(apiMock.generateFollowUpSuggestions).toHaveBeenCalledTimes(1)
    })
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })

  it('模型返回空数组不渲染建议条', async () => {
    apiMock.generateFollowUpSuggestions.mockResolvedValueOnce({
      success: true,
      data: { suggestions: [] },
    })
    const { container } = renderBar()
    await waitFor(() => {
      expect(apiMock.generateFollowUpSuggestions).toHaveBeenCalledTimes(1)
    })
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })
})

describe('D45 建议条不侵入正文', () => {
  it('常规文档流容器:无 absolute/fixed 悬浮、无渐变遮罩、无原生 title', async () => {
    const { container } = renderBar()
    await waitFor(() => {
      expect(container.querySelector('[data-testid="ambient-suggestions"]')).not.toBeNull()
    })
    const bar = container.querySelector('[data-testid="ambient-suggestions"]') as HTMLElement
    expect(bar.className).not.toMatch(/absolute|fixed|bg-gradient|backdrop-blur/)
    // 组件树内不允许任何原生 title 提示(规范禁用,无障碍用 aria-label 替代)
    expect(container.querySelector('[title]')).toBeNull()
    // 常规文档流:position 非悬浮
    const position = bar.style.position || window.getComputedStyle(bar).position
    expect(['static', 'relative', '']).toContain(position)
  })
})
