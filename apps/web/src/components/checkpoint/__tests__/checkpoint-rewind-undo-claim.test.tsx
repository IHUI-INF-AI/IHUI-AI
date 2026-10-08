// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// D163 验收①的**界面级**证据:回退失败时那句「工作区未发生变化」必须由"撤销前/失败后
// 两份快照的真实比对"决定,而不是面板里的安慰话。
//
// 为什么单元测不够(`src/lib/__tests__/undo-fact-check.test.ts` 13 条已在 HEAD 且全绿):
// 那些用例判的是纯函数。把面板改成无论 verdict 都发 `t('checkpoint.undoFailed')`,
// 或把成功提示里的 `{count}` 插值丢掉,**一条现有用例都不会红** —— 而用户看到的正是面板
// 发出去的那句话。本文件把"面板 → 提示文案"这一格钉住:
//   · 文案取自真实 web 词包(packages/i18n/messages/web/zh-CN.json),不写死中文;
//   · 三条失败臂(比对成立 / 比对不成立 / 没有快照)断言的是**三个不同键 + 三句不同文案**,
//     其中「比对不成立」与「没有快照」两臂反向要求文案**不得**出现「未发生变化」;
//   · 翻译器键被记录 ⇒ 证明键是 resolveUndoFailureKey(…, verdict) 的产物(变异对照)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CheckpointImpactFile,
  CheckpointImpactResult,
  CheckpointListResult,
  CheckpointRestoreResult,
  CheckpointScope,
} from '@/api/checkpoint-api'
import { undoVerdictForScope } from '@/lib/undo-fact-check'

/** 本用例只断言这些键;缺失即 throw(不许"取不到"被读成"判过了") */
interface CheckpointCopy {
  readonly total: string
  readonly item: string
  readonly loading: string
  readonly refresh: string
  readonly empty: string
  readonly rollback: string
  readonly undoPreparing: string
  readonly undoConfirm: string
  readonly confirmDescription: string
  readonly confirmText: string
  readonly undoSucceeded: string
  readonly undoPartialWarning: string
  readonly undoUnavailable: string
  readonly undoFailed: string
  readonly undoFailedChanged: string
  readonly undoFailedUnverifiable: string
}

const PACK_REL_PATH = '../../../../../../packages/i18n/messages/web/zh-CN.json'

function readCheckpointPack(): CheckpointCopy {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = JSON.parse(readFileSync(join(here, PACK_REL_PATH), 'utf8')) as {
    aiChat?: { checkpoint?: CheckpointCopy }
  }
  const cp = root.aiChat?.checkpoint
  if (!cp || typeof cp.undoFailed !== 'string') {
    throw new Error('web 词包缺 aiChat.checkpoint 命名空间 —— 本用例失去断言对象')
  }
  return cp
}

const copy = readCheckpointPack()

const h = vi.hoisted(() => ({
  /** 面板每调一次 t 就记一条键名 ⇒ 可判"文案到底由哪个键产出"(变异对照的证据面) */
  keys: [] as string[],
  api: {
    listCheckpoints: vi.fn(),
    getCheckpointImpact: vi.fn(),
    restoreCheckpoint: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('next-intl', async () => {
  const { readFileSync: rf } = await import('node:fs')
  const { dirname: dn, join: jt } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu } = await import('@ihui/i18n')
  const parsed = JSON.parse(
    rf(
      jt(
        dn(toPath(import.meta.url)),
        // 字面量必须内联:vi.mock 工厂被提升到文件顶部,引用模块级 const 会 TDZ 报错
        '../../../../../../packages/i18n/messages/web/zh-CN.json',
      ),
      // 显式 'utf8':缺省走 Buffer 返回重载 ⇒ JSON.parse(Buffer) 报 TS2345 NonSharedBuffer→string(2026-10-08 CI Build 首曝)
      'utf8',
    ),
  ) as unknown as { aiChat?: Record<string, unknown> }
  const ns = parsed.aiChat
  // 面板用 useTranslations('aiChat') + t('checkpoint.undoFailed') ⇒ 键是**点分路径**,
  // 必须逐段下钻(直接拿 aiChat.checkpoint 当平表会把每个键都退化成回显键名 = 假绿)。
  const lookup = (key: string): string | undefined => {
    let cur: unknown = ns
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return undefined
      }
    }
    return typeof cur === 'string' ? cur : undefined
  }
  if (!ns || lookup('checkpoint.undoFailed') === undefined) {
    throw new Error('next-intl mock:web 词包没有 aiChat.checkpoint.undoFailed —— 失去断言对象')
  }
  const t = (key: string, values?: Record<string, string | number>): string => {
    h.keys.push(key)
    const raw = lookup(key)
    if (raw === undefined) return key
    return formatIcu(raw, values ?? {}, { locale: 'zh-CN' })
  }
  // **稳定引用**:面板把 t 收进 useCallback/useEffect 依赖数组,每次渲染返回新函数
  // 会让 load() 无限重跑 setState 风暴(g814423 同型教训)。
  return { useTranslations: () => t }
})

// 纯 mock,不 importOriginal:@/api/checkpoint-api 会拉起真实 api 客户端链
// (auth store / 设备指纹 / Tauri vault),在 jsdom worker 里初始化即崩(同 g814423)。
vi.mock('@/api/checkpoint-api', () => ({
  getCheckpointImpact: h.api.getCheckpointImpact,
  listCheckpoints: h.api.listCheckpoints,
  restoreCheckpoint: h.api.restoreCheckpoint,
}))

vi.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({
    confirm: () => Promise.resolve(true),
    ConfirmDialogRenderer: () => null,
  }),
}))

vi.mock('@/components/common', () => ({ toast: h.toast }))

import CheckpointRewindPanel from '../CheckpointRewindPanel'

function impactFile(path: string, oldContent: string): CheckpointImpactFile {
  return { path, oldContent, newContent: 'next\n', added: 1, deleted: 0 }
}

function impact(files: CheckpointImpactFile[]): CheckpointImpactResult {
  return {
    checkpoint_id: 'ck-1',
    session_id: 's1',
    scope: 'code',
    restored_message_count: 2,
    files,
    total: files.length,
    truncated: false,
  }
}

function restoreResult(over?: Partial<CheckpointRestoreResult>): CheckpointRestoreResult {
  return {
    checkpoint_id: 'ck-1',
    session_id: 's1',
    iteration: 4,
    status: 'restored',
    restored_message_count: 2,
    file_changes: 3,
    file_versions: [
      { path: 'a.ts', version_id: 'v-a' },
      { path: 'b.ts', version_id: 'v-b' },
      { path: 'c.ts', version_id: 'v-c' },
    ],
    message: 'ok',
    ...over,
  }
}

function listResult(): CheckpointListResult {
  return {
    session_id: 's1',
    total: 1,
    checkpoints: [
      {
        checkpoint_id: 'ck-1',
        session_id: 's1',
        iteration: 4,
        status: 'ready',
        created_at: 1,
        expires_at: 2,
        message_count: 7,
      },
    ],
  }
}

/** 渲染面板并点击列表里的「回退」按钮;找不到按钮 = 失去被测面,直接 throw */
async function renderAndRollback(scope: CheckpointScope) {
  const view = render(<CheckpointRewindPanel sessionId="s1" scope={scope} />)
  await waitFor(() => expect(h.api.listCheckpoints).toHaveBeenCalled())
  const btn = view.container.querySelector('ul button') as HTMLButtonElement | null
  if (!btn) throw new Error('面板没有渲染出回退按钮 —— 界面级证据无从建立')
  fireEvent.click(btn)
  return view
}

function lastToastText(which: 'success' | 'warning' | 'error'): string {
  const fn = h.toast[which]
  const last = fn.mock.lastCall
  if (!last) throw new Error(`toast.${which} 从未被调用 —— 界面没有把这句话发给用户`)
  return String(last[0] ?? '')
}

/** 只筛"失败/不可用"那一族的键 —— undoSucceeded / undoPreparing / undoConfirm 不属这一族 */
function undoKeysSeen(): string[] {
  return h.keys.filter((k) => /^checkpoint\.undo(Failed|Unavailable)/.test(k))
}

beforeEach(() => {
  vi.clearAllMocks()
  h.keys.length = 0
  h.api.listCheckpoints.mockResolvedValue(listResult())
})

afterEach(() => {
  cleanup()
})

describe('D163 撤销失败提示由快照比对决定(CheckpointRewindPanel 界面级)', () => {
  it('失败 + 两份快照逐文件一致 ⇒ 错误提示说「工作区未发生变化」(真实词包整句)', async () => {
    h.api.getCheckpointImpact.mockResolvedValue(impact([impactFile('a.ts', 'same\n')]))
    h.api.restoreCheckpoint.mockRejectedValue(new Error('restore boom'))

    await renderAndRollback('code')
    await waitFor(() => expect(h.api.restoreCheckpoint).toHaveBeenCalled())
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled())

    expect(lastToastText('error')).toBe(copy.undoFailed)
    expect(lastToastText('error')).toContain('未发生变化')
    expect(undoKeysSeen()).toContain('checkpoint.undoFailed')
    // 比对真的做了:快照前后各取一次
    expect(h.api.getCheckpointImpact).toHaveBeenCalledTimes(2)
  })

  it('失败 + 快照变了 ⇒ 文案**不得**出现「未发生变化」,而是「已发生变化」(反向对照)', async () => {
    h.api.getCheckpointImpact
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'before\n')]))
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'after-mutated\n')]))
    h.api.restoreCheckpoint.mockRejectedValue(new Error('restore boom'))

    await renderAndRollback('code')
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled())

    const text = lastToastText('error')
    expect(text).toBe(copy.undoFailedChanged)
    expect(text).toContain('已发生变化')
    expect(text).not.toContain('未发生变化')
    expect(undoKeysSeen()).toEqual(['checkpoint.undoFailedChanged'])
  })

  it('失败 + 取不到快照 ⇒ 只能说「无法确认」,绝不冒充「未发生变化」', async () => {
    h.api.getCheckpointImpact.mockRejectedValue(new Error('impact down'))
    h.api.restoreCheckpoint.mockRejectedValue(new Error('restore boom'))

    await renderAndRollback('code')
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled())

    const text = lastToastText('error')
    expect(text).toBe(copy.undoFailedUnverifiable)
    expect(text).not.toContain('未发生变化')
    expect(undoKeysSeen()).toEqual(['checkpoint.undoFailedUnverifiable'])
  })

  it('失败 + scope=conversation ⇒ 走事实档(该范围不碰文件),文案是「未发生变化」且从不取快照', async () => {
    // 事实来源是范围本身,不是比对:undoVerdictForScope 对 conversation 直接给 unchanged。
    expect(undoVerdictForScope('conversation', null, null)).toBe('unchanged')
    h.api.restoreCheckpoint.mockRejectedValue(new Error('restore boom'))

    await renderAndRollback('conversation')
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled())

    expect(lastToastText('error')).toBe(copy.undoFailed)
    expect(undoKeysSeen()).toEqual(['checkpoint.undoFailed'])
    // conversation 从不触碰工作区文件 ⇒ 一次快照都不该取(没有"伪比对"冒充证据)
    expect(h.api.getCheckpointImpact).not.toHaveBeenCalled()
  })

  it('成功 ⇒ 提示带具体文件数(把 {count} 插值丢掉就会红)', async () => {
    h.api.getCheckpointImpact.mockResolvedValue(impact([impactFile('a.ts', 'x\n')]))
    h.api.restoreCheckpoint.mockResolvedValue(restoreResult({ file_changes: 3 }))

    await renderAndRollback('both')
    await waitFor(() => expect(h.toast.success).toHaveBeenCalled())

    const text = lastToastText('success')
    expect(text).toBe(copy.undoSucceeded.replace('{count}', '3'))
    expect(text).toContain('3')
    expect(h.toast.warning).not.toHaveBeenCalled()
    expect(undoKeysSeen()).toEqual([])
  })

  it('部分成功 ⇒ 发警告而不是"已恢复 N 个"这条计数承诺', async () => {
    h.api.getCheckpointImpact.mockResolvedValue(impact([impactFile('a.ts', 'x\n')]))
    h.api.restoreCheckpoint.mockResolvedValue(
      restoreResult({
        file_changes: 2,
        file_versions: [{ path: 'a.ts', version_id: 'v-a' }, { path: 'b.ts' }],
      }),
    )

    await renderAndRollback('both')
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalled())

    expect(lastToastText('warning')).toBe(copy.undoPartialWarning)
    expect(h.toast.success).not.toHaveBeenCalled()
  })

  it('变异对照:同一面板在 changed / unchanged 两臂收到的键**不同**(键随 verdict 走)', async () => {
    h.api.restoreCheckpoint.mockRejectedValue(new Error('restore boom'))

    // 臂 A:前后快照一致
    h.api.getCheckpointImpact
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'same\n')]))
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'same\n')]))
    const view = await renderAndRollback('code')
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(1))
    const keysUnchanged = undoKeysSeen()
    const textUnchanged = lastToastText('error')

    // 臂 B:快照变了(同一面板第二次点击;清掉记录以隔离这一臂)
    h.keys.length = 0
    h.toast.error.mockClear()
    h.api.getCheckpointImpact
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'same\n')]))
      .mockResolvedValueOnce(impact([impactFile('a.ts', 'mutated\n')]))
    const btnB = view.container.querySelector('ul button') as HTMLButtonElement | null
    if (!btnB) throw new Error('第二次点击找不到回退按钮')
    fireEvent.click(btnB)
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledTimes(1))
    const keysChanged = undoKeysSeen()
    const textChanged = lastToastText('error')

    expect(keysUnchanged).toEqual(['checkpoint.undoFailed'])
    expect(keysChanged).toEqual(['checkpoint.undoFailedChanged'])
    // 若面板无视比对结果、硬套「未发生变化」,这两组必然同形 ⇒ 本条红
    expect(keysChanged).not.toEqual(keysUnchanged)
    expect(textChanged).not.toBe(textUnchanged)
    expect(textUnchanged).toContain('未发生变化')
    expect(textChanged).not.toContain('未发生变化')
  })

  it('源码锁:失败提示必须由 resolveUndoFailureKey 选出的键取名生成,不是写死串', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, '..', 'CheckpointRewindPanel.tsx'), 'utf8')
    // 失败提示的实参是 t(...) 而不是字符串字面量 ⇒ "写死文案"这一改法当场红
    expect(src).toMatch(/toast\.error\(\s*t\(\s*`checkpoint\.\$\{resolveUndoFailureKey\(/)
    // verdict 来自两份快照的真实比对(不是常量) ⇒ "跳过比对"这一改法当场红
    expect(src).toMatch(/classifyUndoWorkspace\(\s*before,\s*after\s*\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
