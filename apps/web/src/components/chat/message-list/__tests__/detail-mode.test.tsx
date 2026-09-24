// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D45 会话详情聚合档位测试(2026-09-24 立)。
// 形态参照 components/ai/__tests__/injection-bar.test.tsx(vi.mock next-intl + 真实 zh-CN 词包)。
// 覆盖:① 三档过滤纯函数(steps 直通 / commands 仅命令与文件写入类 / narrative 仅叙述);
//      ② 档位切换器渲染与选中态;③ 档位持久化(localStorage zustand persist 产物);
//      ④ 五语词包 parity。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../../packages/i18n/messages/web/zh-CN.json',
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

import {
  applyConversationDetailMode,
  isCommandToolCall,
} from '../detail-mode-filter'
import { DetailModeSwitcher } from '../detail-mode-switcher'
import { useConversationDetailModeStore } from '@/stores/conversation-detail-mode'
import type { ChatMessage, ToolCall } from '@/stores/chat'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')

function toolCall(toolName: string, id: string): ToolCall {
  return { id, toolName, args: {}, status: 'success' }
}

function msg(partial: Partial<ChatMessage> & { id: string; role: ChatMessage['role'] }): ChatMessage {
  return { content: '', createdAt: 1, ...partial }
}

/** 基线对话:提问 + 纯叙述回答 + 混合活动回答 + 挂起提问回答 */
function baseMessages(): ChatMessage[] {
  return [
    msg({ id: 'u1', role: 'user', content: '帮我跑一下测试' }),
    msg({ id: 'a1', role: 'assistant', content: '好的,这是计划说明叙述。' }),
    msg({
      id: 'a2',
      role: 'assistant',
      content: '叙述正文,执行了命令并读了文件。',
      toolCalls: [toolCall('read_file', 't1'), toolCall('bash', 't2'), toolCall('write_file', 't3')],
    }),
    msg({ id: 'a3', role: 'assistant', content: '' }),
  ]
}

afterEach(() => {
  cleanup()
  useConversationDetailModeStore.setState({ mode: 'steps', suggestionsEnabled: true })
  window.localStorage.clear()
})

describe('D45 detail-mode-filter 三档过滤', () => {
  it('steps 档:全部步骤直通,不丢弃任何消息与条目', () => {
    const messages = baseMessages()
    const out = applyConversationDetailMode(messages, 'steps')
    expect(out).toHaveLength(messages.length)
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1', 'a2', 'a3'])
    // a2 条目一个不少
    const a2 = out.find((m) => m.id === 'a2')
    expect(a2?.toolCalls).toHaveLength(3)
    expect(a2?.content).not.toBe('')
  })

  it('commands 档:隐藏非命令类条目(read_file 被滤掉),保留命令与文件写入', () => {
    const out = applyConversationDetailMode(baseMessages(), 'commands')
    // 纯叙述回答 a1 被整条隐藏;空消息 a3 亦隐藏
    expect(out.map((m) => m.id)).toEqual(['u1', 'a2'])
    const a2 = out.find((m) => m.id === 'a2')
    expect(a2?.toolCalls?.map((tc) => tc.toolName)).toEqual(['bash', 'write_file'])
    // 命令视图隐藏叙述正文
    expect(a2?.content).toBe('')
    // 用户提问不受档位影响
    expect(out.find((m) => m.id === 'u1')?.content).toBe('帮我跑一下测试')
  })

  it('commands 档:挂起提问与错误交代保留(不被聚合粒度吞掉)', () => {
    const messages = [
      msg({
        id: 'q1',
        role: 'assistant',
        content: '请选择方案',
        question: { questionId: 'q', prompt: '请选择方案', options: [], allowCustom: true, allowMultiple: false },
      }),
      msg({ id: 'e1', role: 'assistant', content: '执行失败:超时', error: true }),
    ]
    const out = applyConversationDetailMode(messages, 'commands')
    expect(out.map((m) => m.id)).toEqual(['q1', 'e1'])
    expect(out[0]?.content).toBe('请选择方案')
    expect(out[1]?.content).toBe('执行失败:超时')
  })

  it('narrative 档:只保留叙述性内容,隐藏全部工具条目', () => {
    const out = applyConversationDetailMode(baseMessages(), 'narrative')
    // a3 无正文被隐藏;a1/a2 保留
    expect(out.map((m) => m.id)).toEqual(['u1', 'a1', 'a2'])
    const a2 = out.find((m) => m.id === 'a2')
    expect(a2?.toolCalls).toBeUndefined()
    expect(a2?.content).toContain('叙述正文')
  })

  it('isCommandToolCall:命令与文件写入类为真,读/搜/浏览为假', () => {
    for (const name of ['bash', 'run_command', 'execute_command', 'shell', 'write_file', 'edit_file', 'delete_file']) {
      expect(isCommandToolCall(name)).toBe(true)
    }
    for (const name of ['read_file', 'grep', 'web_search', 'browser_navigate', 'mcp__x__y']) {
      expect(isCommandToolCall(name)).toBe(false)
    }
  })
})

describe('D45 档位切换器与持久化', () => {
  it('三选一胶囊渲染,选中态 aria-checked', () => {
    const { container } = render(<DetailModeSwitcher />)
    const group = container.querySelector('[data-testid="detail-mode-switcher"]')
    expect(group).not.toBeNull()
    for (const m of ['steps', 'commands', 'narrative']) {
      const btn = container.querySelector(`[data-testid="detail-mode-${m}"]`)
      expect(btn).not.toBeNull()
    }
    expect(
      container.querySelector('[data-testid="detail-mode-steps"]')?.getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('点击切换档位并持久化到 localStorage(zustand persist 产物)', () => {
    const { container } = render(<DetailModeSwitcher />)
    fireEvent.click(container.querySelector('[data-testid="detail-mode-commands"]') as HTMLElement)
    expect(useConversationDetailModeStore.getState().mode).toBe('commands')
    const raw = window.localStorage.getItem('ihui-conversation-detail-mode')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { state: { mode: string; suggestionsEnabled: boolean } }
    expect(parsed.state.mode).toBe('commands')
  })

  it('建议条整体开关同样持久化', () => {
    useConversationDetailModeStore.getState().setSuggestionsEnabled(false)
    const parsed = JSON.parse(
      window.localStorage.getItem('ihui-conversation-detail-mode') as string,
    ) as { state: { suggestionsEnabled: boolean } }
    expect(parsed.state.suggestionsEnabled).toBe(false)
    useConversationDetailModeStore.getState().setSuggestionsEnabled(true)
    const after = JSON.parse(
      window.localStorage.getItem('ihui-conversation-detail-mode') as string,
    ) as { state: { suggestionsEnabled: boolean } }
    expect(after.state.suggestionsEnabled).toBe(true)
  })
})

describe('D45 五语词包 parity', () => {
  const files = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'] as const
  it('conversationDetailMode / ambientSuggestions 键集合五语一致', () => {
    let modeKeys: string | undefined
    let ambientKeys: string | undefined
    for (const f of files) {
      const pack = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${f}.json`), 'utf8')) as {
        conversationDetailMode: Record<string, string>
        ambientSuggestions: Record<string, string>
      }
      const mk = Object.keys(pack.conversationDetailMode).sort().join(',')
      const ak = Object.keys(pack.ambientSuggestions).sort().join(',')
      if (modeKeys === undefined) modeKeys = mk
      if (ambientKeys === undefined) ambientKeys = ak
      expect(mk).toBe(modeKeys)
      expect(ak).toBe(ambientKeys)
      // 值非空
      for (const v of Object.values(pack.conversationDetailMode)) expect(v.length).toBeGreaterThan(0)
      for (const v of Object.values(pack.ambientSuggestions)) expect(v.length).toBeGreaterThan(0)
    }
    expect(modeKeys).toBe('commands,label,narrative,steps')
    expect(ambientKeys).toBe(
      'close,dismiss,restore,suggestionAnswerQuestion,suggestionContinueTopic,suggestionResumeTask,suggestionReviewFiles,title',
    )
  })
})
