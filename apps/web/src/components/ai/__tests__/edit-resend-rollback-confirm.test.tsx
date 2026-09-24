// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EDIT_RESEND_FAILURE_PHASES,
  type EditResendImpact,
  type EditResendPhase,
} from '@ihui/shared/chat/edit-resend-rollback'

import { EditResendRollbackConfirm } from '../edit-resend-rollback-confirm'

// 只断言**结构与判据**(预览 / 失败态 / 警示 / 回调带参),文案一律走 key;
// 真实文案覆盖由下面「读真实词包」那组用例守住。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

// 内嵌的既有 CheckpointRollbackConfirm 会拉 '@/lib/api' 链路;详情弹层在本组用例不展开,
// mock 掉 checkpoint-api 通道即可(其能力由既有自身用例守护,这里只验组合)。
vi.mock('@/api/checkpoint-api', () => ({
  getCheckpointImpact: vi.fn(async () => {
    throw new Error('not used in edit-resend tests')
  }),
}))

// Dialog 内容经 Portal 渲染到 document.body(packages/ui-react dialog.tsx),
// 统一从 document.body 查询。
const $ = (sel: string): Element | null => document.body.querySelector(sel)
const $$ = (sel: string): NodeListOf<Element> => document.body.querySelectorAll(sel)

const impactPartial: EditResendImpact = {
  checkpointId: 'cp-1',
  files: [
    { path: 'src/a.ts', recorded: true },
    { path: 'src/b.ts', recorded: false },
  ],
  editDraft: '改成这样的提问',
}

const impactAllRecorded: EditResendImpact = {
  checkpointId: 'cp-1',
  files: [{ path: 'src/a.ts', recorded: true }],
  editDraft: '改成这样的提问',
}

function renderDlg(
  overrides: Partial<Parameters<typeof EditResendRollbackConfirm>[0]> = {},
  impact: EditResendImpact | null = impactPartial,
) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <EditResendRollbackConfirm
      open
      checkpointId="cp-1"
      sessionId="s-1"
      scope="both"
      impact={impact}
      phase="previewing"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onConfirm, onCancel }
}

afterEach(cleanup)

describe('D66 EditResendRollbackConfirm / 预览', () => {
  it('预览可见:文件清单(含逐文件 recorded 标记)+ 编辑内容', () => {
    renderDlg()
    expect($('[data-edit-resend-section="files"]')).not.toBeNull()
    expect($('[data-edit-resend-section="draft"]')).not.toBeNull()

    expect($$('[data-edit-resend-file]').length).toBe(2)
    expect($('[data-edit-resend-file="src/a.ts"]')?.getAttribute('data-edit-resend-recorded')).toBe(
      'true',
    )
    expect($('[data-edit-resend-file="src/b.ts"]')?.getAttribute('data-edit-resend-recorded')).toBe(
      'false',
    )

    expect($('[data-edit-resend-draft]')?.textContent).toBe('改成这样的提问')
  })

  it('确认回调带参:onConfirm 收到预览视图(含文件清单与编辑文本)', () => {
    const { onConfirm } = renderDlg()
    ;($('[data-action="confirm"]') as HTMLButtonElement).click()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const arg = onConfirm.mock.calls[0]?.[0]
    expect(arg?.editDraft).toBe('改成这样的提问')
    expect(arg?.fileCount).toBe(2)
    expect(arg?.unrecordedCount).toBe(1)
  })

  it('取消回调触发;无影响面时确认被禁用', () => {
    const { onCancel } = renderDlg({}, null)
    ;($('[data-action="cancel"]') as HTMLButtonElement).click()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(($('[data-action="confirm"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('预览期间提供逐文件 diff 入口(内嵌既有 CheckpointRollbackConfirm 的组合位)', () => {
    renderDlg()
    expect($('[data-action="viewDiff"]')).not.toBeNull()
  })
})

describe('D66 EditResendRollbackConfirm / 部分回退警示出现条件(本票灵魂)', () => {
  it('部分改动未被检查点记录 → 警示出现', () => {
    renderDlg()
    expect($('[data-edit-resend-warning="partialRollback"]')).not.toBeNull()
  })

  it('全部改动已被检查点记录 → 不警示', () => {
    renderDlg({}, impactAllRecorded)
    expect($('[data-edit-resend-warning="partialRollback"]')).toBeNull()
  })

  it('无影响面 → 不虚警', () => {
    renderDlg({}, null)
    expect($('[data-edit-resend-warning="partialRollback"]')).toBeNull()
  })
})

describe('D66 EditResendRollbackConfirm / 四组失败态逐一显式渲染(不得静默吞掉)', () => {
  it('五个失败态(四组命名失败 + 回退失败兜底)各自渲染非空失败条', () => {
    for (const phase of EDIT_RESEND_FAILURE_PHASES) {
      renderDlg({ phase: phase as EditResendPhase })
      const strip = $(`[data-edit-resend-failure="${phase}"]`)
      expect(strip, phase).not.toBeNull()
      expect((strip?.textContent ?? '').length, phase).toBeGreaterThan(0)
      cleanup()
    }
  })

  it('失败态下确认被禁用(不得在失败态继续放行)', () => {
    renderDlg({ phase: 'rollbackPartial' })
    expect(($('[data-action="confirm"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('进行中与完成态各占显式渲染位,失败条不出现', () => {
    for (const phase of ['executing', 'completed'] as const) {
      renderDlg({ phase })
      expect($(`[data-edit-resend-progress="${phase}"]`), phase).not.toBeNull()
      expect($('[data-edit-resend-failure]')).toBeNull()
      cleanup()
    }
  })

  it('根节点携带当前相位(data-edit-resend-state)', () => {
    renderDlg({ phase: 'executing' })
    expect($('[data-edit-resend-state="executing"]')).not.toBeNull()
  })

  it('open=false 不渲染任何内容', () => {
    renderDlg({ open: false })
    expect($('[data-edit-resend-state]')).toBeNull()
  })
})

describe('D66 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  const here = dirname(fileURLToPath(import.meta.url))
  const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

  const readEditResend = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: { editResend?: Record<string, unknown> } } }
    const node = parsed.ai?.pane?.editResend
    if (!node) throw new Error(`missing ai.pane.editResend in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readEditResend('zh-CN')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readEditResend(locale)).sort(), locale).toEqual(base)
    }
  })

  it('十相位 / 五失败态 / 固定键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readEditResend(locale))
      for (const phase of [
        'idle',
        'previewing',
        'confirmed',
        'executing',
        'completed',
        ...EDIT_RESEND_FAILURE_PHASES,
      ]) {
        expect(keys, `${locale} phase.${phase}`).toContain(`phase.${phase}`)
      }
      for (const phase of EDIT_RESEND_FAILURE_PHASES) {
        expect(keys, `${locale} failure.${phase}`).toContain(`failure.${phase}`)
      }
      for (const key of [
        'title',
        'ariaLabel',
        'desc',
        'confirm',
        'cancel',
        'previewFilesTitle',
        'previewEditTitle',
        'fileRecorded',
        'fileUnrecorded',
        'previewFilesMore',
        'detailAction',
        'detailLabel',
        'warning.partialRollback',
      ]) {
        expect(keys, `${locale} ${key}`).toContain(key)
      }
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readEditResend(locale))
    }
  })

  it('zh-CN 关键文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readEditResend('zh-CN') as {
      title: string
      warning: Record<string, string>
      previewFilesTitle: string
      previewEditTitle: string
      confirm: string
      cancel: string
    }
    expect(node.title).toBe('回退文件修改并重新发送？')
    expect(node.warning.partialRollback).toBe('部分修改未被检查点完整记录，回退结果可能不完整')
    expect(node.previewFilesTitle).toBe('将回退的文件')
    expect(node.previewEditTitle).toBe('将重新发送的内容')
    expect(node.confirm).toBe('回退并重新发送')
    expect(node.cancel).toBe('取消')
  })

  it('ja 不残留简体中文特有词(协作/概览/绑定等易混词不入包)', () => {
    const raw = JSON.stringify(readEditResend('ja'))
    for (const bad of ['协作', '概览', '绑定', '回退文件', '检查点已记录']) {
      expect(raw.includes(bad), bad).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
