// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 块 7 上收的视觉等价锁:小程序侧 msg-item/bubble 的 class 与层级必须原样存在,
// 端内适配器只注入行为,共享件不判断端。
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { Text } from 'react-native'
import { describe, expect, it } from 'vitest'

import { ChatMessageItemView, type ChatMessage } from '../src/features/chat/ChatMessageItem'
import type { RenderIcon } from '../src/features/chat/ChatMessageItem'
import type { TFunction } from '../src/types'

const t: TFunction = (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key)

const icons = {
  reuse: 'reuse.png',
  copy: 'copy.png',
  download: 'download.png',
  sikao: 'sikao.png',
  share: 'share.png',
}

const renderIcon: RenderIcon = ({ name }) => createElement(Text, null, `ICON:${name}`)
const rpx = (n: number) => `${n}rpx`

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    t,
    icons,
    renderIcon,
    rpx,
    onCopy: () => undefined,
    onOpenImage: () => undefined,
    onDownloadImages: () => undefined,
    onOpenDigitalHuman: () => undefined,
    onPlayVoice: () => undefined,
    onRate: () => undefined,
    onApproval: () => undefined,
    ...overrides,
  } as never
}

const userMsg: ChatMessage = { id: 'u1', role: 'user', content: 'USER_TEXT' }
const aiMsg: ChatMessage = {
  id: 'a1',
  role: 'assistant',
  content: 'AI_TEXT',
  images: ['https://example.com/a.png'],
  tokenCount: 1200,
}

describe('小程序侧视觉等价:用户气泡', () => {
  it('保留 .question-container / .agent-content-item-question / .fuyong-btn 与层级', () => {
    const r = render(
      createElement(ChatMessageItemView, baseProps({ msg: userMsg, onReuse: () => undefined })),
    )
    const question = r.container.querySelector('.question-container')
    expect(question, 'Missing: .question-container').toBeTruthy()
    const bubble = question?.querySelector('.agent-content-item-question')
    expect(bubble, 'Missing: .agent-content-item-question').toBeTruthy()
    expect(bubble?.parentElement?.className).toContain('question-container')
    expect(question?.querySelector('.fuyong-btn'), 'Missing: .fuyong-btn').toBeTruthy()
    expect(r.container.textContent).toContain('USER_TEXT')
  })
})

describe('小程序侧视觉等价:AI 气泡', () => {
  it('保留 .agent-content-item > .content_agent_nei / .agent-content-item-img / .action-buttons', () => {
    const r = render(createElement(ChatMessageItemView, baseProps({ msg: aiMsg })))
    const item = r.container.querySelector('.agent-content-item')
    expect(item, 'Missing: .agent-content-item').toBeTruthy()
    const inner = item?.querySelector('.content_agent_nei')
    expect(inner, 'Missing: .content_agent_nei').toBeTruthy()
    expect(inner?.parentElement?.className).toContain('agent-content-item')
    expect(
      item?.querySelector('.agent-content-item-img'),
      'Missing: .agent-content-item-img',
    ).toBeTruthy()
    expect(item?.querySelector('.action-buttons'), 'Missing: .action-buttons').toBeTruthy()
    // token 消耗走同一取词键(端内词包不变)
    expect(item?.textContent).toContain('ai.chatMessageItem.tokenCost')
    expect(item?.textContent).toContain('AI_TEXT')
  })

  it('未注入 shareSlot 时回落到内建 .share-btn(视觉不变)', () => {
    const r = render(createElement(ChatMessageItemView, baseProps({ msg: aiMsg })))
    expect(r.container.querySelector('.share-btn'), 'Missing: .share-btn').toBeTruthy()
  })

  it('注入 shareSlot 时替换内建 .share-btn(共享件只做挂载,不判断端)', () => {
    const r = render(
      createElement(
        ChatMessageItemView,
        baseProps({
          msg: aiMsg,
          shareSlot: createElement('span', { className: 'injected-share' }, 'SHARE_SLOT'),
        }),
      ),
    )
    expect(r.container.querySelector('.injected-share'), 'Missing: shareSlot').toBeTruthy()
    expect(r.container.querySelector('.share-btn'), '内建 .share-btn 必须被注入节点替换').toBeNull()
  })

  it('versionMenuSlot 挂在该条之后(层级不变)', () => {
    const r = render(
      createElement(
        ChatMessageItemView,
        baseProps({
          msg: aiMsg,
          versionMenuSlot: createElement('span', { className: 'injected-version' }, 'VERSION'),
        }),
      ),
    )
    const menu = r.container.querySelector('.injected-version')
    expect(menu, 'Missing: versionMenuSlot').toBeTruthy()
    expect(menu?.previousElementSibling?.className).toContain('agent-content-item')
  })
})

describe('共享层纪律:不出现平台 API', () => {
  it('共享件源码不含 Taro / wx.* / @tarojs 依赖', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../src/features/chat/ChatMessageItem.tsx'),
      'utf8',
    )
    // 只查可执行代码:纪律说明的注释里允许提到这些名字
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/from '@tarojs\//)
    expect(code).not.toMatch(/\bTaro\./)
    expect(code).not.toMatch(/\bwx\./)
    // 只允许 react-native 原语(View/Text/Image)进入共享件
    expect(code).toMatch(/from 'react-native'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
