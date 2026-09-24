// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { deniedNotice, queueInteractionPerms, queueReasonKey } from '../input-notices'
import {
  FOLLOW_UP_DEGRADE_KEY,
  FOLLOW_UP_MODES,
  QUEUE_INTERACTION_KINDS,
  applyQueueEdit,
  effectiveMode,
  followUpModeKey,
  interactionAllowed,
  interruptPlan,
  isFollowUpMode,
  isQueueInteractionKind,
  reorderQueue,
  type EditableQueueItem,
} from '../queue-interactions'

/** 全绿 perms(队列非空 + 非流式 + Runtime 支持插话) */
const fullPerms = () =>
  queueInteractionPerms({
    runtimeSupportsInterjection: true,
    streaming: false,
    hasQueuedMessages: true,
  })

describe('D38 动词集合 / 类型守卫', () => {
  it('QUEUE_INTERACTION_KINDS 恰为五种(reorder/undo/edit/interruptAndRun/setMode)', () => {
    expect(QUEUE_INTERACTION_KINDS).toEqual([
      'reorder',
      'undo',
      'edit',
      'interruptAndRun',
      'setMode',
    ])
    for (const kind of QUEUE_INTERACTION_KINDS) expect(isQueueInteractionKind(kind)).toBe(true)
    expect(isQueueInteractionKind('enqueue')).toBe(false)
    expect(isQueueInteractionKind('')).toBe(false)
  })

  it('FOLLOW_UP_MODES 恰为 steer/queue,守卫一致', () => {
    expect(FOLLOW_UP_MODES).toEqual(['steer', 'queue'])
    expect(isFollowUpMode('steer')).toBe(true)
    expect(isFollowUpMode('serial')).toBe(false)
  })
})

describe('D38 许可门 interactionAllowed(复用 D69 queueInteractionPerms,正反例)', () => {
  it('全绿 perms:五个动词全部放行', () => {
    const perms = fullPerms()
    for (const kind of QUEUE_INTERACTION_KINDS) {
      const verdict = interactionAllowed(kind, perms)
      expect(verdict.allowed, kind).toBe(true)
      expect(verdict.deniedKey, kind).toBeNull()
    }
  })

  it('流式中:reorder 被拒 → deniedKey 与 D69 deniedNotice("reorder","streaming") 同键', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: true,
      hasQueuedMessages: true,
    })
    const verdict = interactionAllowed('reorder', perms)
    expect(verdict.allowed).toBe(false)
    expect(verdict.deniedKey).toBe('denied.reorder')
    expect(verdict.deniedKey).toBe(deniedNotice('reorder', 'streaming'))
    // 流式不锁撤回/编辑(D69 判据:canUndo 只看队列存在性)
    expect(interactionAllowed('undo', perms).allowed).toBe(true)
    expect(interactionAllowed('edit', perms).allowed).toBe(true)
  })

  it('队列空:undo / edit 被拒同族键 denied.undo;reorder 亦拒', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: false,
      hasQueuedMessages: false,
    })
    expect(interactionAllowed('undo', perms)).toEqual({ allowed: false, deniedKey: 'denied.undo' })
    expect(interactionAllowed('edit', perms)).toEqual({ allowed: false, deniedKey: 'denied.undo' })
    expect(interactionAllowed('reorder', perms)).toEqual({
      allowed: false,
      deniedKey: 'denied.reorder',
    })
  })

  it('Runtime 不支持插话:interruptAndRun 被拒 → denied.interject(与 D69 原句同键)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: false,
      streaming: false,
      hasQueuedMessages: true,
    })
    const verdict = interactionAllowed('interruptAndRun', perms)
    expect(verdict).toEqual({ allowed: false, deniedKey: 'denied.interject' })
    expect(verdict.deniedKey).toBe(deniedNotice('interject', 'runtimeNoInterject'))
    // 插话能力不影响重排/撤回(D69 判据)
    expect(interactionAllowed('reorder', perms).allowed).toBe(true)
    expect(interactionAllowed('undo', perms).allowed).toBe(true)
  })

  it('setMode 恒可切:即便全受限也不给拒绝键(降级归 effectiveMode 管)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: false,
      streaming: true,
      hasQueuedMessages: false,
    })
    expect(interactionAllowed('setMode', perms)).toEqual({ allowed: true, deniedKey: null })
  })

  it('edit 与 undo 同门(同被拒键族):流式不拦,队列空才拦', () => {
    const streamingPerms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: true,
      hasQueuedMessages: true,
    })
    expect(interactionAllowed('edit', streamingPerms).deniedKey).toBeNull()
  })
})

describe('D38 reorderQueue 纯重排(越界/同位/引用集不变式)', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('正常重排:先摘后插(DnD 语义),其余元素引用原样', () => {
    const out = reorderQueue(ids, 0, 2)
    expect([...out]).toEqual(['b', 'c', 'a', 'd'])
    // 引用恒等:每个位置上的元素与输入某元素同引用(纯字符串场景比值;对象场景见 W27 组)
    expect(out).not.toBe(ids)
  })

  it('对象数组重排不丢引用', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    const c = { id: 'c' }
    const out = reorderQueue([a, b, c], 2, 0)
    expect(out[0]).toBe(c)
    expect(out[1]).toBe(a)
    expect(out[2]).toBe(b)
  })

  it('同位返回原数组(同一引用)', () => {
    expect(reorderQueue(ids, 1, 1)).toBe(ids)
  })

  it('越界(负 / ≥len)返回原数组(同一引用)', () => {
    expect(reorderQueue(ids, -1, 2)).toBe(ids)
    expect(reorderQueue(ids, 0, 4)).toBe(ids)
    expect(reorderQueue(ids, 4, 0)).toBe(ids)
  })

  it('非整数索引返回原数组', () => {
    expect(reorderQueue(ids, 0.5, 2)).toBe(ids)
    expect(reorderQueue(ids, 0, Number.NaN)).toBe(ids)
  })

  it('空数组重排不崩', () => {
    expect(reorderQueue([], 0, 0)).toEqual([])
  })
})

describe('D38 applyQueueEdit 编辑不改元数据(W27 纪律)', () => {
  const items: EditableQueueItem[] = [
    { id: 'q1', text: '第一条', createdAt: 1000 },
    { id: 'q2', text: '第二条', createdAt: 2000 },
    { id: 'q3', text: '第三条', createdAt: 3000 },
  ]

  it('编辑目标项 text,createdAt 等其余字段原样', () => {
    const out = applyQueueEdit(items, 'q2', { text: '  改后的第二条  ' })
    expect([...out]).toEqual([
      { id: 'q1', text: '第一条', createdAt: 1000 },
      { id: 'q2', text: '改后的第二条', createdAt: 2000 },
      { id: 'q3', text: '第三条', createdAt: 3000 },
    ])
    expect(out[1]?.createdAt).toBe(2000)
  })

  it('其他项引用恒等(局部替换,非全量克隆)', () => {
    const out = applyQueueEdit(items, 'q2', { text: 'x' })
    expect(out[0]).toBe(items[0])
    expect(out[2]).toBe(items[2])
    expect(out[1]).not.toBe(items[1])
  })

  it('patch 类型只携带 text:createdAt / 顺序不可能被编辑改变', () => {
    const out = applyQueueEdit(items, 'q1', { text: 'x' })
    expect(out.map((it) => it.createdAt)).toEqual([1000, 2000, 3000])
    expect(out.map((it) => it.id)).toEqual(['q1', 'q2', 'q3'])
  })

  it('id 不存在返回原数组(同一引用)', () => {
    expect(applyQueueEdit(items, 'nope', { text: 'x' })).toBe(items)
  })

  it('trim 后空文本 no-op(拒绝把队列项清空)', () => {
    expect(applyQueueEdit(items, 'q1', { text: '   ' })).toBe(items)
    expect(applyQueueEdit(items, 'q1', { text: '' })).toBe(items)
  })
})

describe('D38 interruptPlan 打断计划(先停当前,再跑队首)', () => {
  it('流式中:stopFirst=true,thenRun=队首 id', () => {
    expect(interruptPlan({ streaming: true, streamingMessageId: 'm1' }, { id: 'q1' })).toEqual({
      stopFirst: true,
      thenRun: 'q1',
    })
  })

  it('非流式:无需打断(stopFirst=false),直接跑队首', () => {
    expect(interruptPlan({ streaming: false, streamingMessageId: null }, { id: 'q2' })).toEqual({
      stopFirst: false,
      thenRun: 'q2',
    })
  })

  it('队列空:thenRun=null(即便在流式中也不产生执行目标)', () => {
    expect(interruptPlan({ streaming: true, streamingMessageId: 'm1' }, null)).toEqual({
      stopFirst: true,
      thenRun: null,
    })
  })
})

describe('D38 模式可配 effectiveMode(steer vs queue 降级)', () => {
  it('steer + Runtime 支持 → steer,不降级', () => {
    expect(effectiveMode('steer', true)).toEqual({
      mode: 'steer',
      degraded: false,
      degradedKey: null,
    })
  })

  it('queue + Runtime 不支持 → queue(排队本就是降级路径,不再降)', () => {
    expect(effectiveMode('queue', false)).toEqual({
      mode: 'queue',
      degraded: false,
      degradedKey: null,
    })
  })

  it('steer + Runtime 不支持 → 降级为 queue 且给出降级文案键(对齐 D69 原句族)', () => {
    const res = effectiveMode('steer', false)
    expect(res.mode).toBe('queue')
    expect(res.degraded).toBe(true)
    expect(res.degradedKey).toBe(FOLLOW_UP_DEGRADE_KEY)
    expect(res.degradedKey).toBe('degraded.runtimeNoInterject')
  })

  it('降级键与 D69 queueReasonKey("runtimeNoInterject") 判据同源(原句同族)', () => {
    // D69 的 reasonKey 键值落在 ai.pane.inputNotices,本键落 ai.pane.queueOps —— 判据同源、命名空间分离
    expect(queueReasonKey('runtimeNoInterject')).toBe('reason.runtimeNoInterject')
    expect(FOLLOW_UP_DEGRADE_KEY).toBe('degraded.runtimeNoInterject')
  })

  it('followUpModeKey 生成 mode.<mode> 键', () => {
    expect(followUpModeKey('steer')).toBe('mode.steer')
    expect(followUpModeKey('queue')).toBe('mode.queue')
  })
})

describe('D38 W27 不变式(专门用例:纯函数不含队首选择语义)', () => {
  const a = { id: 'a', text: 'A', createdAt: 1 }
  const b = { id: 'b', text: 'B', createdAt: 2 }
  const c = { id: 'c', text: 'C', createdAt: 3 }
  const items = [a, b, c]

  it('reorderQueue 输出与输入 length 恒等', () => {
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        expect(reorderQueue(items, from, to)).toHaveLength(3)
      }
    }
  })

  it('reorderQueue 输出与输入元素引用集恒等(多重集相等,不增删对象)', () => {
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        const out = reorderQueue(items, from, to)
        const outRefs = [...out].sort((x, y) => x.id.localeCompare(y.id))
        const inRefs = [...items].sort((x, y) => x.id.localeCompare(y.id))
        expect(outRefs.map((it) => it.id)).toEqual(inRefs.map((it) => it.id))
        // 逐项引用比对:输出每个元素都是输入中的同一对象
        for (const ref of out) expect(items).toContain(ref)
      }
    }
  })

  it('applyQueueEdit 除目标 text 外全部字段浅相等(元数据不可触碰的结构证明)', () => {
    const out = applyQueueEdit(items, 'b', { text: 'B2' })
    for (const it of out) {
      const orig = items.find((o) => o.id === it.id)
      expect(orig).toBeDefined()
      const { text: editedText, ...restEdited } = it
      const { text: origText, ...restOrig } = orig as EditableQueueItem
      void editedText
      void origText
      expect(restEdited).toEqual(restOrig)
    }
  })

  it('interruptPlan 输出键集恰为 {stopFirst, thenRun}:不含队列数组、不含选择逻辑', () => {
    const plan = interruptPlan({ streaming: true, streamingMessageId: 'm1' }, { id: 'q1' })
    expect(Object.keys(plan).sort()).toEqual(['stopFirst', 'thenRun'])
    // 队首由调用方传入(plan.thenRun 即调用方所传,本函数无从"选择")
    expect(plan.thenRun).toBe('q1')
  })

  it('interactionAllowed / effectiveMode 同为只读纯函数:同输入恒同输出', () => {
    const perms = fullPerms()
    const v1 = interactionAllowed('reorder', perms)
    const v2 = interactionAllowed('reorder', perms)
    expect(v1).toEqual(v2)
    expect(effectiveMode('steer', false)).toEqual(effectiveMode('steer', false))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
