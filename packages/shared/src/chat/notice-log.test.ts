// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  NOTICE_LOG_CAP,
  NOTICE_LOG_DRAFT_KEY,
  NOTICE_LOG_STORAGE_PREFIX,
  appendNotice,
  clearNoticeLog,
  isNoticeKind,
  loadNoticeLog,
  mergeNotices,
  noticeLogStorageKey,
  parseNoticeLog,
  saveNoticeLog,
  serializeNoticeLog,
  type ChatNotice,
  type NoticeLogStorage,
} from './notice-log'

function notice(over: Partial<ChatNotice> = {}): ChatNotice {
  return { id: 'n1', kind: 'info', text: 'hello', ts: 1000, ...over }
}

/** 内存存储替身:与 RN AsyncStorage / web localStorage 同构的最小实现 */
function memoryStorage(seed: Record<string, string> = {}): NoticeLogStorage & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(seed))
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v)
    },
    removeItem: async (k) => {
      data.delete(k)
    },
  }
}

describe('appendNotice — 追加与去重', () => {
  it('空列表追加一条', () => {
    expect(appendNotice([], notice())).toHaveLength(1)
  })

  it('同文同类型 ⇒ 只更新时刻,不新增占位(去重「正在重连…」刷屏)', () => {
    const first = notice({ id: 'a', text: '正在重连…', ts: 100 })
    const again = notice({ id: 'b', text: '正在重连…', ts: 200 })
    const out = appendNotice([first], again)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'a', text: '正在重连…', ts: 200 })
  })

  it('同文不同类型 ⇒ 各自占位(错误和警告不是同一件事)', () => {
    const warn = notice({ id: 'a', kind: 'warning', text: '网络不稳定' })
    const err = notice({ id: 'b', kind: 'error', text: '网络不稳定' })
    expect(appendNotice([warn], err)).toHaveLength(2)
  })

  it('超过上限丢最旧', () => {
    let list: ChatNotice[] = []
    for (let i = 0; i < NOTICE_LOG_CAP + 5; i++) {
      list = appendNotice(list, notice({ id: `n${i}`, text: `t${i}`, ts: i }))
    }
    expect(list).toHaveLength(NOTICE_LOG_CAP)
    expect(list[0].id).toBe('n5')
    expect(list[list.length - 1].id).toBe(`n${NOTICE_LOG_CAP + 4}`)
  })
})

describe('mergeNotices — 读回与新记录并存', () => {
  it('按 id 去重、按时刻升序、超限裁最旧', () => {
    const a = [notice({ id: 'x', ts: 300 }), notice({ id: 'y', ts: 100 })]
    const b = [notice({ id: 'x', ts: 300, text: '覆盖后' }), notice({ id: 'z', ts: 200 })]
    const out = mergeNotices(a, b)
    expect(out.map((n) => n.id)).toEqual(['y', 'z', 'x'])
    expect(out.find((n) => n.id === 'x')?.text).toBe('覆盖后')
  })
})

describe('isNoticeKind — 封闭集守卫', () => {
  it('四态为真,其余为假', () => {
    for (const k of ['success', 'error', 'warning', 'info']) expect(isNoticeKind(k)).toBe(true)
    for (const k of ['', 'ERROR', 'debug', null, undefined, 1]) expect(isNoticeKind(k)).toBe(false)
  })
})

describe('noticeLogStorageKey — 未绑定会话落 draft 键', () => {
  it('有 id 按 id 分键', () => {
    expect(noticeLogStorageKey('conv-1')).toBe(`${NOTICE_LOG_STORAGE_PREFIX}:conv-1`)
  })

  it('null / 空串 / 纯空白一律落 draft 键(新会话恒无 id,见模块头注)', () => {
    const draft = `${NOTICE_LOG_STORAGE_PREFIX}:${NOTICE_LOG_DRAFT_KEY}`
    for (const v of [null, undefined, '', '   ']) expect(noticeLogStorageKey(v)).toBe(draft)
  })
})

describe('序列化 / 反序列化', () => {
  it('往返不丢字段', () => {
    const list = [notice({ id: 'a', kind: 'error', text: '失败了', ts: 42 })]
    expect(parseNoticeLog(serializeNoticeLog(list))).toEqual(list)
  })

  it('空列表序列化后读回仍为空(显式清空可被表达)', () => {
    expect(parseNoticeLog(serializeNoticeLog([]))).toEqual([])
  })

  it('坏数据一律降级为空,不抛错', () => {
    for (const raw of [null, undefined, '', 'not-json', '{}', '{"items":1}', '[]', 'null']) {
      expect(() => parseNoticeLog(raw as string | null)).not.toThrow()
      expect(parseNoticeLog(raw as string | null)).toEqual([])
    }
  })

  it('逐条校验:单条字段不合格只丢那条,不整批作废', () => {
    const raw = JSON.stringify({
      v: 1,
      items: [
        { id: 'ok', kind: 'info', text: '留下', ts: 1 },
        { id: '', kind: 'info', text: '空 id 丢', ts: 2 },
        { id: 'bad-kind', kind: 'debug', text: '未知类型丢', ts: 3 },
        { id: 'bad-text', kind: 'info', text: '', ts: 4 },
        { id: 'bad-ts', kind: 'info', text: '时刻非数丢', ts: 'x' },
        null,
        'oops',
      ],
    })
    const out = parseNoticeLog(raw)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('ok')
  })

  it('反序列化结果同样受上限约束(防手改存储撑爆内存)', () => {
    const items = Array.from({ length: NOTICE_LOG_CAP + 10 }, (_, i) => ({
      id: `n${i}`,
      kind: 'info',
      text: `t${i}`,
      ts: i,
    }))
    const out = parseNoticeLog(JSON.stringify({ v: 1, items }))
    expect(out).toHaveLength(NOTICE_LOG_CAP)
    expect(out[out.length - 1].id).toBe(`n${NOTICE_LOG_CAP + 9}`)
  })
})

describe('存储适配器三个薄封装', () => {
  it('save → load 往返一致', async () => {
    const storage = memoryStorage()
    const list = [notice({ id: 'a', text: '存起来', ts: 7 })]
    await saveNoticeLog(storage, 'conv-9', list)
    await expect(loadNoticeLog(storage, 'conv-9')).resolves.toEqual(list)
  })

  it('不同会话互不覆盖', async () => {
    const storage = memoryStorage()
    await saveNoticeLog(storage, 'c1', [notice({ id: 'a', text: '会话一' })])
    await saveNoticeLog(storage, 'c2', [notice({ id: 'b', text: '会话二' })])
    expect((await loadNoticeLog(storage, 'c1'))[0].text).toBe('会话一')
    expect((await loadNoticeLog(storage, 'c2'))[0].text).toBe('会话二')
  })

  it('clear 删键后读回为空', async () => {
    const storage = memoryStorage()
    await saveNoticeLog(storage, null, [notice({ id: 'a' })])
    await clearNoticeLog(storage, null)
    await expect(loadNoticeLog(storage, null)).resolves.toEqual([])
  })

  it('适配器没有 removeItem 时退化为写空列表(仍能读到空)', async () => {
    const storage = memoryStorage()
    const noRemove: NoticeLogStorage = {
      getItem: storage.getItem,
      setItem: storage.setItem,
    }
    await saveNoticeLog(noRemove, 'c1', [notice({ id: 'a' })])
    await clearNoticeLog(noRemove, 'c1')
    await expect(loadNoticeLog(noRemove, 'c1')).resolves.toEqual([])
  })

  it('存储层异常照常向上抛(不静默假装成功)', async () => {
    const broken: NoticeLogStorage = {
      getItem: async () => {
        throw new Error('disk full')
      },
      setItem: async () => {
        throw new Error('disk full')
      },
    }
    await expect(loadNoticeLog(broken, 'c1')).rejects.toThrow('disk full')
    await expect(saveNoticeLog(broken, 'c1', [])).rejects.toThrow('disk full')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
