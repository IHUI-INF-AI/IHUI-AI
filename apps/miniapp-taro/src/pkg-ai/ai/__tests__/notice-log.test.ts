// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 对话内「提示留痕」小程序端回归锁(2026-11)。
 *
 * 钉四件事:
 *  ① 端口层旁路订阅:文案与 kind 原样到达,退订即止 —— 这是"20+ 调用点零改动也能留痕"的前提;
 *  ② 订阅者抛错不得影响提示本身(留痕是旁路,不能反过来吃掉用户该看到的 toast);
 *  ③ NoticeLog 空列表不出图、有记录时每条文案都上屏(否则消息尾部会挂空边框);
 *  ④ 存储适配器往返一致,且 Taro 的 `''` 被归一成 null(语义:键不存在 ≠ 存了空串)。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Taro 存储是同步 API,测试用内存 Map 复刻;读不到时返回 '' —— 与真机行为一致(见适配器头注)
const taro = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  return {
    store,
    getStorageSync: vi.fn((key: string) => (store.has(key) ? store.get(key) : '')),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      store.set(key, value)
    }),
    removeStorageSync: vi.fn((key: string) => {
      store.delete(key)
    }),
  }
})
vi.mock('@tarojs/taro', () => ({ default: taro }))

// 端内 vitest 是 node 环境,没有 Taro 运行时;View/Text 落成宿主元素即可验"文案是否上屏"。
// selectable 是 Taro 专有 prop,原样透传给 DOM 会触发 React 警告,故在桩里剥掉。
vi.mock('@tarojs/components', async () => {
  const React = (await import('react')).default
  const make = (tag: string) => {
    const Stub = (props: Record<string, unknown>) => {
      const { selectable: _selectable, ...rest } = props
      return React.createElement(tag, rest)
    }
    return Stub
  }
  return { View: make('div'), Text: make('span') }
})

import { onToast, subscribeOnToast } from '@/host/on-toast'
import { NoticeLog } from '../notice-log'
import { noticeLogStorage } from '@/lib/notice-log-storage'
import {
  loadNoticeLog,
  noticeLogStorageKey,
  saveNoticeLog,
  type ChatNotice,
} from '@ihui/shared/chat/notice-log'

describe('subscribeOnToast:端口层旁路订阅', () => {
  it('收到 onToast 的文案与 kind(未指定 kind 按 info 记),退订后不再收到', () => {
    const seen: Array<[string, string]> = []
    const off = subscribeOnToast((message, kind) => seen.push([message, kind]))

    onToast('已复制', { kind: 'success' })
    onToast('没指定类型')

    expect(seen).toEqual([
      ['已复制', 'success'],
      ['没指定类型', 'info'],
    ])

    off()
    onToast('退订后不该再记')
    expect(seen).toHaveLength(2)
  })

  it('订阅者抛错时 onToast 仍正常,且不影响其他订阅者', () => {
    const seen: string[] = []
    const off1 = subscribeOnToast(() => {
      throw new Error('订阅者炸了')
    })
    const off2 = subscribeOnToast((message) => seen.push(message))

    expect(() => onToast('提示照常')).not.toThrow()
    expect(seen).toEqual(['提示照常'])

    off1()
    off2()
  })
})

describe('NoticeLog:消息列表尾部留痕', () => {
  const notice = (id: string, text: string, ts = Date.UTC(2026, 10, 13, 1, 2)): ChatNotice => ({
    id,
    kind: 'info',
    text,
    ts,
  })

  it('空列表不出图(否则每条消息尾部会挂一条空边框)', () => {
    expect(renderToStaticMarkup(createElement(NoticeLog, { notices: [] }))).toBe('')
  })

  it('有记录时每条文案都上屏,并带 HH:mm 时刻', () => {
    const html = renderToStaticMarkup(
      createElement(NoticeLog, {
        notices: [notice('n1', '已保存到收藏'), notice('n2', '网络已恢复')],
      }),
    )
    expect(html).toContain('已保存到收藏')
    expect(html).toContain('网络已恢复')
    // 时刻按本地时区格式化,只断言形状(HH:mm),不锁死时区
    expect(html).toMatch(/\d{2}:\d{2}/u)
  })
})

describe('noticeLogStorage:小程序存储适配器', () => {
  beforeEach(() => {
    taro.store.clear()
    taro.getStorageSync.mockClear()
    taro.setStorageSync.mockClear()
    taro.removeStorageSync.mockClear()
  })

  it('save → load 往返一致(同一会话键)', async () => {
    const list: ChatNotice[] = [
      { id: 'a-1', kind: 'success', text: '已复制', ts: 1_700_000_000_000 },
      { id: 'a-2', kind: 'error', text: '发送失败', ts: 1_700_000_001_000 },
    ]
    await saveNoticeLog(noticeLogStorage, 'conv-1', list)

    expect(await loadNoticeLog(noticeLogStorage, 'conv-1')).toEqual(list)
    // 落键口径来自 shared,适配器不得自造键名
    expect(taro.setStorageSync).toHaveBeenCalledWith(
      noticeLogStorageKey('conv-1'),
      expect.any(String),
    )
  })

  it("getStorageSync 返回 '' 时归一化为 null,读回即空列表", async () => {
    expect(await noticeLogStorage.getItem('从未写过的键')).toBeNull()
    expect(await loadNoticeLog(noticeLogStorage, '从未写过的会话')).toEqual([])
  })

  it('removeItem 后读回空列表(clearNoticeLog 走的就是这条)', async () => {
    await saveNoticeLog(noticeLogStorage, 'conv-2', [
      { id: 'b-1', kind: 'info', text: '已切换模型', ts: 1_700_000_002_000 },
    ])
    await noticeLogStorage.removeItem?.(noticeLogStorageKey('conv-2'))

    expect(await loadNoticeLog(noticeLogStorage, 'conv-2')).toEqual([])
  })
})
