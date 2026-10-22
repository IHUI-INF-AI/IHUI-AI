// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票64(2026-10-18 立):版本族读投影用例。咬三件事:
//  ① 判族只认 siblingIndex 非 null 的行 —— W16 live 本地链(parentMessageId=前一条、
//     无 siblingIndex)不得被误当族成员,否则正常时间线会被投影吃掉;
//  ② 同族多版本只渲染激活版本(= siblingIndex 最大),且输出保持时间线原序;
//  ③ 防御:族根不在集合(分页切割)⇒ 整族保留,宁可重复不丢内容。
// 另:历史水合必须把版本族坐标按名列清单挂进 store 行(不在清单 = 静默丢)。

import { describe, expect, it } from 'vitest'

import {
  hasVersionFamilyCoords,
  projectActiveMessages,
  versionFamilyMembers,
  versionFamilyPosition,
  versionFamilyRootId,
} from '@/lib/message-version-family'
import { hydrateHistoryMessage } from '@/hooks/use-chat/history-message'

interface Row {
  id: string
  parentMessageId?: string | null
  siblingIndex?: number | null
}

const row = (id: string, opts: Omit<Row, 'id'> = {}): Row => ({ id, ...opts })

describe('hasVersionFamilyCoords / versionFamilyRootId', () => {
  it('live 本地链(parentMessageId 有、siblingIndex 无)判为非族成员', () => {
    expect(hasVersionFamilyCoords(row('m1', { parentMessageId: 'm0' }))).toBe(false)
  })

  it('服务端确认非族(siblingIndex=null)判为非族成员', () => {
    expect(hasVersionFamilyCoords(row('m1', { parentMessageId: null, siblingIndex: null }))).toBe(
      false,
    )
  })

  it('siblingIndex=0(族根被开族后补标)判为族成员,族根取自身', () => {
    const m = row('m1', { parentMessageId: null, siblingIndex: 0 })
    expect(hasVersionFamilyCoords(m)).toBe(true)
    expect(versionFamilyRootId(m)).toBe('m1')
  })

  it('族成员的族根取 parentMessageId', () => {
    expect(versionFamilyRootId(row('m2', { parentMessageId: 'm1', siblingIndex: 2 }))).toBe('m1')
  })
})

describe('projectActiveMessages', () => {
  it('零坐标输入原样返回(不重建数组引用除外,逐项等值)', () => {
    const input = [row('a'), row('b', { parentMessageId: 'a' })]
    expect(projectActiveMessages(input)).toEqual(input)
  })

  it('同族三版本只保留激活(最大 siblingIndex),非族消息保留,输出保序', () => {
    const input = [
      row('user1'),
      row('ai-v0', { siblingIndex: 0 }), // 族根
      row('other1'),
      row('ai-v1', { parentMessageId: 'ai-v0', siblingIndex: 1 }),
      row('ai-v2', { parentMessageId: 'ai-v0', siblingIndex: 2 }), // 激活
    ]
    expect(projectActiveMessages(input).map((m) => m.id)).toEqual(['user1', 'other1', 'ai-v2'])
  })

  it('族根尚未被开族(siblingIndex 缺席)但成员在 ⇒ 族根保留,只剔成员', () => {
    // 存量老消息(从未 regenerate)没有坐标,后来开族后历史页重拉:根行是老数据
    // 无坐标 ⇒ hasVersionFamilyCoords=false ⇒ 不进族桶 ⇒ 自然保留
    const input = [row('ai-root'), row('ai-v1', { parentMessageId: 'ai-root', siblingIndex: 1 })]
    expect(projectActiveMessages(input).map((m) => m.id)).toEqual(['ai-root', 'ai-v1'])
  })

  it('族根不在集合(分页切割)⇒ 整族成员保留(宁可重复不丢内容)', () => {
    const input = [
      row('member-1', { parentMessageId: 'missing-root', siblingIndex: 1 }),
      row('member-2', { parentMessageId: 'missing-root', siblingIndex: 2 }),
    ]
    expect(projectActiveMessages(input).map((m) => m.id)).toEqual(['member-1', 'member-2'])
  })

  it('两条不同族互不干扰', () => {
    const input = [
      row('f1-root', { siblingIndex: 0 }),
      row('f1-v1', { parentMessageId: 'f1-root', siblingIndex: 1 }),
      row('f2-root', { siblingIndex: 0 }),
      row('f2-v1', { parentMessageId: 'f2-root', siblingIndex: 1 }),
    ]
    expect(projectActiveMessages(input).map((m) => m.id)).toEqual(['f1-v1', 'f2-v1'])
  })
})

describe('票59 2/3:versionFamilyMembers / versionFamilyPosition 与手动切换态', () => {
  const timeline = [
    row('user-1'),
    row('ai-root', { siblingIndex: 0 }),
    row('ai-v1', { parentMessageId: 'ai-root', siblingIndex: 1 }),
    row('ai-v2', { parentMessageId: 'ai-root', siblingIndex: 2 }),
  ]

  it('成员枚举按 siblingIndex 升序,族根(siblingIndex=0)排第一', () => {
    expect(versionFamilyMembers(timeline, 'ai-root').map((m) => m.id)).toEqual([
      'ai-root',
      'ai-v1',
      'ai-v2',
    ])
  })

  it('位置读数是 1 起显示前的 0 起序号 + 总数', () => {
    expect(versionFamilyPosition(timeline, 'ai-v1')).toMatchObject({
      rootId: 'ai-root',
      index: 1,
      total: 3,
    })
  })

  it('非族成员 / 单版本族 ⇒ null(不渲染切换器,不做 1/1 假控件)', () => {
    expect(versionFamilyPosition(timeline, 'user-1')).toBeNull()
    expect(versionFamilyPosition([row('solo', { siblingIndex: 0 })], 'solo')).toBeNull()
  })

  it('手动切换态把激活版本钉到指定成员(默认是 siblingIndex 最大者)', () => {
    // 默认:最新版 v2
    expect(projectActiveMessages(timeline).map((m) => m.id)).toEqual(['user-1', 'ai-v2'])
    // 切到第 1 版:只渲染它
    expect(projectActiveMessages(timeline, { 'ai-root': 'ai-root' }).map((m) => m.id)).toEqual([
      'user-1',
      'ai-root',
    ])
    // 切到中间版
    expect(projectActiveMessages(timeline, { 'ai-root': 'ai-v1' }).map((m) => m.id)).toEqual([
      'user-1',
      'ai-v1',
    ])
  })

  it('坏指针(指向已不存在的消息)⇒ 回落最新版,不把整族渲染成空', () => {
    expect(projectActiveMessages(timeline, { 'ai-root': 'gone' }).map((m) => m.id)).toEqual([
      'user-1',
      'ai-v2',
    ])
  })

  it('变异对照:把 activate 覆盖那段删掉(只留默认判据)时,上面三条切换断言必须翻红', () => {
    // 这条不是重复实现,而是把"覆盖真的参与了判定"钉成可红可绿:
    // 只按 siblingIndex 最大取激活,任何 override 都不可能改变输出。
    const latestOnly = timeline.filter((m) => m.id !== 'ai-root' && m.id !== 'ai-v1')
    expect(latestOnly.map((m) => m.id)).toEqual(['user-1', 'ai-v2'])
    expect(projectActiveMessages(timeline, { 'ai-root': 'ai-v1' }).map((m) => m.id)).not.toEqual(
      latestOnly.map((m) => m.id),
    )
  })
})

describe('hydrateHistoryMessage 版本族坐标读回', () => {
  it('服务端行带族坐标时逐字段挂进 store 形状', () => {
    const hydrated = hydrateHistoryMessage({
      id: 'ai-v2',
      role: 'assistant',
      content: 'hello',
      createdAt: '2026-10-18T12:00:00.000Z',
      parentMessageId: 'ai-v0',
      siblingIndex: 2,
    })
    expect(hydrated.parentMessageId).toBe('ai-v0')
    expect(hydrated.siblingIndex).toBe(2)
  })

  it('老行(无坐标)落 null,不落 undefined(与 wire serializeMessage 同形)', () => {
    const hydrated = hydrateHistoryMessage({
      id: 'old',
      role: 'user',
      content: 'hi',
      createdAt: '2026-10-18T12:00:00.000Z',
    })
    expect(hydrated.parentMessageId).toBeNull()
    expect(hydrated.siblingIndex).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
