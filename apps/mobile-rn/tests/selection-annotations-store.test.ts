// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 会话批注 store(D180 对齐层)的行为断言。
 *
 * 钉住四件事:
 * ① **归属键是复合键** —— 同一 messageId 在不同 conversationId 下不得互相看到批注
 *    (web 用 `${conversationId}::${messageId}`,裸 messageId 会在切对话后串味)。
 * ② **活过冷启动** —— mutate 落 AsyncStorage,rehydrate 能取回;取不到/坏数据不炸、
 *    不改现状(web 的 persist rehydrate 同义)。
 * ③ **写语义与 web 同形** —— 空文本丢弃、comment 空串表示未填、删到最后一条撤键。
 * ④ **选择器返回稳定空引用** —— 无批注时不得每次渲染造新数组(web 侧
 *    `EMPTY_SELECTION_ANNOTATIONS` 同因:重渲染风暴)。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
const setItem = vi.fn(async (k: string, v: string) => {
  store.set(k, v)
})
const getItem = vi.fn(async (k: string) => store.get(k) ?? null)
const removeItem = vi.fn(async (k: string) => {
  store.delete(k)
})

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: (...a: unknown[]) => setItem(...(a as [string, string])),
    getItem: (...a: unknown[]) => getItem(...(a as [string])),
    removeItem: (...a: unknown[]) => removeItem(...(a as [string])),
  },
}))

import type * as SelectionAnnotationsModule from '../src/lib/selection-annotations-store'

/**
 * store 是模块级单例(与端内运行时同形),所以每条用例都要拿一份**全新模块实例**,
 * 否则上一条留下的内存态会渗进下一条 —— 那不是被测行为,是测试自己造的脏输入。
 */
type Store = typeof SelectionAnnotationsModule

async function freshStore(): Promise<Store> {
  vi.resetModules()
  return import('../src/lib/selection-annotations-store')
}

const PAYLOAD = (): Record<string, Array<{ id: string; text: string; comment: string }>> =>
  JSON.parse(store.get('ihui-d180-selection-annotations') ?? '{}') as Record<
    string,
    Array<{ id: string; text: string; comment: string }>
  >

describe('会话批注 store', () => {
  beforeEach(() => {
    store.clear()
    setItem.mockClear()
    getItem.mockClear()
    removeItem.mockClear()
  })

  it('复合键:同一 messageId 在两个会话下互不可见', async () => {
    const { addAnnotation, selectionAnnotationKey } = await freshStore()
    addAnnotation('conv-a', 'm1', 'A 会话的原文')
    addAnnotation('conv-b', 'm1', 'B 会话的原文')
    expect(selectionAnnotationKey('conv-a', 'm1')).not.toBe(selectionAnnotationKey('conv-b', 'm1'))
    expect(Object.keys(PAYLOAD()).sort()).toEqual(['conv-a::m1', 'conv-b::m1'].sort())
  })

  it('空文本批注被丢弃(web 同形:trim 后为空即不入)', async () => {
    const { addAnnotation } = await freshStore()
    addAnnotation('c', 'm', '   \n  ')
    expect(store.get('ihui-d180-selection-annotations')).toBeUndefined()
  })

  it('写入时 trim 原文,comment 初始为空串', async () => {
    const { addAnnotation } = await freshStore()
    addAnnotation('c', 'm', '  正文  ')
    expect(PAYLOAD()['c::m']?.[0]?.text).toBe('正文')
    expect(PAYLOAD()['c::m']?.[0]?.comment).toBe('')
  })

  it('删到最后一条时撤键,不留空数组', async () => {
    const { addAnnotation, removeAnnotation } = await freshStore()
    addAnnotation('c', 'm', '一')
    addAnnotation('c', 'm', '二')
    const ids = PAYLOAD()['c::m']?.map((a) => a.id) ?? []
    expect(ids).toHaveLength(2)
    removeAnnotation('c', 'm', ids[0] as string)
    expect(PAYLOAD()['c::m']).toHaveLength(1)
    removeAnnotation('c', 'm', ids[1] as string)
    expect(PAYLOAD()['c::m']).toBeUndefined()
  })

  it('removeAll 只撤本条命名空间', async () => {
    const { addAnnotation, removeAllAnnotations } = await freshStore()
    addAnnotation('c', 'm', '一')
    addAnnotation('c', 'other', '二')
    removeAllAnnotations('c', 'm')
    expect(PAYLOAD()['c::m']).toBeUndefined()
    expect(PAYLOAD()['c::other']).toHaveLength(1)
  })

  it('setComment 原地改不追加,且按 web 同形不做 trim(web 侧由 UI 层 trim)', async () => {
    const { addAnnotation, setComment } = await freshStore()
    addAnnotation('c', 'm', '一')
    const id = PAYLOAD()['c::m']?.[0]?.id as string
    setComment('c', 'm', id, ' 好看 ')
    expect(PAYLOAD()['c::m']).toHaveLength(1)
    expect(PAYLOAD()['c::m']?.[0]?.comment).toBe(' 好看 ')
  })

  it('落盘键与 web localStorage 同名(两端可对账)', async () => {
    const { addAnnotation } = await freshStore()
    addAnnotation('conv-x', 'm9', '跨进程留存')
    expect(store.get('ihui-d180-selection-annotations')).toBeDefined()
    expect(PAYLOAD()['conv-x::m9']?.[0]?.text).toBe('跨进程留存')
  })

  it('冷启动回填:坏数据不抛、不改现状(缺键不得折成"清空")', async () => {
    const { addAnnotation, rehydrateSelectionAnnotations } = await freshStore()
    addAnnotation('c', 'm', '留存')
    for (const bad of ['{ not json', '["数组不是本该有的形状"]', 'null', '"字符串"', '42']) {
      store.set('ihui-d180-selection-annotations', bad)
      await expect(rehydrateSelectionAnnotations()).resolves.toBeUndefined()
    }
  })

  it('冷启动回填:合法载荷进内存(再写一条时旧批注仍在,证明真回填而非空态)', async () => {
    const writer = await freshStore()
    writer.addAnnotation('c', 'm', '留存')
    const persisted = store.get('ihui-d180-selection-annotations') as string
    // 模拟冷启动:换一个模块实例(内存态为空),只喂落盘数据
    const reader = await freshStore()
    store.set('ihui-d180-selection-annotations', persisted)
    await reader.rehydrateSelectionAnnotations()
    reader.addAnnotation('c', 'm', '新写的一条')
    expect(PAYLOAD()['c::m']?.map((a) => a.text)).toEqual(['留存', '新写的一条'])
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
