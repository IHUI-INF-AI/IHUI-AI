// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D69 输入区文案族补齐 —— 判定层用例(G-91/G-92 + D38/D43 规格补强)。
// 覆盖:压缩不可用三类原因逐类 + 穷尽性 + 因/果成对断言;排队许可正反例
// (Runtime 不支持插话 → canInterject=false;流式中 → canReorder=false 等);
// 五条判据键名生成;拒绝提示 (action, reason) 组合矩阵。

import { describe, expect, it } from 'vitest'

import {
  COMPACTION_BLOCK_REASONS,
  INPUT_NOTICES_NAMESPACE,
  QUEUE_REASONS,
  compactionBlockCauseKey,
  compactionBlockConsequenceKey,
  compactionBlockView,
  deniedNotice,
  isCompactionBlockReason,
  isQueueReason,
  queueInteractionPerms,
  queueReasonKey,
  queueReasonView,
  queueReorderAria,
  resolveCompactionBlockReason,
} from '../input-notices'

// ---------------------------------------------------------------------------
// ① 压缩不可用:原因分类 + 因果成对
// ---------------------------------------------------------------------------

describe('D69 压缩不可用 / 原因分类与因果成对', () => {
  it('三类原因逐类给出成对的 causeKey / consequenceKey(两个独立键,非一句拼凑)', () => {
    const ctx = { turnRunning: true, creditsSufficient: true, turnBoundaryAvailable: true }
    for (const reason of COMPACTION_BLOCK_REASONS) {
      const view = compactionBlockView(reason, ctx)
      expect(view.reason).toBe(reason)
      expect(view.causeKey).toBe(compactionBlockCauseKey(reason))
      expect(view.consequenceKey).toBe(compactionBlockConsequenceKey(reason))
      // 因与果成对:两个键都存在且互不相同
      expect(view.causeKey.length).toBeGreaterThan(0)
      expect(view.consequenceKey.length).toBeGreaterThan(0)
      expect(view.causeKey).not.toBe(view.consequenceKey)
    }
  })

  it('键名片段逐类落名(runningTurn / insufficientCredits / noTurnBoundary)', () => {
    expect(compactionBlockCauseKey('runningTurn')).toBe('cause.runningTurn')
    expect(compactionBlockConsequenceKey('runningTurn')).toBe('consequence.runningTurn')
    expect(compactionBlockCauseKey('insufficientCredits')).toBe('cause.insufficientCredits')
    expect(compactionBlockConsequenceKey('insufficientCredits')).toBe(
      'consequence.insufficientCredits',
    )
    expect(compactionBlockCauseKey('noTurnBoundary')).toBe('cause.noTurnBoundary')
    expect(compactionBlockConsequenceKey('noTurnBoundary')).toBe('consequence.noTurnBoundary')
  })

  it('穷尽性:COMPACTION_BLOCK_REASONS 三类全覆盖,类型守卫与集合一致', () => {
    expect(COMPACTION_BLOCK_REASONS).toHaveLength(3)
    for (const reason of COMPACTION_BLOCK_REASONS) {
      expect(isCompactionBlockReason(reason)).toBe(true)
    }
    expect(isCompactionBlockReason('whatever')).toBe(false)
  })

  it('retryAfterTurn 只在有 Turn 边界时为 true(无边界不得给"稍后自动执行"预期)', () => {
    const base = { turnRunning: true, creditsSufficient: true, turnBoundaryAvailable: true }
    expect(compactionBlockView('runningTurn', base).retryAfterTurn).toBe(true)
    expect(
      compactionBlockView('runningTurn', { ...base, turnBoundaryAvailable: false }).retryAfterTurn,
    ).toBe(false)
    // 积分不足与无边界不承诺自动重试
    expect(
      compactionBlockView('insufficientCredits', {
        turnRunning: false,
        creditsSufficient: false,
        turnBoundaryAvailable: true,
      }).retryAfterTurn,
    ).toBe(false)
    expect(
      compactionBlockView('noTurnBoundary', {
        turnRunning: false,
        creditsSufficient: true,
        turnBoundaryAvailable: false,
      }).retryAfterTurn,
    ).toBe(false)
  })

  it('resolveCompactionBlockReason 优先级:积分不足 > 运行中 > 无边界;全满足 → null', () => {
    const allOk = { turnRunning: false, creditsSufficient: true, turnBoundaryAvailable: true }
    expect(resolveCompactionBlockReason(allOk)).toBeNull()
    expect(resolveCompactionBlockReason({ ...allOk, creditsSufficient: false })).toBe(
      'insufficientCredits',
    )
    expect(resolveCompactionBlockReason({ ...allOk, turnRunning: true })).toBe('runningTurn')
    expect(resolveCompactionBlockReason({ ...allOk, turnBoundaryAvailable: false })).toBe(
      'noTurnBoundary',
    )
    // 积分不足压过其他信号(硬阻断优先)
    expect(
      resolveCompactionBlockReason({
        turnRunning: true,
        creditsSufficient: false,
        turnBoundaryAvailable: false,
      }),
    ).toBe('insufficientCredits')
  })
})

// ---------------------------------------------------------------------------
// ② 排队:许可判定正反例(本票核心)
// ---------------------------------------------------------------------------

describe('D69 排队许可 / queueInteractionPerms 正反例', () => {
  it('Runtime 不支持插话 → canInterject=false,且 reasonKey 指向插话降级句(判据原文)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: false,
      streaming: true,
      hasQueuedMessages: true,
    })
    expect(perms.canInterject).toBe(false)
    expect(perms.reasonKey).toBe(queueReasonKey('runtimeNoInterject'))
    // 插话能力与流式无关:不支持时无论是否流式都不可插话
    expect(
      queueInteractionPerms({
        runtimeSupportsInterjection: false,
        streaming: false,
        hasQueuedMessages: true,
      }).canInterject,
    ).toBe(false)
  })

  it('流式中 → canReorder=false(重排会打乱 W27 出队顺序预期)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: true,
      hasQueuedMessages: true,
    })
    expect(perms.canReorder).toBe(false)
    expect(perms.reasonKey).toBe(queueReasonKey('turnRunning'))
  })

  it('队列空 → canReorder/canUndo=false 且 reasonKey=null(无排队之事,不给原因)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: false,
      hasQueuedMessages: false,
    })
    expect(perms.canReorder).toBe(false)
    expect(perms.canUndo).toBe(false)
    expect(perms.reasonKey).toBeNull()
  })

  it('正例:有队列 + 非流式 + 支持插话 → 三许可全开,reasonKey=null', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: false,
      hasQueuedMessages: true,
    })
    expect(perms.canReorder).toBe(true)
    expect(perms.canUndo).toBe(true)
    expect(perms.canInterject).toBe(true)
    expect(perms.reasonKey).toBeNull()
  })

  it('负例:流式中撤回排队消息不受限(队列里还在就能撤)', () => {
    const perms = queueInteractionPerms({
      runtimeSupportsInterjection: true,
      streaming: true,
      hasQueuedMessages: true,
    })
    expect(perms.canUndo).toBe(true)
    expect(perms.canReorder).toBe(false)
  })
})

describe('D69 排队原因 / queueReasonView', () => {
  it('优先级:Runtime 不支持插话 > 流式中 > 队首未完成', () => {
    const base = { runtimeSupportsInterjection: true, streaming: false, hasQueuedMessages: true }
    expect(queueReasonView(base)?.reason).toBe('queueAhead')
    expect(queueReasonView({ ...base, streaming: true })?.reason).toBe('turnRunning')
    expect(queueReasonView({ ...base, runtimeSupportsInterjection: false })?.reason).toBe(
      'runtimeNoInterject',
    )
    // 能力缺口压过流式信号
    expect(
      queueReasonView({
        runtimeSupportsInterjection: false,
        streaming: true,
        hasQueuedMessages: true,
      })?.reason,
    ).toBe('runtimeNoInterject')
  })

  it('队列空 → null(不空转);reasonKey 与 queueReasonKey 一致', () => {
    expect(
      queueReasonView({ runtimeSupportsInterjection: true, streaming: true, hasQueuedMessages: false }),
    ).toBeNull()
    for (const reason of QUEUE_REASONS) {
      expect(isQueueReason(reason)).toBe(true)
      expect(queueReasonKey(reason)).toBe(`reason.${reason}`)
    }
    expect(isQueueReason('whatever')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ③ 拒绝提示组合矩阵 + 五条判据键名生成
// ---------------------------------------------------------------------------

describe('D69 拒绝提示 / deniedNotice 组合矩阵', () => {
  it('合法组合落同族键;非法组合 → null(宁可不渲染,也不臆造)', () => {
    expect(deniedNotice('undo', 'emptyQueue')).toBe('denied.undo')
    expect(deniedNotice('reorder', 'streaming')).toBe('denied.reorder')
    expect(deniedNotice('reorder', 'emptyQueue')).toBe('denied.reorder')
    expect(deniedNotice('interject', 'runtimeNoInterject')).toBe('denied.interject')
    // 非法组合
    expect(deniedNotice('undo', 'runtimeNoInterject')).toBeNull()
    expect(deniedNotice('undo', 'streaming')).toBeNull()
    expect(deniedNotice('reorder', 'runtimeNoInterject')).toBeNull()
    expect(deniedNotice('interject', 'streaming')).toBeNull()
    expect(deniedNotice('interject', 'emptyQueue')).toBeNull()
  })
})

describe('D69 五条判据键名生成 + 命名空间', () => {
  it('五条判据键名逐一落名(排队原因 / 拖动 aria / 无法撤回 / 无法调整 / 插话降级)', () => {
    // 排队原因(标签 + 三条原因)
    expect(queueReasonKey('turnRunning')).toBe('reason.turnRunning')
    expect(queueReasonKey('queueAhead')).toBe('reason.queueAhead')
    expect(queueReasonKey('runtimeNoInterject')).toBe('reason.runtimeNoInterject')
    // 拖动调整排队顺序;聚焦后可使用上下方向键
    expect(queueReorderAria()).toBe('reorderAria')
    // 无法撤回排队消息 / 无法调整排队顺序 / 当前 Runtime 不支持插话,消息将继续排队
    expect(deniedNotice('undo', 'emptyQueue')).toBe('denied.undo')
    expect(deniedNotice('reorder', 'streaming')).toBe('denied.reorder')
    expect(deniedNotice('interject', 'runtimeNoInterject')).toBe('denied.interject')
  })

  it('压缩与排队键名都在 ai.pane.inputNotices 命名空间下消费', () => {
    expect(INPUT_NOTICES_NAMESPACE).toBe('ai.pane.inputNotices')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
