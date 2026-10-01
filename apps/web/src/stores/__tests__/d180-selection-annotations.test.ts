// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D180(2026-09-30 立):划词批注状态层装车证明。
// 判据:① 归属(conversationId+messageId 复合键)进数据结构;② 增/评/单删/全删四动作;
// ③ persist 真实可读写 —— 动作后 localStorage 载荷含批注,模块重建(reload 仿真)后读回,
//   这是"批注活过刷新"的证明,不是内存数组自说自话。
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  selectionAnnotationKey,
  useSelectionAnnotationsStore,
} from '@/stores/d180-selection-annotations'

const PERSIST_KEY = 'ihui-d180-selection-annotations'

function reset() {
  useSelectionAnnotationsStore.setState({ annotationsByMessage: {} })
  localStorage.clear()
}

describe('D180 划词批注 store', () => {
  beforeEach(() => {
    reset()
  })

  it('addAnnotation 以 conversationId::messageId 为归属键入清单,并 trim 选段', () => {
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '  选中文字 A  ')
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm2', '另一条消息的选段')
    useSelectionAnnotationsStore.getState().addAnnotation('c2', 'm1', '别的会话')
    const s = useSelectionAnnotationsStore.getState()
    expect(s.annotationsByMessage[selectionAnnotationKey('c1', 'm1')]!.map((a) => a.text)).toEqual([
      '选中文字 A',
    ])
    expect(s.annotationsByMessage[selectionAnnotationKey('c1', 'm2')]).toHaveLength(1)
    expect(s.annotationsByMessage[selectionAnnotationKey('c2', 'm1')]).toHaveLength(1)
    // 同会话不同消息、不同会话同消息互不串线(ownership 生效)
    expect(s.annotationsByMessage[selectionAnnotationKey('c1', 'm1')]).toHaveLength(1)
  })

  it('空白选段不入清单;setComment 只改目标条的评论', () => {
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '   ')
    expect(useSelectionAnnotationsStore.getState().annotationsByMessage).toEqual({})

    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '甲段')
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '乙段')
    const key = selectionAnnotationKey('c1', 'm1')
    const [first] = useSelectionAnnotationsStore.getState().annotationsByMessage[key]!
    useSelectionAnnotationsStore.getState().setComment('c1', 'm1', first!.id, '评论一')
    const list = useSelectionAnnotationsStore.getState().annotationsByMessage[key]!
    expect(list[0]!.comment).toBe('评论一')
    expect(list[1]!.comment).toBe('')
  })

  it('removeAnnotation 清空该条后撤收键位;removeAllAnnotations 撤收整条消息', () => {
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '甲段')
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '乙段')
    const key = selectionAnnotationKey('c1', 'm1')
    const [first, second] = useSelectionAnnotationsStore.getState().annotationsByMessage[key]!

    useSelectionAnnotationsStore.getState().removeAnnotation('c1', 'm1', first!.id)
    expect(
      useSelectionAnnotationsStore.getState().annotationsByMessage[key]!.map((a) => a.text),
    ).toEqual(['乙段'])

    useSelectionAnnotationsStore.getState().removeAnnotation('c1', 'm1', second!.id)
    expect(key in useSelectionAnnotationsStore.getState().annotationsByMessage).toBe(false)

    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '丙段')
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm2', '丁段')
    useSelectionAnnotationsStore.getState().removeAllAnnotations('c1', 'm1')
    expect(key in useSelectionAnnotationsStore.getState().annotationsByMessage).toBe(false)
    // 全删只清本消息,不波及同会话他条(键位粒度)
    expect(
      useSelectionAnnotationsStore.getState().annotationsByMessage[
        selectionAnnotationKey('c1', 'm2')
      ],
    ).toHaveLength(1)
  })

  it('persist 真实可读写:动作落入 localStorage,模块重建(刷新仿真)后按归属键读回', async () => {
    useSelectionAnnotationsStore.getState().addAnnotation('c1', 'm1', '刷新后仍要在')
    useSelectionAnnotationsStore
      .getState()
      .setComment(
        'c1',
        'm1',
        useSelectionAnnotationsStore.getState().annotationsByMessage[
          selectionAnnotationKey('c1', 'm1')
        ]![0]!.id,
        '刷新后的评论',
      )

    const raw = localStorage.getItem(PERSIST_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as {
      state: { annotationsByMessage: Record<string, { text: string; comment: string }[]> }
    }
    expect(
      parsed.state.annotationsByMessage[selectionAnnotationKey('c1', 'm1')]![0]!,
    ).toMatchObject({ text: '刷新后仍要在', comment: '刷新后的评论' })

    // 刷新仿真:重建模块图 ⇒ 新 store 实例从 localStorage 同步 rehydrate
    vi.resetModules()
    const fresh = await import('@/stores/d180-selection-annotations')
    const rehydrated =
      fresh.useSelectionAnnotationsStore.getState().annotationsByMessage[
        selectionAnnotationKey('c1', 'm1')
      ]!
    expect(rehydrated).toHaveLength(1)
    expect(rehydrated[0]!.text).toBe('刷新后仍要在')
    expect(rehydrated[0]!.comment).toBe('刷新后的评论')

    // 收尾:恢复单例态,避免泄漏到同文件其他用例(共享 localStorage 已含上一步载荷)
    reset()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
