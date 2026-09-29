// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D184「选中文本作为附件」消费端合围(2026-09-29 立,对标竞品 chatSession.selectionActions)。
// 判据唯一源:apps/web/src/components/chat/message-input.tsx(D184 监听 effect)+
// apps/web/src/hooks/use-message-references.ts(G-833 三档校验)。
// MessageInput 体量大、依赖面广(仓内惯例 message-input-history.test.tsx 亦不整体挂载):
// 本文件两层合围 ——
//   行为层:真实 useMessageReferences 证明「选中的文本.txt」包装件真的过三档校验、
//           容量满(30/30)真的返回 max_files(消费端据此弹 attachmentLimitReached);
//   锚点层:宿主真的注册 ihui:add-selection-attachment 监听(带清理)并走同一包装/回报链,
//           派发端(MessageItem)真的派发同名事件 —— 防「件在库零引用」的单向悬空。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: false, error: 'mock-offline' })),
}))

import { CHAT_ATTACHMENT_MAX_FILES, useMessageReferences } from '@/hooks/use-message-references'

const MESSAGES_ROOT = resolve(process.cwd(), '../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

type SelectionActions = Record<string, string>

function readLocale(locale: (typeof LOCALES)[number]): {
  chat: { selectionActions: SelectionActions }
} {
  return JSON.parse(readFileSync(resolve(MESSAGES_ROOT, `${locale}.json`), 'utf-8')) as {
    chat: { selectionActions: SelectionActions }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // createObjectURL 在 happy-dom/jsdom 下可能缺真实现:统一桩,断言不依赖其返回值
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock/${Math.random()}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('D184 行为层:选中文本 .txt 包装件过 G-833 通道(真实 useMessageReferences)', () => {
  it('按 zh-CN 词包装文件名「选中的文本.txt」→ addFileReferences 收下,label=文件名', () => {
    const attachmentName = readLocale('zh-CN').chat.selectionActions.attachmentName
    expect(attachmentName).toBe('选中的文本')
    const { result } = renderHook(() => useMessageReferences())
    const file = new File(['选中的正文'], `${attachmentName}.txt`, { type: 'text/plain' })
    let rejections: Array<{ code: string }> = []
    act(() => {
      rejections = result.current.addFileReferences([file])
    })
    expect(rejections).toHaveLength(0)
    expect(result.current.references).toHaveLength(1)
    expect(result.current.references[0]!.label).toBe(`${attachmentName}.txt`)
  })

  it('容量满(30/30)再投递选中文本 → max_files 恰 1 条,引用仍 30(消费端据此弹 attachmentLimitReached)', () => {
    const attachmentName = readLocale('zh-CN').chat.selectionActions.attachmentName
    const { result } = renderHook(() => useMessageReferences())
    const full = Array.from(
      { length: CHAT_ATTACHMENT_MAX_FILES },
      (_, i) => new File([new Uint8Array(0)], `p${i}.png`, { type: 'image/png' }),
    )
    act(() => {
      result.current.addFileReferences(full)
    })
    expect(result.current.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
    let rejections: Array<{ code: string }> = []
    act(() => {
      rejections = result.current.addFileReferences([
        new File(['再来一条'], `${attachmentName}.txt`, { type: 'text/plain' }),
      ])
    })
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_files')
    expect(result.current.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
  })
})

describe('D184 锚点层:宿主监听在位且走同一包装/回报链(防「件在库零引用」)', () => {
  const host = readFileSync(
    resolve(process.cwd(), 'src/components/chat/message-input.tsx'),
    'utf-8',
  )

  it('监听真的注册在 window 上,且带清理(注册+清理 ≥2 处)', () => {
    const hits = host.match(/ihui:add-selection-attachment/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(2)
    expect(host).toContain("window.addEventListener('ihui:add-selection-attachment'")
    expect(host).toContain('window.removeEventListener(')
  })

  it('监听体:new File([trimmed], `${t(attachmentName)}.txt`) → addFileReferences → max_files 时 attachmentLimitReached({limit: 30})', () => {
    expect(host).toContain("new File([trimmed], `${t('selectionActions.attachmentName')}.txt`")
    expect(host).toContain('addFileReferences([file])')
    expect(host).toContain("r.code === 'max_files'")
    expect(host).toContain(
      "t('selectionActions.attachmentLimitReached', { limit: CHAT_ATTACHMENT_MAX_FILES })",
    )
  })

  it('派发端(message-list/MessageItem.tsx)真的派发同名事件(双向对齐,防单向悬空)', () => {
    const emitter = readFileSync(
      resolve(process.cwd(), 'src/components/chat/message-list/MessageItem.tsx'),
      'utf-8',
    )
    expect(emitter).toContain(
      "new CustomEvent('ihui:add-selection-attachment', { detail: { text: selectionText } })",
    )
  })
})

describe('D184 词包五语言直锁(chat.selectionActions)', () => {
  const EXPECTED: Record<(typeof LOCALES)[number], SelectionActions> = {
    'zh-CN': {
      ariaLabel: '选中文本操作',
      addAsAttachment: '作为附件添加',
      attachmentName: '选中的文本',
      attachmentLimitReached: '附件已达 {limit} 个,请先移除一个再添加选中文本。',
    },
    'zh-TW': {
      ariaLabel: '選取文字操作',
      addAsAttachment: '作為附件加入',
      attachmentName: '選取的文字',
      attachmentLimitReached: '附件已達 {limit} 個,請先移除一個再加入選取文字。',
    },
    en: {
      ariaLabel: 'Selected text actions',
      addAsAttachment: 'Add as attachment',
      attachmentName: 'Selected text',
      attachmentLimitReached:
        'Attachment limit of {limit} reached. Remove one before adding the selected text.',
    },
    ja: {
      ariaLabel: '選択テキストの操作',
      addAsAttachment: '添付として追加',
      attachmentName: '選択したテキスト',
      attachmentLimitReached:
        '添付が {limit} 個に達しました。先に 1 つ削除してから選択テキストを追加してください。',
    },
    ko: {
      ariaLabel: '선택 텍스트 작업',
      addAsAttachment: '첨부 파일로 추가',
      attachmentName: '선택한 텍스트',
      attachmentLimitReached:
        '첨부 파일이 {limit}개에 도달했습니다. 먼저 하나를 제거한 후 선택 텍스트를 추가하세요.',
    },
  }

  it('五语言四键逐一逐字一致(含 {limit} 插值占位,防翻译机踩掉插值)', () => {
    for (const locale of LOCALES) {
      expect(readLocale(locale).chat.selectionActions, locale).toEqual(EXPECTED[locale])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
