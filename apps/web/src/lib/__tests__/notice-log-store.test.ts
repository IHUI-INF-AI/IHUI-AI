// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 侧「提示留痕」store 单测。
 *
 * 钉住四件事(对应「关掉再打开还能看到」这条用户诉求的 web 实现):
 * ① 记录能落进当前会话的快照,并写进 localStorage;
 * ② 换会话互不串味(按 conversationId 分区);
 * ③ 新会话(无 id)落 draft 键 —— 与 RN 同一口径;
 * ④ 清空后读回为空,脏数据不炸。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTICE_LOG_DRAFT_KEY, NOTICE_LOG_STORAGE_PREFIX } from '@ihui/shared/chat/notice-log'
import type * as NoticeLogStore from '../notice-log-store'

const DRAFT_KEY = `${NOTICE_LOG_STORAGE_PREFIX}:${NOTICE_LOG_DRAFT_KEY}`

/** 每次拿一份全新的模块实例:store 是模块级单例,不重置会互相污染 */
async function freshStore(): Promise<typeof NoticeLogStore> {
  vi.resetModules()
  return await import('../notice-log-store')
}

/** 等一轮微任务,让 hydrate/flush 这类 fire-and-forget 的 Promise 落定 */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function readPersisted(key: string): { items: Array<{ text: string; kind: string }> } | null {
  const raw = window.localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { items: Array<{ text: string; kind: string }> }) : null
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('recordNotice — 记录与持久化', () => {
  it('新会话(无 id)记一条:落 draft 键,内容可读回', async () => {
    const store = await freshStore()
    store.setNoticeScope(null)
    await settle()
    store.recordNotice('error', '网络异常')
    await settle()
    const saved = readPersisted(DRAFT_KEY)
    expect(saved?.items).toHaveLength(1)
    expect(saved?.items[0]).toMatchObject({ text: '网络异常', kind: 'error' })
  })

  it('连续同文只留一条(去重),不同文案各自留痕', async () => {
    const store = await freshStore()
    store.setNoticeScope('conv-1')
    await settle()
    store.recordNotice('warning', '正在重连…')
    store.recordNotice('warning', '正在重连…')
    store.recordNotice('success', '已保存')
    await settle()
    const saved = readPersisted(`${NOTICE_LOG_STORAGE_PREFIX}:conv-1`)
    expect(saved?.items.map((i) => i.text)).toEqual(['正在重连…', '已保存'])
  })

  it('空白文案不记录(不制造无信息的噪声行)', async () => {
    const store = await freshStore()
    store.setNoticeScope('conv-1')
    await settle()
    store.recordNotice('info', '   ')
    await settle()
    expect(readPersisted(`${NOTICE_LOG_STORAGE_PREFIX}:conv-1`)).toBeNull()
  })
})

describe('会话分区', () => {
  it('两个会话各记各的,互不覆盖', async () => {
    const store = await freshStore()
    store.setNoticeScope('conv-a')
    await settle()
    store.recordNotice('info', 'A 的提示')
    store.setNoticeScope('conv-b')
    await settle()
    store.recordNotice('info', 'B 的提示')
    await settle()
    expect(readPersisted(`${NOTICE_LOG_STORAGE_PREFIX}:conv-a`)?.items[0]?.text).toBe('A 的提示')
    expect(readPersisted(`${NOTICE_LOG_STORAGE_PREFIX}:conv-b`)?.items[0]?.text).toBe('B 的提示')
  })

  it('模块重载后(≈刷新页面)能从 localStorage 读回旧记录', async () => {
    const first = await freshStore()
    first.setNoticeScope('conv-p')
    await settle()
    first.recordNotice('error', '刷新前留下的提示')
    await settle()

    const second = await freshStore()
    second.setNoticeScope('conv-p')
    await settle()
    // 读回不丢:再记一条,盘上应是两条(旧的在,新的也进了)
    second.recordNotice('info', '刷新后的新提示')
    await settle()
    const saved = readPersisted(`${NOTICE_LOG_STORAGE_PREFIX}:conv-p`)
    expect(saved?.items.map((i) => i.text)).toEqual(['刷新前留下的提示', '刷新后的新提示'])
  })
})

describe('clearNotices — 主动清空', () => {
  it('清空后盘上为空列表', async () => {
    const store = await freshStore()
    store.setNoticeScope(null)
    await settle()
    store.recordNotice('info', '要被清掉的提示')
    await settle()
    store.clearNotices(null)
    await settle()
    expect(readPersisted(DRAFT_KEY)?.items ?? []).toEqual([])
  })
})

describe('脏数据降级', () => {
  it('盘上是坏 JSON 时不抛错,记录仍能继续', async () => {
    window.localStorage.setItem(DRAFT_KEY, '{不是 JSON')
    const store = await freshStore()
    store.setNoticeScope(null)
    await settle()
    expect(() => store.recordNotice('info', '还能记')).not.toThrow()
    await settle()
    expect(readPersisted(DRAFT_KEY)?.items.map((i) => i.text)).toEqual(['还能记'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
