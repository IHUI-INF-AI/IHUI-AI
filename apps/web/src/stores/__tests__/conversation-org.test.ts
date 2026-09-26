// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 web 端会话组织 store 的用例。
//
// 取的是**消费者自己读的那条路**:renderHook 跑 useConversationOrgMap,而不是直接
// getState() 拿值 —— 引用稳定性(未受影响的用户必须拿到同一对象)只有经 zustand 订阅
// 这一层才判得出来,而它正是侧栏 useMemo([orgMap]) 依赖的东西。

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConversationOrgMap, useConversationOrgStore } from '../conversation-org'

const reset = () => useConversationOrgStore.setState({ byUser: {} })

function mapOf(userId: string) {
  return useConversationOrgStore.getState().byUser[userId] ?? {}
}

describe('useConversationOrgStore.setFolder', () => {
  beforeEach(reset)

  it('写入即归一化:首尾空白与换行不会带进存储', () => {
    act(() => useConversationOrgStore.getState().setFolder('u1', 'c1', '  工作\n项目 '))
    expect(mapOf('u1').c1).toEqual({ folder: '工作 项目', tags: [] })
  })

  it('传 null 且没有标签 ⇒ 整条元数据被删掉(不留死键)', () => {
    const { setFolder } = useConversationOrgStore.getState()
    setFolder('u1', 'c1', '工作')
    setFolder('u1', 'c1', null)
    expect(mapOf('u1')).toEqual({})
  })

  it('按 userId 分桶:两个用户的同 id 会话互不影响', () => {
    const { setFolder } = useConversationOrgStore.getState()
    setFolder('u1', 'c1', '甲')
    setFolder('u2', 'c1', '乙')
    expect(mapOf('u1').c1?.folder).toBe('甲')
    expect(mapOf('u2').c1?.folder).toBe('乙')
  })
})

describe('useConversationOrgStore.setTags', () => {
  beforeEach(reset)

  it('去重去空,并保留书写原样', () => {
    act(() => useConversationOrgStore.getState().setTags('u1', 'c1', ['a', 'A', '', ' b ']))
    expect(mapOf('u1').c1?.tags).toEqual(['a', 'b'])
  })

  it('清空标签不影响文件夹;两栏都空才整条删除', () => {
    const { setFolder, setTags } = useConversationOrgStore.getState()
    setFolder('u1', 'c1', '工作')
    setTags('u1', 'c1', ['重要'])
    setTags('u1', 'c1', [])
    expect(mapOf('u1').c1).toEqual({ folder: '工作', tags: [] })
    setFolder('u1', 'c1', null)
    expect(mapOf('u1')).toEqual({})
  })
})

describe('useConversationOrgMap(hook 面)', () => {
  beforeEach(reset)

  it('未登录 / 未知用户都拿到同一个空表引用', () => {
    const { result, rerender } = renderHook(({ uid }) => useConversationOrgMap(uid), {
      initialProps: { uid: null as string | null },
    })
    const empty = result.current
    rerender({ uid: 'ghost' })
    expect(result.current).toBe(empty)
  })

  it('别的用户被改动时,正在读的用户引用不变(否则侧栏每帧重算筛选)', () => {
    const { result } = renderHook(() => useConversationOrgMap('u1'))
    const before = result.current
    act(() => useConversationOrgStore.getState().setFolder('u2', 'c9', '工作'))
    expect(result.current).toBe(before)
    // 自己这条改动后必须换新引用,useMemo 才会重算
    act(() => useConversationOrgStore.getState().setFolder('u1', 'c1', '工作'))
    expect(result.current).not.toBe(before)
    expect(result.current.c1?.folder).toBe('工作')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
