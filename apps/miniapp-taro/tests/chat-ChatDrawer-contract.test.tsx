// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 块 5 ChatDrawer 契约测试。
 *
 * 正例：会话按传入顺序原样渲染、timeLabel 逐字展示、显式按钮；open=false 全隐藏。
 * 阴性对照：渲染本身不触发任何回调；源码不含平台 API / 手势原语。
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 共享层按 packages/app 的 React 19 产出元素；测试改用同一实例渲染，避免 18/19 混栈。
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
vi.mock('react', async () => import('../../../packages/app/node_modules/react'))

import { createElement } from 'react'
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
import { renderToStaticMarkup } from '../../../packages/app/node_modules/react-dom/server'

import { ChatDrawer } from '../../../packages/app/src/features/chat/ChatDrawer'

const ZH: Record<string, string> = {
  'drawer.history': '聊天记录',
  'drawer.newChat': '新建对话',
  'drawer.claimFree': '领取免费资料',
  'drawer.noHistory': '暂无会话',
  'drawer.collect': '收藏',
  'drawer.collected': '已收藏',
  'drawer.delete': '删除',
  'common.close': '关闭',
  'menu.settings': '设置',
  'menu.messageCenter': '消息',
  'profile.backHome': '返回首页',
}

const t = (key: string, options?: Record<string, string | number>): string => {
  const text = ZH[key] ?? key
  return options ? `${text}(${JSON.stringify(options)})` : text
}

const SOURCE = resolve(__dirname, '../../../packages/app/src/features/chat/ChatDrawer.tsx')
const src = readFileSync(SOURCE, 'utf8')

const CONVERSATIONS = [
  { id: 'p', title: '置顶会话', timeLabel: '今天 09:00', pinned: true },
  { id: 'f', title: '收藏会话', timeLabel: '昨天 20:00', favorited: true, modelName: '模型乙' },
  { id: 'n', title: '普通会话', timeLabel: '更早' },
]

describe('ChatDrawer 正例：顺序、时间列与入口', () => {
  const onClose = vi.fn()
  const onSelectConversation = vi.fn()
  const onDeleteConversation = vi.fn()
  const onToggleFavorite = vi.fn()
  const onCreateNewChat = vi.fn()
  const onClaimFree = vi.fn()
  const onOpenSettings = vi.fn()
  const onOpenMessages = vi.fn()
  const onGoHome = vi.fn()

  const html = renderToStaticMarkup(
    createElement(ChatDrawer, {
      t,
      open: true,
      showClaimFree: true,
      conversations: CONVERSATIONS,
      tabs: [
        { key: 'chat', label: '对话' },
        { key: 'agent', label: '智能体' },
      ],
      activeTab: 'chat',
      onClose,
      onSelectConversation,
      onDeleteConversation,
      onToggleFavorite,
      onCreateNewChat,
      onClaimFree,
      onOpenSettings,
      onOpenMessages,
      onGoHome,
    }),
  )

  it('会话按传入顺序渲染，不重排（置顶 → 收藏 → 普通）', () => {
    expect(html.indexOf('置顶会话')).toBeLessThan(html.indexOf('收藏会话'))
    expect(html.indexOf('收藏会话')).toBeLessThan(html.indexOf('普通会话'))
  })

  it('timeLabel 与 modelName 逐字展示', () => {
    expect(html).toContain('今天 09:00')
    expect(html).toContain('昨天 20:00')
    expect(html).toContain('更早')
    expect(html).toContain('模型乙')
  })

  it('顶栏与底部入口文案可见，tab 顺序不变', () => {
    expect(html).toContain('领取免费资料')
    expect(html).toContain('新建对话')
    expect(html).toContain('设置')
    expect(html).toContain('消息')
    expect(html).toContain('返回首页')
    expect(html.indexOf('对话')).toBeLessThan(html.indexOf('智能体'))
  })

  it('收藏与删除都是行内显式按钮，收藏回传取反值', () => {
    expect(html.match(/删除/g) ?? []).toHaveLength(CONVERSATIONS.length)
    expect(html).toContain('收藏')
    expect(html).toContain('已收藏')
    expect(src).toContain('!conversation.favorited')
  })

  it('阴性对照：未触发交互，所有回调 0 次', () => {
    for (const callback of [
      onClose,
      onSelectConversation,
      onDeleteConversation,
      onToggleFavorite,
      onCreateNewChat,
      onClaimFree,
      onOpenSettings,
      onOpenMessages,
      onGoHome,
    ]) {
      expect(callback).toHaveBeenCalledTimes(0)
    }
  })
})

describe('ChatDrawer 阴性对照：隐藏与平台 API', () => {
  it('open=false 时整体不渲染', () => {
    const onClose = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ChatDrawer, { t, open: false, onClose, onCreateNewChat: vi.fn() }),
    )
    expect(html).toBe('')
    expect(onClose).toHaveBeenCalledTimes(0)
  })

  it('showClaimFree=true 但没给 onClaimFree 时不渲染领取入口', () => {
    const html = renderToStaticMarkup(
      createElement(ChatDrawer, {
        t,
        open: true,
        showClaimFree: true,
        onClose: vi.fn(),
        onCreateNewChat: vi.fn(),
      }),
    )
    expect(html).not.toContain('领取免费资料')
  })

  it('源码零平台 API、零手势原语、零排序分组', () => {
    expect(src).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    expect(src).not.toMatch(/Animated|Dimensions|PanResponder|Keyboard|Linking/)
    expect(src).not.toMatch(/\.sort\(|groupBy|reduce\(/)
    expect(src).not.toMatch(/from 'apps\//)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
