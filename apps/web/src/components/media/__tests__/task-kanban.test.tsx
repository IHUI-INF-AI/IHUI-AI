// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    // 组件内 useTranslations('mediaTasksPage') 后调用 t('colEmpty') —— key 无命名空间前缀
    const map: Record<string, string> = {
      colRunning: '进行中',
      colWaiting: '排队中',
      colCompleted: '已完成',
      colEmpty: '暂无任务',
      loading: '加载中',
      cancel: '取消',
      cancelling: '取消中',
      delete: '删除',
      playable: '可播放',
      jumpToChat: '打开会话',
      // task-parts 徽章 label
      statusBadgeProcessing: '处理中',
      statusBadgeSucceeded: '成功',
      statusBadgeFailed: '失败',
      statusBadgeCancelled: '已取消',
      kindVideo: '视频',
      kindImage: '图片',
    }
    return map[key] ?? key
  },
  useLocale: () => 'zh-CN',
}))

import { TaskKanban, groupTasksByColumn } from '../task-kanban'
import type { MediaTask } from '../task-parts'

function makeTask(over: Partial<MediaTask> = {}): MediaTask {
  return {
    id: Math.floor(Math.random() * 100000),
    kind: 'image',
    tool: 'image_generation',
    provider: 'p',
    task_id: `tk-${Math.random().toString(36).slice(2, 8)}`,
    status: 'processing',
    message: '一只猫',
    created_at: '2026-09-16T10:00:00Z',
    updated_at: '2026-09-16T10:00:00Z',
    ...over,
  }
}

/**
 * TaskKanban 测试(P3 #31 全局任务看板,2026-09-16 立)
 *
 * 覆盖:三列分组纯函数(全状态覆盖+未知状态兜底)/ 列渲染与计数 /
 * 卡片操作(取消/删除)/ chat_id 跳转深链与空值降级。
 */
describe('groupTasksByColumn(纯函数)', () => {
  it('四类在途状态分别归入 Running(processing)与 Waiting(其余三类)', () => {
    const g = groupTasksByColumn([
      makeTask({ task_id: 'a', status: 'processing' }),
      makeTask({ task_id: 'b', status: 'pending' }),
      makeTask({ task_id: 'c', status: 'accepted' }),
      makeTask({ task_id: 'd', status: 'submitted' }),
    ])
    expect(g.running.map((t) => t.task_id)).toEqual(['a'])
    expect(g.waiting.map((t) => t.task_id)).toEqual(['b', 'c', 'd'])
    expect(g.completed).toEqual([])
  })

  it('三类终态全部归入 Completed', () => {
    const g = groupTasksByColumn([
      makeTask({ task_id: 'x', status: 'succeeded' }),
      makeTask({ task_id: 'y', status: 'failed' }),
      makeTask({ task_id: 'z', status: 'cancelled' }),
    ])
    expect(g.running).toEqual([])
    expect(g.waiting).toEqual([])
    expect(g.completed.map((t) => t.task_id)).toEqual(['x', 'y', 'z'])
  })

  it('未知状态兜底归入 Completed(不丢任务)', () => {
    const g = groupTasksByColumn([makeTask({ task_id: 'u', status: 'some_new_status' })])
    expect(g.completed.map((t) => t.task_id)).toEqual(['u'])
  })

  it('空输入返回三空列', () => {
    expect(groupTasksByColumn([])).toEqual({ running: [], waiting: [], completed: [] })
  })
})

describe('TaskKanban(组件)', () => {
  afterEach(() => cleanup())

  const noop = () => {}

  it('加载态显示 loading', () => {
    render(
      <TaskKanban
        tasks={[]}
        loading
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByText('加载中')).toBeTruthy()
  })

  it('三列渲染 + 计数正确;空列显示「暂无任务」', () => {
    render(
      <TaskKanban
        tasks={[
          makeTask({ task_id: 'r1', status: 'processing' }),
          makeTask({ task_id: 'w1', status: 'pending' }),
          makeTask({ task_id: 'c1', status: 'succeeded' }),
        ]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByTestId('kanban-col-running').textContent).toContain('进行中')
    expect(screen.getByTestId('kanban-col-running').textContent).toContain('1')
    expect(screen.getByTestId('kanban-col-waiting').textContent).toContain('排队中')
    expect(screen.getByTestId('kanban-col-completed').textContent).toContain('已完成')
    // 无等待任务之外的列…waiting 有 1 条;构造一个空列验证:completed 只有 1 条,不空
    // 空列验证单独用例覆盖
    expect(screen.getByTestId('kanban-card-c1')).toBeTruthy()
  })

  it('某列为空时显示「暂无任务」占位', () => {
    render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'only', status: 'processing' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    expect(screen.getByTestId('kanban-col-waiting').textContent).toContain('暂无任务')
    expect(screen.getByTestId('kanban-col-completed').textContent).toContain('暂无任务')
  })

  it('点取消按钮触发 onCancel(传 task_id)', () => {
    const onCancel = vi.fn()
    render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'flight', status: 'processing' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={onCancel}
        onDelete={noop}
      />,
    )
    fireEvent.click(screen.getByTestId('kanban-cancel-flight'))
    expect(onCancel).toHaveBeenCalledWith('flight')
  })

  it('终态任务不渲染取消按钮(仅可删除)', () => {
    render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'done', status: 'succeeded' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    expect(screen.queryByTestId('kanban-cancel-done')).toBeNull()
    expect(screen.getByTestId('kanban-delete-done')).toBeTruthy()
  })

  it('chat_id 有值 → 渲染「打开会话」深链;空值 → 不渲染(历史任务降级)', () => {
    const { unmount } = render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'linked', status: 'succeeded', chat_id: 'conv-123' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    const link = screen.getByTestId('kanban-jump-linked') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/chat?conversationId=conv-123')
    unmount()

    render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'legacy', status: 'succeeded', chat_id: '' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={noop}
      />,
    )
    expect(screen.queryByTestId('kanban-jump-legacy')).toBeNull()
  })

  it('点删除按钮触发 onDelete', () => {
    const onDelete = vi.fn()
    render(
      <TaskKanban
        tasks={[makeTask({ task_id: 'del', status: 'failed' })]}
        loading={false}
        error={null}
        cancelling={null}
        deleting={null}
        onCancel={noop}
        onDelete={onDelete}
      />,
    )
    fireEvent.click(screen.getByTestId('kanban-delete-del'))
    expect(onDelete).toHaveBeenCalledWith('del')
  })
})
