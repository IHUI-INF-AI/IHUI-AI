// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CheckpointImpactFile, CheckpointImpactResult } from '@/api/checkpoint-api'

// t 必须是**稳定引用**:组件把 t 收进 effect 依赖数组(exhaustive-deps 正当写法),
// 若 useTranslations 每次渲染返回新函数,effect 就无限重跑 → setState 风暴 → worker OOM。
// 生产环境真 next-intl 的 t 引用稳定,此 mock 必须同形。
const tMock = vi.hoisted(() => ({
  stableT: (key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return `${key}|${Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('|')}`
  },
}))
vi.mock('next-intl', () => ({
  useTranslations: () => tMock.stableT,
}))

const impactMock = vi.hoisted(() => ({ getCheckpointImpact: vi.fn() }))
// 纯 mock,不 importOriginal:本测试被测对象是"组件对 impact 数据的渲染行为",
// API 客户端本身不是被测物。importOriginal 会拉起真实 @/api/checkpoint-api →
// @/lib/api → auth store/设备指纹采集器/Tauri token vault 的整条 import 链,
// 该链在 jsdom worker 里初始化即原生崩溃(Worker exited unexpectedly,无 JS 栈)。
vi.mock('@/api/checkpoint-api', () => ({
  getCheckpointImpact: impactMock.getCheckpointImpact,
}))

vi.mock('@ihui/ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// diff stub:透出喂进来的内容,好断言"不可读侧没有被伪渲染"
vi.mock('@/components/ai/diff-preview', () => ({
  DiffPreview: (props: Record<string, unknown>) => (
    <div
      data-testid="stub-diff-preview"
      data-old={typeof props.oldContent === 'string' ? props.oldContent : ''}
      data-new={typeof props.newContent === 'string' ? props.newContent : ''}
    />
  ),
}))

import { CheckpointRollbackConfirm } from '../checkpoint-rollback-confirm'

function impactFile(partial: Partial<CheckpointImpactFile> & { path: string }): CheckpointImpactFile {
  return { oldContent: '', newContent: '', added: 1, deleted: 1, ...partial }
}

function makeImpact(files: CheckpointImpactFile[]): CheckpointImpactResult {
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

function setupProps() {
  return {
    open: true,
    checkpointId: 'ck-1',
    sessionId: 's1',
    scope: 'code' as const,
    checkpointLabel: 'ck-1',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  }
}

describe('G-814423 checkpoint 影响预览:读不到 ≠ 空文件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => cleanup())

  it('磁盘侧读失败(readError) ⇒ 显式缺省态行,不渲染"空文件 vs 内容"伪 diff', async () => {
    impactMock.getCheckpointImpact.mockResolvedValue(
      makeImpact([impactFile({ path: 'gone.ts', readError: true })]),
    )
    render(<CheckpointRollbackConfirm {...setupProps()} />)
    await waitFor(() =>
      expect(screen.getByTestId('rollback-confirm-content-unreadable')).toBeTruthy(),
    )
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('快照侧取不到(snapshotError) ⇒ 同样缺省,不得渲染成整文件删除', async () => {
    impactMock.getCheckpointImpact.mockResolvedValue(
      makeImpact([impactFile({ path: 'snap-lost.ts', snapshotError: true })]),
    )
    render(<CheckpointRollbackConfirm {...setupProps()} />)
    await waitFor(() =>
      expect(screen.getByTestId('rollback-confirm-content-unreadable')).toBeTruthy(),
    )
    expect(screen.queryByTestId('stub-diff-preview')).toBeNull()
  })

  it('双侧可读的文件不受影响:展开后 diff 正常渲染(回归对照)', async () => {
    impactMock.getCheckpointImpact.mockResolvedValue(
      makeImpact([impactFile({ path: 'ok.ts', oldContent: 'old\n', newContent: 'new\n' })]),
    )
    render(<CheckpointRollbackConfirm {...setupProps()} />)
    await waitFor(() => expect(screen.getByText('ok.ts')).toBeTruthy())
    // 文件名 span 与展开 Button 是兄弟节点(同一行 div),closest 找不到 button 祖先 ⇒
    // 用行容器 querySelector 定位该行唯一的展开按钮
    const row = screen.getByText('ok.ts').parentElement as HTMLElement
    fireEvent.click(row.querySelector('button') as HTMLElement)
    await waitFor(() => expect(screen.getByTestId('stub-diff-preview')).toBeTruthy())
    const stub = screen.getByTestId('stub-diff-preview')
    expect(stub.getAttribute('data-old')).toBe('old\n')
    expect(stub.getAttribute('data-new')).toBe('new\n')
    expect(screen.queryByTestId('rollback-confirm-content-unreadable')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
