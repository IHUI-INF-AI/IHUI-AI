// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyColdStartRestore,
  buildColdStartPlaceholder,
  writeColdStartSnapshot,
} from '@/lib/cold-start-restore'
import { useChatStore } from '@/stores/chat'

const USER = 'u-cold-start-1'
const ROWS = [
  { id: 'c1', title: '进行中' },
  { id: 'c2', title: '昨天的会' },
]

describe('冷启动快照真实消费路径(首屏写入 → 契约判决 → 冷启消费)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useChatStore.getState().setConversationId(null)
  })

  it('侧栏首屏写入的快照能在冷启预填列表,并命中深链恢复会话', () => {
    writeColdStartSnapshot(USER, ROWS)

    // 侧栏首屏预填:与写入同源,按 userId 分桶,只回真实有的 id/title
    const placeholder = buildColdStartPlaceholder(USER)
    expect(placeholder?.pages[0]?.conversations.map((c) => [c.id, c.title])).toEqual([
      ['c1', '进行中'],
      ['c2', '昨天的会'],
    ])
    // 换账号:分桶隔离,读不到别人的快照
    expect(buildColdStartPlaceholder('u-other')).toBeUndefined()

    // 冷启消费点:深链命中快照 → 提前摆正会话
    expect(applyColdStartRestore({ userId: USER, conversationId: 'c1' })).toMatchObject({
      disposition: 'restore',
      routeId: 'c1',
    })
    expect(useChatStore.getState().conversationId).toBe('c1')
  })

  it('深链不在快照/快照不可读时安静跳过,不改会话也不阻断常规深链', () => {
    writeColdStartSnapshot(USER, ROWS)
    useChatStore.getState().setConversationId('keep')

    // 深链指向快照外的会话:契约只判 list-only,消费点不碰会话(常规同步照常进入)
    expect(applyColdStartRestore({ userId: USER, conversationId: 'c9' })).toMatchObject({
      disposition: 'list-only',
      reason: 'route-absent',
      routeId: null,
    })
    expect(useChatStore.getState().conversationId).toBe('keep')

    // 快照整体不可读(如被清掉):unjudged,同样安静跳过
    window.localStorage.clear()
    expect(applyColdStartRestore({ userId: USER, conversationId: 'c1' }).reason).toBe(
      'snapshot-unmeasured',
    )
    expect(useChatStore.getState().conversationId).toBe('keep')
    expect(buildColdStartPlaceholder(USER)).toBeUndefined()
  })

  it('版本不认的快照不进预填,也不参与路由判定', () => {
    writeColdStartSnapshot(USER, ROWS)
    const key = Object.keys(window.localStorage).find((k) => k.includes(USER))
    expect(key).toBeTruthy()
    const raw = JSON.parse(window.localStorage.getItem(key!) as string) as Record<string, unknown>
    window.localStorage.setItem(key!, JSON.stringify({ ...raw, version: 2 }))

    expect(buildColdStartPlaceholder(USER)).toBeUndefined()
    expect(applyColdStartRestore({ userId: USER, conversationId: 'c1' }).reason).toBe(
      'version-unrecognized',
    )
    expect(useChatStore.getState().conversationId).toBeNull()
  })
})
