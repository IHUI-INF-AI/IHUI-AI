// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D66「编辑重发 = 回退文件改动 + 重新发送」判定层用例(G-89)。
// 四组失败态逐一落名 + 部分回退警示正反例(本票灵魂)+ 组合编排失败即停且报告步骤。

import { describe, expect, it, vi } from 'vitest'

import {
  EDIT_RESEND_EMPTY_DRAFT,
  EDIT_RESEND_FAILURE_PHASES,
  EDIT_RESEND_FIXED_KEYS,
  EDIT_RESEND_PHASES,
  EDIT_RESEND_STEPS,
  applyEditResendAction,
  composeEditResend,
  createEditResendState,
  editResendFailureKey,
  editResendFixedKey,
  editResendPhaseKey,
  failStepToPhase,
  isEditResendFailurePhase,
  isEditResendPhase,
  needsPartialRollbackWarning,
  previewView,
  type EditResendImpact,
  type EditResendRollbackResult,
} from '../edit-resend-rollback'

const impactAllRecorded: EditResendImpact = {
  checkpointId: 'cp-1',
  files: [
    { path: 'a.ts', recorded: true },
    { path: 'b.ts', recorded: true },
  ],
  editDraft: '改好的提问',
}

const impactPartiallyRecorded: EditResendImpact = {
  checkpointId: 'cp-1',
  files: [
    { path: 'a.ts', recorded: true },
    { path: 'b.ts', recorded: false },
  ],
  editDraft: '改好的提问',
}

describe('D66 部分回退警示 needsPartialRollbackWarning(本票灵魂,正反例)', () => {
  it('正例:本轮改动全被检查点记录 → 不警示', () => {
    expect(needsPartialRollbackWarning(impactAllRecorded)).toBe(false)
  })

  it('正例:部分改动未被检查点记录 → 必须警示(回退结果可能不完整)', () => {
    expect(needsPartialRollbackWarning(impactPartiallyRecorded)).toBe(true)
  })

  it('正例:全部改动都未被记录(无 checkpoint)→ 也警示(未全部记录的极端情形)', () => {
    expect(
      needsPartialRollbackWarning({
        checkpointId: null,
        files: [{ path: 'a.ts', recorded: false }],
        editDraft: 'x',
      }),
    ).toBe(true)
  })

  it('反例:无文件改动 / 无影响面 → 不虚警', () => {
    expect(needsPartialRollbackWarning({ checkpointId: 'cp-1', files: [], editDraft: 'x' })).toBe(
      false,
    )
    expect(needsPartialRollbackWarning(null)).toBe(false)
  })

  it('警示语义进预览:partialRollbackWarning 与 needsPartialRollbackWarning 同源', () => {
    expect(previewView(impactPartiallyRecorded)?.partialRollbackWarning).toBe(true)
    expect(previewView(impactAllRecorded)?.partialRollbackWarning).toBe(false)
  })
})

describe('D66 预览视图 previewView(文件清单 + 编辑文本)', () => {
  it('列出要回退的文件清单与要重发的编辑文本,并给出未记录计数', () => {
    const view = previewView(impactPartiallyRecorded)
    expect(view?.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts'])
    expect(view?.editDraft).toBe('改好的提问')
    expect(view?.fileCount).toBe(2)
    expect(view?.unrecordedCount).toBe(1)
  })

  it('无影响面 → null(宿主未取到 impact 时不得渲染空壳预览)', () => {
    expect(previewView(null)).toBeNull()
  })
})

describe('D66 键名生成器与常量', () => {
  it('相位 / 失败态 / 固定文案键名生成,词包键对齐', () => {
    for (const phase of EDIT_RESEND_PHASES) expect(editResendPhaseKey(phase)).toBe(`phase.${phase}`)
    for (const phase of EDIT_RESEND_FAILURE_PHASES)
      expect(editResendFailureKey(phase)).toBe(`failure.${phase}`)
    for (const key of EDIT_RESEND_FIXED_KEYS) expect(editResendFixedKey(key)).toBe(key)
  })

  it('相位守卫:合法相位放行,非法字符串拒绝', () => {
    expect(isEditResendPhase('executing')).toBe(true)
    expect(isEditResendPhase('nope')).toBe(false)
    expect(isEditResendFailurePhase('syncFailed')).toBe(true)
    expect(isEditResendFailurePhase('completed')).toBe(false)
  })

  it('失败步骤 → 失败态逐一落名(编辑 / 回退 / 同步 / 替换)', () => {
    expect(failStepToPhase('edit')).toBe('editFailed')
    expect(failStepToPhase('rollback')).toBe('rollbackFailed')
    expect(failStepToPhase('sync')).toBe('syncFailed')
    expect(failStepToPhase('replace')).toBe('replaceFailed')
  })

  it('步骤常量齐全且失败步骤是步骤子集', () => {
    for (const step of ['edit', 'rollback', 'sync', 'replace'] as const) {
      expect(EDIT_RESEND_STEPS).toContain(step)
    }
    expect(EDIT_RESEND_PHASES).toContain('rollbackPartial')
    expect(EDIT_RESEND_FAILURE_PHASES).toContain('rollbackPartial')
  })
})

describe('D66 状态机 applyEditResendAction(switch 穷尽 + 非法迁移原样返回)', () => {
  const ctx = { impact: impactAllRecorded }

  it('startPreview:idle → previewing,预览就位', () => {
    const s = applyEditResendAction(createEditResendState(), { type: 'startPreview' }, ctx)
    expect(s.phase).toBe('previewing')
    expect(s.preview?.fileCount).toBe(2)
    expect(s.impact).toBe(impactAllRecorded)
  })

  it('startPreview:编辑文本空 / 纯空白 → editFailed + emptyDraft 哨兵,不进预览', () => {
    const s = applyEditResendAction(
      createEditResendState(),
      { type: 'startPreview' },
      { impact: { checkpointId: 'cp-1', files: [], editDraft: '   ' } },
    )
    expect(s.phase).toBe('editFailed')
    expect(s.error).toBe(EDIT_RESEND_EMPTY_DRAFT)
    expect(s.stoppedAt).toBe('edit')
  })

  it('startPreview:影响面未取到 → editFailed(不得拿空预览让用户确认)', () => {
    const s = applyEditResendAction(
      createEditResendState(),
      { type: 'startPreview' },
      { impact: null },
    )
    expect(s.phase).toBe('editFailed')
  })

  it('confirm 仅在 previewing 生效;execute 仅在 confirmed 生效', () => {
    const idle = createEditResendState()
    expect(applyEditResendAction(idle, { type: 'confirm' }, ctx).phase).toBe('idle')
    expect(applyEditResendAction(idle, { type: 'execute' }, ctx).phase).toBe('idle')
    const previewing = applyEditResendAction(idle, { type: 'startPreview' }, ctx)
    const confirmed = applyEditResendAction(previewing, { type: 'confirm' }, ctx)
    expect(confirmed.phase).toBe('confirmed')
    expect(applyEditResendAction(confirmed, { type: 'execute' }, ctx).phase).toBe('executing')
  })

  it('cancel:执行中 / 已完成不可取消;其余回到 idle', () => {
    const previewing = applyEditResendAction(createEditResendState(), { type: 'startPreview' }, ctx)
    expect(applyEditResendAction(previewing, { type: 'cancel' }, ctx).phase).toBe('idle')
    const confirmed = applyEditResendAction(previewing, { type: 'confirm' }, ctx)
    const executing = applyEditResendAction(confirmed, { type: 'execute' }, ctx)
    expect(applyEditResendAction(executing, { type: 'cancel' }, ctx).phase).toBe('executing')
    const completed = applyEditResendAction(executing, { type: 'replaceDone' }, ctx)
    expect(applyEditResendAction(completed, { type: 'cancel' }, ctx).phase).toBe('completed')
  })

  it('executing / completed 中不可重开预览(防半途回预览造成双写)', () => {
    const confirmed = applyEditResendAction(
      applyEditResendAction(createEditResendState(), { type: 'startPreview' }, ctx),
      { type: 'confirm' },
      ctx,
    )
    const executing = applyEditResendAction(confirmed, { type: 'execute' }, ctx)
    expect(applyEditResendAction(executing, { type: 'startPreview' }, ctx).phase).toBe('executing')
    const completed = applyEditResendAction(executing, { type: 'replaceDone' }, ctx)
    expect(applyEditResendAction(completed, { type: 'startPreview' }, ctx).phase).toBe('completed')
  })

  it('rollbackDone:ok → 保持 executing 并记账;partial → rollbackPartial 即停;failed → rollbackFailed', () => {
    const executing = applyEditResendAction(
      applyEditResendAction(
        applyEditResendAction(createEditResendState(), { type: 'startPreview' }, ctx),
        { type: 'confirm' },
        ctx,
      ),
      { type: 'execute' },
      ctx,
    )
    const ok = applyEditResendAction(
      executing,
      { type: 'rollbackDone', result: { kind: 'ok', rolledBackFiles: 2 } },
      ctx,
    )
    expect(ok.phase).toBe('executing')
    expect(ok.rolledBackFiles).toBe(2)

    const partial = applyEditResendAction(
      executing,
      { type: 'rollbackDone', result: { kind: 'partial', rolledBackFiles: 1, unrecordedFiles: 1 } },
      ctx,
    )
    expect(partial.phase).toBe('rollbackPartial')
    expect(partial.stoppedAt).toBe('rollback')

    const failed = applyEditResendAction(
      executing,
      { type: 'rollbackDone', result: { kind: 'failed', error: 'boom' } },
      ctx,
    )
    expect(failed.phase).toBe('rollbackFailed')
    expect(failed.error).toBe('boom')
  })

  it('fail:四组失败态逐一落名且 stoppedAt 报告步骤', () => {
    for (const [step, phase] of [
      ['edit', 'editFailed'],
      ['rollback', 'rollbackFailed'],
      ['sync', 'syncFailed'],
      ['replace', 'replaceFailed'],
    ] as const) {
      const s = applyEditResendAction(
        createEditResendState(),
        { type: 'fail', step, error: 'x' },
        ctx,
      )
      expect(s.phase, step).toBe(phase)
      expect(s.stoppedAt, step).toBe(step)
    }
  })

  it('全程 happy path:previewing → confirmed → executing → completed', () => {
    let s = createEditResendState()
    s = applyEditResendAction(s, { type: 'startPreview' }, ctx)
    s = applyEditResendAction(s, { type: 'confirm' }, ctx)
    s = applyEditResendAction(s, { type: 'execute' }, ctx)
    s = applyEditResendAction(
      s,
      { type: 'rollbackDone', result: { kind: 'ok', rolledBackFiles: 2 } },
      ctx,
    )
    s = applyEditResendAction(s, { type: 'replaceDone' }, ctx)
    expect(s.phase).toBe('completed')
    expect(s.stoppedAt).toBeNull()
  })
})

describe('D66 组合编排 composeEditResend(失败即停且报告步骤,不静默继续)', () => {
  const baseCtx = {
    impact: impactAllRecorded,
    onEditResend: () => {},
    onRollback: (): EditResendRollbackResult => ({ kind: 'ok', rolledBackFiles: 2 }),
    onSyncLocal: () => {},
    onReplaceMessage: () => {},
  }

  it('全程成功:completed 且 stoppedAt 为 null;调用顺序 = 编辑→回退→同步→替换', async () => {
    const order: string[] = []
    const r = await composeEditResend({
      ...baseCtx,
      onEditResend: () => void order.push('edit'),
      onConfirm: () => {
        order.push('confirm')
        return true
      },
      onRollback: () => {
        order.push('rollback')
        return { kind: 'ok' as const, rolledBackFiles: 2 }
      },
      onSyncLocal: () => void order.push('sync'),
      onReplaceMessage: () => void order.push('replace'),
    })
    expect(order).toEqual(['edit', 'confirm', 'rollback', 'sync', 'replace'])
    expect(r.state.phase).toBe('completed')
    expect(r.stoppedAt).toBeNull()
    expect(r.aborted).toBe(false)
  })

  it('编辑失败:停在 edit,后续步骤一律不执行', async () => {
    const onRollback = vi.fn(() => ({ kind: 'ok' as const, rolledBackFiles: 0 }))
    const r = await composeEditResend({
      ...baseCtx,
      onEditResend: () => {
        throw new Error('edit boom')
      },
      onRollback,
    })
    expect(r.state.phase).toBe('editFailed')
    expect(r.state.error).toBe('edit boom')
    expect(r.stoppedAt).toBe('edit')
    expect(onRollback).not.toHaveBeenCalled()
  })

  it('确认门拒绝:干净中止(aborted),不算失败', async () => {
    const onRollback = vi.fn(() => ({ kind: 'ok' as const, rolledBackFiles: 0 }))
    const r = await composeEditResend({ ...baseCtx, onConfirm: () => false, onRollback })
    expect(r.aborted).toBe(true)
    expect(r.stoppedAt).toBe('confirm')
    expect(r.state.phase).toBe('idle')
    expect(onRollback).not.toHaveBeenCalled()
  })

  it('回退失败(抛异常):停在 rollback → rollbackFailed,同步 / 替换不执行', async () => {
    const onSyncLocal = vi.fn()
    const onReplaceMessage = vi.fn()
    const r = await composeEditResend({
      ...baseCtx,
      onRollback: () => {
        throw new Error('rollback boom')
      },
      onSyncLocal,
      onReplaceMessage,
    })
    expect(r.state.phase).toBe('rollbackFailed')
    expect(r.stoppedAt).toBe('rollback')
    expect(onSyncLocal).not.toHaveBeenCalled()
    expect(onReplaceMessage).not.toHaveBeenCalled()
  })

  it('部分回退:停在 rollback → rollbackPartial,同步 / 替换不执行(警示由预览与失败态承载)', async () => {
    const onSyncLocal = vi.fn()
    const r = await composeEditResend({
      ...baseCtx,
      impact: impactPartiallyRecorded,
      onRollback: () => ({ kind: 'partial', rolledBackFiles: 1, unrecordedFiles: 1 }),
      onSyncLocal,
    })
    expect(r.state.phase).toBe('rollbackPartial')
    expect(r.stoppedAt).toBe('rollback')
    expect(onSyncLocal).not.toHaveBeenCalled()
  })

  it('本地同步失败:停在 sync → syncFailed,替换不执行', async () => {
    const onReplaceMessage = vi.fn()
    const r = await composeEditResend({
      ...baseCtx,
      onSyncLocal: () => {
        throw new Error('sync boom')
      },
      onReplaceMessage,
    })
    expect(r.state.phase).toBe('syncFailed')
    expect(r.state.error).toBe('sync boom')
    expect(r.stoppedAt).toBe('sync')
    expect(onReplaceMessage).not.toHaveBeenCalled()
  })

  it('替换失败:停在 replace → replaceFailed', async () => {
    const r = await composeEditResend({
      ...baseCtx,
      onReplaceMessage: () => {
        throw new Error('replace boom')
      },
    })
    expect(r.state.phase).toBe('replaceFailed')
    expect(r.stoppedAt).toBe('replace')
  })

  it('编辑文本空(未走回调即被状态机拦下):停在 edit → editFailed + emptyDraft', async () => {
    const onEditResend = vi.fn()
    const r = await composeEditResend({
      ...baseCtx,
      impact: { checkpointId: 'cp-1', files: [], editDraft: '  ' },
      onEditResend,
    })
    expect(onEditResend).toHaveBeenCalled()
    expect(r.state.phase).toBe('editFailed')
    expect(r.state.error).toBe(EDIT_RESEND_EMPTY_DRAFT)
    expect(r.stoppedAt).toBe('edit')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
