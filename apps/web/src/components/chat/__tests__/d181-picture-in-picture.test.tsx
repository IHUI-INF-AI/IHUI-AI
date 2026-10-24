// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D181 电脑使用画中画(2026-10-23 立项落地,对标竞品 chatSession.pictureInPicture.* 五键)。
// 与 d182-d183-header-actions.test.tsx 同型三层合围:
//   行为层:真跑 picture-in-picture-prefs store —— 两档隐藏翻转 + persist 落 localStorage;
//   组件层:挂载 PictureInPictureSection —— 空态占位随隐藏档出现/消失、
//           开关真接 Document Picture-in-Picture 能力面(隐藏即关窗)、写入抛错报 updateFailed;
//   词包层:aiChat.pictureInPicture 五语言直锁。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePictureInPicturePrefsStore } from '@/stores/picture-in-picture-prefs'
import { PictureInPictureSection } from '../picture-in-picture-section'

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

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

describe('D181 组件层:PictureInPictureSection 挂载行为', () => {
  it('默认可见 ⇒ 渲染节名/标题/两开关/空态占位;无能力面时不出现开窗外挂', () => {
    render(<PictureInPictureSection conversationId="conv-a" />)
    expect(screen.getByText('aiChat.pictureInPicture.sectionLabel')).toBeTruthy()
    expect(screen.getByText('aiChat.pictureInPicture.title')).toBeTruthy()
    expect(screen.getByTestId('pip-hide-in-session')).toBeTruthy()
    expect(screen.getByTestId('pip-hide-in-all-sessions')).toBeTruthy()
    expect(screen.getByTestId('pip-empty-state')).toBeTruthy()
    expect(screen.queryByTestId('pip-open-window')).toBeNull()
  })

  it('无会话 id 时"在此会话中隐藏"禁用(能用才显示)', () => {
    render(<PictureInPictureSection conversationId={null} />)
    expect((screen.getByTestId('pip-hide-in-session') as HTMLInputElement).disabled).toBe(true)
  })

  it('勾选在此会话中隐藏 ⇒ 空态占位消失且 store 记该会话', () => {
    render(<PictureInPictureSection conversationId="conv-a" />)
    fireEvent.click(screen.getByTestId('pip-hide-in-session'))
    expect(screen.queryByTestId('pip-empty-state')).toBeNull()
    expect(usePictureInPicturePrefsStore.getState().hiddenConversationIds).toEqual(['conv-a'])
    fireEvent.click(screen.getByTestId('pip-hide-in-session'))
    expect(screen.getByTestId('pip-empty-state')).toBeTruthy()
  })

  it('开关真接画中画能力面:可见+能力在位 ⇒ 出开窗按钮,点击真调 requestWindow;翻隐藏 ⇒ 真关浮窗', async () => {
    const pipWin = {
      document: { title: '', body: {} as { textContent?: string } },
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
      render(<PictureInPictureSection conversationId="conv-a" />)
      fireEvent.click(await screen.findByTestId('pip-open-window'))
      await vi.waitFor(() => expect(requestWindow).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByTestId('pip-hide-in-all-sessions'))
      expect(pipWin.close).toHaveBeenCalledTimes(1)
    } finally {
      // 清掉模块级浮窗引用残留,避免串到后续用例
      pipWin.closed = true
      delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture
    }
  })

  it('偏好写入抛错(存储配额型)⇒ 按规格报 updateFailed,不静默吞', () => {
    usePictureInPicturePrefsStore.setState({
      setHideInAllSessions: () => {
        throw new Error('quota')
      },
    })
    render(<PictureInPictureSection conversationId="conv-a" />)
    fireEvent.click(screen.getByTestId('pip-hide-in-all-sessions'))
    expect(screen.getByRole('alert').textContent).toContain('aiChat.pictureInPicture.updateFailed')
  })
})

describe('D181 锚点层:会话面挂载点', () => {
  it('MessageList 真挂 PictureInPictureSection 并把当前会话 id 传入', () => {
    const host = readFileSync(
      resolve(process.cwd(), 'src/components/chat/message-list/MessageList.tsx'),
      'utf-8',
    )
    expect(host).toContain(
      "import { PictureInPictureSection } from '../picture-in-picture-section'",
    )
    expect(host).toMatch(/<PictureInPictureSection conversationId=\{conversationId\} \/>/)
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
