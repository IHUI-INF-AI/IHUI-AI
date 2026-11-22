// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D03 会话内快捷笔记 —— shared 数据层真值表(文字纵切片)
 *
 * 钉四件事:
 *  ① CRUD 真值表:create/update/archive/remove 逐动作断言(时间戳注入,全确定性);
 *  ② 持久化往返:写后同 key 新实例 rehydrate 回读一致(数据落 transport);
 *  ③ 搜索过滤:归档默认隐藏/关键词命中标题+正文+分组(大小写不敏感)/分组精确/排序;
 *  ④ 插入拼接:composeInsertText 与 ChatScreen setPrompt 通道同口径(空/非空/纯空白)。
 */
import { describe, it, expect } from 'vitest'
import {
  createQuickNotesStore,
  filterQuickNotes,
  composeInsertText,
  type QuickNote,
} from '../quick-notes-store'
import { createMemoryTransport } from '../transport'

/** 确定时钟:第 i 次调用返回 1000 + i */
function makeClock() {
  let i = 0
  return () => 1000 + i++
}
function makeIds() {
  let i = 0
  return (now: number) => `id-${now}-${i++}`
}

function makeNote(partial: Partial<QuickNote> & { id: string }): QuickNote {
  return {
    title: '',
    content: '',
    group: '',
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('quick-notes store CRUD 真值表', () => {
  it('create: 头插 + 默认未归档 + 时间戳/分组按入参', () => {
    const store = createQuickNotesStore({
      transport: createMemoryTransport(),
      now: makeClock(),
      newId: makeIds(),
    })
    const a = store.getState().createNote({ title: 'A', content: '内容A' })
    const b = store.getState().createNote({ title: 'B', content: '', group: '工作' })
    expect(a).toMatchObject({
      id: 'id-1000-0',
      title: 'A',
      content: '内容A',
      group: '',
      archived: false,
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(b.id).toBe('id-1001-1')
    expect(store.getState().notes.map((n) => n.title)).toEqual(['B', 'A'])
  })

  it('update: 只改目标且 bump updatedAt;归档 toggle 走 setArchived', () => {
    const store = createQuickNotesStore({
      transport: createMemoryTransport(),
      now: makeClock(),
      newId: makeIds(),
    })
    const a = store.getState().createNote({ title: 'A', content: 'x' })
    const b = store.getState().createNote({ title: 'B', content: 'y' })
    store.getState().updateNote(a.id, { title: 'A2' })
    const notes = store.getState().notes
    expect(notes.find((n) => n.id === a.id)).toMatchObject({ title: 'A2', updatedAt: 1002 })
    expect(notes.find((n) => n.id === b.id)?.title).toBe('B')
    store.getState().setArchived(b.id, true)
    expect(store.getState().notes.find((n) => n.id === b.id)).toMatchObject({
      archived: true,
      updatedAt: 1003,
    })
  })

  it('remove: 只删目标;不存在的 id 无副作用', () => {
    const store = createQuickNotesStore({
      transport: createMemoryTransport(),
      now: makeClock(),
      newId: makeIds(),
    })
    const a = store.getState().createNote({ title: 'A', content: '' })
    const before = store.getState().notes.length
    store.getState().removeNote('nope')
    expect(store.getState().notes.length).toBe(before)
    store.getState().removeNote(a.id)
    expect(store.getState().notes).toEqual([])
  })
})

describe('quick-notes 持久化往返', () => {
  it('写后同 key 新实例 rehydrate 回读一致', async () => {
    const transport = createMemoryTransport()
    const clock = makeClock()
    const ids = makeIds()
    const writer = createQuickNotesStore({ transport, now: clock, newId: ids })
    const n1 = writer.getState().createNote({ title: '甲', content: '正文', group: 'g' })
    writer.getState().setArchived(n1.id, true)

    const reader = createQuickNotesStore({ transport, now: clock, newId: ids })
    await Promise.resolve(reader.rehydrate())
    const restored = reader.getState().notes.find((n) => n.id === n1.id)
    expect(restored).toMatchObject({ title: '甲', content: '正文', group: 'g', archived: true })
  })
})

describe('filterQuickNotes 搜索过滤真值表', () => {
  const notes: QuickNote[] = [
    makeNote({ id: '1', title: '会议纪要', content: '讨论 Q4 规划', group: '工作', updatedAt: 5 }),
    makeNote({ id: '2', title: 'TODO', content: '买菜 grep 关键词', updatedAt: 9 }),
    makeNote({
      id: '3',
      title: '旧稿',
      content: '废弃草稿',
      group: '工作',
      archived: true,
      updatedAt: 7,
    }),
  ]

  it('默认隐藏已归档;includeArchived 才放出', () => {
    expect(filterQuickNotes(notes).map((n) => n.id)).toEqual(['2', '1'])
    expect(filterQuickNotes(notes, { includeArchived: true }).map((n) => n.id)).toEqual([
      '2',
      '3',
      '1',
    ])
  })

  it('关键词大小写不敏感命中标题/正文/分组', () => {
    expect(filterQuickNotes(notes, { query: '会议' }).map((n) => n.id)).toEqual(['1'])
    expect(filterQuickNotes(notes, { query: 'GREP' }).map((n) => n.id)).toEqual(['2'])
    expect(filterQuickNotes(notes, { query: '工作' }).map((n) => n.id)).toEqual(['1'])
    expect(filterQuickNotes(notes, { query: '  ' })).toEqual(filterQuickNotes(notes))
  })

  it('分组精确过滤;updatedAt 倒序', () => {
    expect(
      filterQuickNotes(notes, { group: '工作', includeArchived: true }).map((n) => n.id),
    ).toEqual(['3', '1'])
    expect(filterQuickNotes(notes, { group: '不存在' })).toEqual([])
  })
})

describe('composeInsertText 插入拼接(会话通道口径)', () => {
  it('空输入框直接落文本;非空换行追加;纯空白文本不产生追加', () => {
    expect(composeInsertText('', 'hello')).toBe('hello')
    expect(composeInsertText('已有', 'hello')).toBe('已有\nhello')
    expect(composeInsertText('已有', '   ')).toBe('已有')
    expect(composeInsertText('', '   ')).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
