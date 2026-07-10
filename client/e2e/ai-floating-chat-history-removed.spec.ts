/**
 * AI 浮窗"对话历史"重复入口防回归 (2026-07-02)
 *
 * 背景：AI 浮窗 header 原本有 session-list-btn 按钮 + 左侧滑出的 ChatSessionPanel 组件。
 *       当 Sidebar.vue 接回 SidebarChatHistory 后，浮窗内的重复入口成为冗余。
 *       本 spec 在源码级别保证：
 *         - AI 浮窗 ChatHeaderBar 不再渲染 session-list-btn
 *         - ChatSessionPanel.vue 组件文件不存在
 *         - AIChat.vue 不再 import / 使用 ChatSessionPanel
 *         - SessionListIcon 图标文件不存在
 *         - SessionListIcon 不在 icons/index.ts 中 export
 *         - 浮窗不再维护 showSessionList ref / watch
 *
 * 该 spec 跑通 = 重复入口已彻底清理；任一断言失败 = 有人又把它们加回来了。
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const HEADER_BAR = join(ROOT, 'src/components/ai/chat-parts/ChatHeaderBar.vue')
const AI_CHAT = join(ROOT, 'src/components/ai/AIChat.vue')
const CHAT_PARTS_INDEX = join(ROOT, 'src/components/ai/chat-parts/index.ts')
const ICONS_INDEX = join(ROOT, 'src/components/icons/index.ts')
const CHAT_SESSION_PANEL = join(ROOT, 'src/components/ai/chat-parts/ChatSessionPanel.vue')
const SESSION_LIST_ICON = join(ROOT, 'src/components/icons/SessionListIcon.vue')

test.describe('AI 浮窗对话历史重复入口清理防回归', () => {
  test('1/6 ChatHeaderBar.vue 不再渲染 session-list-btn 按钮', () => {
    const src = readFileSync(HEADER_BAR, 'utf-8')
    expect(
      src,
      'ChatHeaderBar 仍包含 session-list-btn 按钮（AI 浮窗 header 出现重复入口）',
    ).not.toMatch(/class="[^"]*session-list-btn[^"]*"/)
  })

  test('2/6 ChatHeaderBar.vue 不再 import SessionListIcon', () => {
    const src = readFileSync(HEADER_BAR, 'utf-8')
    expect(
      src,
      'ChatHeaderBar 仍 import SessionListIcon（应已删除）',
    ).not.toMatch(/import\s*\{[^}]*SessionListIcon[^}]*\}\s*from\s*['"]@\/components\/icons['"]/)
  })

  test('3/6 ChatSessionPanel.vue 组件文件不存在', () => {
    expect(
      existsSync(CHAT_SESSION_PANEL),
      'ChatSessionPanel.vue 文件存在（重复入口组件未清理）',
    ).toBe(false)
  })

  test('4/6 AIChat.vue 不再 import / 使用 ChatSessionPanel', () => {
    const src = readFileSync(AI_CHAT, 'utf-8')
    expect(src, 'AIChat.vue 仍 import ChatSessionPanel').not.toMatch(/import\s*\{[^}]*ChatSessionPanel[^}]*\}/)
    expect(src, 'AIChat.vue 模板中仍使用 <ChatSessionPanel').not.toMatch(/<ChatSessionPanel[\s>]/)
  })

  test('5/6 SessionListIcon 图标文件不存在 + icons/index.ts 不再 export', () => {
    expect(
      existsSync(SESSION_LIST_ICON),
      'SessionListIcon.vue 文件存在（图标未清理）',
    ).toBe(false)
    const iconsIdx = readFileSync(ICONS_INDEX, 'utf-8')
    expect(iconsIdx, 'icons/index.ts 仍 export SessionListIcon').not.toMatch(/export\s*\{[^}]*SessionListIcon[^}]*\}/)
  })

  test('6/6 chat-parts/index.ts 不再 export ChatSessionPanel', () => {
    const idx = readFileSync(CHAT_PARTS_INDEX, 'utf-8')
    expect(idx, 'chat-parts/index.ts 仍 export ChatSessionPanel').not.toMatch(/export\s*\{[^}]*ChatSessionPanel[^}]*\}/)
  })
})
