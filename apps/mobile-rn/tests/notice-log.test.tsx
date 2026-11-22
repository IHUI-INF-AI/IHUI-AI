// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NoticeLog(对话内 toast 留痕)单测。
 *
 * 钉三组最关键的判据(用户诉求「全部 toast 都要能回看」「关掉再打开还能看到」):
 * ① appendNotice:连续同文同类型只更新时刻(去重"正在重连…"刷屏)、不同类型不算重复、
 *    超上限裁最旧;
 * ② 渲染:空列表不出图、有记录时每条文案都上屏;
 * ③ 持久化:AsyncStorage 适配器接上 shared 契约后,save→load 往返一致、会话间互不串味、
 *    清空后读回为空。
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  appendNotice,
  NoticeLog,
  NOTICE_LOG_CAP,
  type ChatNotice,
} from '../src/components/chat/NoticeLog'
import {
  clearNoticeLog,
  loadNoticeLog,
  noticeLogStorageKey,
  saveNoticeLog,
} from '@ihui/shared/chat/notice-log'
import { noticeLogStorage } from '../src/lib/notice-log-storage'
import asyncStorageMock from './__mocks__/async-storage'

/** 取替身的内存 Map(只读断言用;写入一律走真实适配器) */
function asyncStorageStore(): Map<string, string> {
  return (asyncStorageMock as unknown as { __store: Map<string, string> }).__store
}

function n(
  id: number,
  text: string,
  kind: ChatNotice['kind'] = 'info',
  ts = 1000 + id,
): ChatNotice {
  return { id: `notice-${id}`, kind, text, ts }
}

describe('appendNotice:去重 / 上限', () => {
  it('追加不同文案', () => {
    const out = appendNotice([], n(1, '已保存'))
    expect(out).toHaveLength(1)
    expect(out[0]?.text).toBe('已保存')
  })

  it('连续同文同类型只更新时间,不重复占位', () => {
    const a = appendNotice([], n(1, '正在重连…', 'warning', 1000))
    const b = appendNotice(a, n(2, '正在重连…', 'warning', 2000))
    expect(b).toHaveLength(1)
    expect(b[0]?.ts).toBe(2000)
  })

  it('同文不同类型不算重复(各自留痕)', () => {
    const a = appendNotice([], n(1, '操作完成', 'success'))
    const b = appendNotice(a, n(2, '操作完成', 'warning'))
    expect(b).toHaveLength(2)
  })

  it('超上限裁最旧,保留最新', () => {
    let list: ChatNotice[] = []
    for (let i = 1; i <= NOTICE_LOG_CAP + 5; i++) list = appendNotice(list, n(i, `第 ${i} 条`))
    expect(list).toHaveLength(NOTICE_LOG_CAP)
    expect(list[list.length - 1]?.text).toBe(`第 ${NOTICE_LOG_CAP + 5} 条`)
    expect(list[0]?.text).toBe('第 6 条')
  })
})

describe('NoticeLog 渲染', () => {
  it('空列表不出图', () => {
    const { container } = render(<NoticeLog notices={[]} />)
    expect(container.textContent).toBe('')
  })

  it('有记录时每条文案都上屏', () => {
    const { getByText } = render(
      <NoticeLog notices={[n(1, '已保存'), n(2, '网络异常', 'error')]} />,
    )
    expect(getByText('已保存')).toBeTruthy()
    expect(getByText('网络异常')).toBeTruthy()
  })
})

describe('留痕持久化(AsyncStorage 适配器 × shared 契约)', () => {
  it('save → load 往返一致(关掉 App 再打开仍能看到)', async () => {
    const list = [n(1, '已保存', 'success'), n(2, '网络异常', 'error')]
    await saveNoticeLog(noticeLogStorage, 'conv-rn-1', list)
    await expect(loadNoticeLog(noticeLogStorage, 'conv-rn-1')).resolves.toEqual(list)
  })

  it('不同会话互不覆盖', async () => {
    await saveNoticeLog(noticeLogStorage, 'conv-a', [n(1, '会话 A 的提示')])
    await saveNoticeLog(noticeLogStorage, 'conv-b', [n(2, '会话 B 的提示')])
    expect((await loadNoticeLog(noticeLogStorage, 'conv-a'))[0]?.text).toBe('会话 A 的提示')
    expect((await loadNoticeLog(noticeLogStorage, 'conv-b'))[0]?.text).toBe('会话 B 的提示')
  })

  it('未绑定会话(新会话整场无 id)落 draft 键,清空后读回为空', async () => {
    await saveNoticeLog(noticeLogStorage, null, [n(1, '新会话里的提示')])
    // 落点必须是 draft 键:新会话整场没有 conversationId(见 shared 模块头注)
    expect(asyncStorageStore().has(noticeLogStorageKey(null))).toBe(true)
    await expect(loadNoticeLog(noticeLogStorage, null)).resolves.toHaveLength(1)
    await clearNoticeLog(noticeLogStorage, null)
    await expect(loadNoticeLog(noticeLogStorage, null)).resolves.toEqual([])
  })

  it('盘上是脏数据时不炸,降级为空', async () => {
    await noticeLogStorage.setItem(noticeLogStorageKey('conv-bad'), '{不是 JSON')
    await expect(loadNoticeLog(noticeLogStorage, 'conv-bad')).resolves.toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
