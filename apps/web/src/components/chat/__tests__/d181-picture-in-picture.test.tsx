// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D181 电脑使用画中画(2026-10-23 立项落地,对齐竞品 chatSession.pictureInPicture.* 五键)。
// 与 d182-d183-header-actions.test.tsx 同型三层合围:
//   行为层:真跑 picture-in-picture-prefs store —— 两档隐藏翻转 + persist 落 localStorage;
//   能力层:openPictureInPictureWindow 真接 Document Picture-in-Picture 能力面;
//   锚点层:ai-side-panel 菜单项在位,消息流不再挂常驻条;
//   词包层:aiChat.pictureInPicture 五语言直锁。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePictureInPicturePrefsStore } from '@/stores/picture-in-picture-prefs'
import {
  isDocumentPictureInPictureSupported,
  openPictureInPictureWindow,
} from '../picture-in-picture-section'

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

const PIP_KEYS = [
  'sectionLabel',
  'title',
  'hideInSession',
  'hideInAllSessions',
  'updateFailed',
  'emptyState',
  'openWindow',
] as const

beforeEach(() => {
  usePictureInPicturePrefsStore.setState({
    hideInAllSessions: false,
    hiddenConversationIds: [],
  })
  window.localStorage.clear()
})

describe('D181 行为层:picture-in-picture-prefs store 两档隐藏', () => {
  it('默认不隐藏;setHideInAllSessions 真实翻转并落 localStorage', () => {
    const s = usePictureInPicturePrefsStore.getState()
    expect(s.hideInAllSessions).toBe(false)
    expect(s.hiddenConversationIds).toEqual([])
    s.setHideInAllSessions(true)
    expect(usePictureInPicturePrefsStore.getState().hideInAllSessions).toBe(true)
    const raw = JSON.parse(window.localStorage.getItem('ihui-picture-in-picture-prefs') || '{}')
    expect(raw.state?.hideInAllSessions).toBe(true)
  })

  it('setSessionHidden 按会话增删且不重复;去重后移除只删目标会话', () => {
    const st = () => usePictureInPicturePrefsStore.getState()
    st().setSessionHidden('conv-a', true)
    st().setSessionHidden('conv-a', true)
    expect(st().hiddenConversationIds).toEqual(['conv-a'])
    st().setSessionHidden('conv-b', true)
    st().setSessionHidden('conv-a', false)
    expect(st().hiddenConversationIds).toEqual(['conv-b'])
  })
})

describe('D181 能力层:Document Picture-in-Picture 开窗', () => {
  it('能力缺失 ⇒ 判定不支持,调用不抛错(菜单项也不出现)', () => {
    expect(isDocumentPictureInPictureSupported()).toBe(false)
    expect(() => openPictureInPictureWindow({ title: 't', emptyState: 'e' })).not.toThrow()
  })

  it('能力在位 ⇒ requestWindow 真调用并写入标题/空态文案', async () => {
    const pipWin = {
      document: { title: '', body: { textContent: '' } },
      addEventListener: vi.fn(),
      close: vi.fn(),
      closed: false,
    }
    const requestWindow = vi.fn().mockResolvedValue(pipWin)
    Object.defineProperty(window, 'documentPictureInPicture', {
      value: { requestWindow },
      configurable: true,
    })
    try {
      expect(isDocumentPictureInPictureSupported()).toBe(true)
      openPictureInPictureWindow({ title: 'PIP-T', emptyState: 'PIP-E' })
      await vi.waitFor(() => expect(requestWindow).toHaveBeenCalledTimes(1))
      expect(pipWin.document.title).toBe('PIP-T')
      expect(pipWin.document.body.textContent).toBe('PIP-E')
    } finally {
      pipWin.closed = true
      delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture
    }
  })
})

describe('D181 锚点层:面板溢出菜单入口', () => {
  it('ai-side-panel 菜单挂「打开画中画窗口」;消息流不再挂常驻 summary 条', () => {
    const panel = readFileSync(
      resolve(process.cwd(), 'src/components/ai/ai-side-panel.tsx'),
      'utf-8',
    )
    expect(panel).toContain('data-testid="ai-panel-open-pip"')
    expect(panel).toContain('openPictureInPictureWindow')
    const host = readFileSync(
      resolve(process.cwd(), 'src/components/chat/message-list/MessageList.tsx'),
      'utf-8',
    )
    expect(host).not.toContain('PictureInPictureSection')
  })
})

describe('D181 词包层:aiChat.pictureInPicture 五语言直锁', () => {
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
  for (const locale of LOCALES) {
    it(`${locale}:七键齐全且非空`, () => {
      const m = JSON.parse(
        readFileSync(
          resolve(process.cwd(), `../../packages/i18n/messages/web/${locale}.json`),
          'utf-8',
        ),
      ) as { aiChat?: { pictureInPicture?: Record<string, string> } }
      const pip = m.aiChat?.pictureInPicture
      expect(pip, 'aiChat.pictureInPicture 命名空间缺失').toBeTruthy()
      for (const key of PIP_KEYS) {
        expect(typeof pip?.[key] === 'string' && pip![key].length > 0, `缺 ${key}`).toBe(true)
      }
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
