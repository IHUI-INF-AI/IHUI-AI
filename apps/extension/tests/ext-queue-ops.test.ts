// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 队列语义完整交互 — extension 端适配器定向测试(H18 跨端消费矩阵,镜像 cli queue-ops.test.ts)。
 *
 * 覆盖四类:
 *   1. 许可门:五动词经 queueInteractionPerms + interactionAllowed 的 (action, reason)
 *      组合矩阵(流式锁重排、空队拒撤回、setMode 恒可切;extension 侧 runtime 支持位
 *      如实传 false ⇒ interject 族被拒 —— cli 恒 true,本端补的是 false 那一半)。
 *   2. 纯函数委托的 W27 不变式:重排后发送顺序断言(硬指标①)、引用集恒等、
 *      createdAt/id 元数据不动、空文本/越界/未知 id no-op 返回原引用。
 *   3. 打断计划:stopFirst/thenRun 派发(队首由调用方传入,计划层不猜队首、不触队列)。
 *   4. 词键可解析性投影:denied.interject → shared 既有同句键;denied.reorder/undo →
 *      本端 extension 词包中新补的 D69 完整键;任何未映射的 denied.<action> 仍 → null
 *      (禁回显原始键名);steer 降级键映射完整 shared 键。
 */
import { describe, expect, it } from 'vitest'

import {
  extDeniedNoticeKey,
  extEditQueueItem,
  extFollowUpDegradeKey,
  extInterruptRunPlan,
  extQueueInteractionAllowed,
  extQueuePerms,
  extRemoveQueueItem,
  extReorderQueue,
  extResolveFollowUpMode,
  type ExtQueueFacts,
  type ExtQueueItem,
} from '../lib/ext-queue-ops'

const RUNTIME_NO = { runtimeSupportsInterjection: false }
const RUNTIME_YES = { runtimeSupportsInterjection: true }

function facts(over: Partial<ExtQueueFacts>): ExtQueueFacts {
  return { hasQueuedMessages: false, streaming: false, ...RUNTIME_NO, ...over }
}

function seedQueue(): ExtQueueItem[] {
  return [
    { id: 'a', text: 'alpha', createdAt: 1 },
    { id: 'b', text: 'beta', createdAt: 2 },
    { id: 'c', text: 'gamma', createdAt: 3 },
  ]
}

describe('D38 extension 许可门(共享层 queueInteractionPerms + interactionAllowed)', () => {
  it('本端 runtime 支持位为 false ⇒ 插话族被拒且给 denied.interject(诚实降级,非静默)', () => {
    const perms = extQueuePerms(facts({ hasQueuedMessages: true, streaming: true }))
    expect(perms.canInterject).toBe(false)
    const v = extQueueInteractionAllowed('interruptAndRun', facts({ hasQueuedMessages: true }))
    expect(v.allowed).toBe(false)
    expect(v.deniedKey).toBe('denied.interject')
  })

  it('流式中锁定重排,队列非空可撤回;reasonKey 优先级按本端协商位如实取(shared 判定:无插话能力 > 流式中)', () => {
    // 本端 runtime=false ⇒ reasonKey 恒取 runtimeNoInterject(D69 判据优先级)
    const perms = extQueuePerms(facts({ hasQueuedMessages: true, streaming: true }))
    expect(perms.canReorder).toBe(false)
    expect(perms.canUndo).toBe(true)
    expect(perms.reasonKey).toBe('reason.runtimeNoInterject')
    // 对照面:协商位为 true 时同事实流 ⇒ reason.turnRunning(判定完全跟随输入)
    const permsYes = extQueuePerms(
      facts({ hasQueuedMessages: true, streaming: true, ...RUNTIME_YES }),
    )
    expect(permsYes.reasonKey).toBe('reason.turnRunning')
    const v = extQueueInteractionAllowed(
      'reorder',
      facts({ hasQueuedMessages: true, streaming: true }),
    )
    expect(v.allowed).toBe(false)
    expect(v.deniedKey).toBe('denied.reorder')
  })

  it('空队列时 undo/edit 被拒(denied.undo 族);非流式且队列非空 ⇒ reorder/undo/edit 放行', () => {
    for (const kind of ['undo', 'edit'] as const) {
      const v = extQueueInteractionAllowed(kind, facts({ hasQueuedMessages: false }))
      expect(v.allowed).toBe(false)
      expect(v.deniedKey).toBe('denied.undo')
    }
    const idle = facts({ hasQueuedMessages: true, streaming: false })
    expect(extQueueInteractionAllowed('reorder', idle).allowed).toBe(true)
    expect(extQueueInteractionAllowed('undo', idle).allowed).toBe(true)
    expect(extQueueInteractionAllowed('edit', idle).allowed).toBe(true)
  })

  it('setMode 恒可切(用户偏好不经能力门)', () => {
    const v = extQueueInteractionAllowed('setMode', facts({ streaming: true }))
    expect(v.allowed).toBe(true)
    expect(v.deniedKey).toBeNull()
  })

  it('对照面:runtime 支持位为 true 时 interject 放行(判定完全跟随注入位,端内无写死)', () => {
    const v = extQueueInteractionAllowed(
      'interruptAndRun',
      facts({ hasQueuedMessages: true, ...RUNTIME_YES }),
    )
    expect(v.allowed).toBe(true)
  })
})

describe('D38 队列数组变换(仅委托 shared 纯函数,W27 不变式)', () => {
  it('重排后发送顺序 = 重排数组逐位相等:seed[a,b,c] → reorder(2,0) → [c,a,b]', () => {
    const items = seedQueue()
    const next = extReorderQueue(items, 2, 0)
    expect(next.map((it) => it.id)).toEqual(['c', 'a', 'b'])
    // 引用集恒等(只重排,不增删不换对象)
    expect(next).toHaveLength(items.length)
    expect(new Set(next)).toEqual(new Set(items))
  })

  it('重排越界/同位返回原数组同一引用(渲染层据此跳过重渲染)', () => {
    const items = seedQueue()
    expect(extReorderQueue(items, 0, 5)).toBe(items)
    expect(extReorderQueue(items, 1, 1)).toBe(items)
    expect(extReorderQueue(items, 1.5, 2)).toBe(items)
  })

  it('编辑只改 text(trim 后),createdAt/id 与其他项引用不动;空文本/未知 id no-op', () => {
    const items = seedQueue()
    const next = extEditQueueItem(items, 'b', '  beta edited  ')
    const edited = next.find((it) => it.id === 'b')
    expect(edited?.text).toBe('beta edited')
    expect(edited?.createdAt).toBe(2)
    expect(next.find((it) => it.id === 'a')).toBe(items[0]) // 其他项同一引用
    expect(extEditQueueItem(items, 'b', '   ')).toBe(items) // trim 后空 → 原数组
    expect(extEditQueueItem(items, 'no-such-id', 'x')).toBe(items)
  })

  it('撤回按 id 摘除;未知 id 返回原引用(许可门在 interactionAllowed,这里只变换)', () => {
    const items = seedQueue()
    const next = extRemoveQueueItem(items, 'b')
    expect(next.map((it) => it.id)).toEqual(['a', 'c'])
    expect(extRemoveQueueItem(items, 'no-such-id')).toBe(items)
  })
})

describe('D38 打断计划与模式解析', () => {
  it('runtime=true:流式+有队首 → stopFirst 且 thenRun=队首;非流式 → 不打断直接跑队首', () => {
    const running = extInterruptRunPlan(
      facts({ hasQueuedMessages: true, streaming: true, ...RUNTIME_YES }),
      'q1',
    )
    expect(running).toEqual({ allowed: true, deniedKey: null, stopFirst: true, thenRun: 'q1' })
    const idle = extInterruptRunPlan(facts({ hasQueuedMessages: true, ...RUNTIME_YES }), 'q1')
    expect(idle).toEqual({ allowed: true, deniedKey: null, stopFirst: false, thenRun: 'q1' })
    // 计划层不猜队首:headId=null ⇒ thenRun=null
    const empty = extInterruptRunPlan(facts({ hasQueuedMessages: false, ...RUNTIME_YES }), null)
    expect(empty.thenRun).toBeNull()
  })

  it('runtime=false(本端现状):打断并执行被许可门拒掉,不产出 stopFirst(不得绕过协商位停流)', () => {
    const denied = extInterruptRunPlan(facts({ hasQueuedMessages: true, streaming: true }), 'q1')
    expect(denied.allowed).toBe(false)
    expect(denied.deniedKey).toBe('denied.interject')
    expect(denied.stopFirst).toBe(false)
    expect(denied.thenRun).toBeNull()
  })

  it('模式值域闭合 + steer 在本端如实降级:degraded=true 且降级键可映射到 shared 完整键', () => {
    expect(extResolveFollowUpMode('followUp', false).ok).toBe(false)
    const queueRes = extResolveFollowUpMode('queue', false)
    expect(queueRes.ok).toBe(true)
    if (queueRes.ok === true) {
      expect(queueRes.resolution).toEqual({ mode: 'queue', degraded: false, degradedKey: null })
      expect(extFollowUpDegradeKey(queueRes.resolution)).toBeNull()
    }
    const steerRes = extResolveFollowUpMode('steer', false)
    expect(steerRes.ok).toBe(true)
    if (steerRes.ok === true) {
      expect(steerRes.resolution.mode).toBe('queue') // 降级为排队优先
      expect(steerRes.resolution.degradedKey).toBe('degraded.runtimeNoInterject')
      expect(extFollowUpDegradeKey(steerRes.resolution)).toBe(
        'ai.pane.queueOps.degraded.runtimeNoInterject',
      )
    }
    // runtime 支持时 steer 不降级
    const steerOk = extResolveFollowUpMode('steer', true)
    if (steerOk.ok === true) {
      expect(steerOk.resolution).toEqual({ mode: 'steer', degraded: false, degradedKey: null })
    }
  })
})

describe('D38 拒绝键 → 本端可解析文案键(缺口已按本端词包补齐,未映射键仍禁回显)', () => {
  it('denied.interject 走 shared 既有同句键;reorder/undo 走本端新补的 D69 键;未映射键 → null', () => {
    expect(extDeniedNoticeKey('denied.interject')).toBe(
      'ai.pane.queueOps.degraded.runtimeNoInterject',
    )
    expect(extDeniedNoticeKey('denied.reorder')).toBe('ai.pane.inputNotices.queue.denied.reorder')
    expect(extDeniedNoticeKey('denied.undo')).toBe('ai.pane.inputNotices.queue.denied.undo')
    // 判定层将来加新 denied.<action> 而本端词包没跟上时,必须是"不显示",不是甩键名
    expect(extDeniedNoticeKey('denied.aFutureAction')).toBeNull()
    expect(extDeniedNoticeKey(null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
