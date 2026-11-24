// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8')

const SIDE_PANEL = '../entrypoints/sidepanel/SidepanelApp.tsx'
const NOTIF_PAGE = '../entrypoints/sidepanel/pages/NotificationsPage.tsx'
const BELL = '../entrypoints/components/NotificationBell.tsx'
const CONFIG = '../lib/config.ts'

describe('扩展端通知角标取服务端真相(2026-11-24)', () => {
  it('事件名单源在 config,两个消费方只 import 不硬编码字面量', () => {
    const config = read(CONFIG)
    expect(config).toContain(
      "export const NOTIFICATION_UNREAD_REFRESH_EVENT = 'ihui:notification-unread-refresh'",
    )
    for (const f of [SIDE_PANEL, NOTIF_PAGE]) {
      const src = read(f)
      expect(src).toContain('NOTIFICATION_UNREAD_REFRESH_EVENT')
      expect(src).not.toContain("'ihui:notification-unread-refresh'")
    }
  })

  it('sidepanel 铃铛用服务端权威数,未就绪/失败回退本地派生(不冒充 0)', () => {
    const src = read(SIDE_PANEL)
    expect(src).toContain('const [serverUnread, setServerUnread] = useState<number | null>(null)')
    expect(src).toContain('getUnreadCount()')
    expect(src).toContain('res.data.notification ?? 0')
    expect(src).toContain('{(serverUnread ?? unreadCount) > 0 ? (')
    expect(src).toContain('{serverUnread ?? unreadCount}')
  })

  it('sidepanel 三个触发点:登录就绪 / WS 新通知帧 / 同页标记事件', () => {
    const src = read(SIDE_PANEL)
    expect(src).toContain('if (!authed) return')
    expect(src).toContain('window.addEventListener(NOTIFICATION_UNREAD_REFRESH_EVENT, onChange)')
  })

  it('通知页两条标记路径成功后都派发刷新事件', () => {
    const src = read(NOTIF_PAGE)
    expect(src).toContain('window.dispatchEvent?.(new Event(NOTIFICATION_UNREAD_REFRESH_EVENT))')
    const calls = src.split('notifyHeader()').length - 1
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('popup Bell:WS 帧重拉服务端真相,抹掉裸 +1', () => {
    const src = read(BELL)
    expect(src).toContain('const refreshCount = useCallback(')
    expect(src).toContain("path: '/api/notifications/unread-count'")
    expect(src).not.toContain('setCount((c) => c + 1)')
  })

  it('变异锁:权威数落地与 Bell 重拉任一被抹即红', () => {
    expect(read(SIDE_PANEL)).toContain('setServerUnread(res.data.notification ?? 0)')
    expect(read(BELL)).toContain('refreshCount()')
  })
})
