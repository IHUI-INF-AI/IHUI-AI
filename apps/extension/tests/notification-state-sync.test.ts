// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8')

const HOOK = '../lib/use-notification-state-sync.ts'
const SIDE_PANEL = '../entrypoints/sidepanel/SidepanelApp.tsx'
const NOTIF_PAGE = '../entrypoints/sidepanel/pages/NotificationsPage.tsx'
const BELL = '../entrypoints/components/NotificationBell.tsx'
const CONFIG = '../lib/config.ts'

describe('扩展端消费 /ws/broadcast 的 notification:state 六档翻转(2026-11-24)', () => {
  it('事件名单源在 config,不硬编码第二份字面量', () => {
    const config = read(CONFIG)
    expect(config).toContain(
      "export const NOTIFICATION_STATE_REFRESH_EVENT = 'ihui:notification-state-refresh'",
    )
    for (const f of [SIDE_PANEL, NOTIF_PAGE]) {
      const src = read(f)
      expect(src).toContain('NOTIFICATION_STATE_REFRESH_EVENT')
      expect(src).not.toContain("'ihui:notification-state-refresh'")
    }
  })

  it('hook 复用设备级广播单例,不自建 WebSocket;只声明 notification:state 一个事件', () => {
    const src = read(HOOK)
    expect(src).toContain('subscribeUserBroadcast')
    expect(src).toContain("'notification:state': (evt) => onStateEvent(evt)")
    expect(src).not.toContain('new WebSocket(')
    // baseUrl / token 走扩展适配点,不写死
    expect(src).toContain('baseUrl: getApiBaseUrl()')
    expect(src).toContain('tokenProvider: () => getToken()')
  })

  it('hook 有重连边沿对账:背压跳帧靠权威重拉补回,不靠帧重放', () => {
    const src = read(HOOK)
    expect(src).toContain('everConnected')
    expect(src).toContain('if (reconnect) onReconnect()')
  })

  it('sidepanel 接帧后重拉权威未读数 + 派发列表刷新事件,回调 useCallback 稳定', () => {
    const src = read(SIDE_PANEL)
    expect(src).toContain('useNotificationStateSync(token, {')
    expect(src).toContain('onStateEvent: onNotificationStateEvent')
    expect(src).toContain('onReconnect: onBroadcastReconnect')
    expect(src).toContain('window.dispatchEvent(new Event(NOTIFICATION_STATE_REFRESH_EVENT))')
  })

  it('通知页监听翻转事件后重拉列表;回调只调 load 不本地派生', () => {
    const src = read(NOTIF_PAGE)
    expect(src).toContain(
      'window.addEventListener(NOTIFICATION_STATE_REFRESH_EVENT, onRemoteState)',
    )
    expect(src).toContain('const onRemoteState = () => void load()')
  })

  it('popup 铃铛也接翻转帧重拉权威数', () => {
    const src = read(BELL)
    expect(src).toContain('useNotificationStateSync(getToken(), {')
    expect(src).toContain('const onStateEvent = useCallback(() => refreshCount(), [refreshCount])')
  })

  it('变异锁:把 sidepanel 的订阅 / hook 的事件声明任一抹掉即红', () => {
    const sideBroken = read(SIDE_PANEL).replace('useNotificationStateSync(token, {', 'NOOP(token, {')
    expect(sideBroken).not.toBe(read(SIDE_PANEL))
    expect(sideBroken).not.toContain('useNotificationStateSync(token, {')

    const hookBroken = read(HOOK).replace(
      "'notification:state': (evt) => onStateEvent(evt)",
      "'notification:state': (evt) => undefined",
    )
    expect(hookBroken).not.toBe(read(HOOK))
    expect(hookBroken).not.toContain("'notification:state': (evt) => onStateEvent(evt)")
  })
})
