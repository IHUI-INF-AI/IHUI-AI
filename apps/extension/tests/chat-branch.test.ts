// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话分叉(branch)接线测试 —— 测的是端内**真模块** chat-branch-utils,
// 不 mock 判据本身;另附一条"装车证明":宿主 ChatPage 必须真的经
// @ihui/api-client 的 branchConversation 出口调用后端(裸 fetch 属违规)。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  branchTargetServerId,
  failureReasonText,
  failureStatusText,
  hydrateBranchTranscript,
  type ServerIdMap,
} from '../entrypoints/sidepanel/pages/chat-branch-utils'

import zhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import zhTW from '@ihui/i18n/messages/extension/zh-TW.json'
import en from '@ihui/i18n/messages/extension/en.json'
import ja from '@ihui/i18n/messages/extension/ja.json'
import ko from '@ihui/i18n/messages/extension/ko.json'

const msg = (id: string, role: string, content = '正文') => ({ id, role, content })
const persisted = (id: string, role: string, content = '正文') => ({ id, role, content })

/** 已落库的 assistant 回复:唯一可分叉的形态 */
const mapped: ServerIdMap = { 'a-1': '0f9c…server' }

describe('branchTargetServerId(分叉准入判据)', () => {
  it('已落库的非空 assistant 回复给出后端 messageId', () => {
    expect(branchTargetServerId(msg('a-1', 'assistant'), mapped, { streaming: false })).toBe(
      '0f9c…server',
    )
  })

  it('流式生成中一律不给分叉(此刻正文还没落库,分过去是半截回复)', () => {
    expect(branchTargetServerId(msg('a-1', 'assistant'), mapped, { streaming: true })).toBeNull()
  })

  it('用户消息不可分叉(分叉的对象是 AI 回复)', () => {
    expect(
      branchTargetServerId(msg('u-1', 'user'), { 'u-1': 'srv-u' }, { streaming: false }),
    ).toBeNull()
  })

  it('空正文不可分叉', () => {
    expect(
      branchTargetServerId(msg('a-1', 'assistant', '   '), mapped, { streaming: false }),
    ).toBeNull()
  })

  it('未持久化成功(没有后端 id)不给分叉 —— 否则后端必然 404', () => {
    expect(branchTargetServerId(msg('a-9', 'assistant'), mapped, { streaming: false })).toBeNull()
    expect(branchTargetServerId(msg('a-1', 'assistant'), {}, { streaming: false })).toBeNull()
  })
})

describe('hydrateBranchTranscript(分支回来的会话整页换装)', () => {
  it('保留 user/assistant 顺序,并给出恒等 id 映射(新会话上可继续逐条分叉)', () => {
    const out = hydrateBranchTranscript([
      persisted('m-1', 'user'),
      persisted('m-2', 'assistant'),
      persisted('m-3', 'user'),
    ])
    expect(out.messages.map((m) => m.id)).toEqual(['m-1', 'm-2', 'm-3'])
    expect(out.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(out.serverIds).toEqual({ 'm-1': 'm-1', 'm-2': 'm-2', 'm-3': 'm-3' })
  })

  it('丢掉 system 与空正文(端内气泡没有这两种形态)', () => {
    const out = hydrateBranchTranscript([
      persisted('s-0', 'system', '你是助手'),
      persisted('m-1', 'user'),
      persisted('m-2', 'assistant', ''),
    ])
    expect(out.messages.map((m) => m.id)).toEqual(['m-1'])
    expect(Object.keys(out.serverIds)).toEqual(['m-1'])
  })

  it('空列表返回空结构而不是 undefined', () => {
    expect(hydrateBranchTranscript([])).toEqual({ messages: [], serverIds: {} })
  })
})

describe('失败文案必须带服务状态码(禁止静默 return)', () => {
  it('状态码存在则如实输出', () => {
    expect(failureStatusText(502)).toBe('502')
    expect(failureStatusText(404)).toBe('404')
  })

  it('状态码取不到时写 unknown,不得留空串', () => {
    expect(failureStatusText(undefined)).toBe('unknown')
    expect(failureStatusText(undefined)).not.toBe('')
  })

  it('后端原因优先,空白/缺失时退到 network error', () => {
    expect(failureReasonText('会话已归档')).toBe('会话已归档')
    expect(failureReasonText('  ')).toBe('network error')
    expect(failureReasonText(undefined)).toBe('network error')
    expect(failureReasonText(null)).toBe('network error')
  })
})

describe('i18n 取词(五语言齐备,禁止硬编码中文)', () => {
  const keys = [
    'branchFromHere',
    'branchDone',
    'branchFailed',
    'conversationCreateFailed',
    'messageSaveFailed',
  ] as const
  const locales: Array<[string, { chat: Record<string, string> }]> = [
    ['zh-CN', zhCN],
    ['zh-TW', zhTW],
    ['en', en],
    ['ja', ja],
    ['ko', ko],
  ]

  for (const [lang, bundle] of locales) {
    for (const key of keys) {
      it(`${lang} chat.${key} 有非空译文且保留占位符`, () => {
        const value = bundle.chat[key]
        expect(typeof value).toBe('string')
        expect((value ?? '').trim()).not.toBe('')
        if (
          key === 'branchFailed' ||
          key === 'conversationCreateFailed' ||
          key === 'messageSaveFailed'
        ) {
          expect(value).toContain('{reason}')
          expect(value).toContain('{status}')
        }
      })
    }
  }
})

describe('装车证明:宿主真的接上了 api-client 出口', () => {
  const hostPath = fileURLToPath(
    new URL('../entrypoints/sidepanel/pages/ChatPage.tsx', import.meta.url),
  )
  const host = readFileSync(hostPath, 'utf8')

  it('从 @ihui/api-client 引入 branchConversation 并在宿主里调用', () => {
    expect(host).toMatch(/branchConversation,?\n?\s*[^]*?from '@ihui\/api-client'/)
    expect(host).toMatch(/await branchConversation\(/)
  })

  it('分叉回来的消息由服务端回读(getMessages),不是本地复制', () => {
    expect(host).toMatch(/getConversationMessages\(/)
    expect(host).toMatch(/hydrateBranchTranscript\(/)
  })

  it('宿主不得绕过 api-client 裸调后端(守门 73)', () => {
    expect(host).not.toMatch(/\bfetch\(/)
    expect(host).not.toMatch(/axios/)
    expect(host).not.toMatch(/XMLHttpRequest/)
  })

  it('按钮文案取词而非硬编码', () => {
    expect(host).toContain("t('chat.branchFromHere')")
    expect(host).toContain("t('chat.branchFailed'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
