// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D175 任务监控「任务内容聚合」分组视图(2026-09-30 立,对标竞品 chatSession.highlights.group/emptyGroup)。
// 三层合围:
//   纯函数层:aggregateTaskContent 三组抽取/去重计数/时序/空态判据(数据全部来自既有
//             toolCalls / citations / summary_data,不新建采集链);
//   渲染层:三分组视图各组标题 + 各组空态 + 全空时的汇总描述;
//   装车层:宿主 task-monitor-sections.tsx 确实把三分组挂在 results「结果与来源」区内
//           (读宿主源码锚点 + 真跑 TaskMonitorZonesView 出 testid 两头都钉)。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  // 译文字面不参与断言(词包五语言由主会话落地后另立锁),这里 echo 键名以钉"取了哪个键"
  useTranslations:
    () =>
    (key: string) =>
      key,
}))

import {
  aggregateTaskContent,
  isTaskContentEmpty,
  taskContentGroupCounts,
  type TaskContentMessageLike,
} from '@/lib/d175-task-content'
import { TaskContentGroupsView } from '@/components/ai/d175-task-content-groups'
import { TaskMonitorZonesView } from '@/components/ai/task-monitor-sections'

const messages = (
  input: Partial<TaskContentMessageLike> & { id?: string } = {},
): TaskContentMessageLike[] => [input as TaskContentMessageLike]

describe('D175 纯函数层:三组抽取全部来自既有数据', () => {
  it('产出:写类工具的文件路径进 artifact(白名单在共享层 FILE_WRITE_TOOLS,本处不另立名单)', () => {
    const groups = aggregateTaskContent(
      messages({
        toolCalls: [
          { toolName: 'write_file', args: { path: 'apps/web/src/a.ts' }, status: 'success' },
          { toolName: 'edit_file', args: { file_path: 'apps/web/src/b.ts' }, status: 'success' },
          // 读类工具不得进产出
          { toolName: 'read_file', args: { path: 'apps/web/src/c.ts' }, status: 'success' },
        ],
      }),
    )
    expect(groups.artifact.map((i) => i.label)).toEqual([
      'apps/web/src/a.ts',
      'apps/web/src/b.ts',
    ])
    expect(groups.browser).toHaveLength(0)
    expect(groups.source).toHaveLength(0)
  })

  it('网页查阅:URL 形态对象进 browser,非 URL 不进(判据取共享层 subjectKind)', () => {
    const groups = aggregateTaskContent(
      messages({
        toolCalls: [
          { toolName: 'fetch_url', args: { url: 'https://a.gov.cn/x' }, status: 'success' },
          { toolName: 'browser_navigate', args: { url: 'https://b.example.com' }, status: 'success' },
          { toolName: 'web_search', args: { query: '天气' }, status: 'success' },
        ],
      }),
    )
    expect(groups.browser.map((i) => i.href)).toEqual([
      'https://a.gov.cn/x',
      'https://b.example.com',
    ])
    expect(groups.artifact).toHaveLength(0)
  })

  it('来源:消息级 citations(#11 全链路)与 summarize_artifacts 回包 sources 同进 source', () => {
    const groups = aggregateTaskContent(
      messages({
        citations: [{ source: 'knowledge_cards', label: '学生手册 3.2 条', url: 'https://kb/x' }],
        toolCalls: [
          {
            toolName: 'summarize_artifacts',
            args: {},
            status: 'success',
            summary_data: {
              sources: [{ type: 'web', ref: 'https://src.example/1', accessed_at: '2026-09-30' }],
              artifacts: [{ type: 'file', path: 'output/report.md' }],
            },
          },
        ],
      }),
    )
    expect(groups.source.map((i) => i.label)).toEqual([
      '学生手册 3.2 条',
      'https://src.example/1',
    ])
    // summary_data.artifacts 是既有台账字段,收进产出而不是新采集
    expect(groups.artifact.map((i) => i.label)).toEqual(['output/report.md'])
  })

  it('同一对象重复出现只留一条并累计次数;反斜杠与尾斜杠不参与去重', () => {
    const groups = aggregateTaskContent(
      messages({
        toolCalls: [
          { toolName: 'write_file', args: { path: 'docs/spec.md' }, status: 'success' },
          { toolName: 'edit_file', args: { path: 'docs\\spec.md' }, status: 'success' },
          { toolName: 'write_file', args: { path: 'docs/other.md' }, status: 'success' },
        ],
      }),
    )
    expect(groups.artifact).toHaveLength(2)
    expect(groups.artifact[0]?.count).toBe(2)
    expect(groups.artifact[1]?.count).toBe(1)
  })

  it('媒体产物字段(image_url/video_url/audio_url)归产出而不归网页查阅', () => {
    const groups = aggregateTaskContent(
      messages({
        toolCalls: [
          {
            toolName: 'image_generation',
            args: { prompt: '一只猫' },
            status: 'success',
            image_url: 'https://cdn.example/cat.png',
          },
        ],
      }),
    )
    expect(groups.artifact.map((i) => i.href)).toEqual(['https://cdn.example/cat.png'])
    expect(groups.browser).toHaveLength(0)
  })

  it('空任务:三组皆空 ⇒ isTaskContentEmpty 为真,计数全 0', () => {
    const groups = aggregateTaskContent([
      { role: 'user', toolCalls: undefined, citations: undefined },
      { role: 'assistant', toolCalls: [], citations: [] },
    ])
    expect(isTaskContentEmpty(groups)).toBe(true)
    expect(taskContentGroupCounts(groups)).toEqual({ artifact: 0, browser: 0, source: 0 })
  })

  it('任一组非空即不算空(汇总描述只在三组全空时出现)', () => {
    const groups = aggregateTaskContent(
      messages({ citations: [{ source: 'rag', label: '来源甲' }] }),
    )
    expect(isTaskContentEmpty(groups)).toBe(false)
    expect(taskContentGroupCounts(groups).source).toBe(1)
  })
})

describe('D175 渲染层:三分组 + 各组空态 + 全空汇总描述', () => {
  afterEach(cleanup)

  it('全空:出 empty + emptyDescription,三组空态逐组出 emptyGroup.<key>', () => {
    render(<TaskContentGroupsView messages={[]} />)
    expect(screen.getByTestId('task-content-groups')).toBeTruthy()
    expect(screen.getByTestId('task-content-empty').textContent).toContain('empty')
    expect(screen.getByTestId('task-content-empty').textContent).toContain('emptyDescription')
    for (const key of ['artifact', 'browser', 'source']) {
      expect(screen.getByTestId(`task-content-group-${key}`).textContent).toContain(`group.${key}`)
      expect(screen.getByTestId(`task-content-group-empty-${key}`)).toBeTruthy()
    }
  })

  it('有内容:分组标题取 group.<key>,条目渲染 label 与重复次数,空的那一组仍给空态', () => {
    render(
      <TaskContentGroupsView
        messages={messages({
          toolCalls: [
            { toolName: 'write_file', args: { path: 'a.md' }, status: 'success' },
            { toolName: 'write_file', args: { path: 'a.md' }, status: 'success' },
            { toolName: 'fetch_url', args: { url: 'https://x.example/p' }, status: 'success' },
          ],
        })}
      />
    )
    expect(screen.queryByTestId('task-content-empty')).toBeNull()
    expect(screen.getByTestId('task-content-group-list-artifact').textContent).toContain('a.md (2)')
    expect(screen.getByTestId('task-content-group-list-browser').textContent).toContain(
      'https://x.example/p',
    )
    expect(screen.getByTestId('task-content-group-empty-source').textContent).toContain(
      'emptyGroup.source',
    )
  })
})

function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

describe('D175 装车层:三分组确实挂在任务监控 results 区内', () => {
  it('宿主 task-monitor-sections.tsx 含 import + results 区挂载点 + chat store 取数', () => {
    const host = readRepo('src/components/ai/task-monitor-sections.tsx')
    expect(host).toContain("import { TaskContentGroupsView } from './d175-task-content-groups'")
    expect(host).toContain("import { useChatStore } from '@/stores/chat'")
    expect(host).toContain('const messages = useChatStore((s) => s.messages)')
    expect(host).toContain("zone === 'results' && <TaskContentGroupsView messages={messages} />")
  })

  it('真跑分区视图:results 区展开即出三分组,折叠即整段退场(不越区泄漏)', () => {
    // 宿主取数走 chat store 既有 messages(默认为空数组 ⇒ 走空态分支)
    render(
      <TaskMonitorZonesView
        activeTab="goal"
        onSelectTab={() => {}}
        renderTab={() => React.createElement('div', { 'data-testid': 'stub-tab' })}
      />,
    )
    expect(screen.getByTestId('task-content-groups')).toBeTruthy()
    const zone = screen.getByTestId('task-monitor-zone-results')
    expect(zone.querySelector('[data-testid="task-content-groups"]')).not.toBeNull()
    fireEvent.click(screen.getByTestId('task-monitor-zone-toggle-results'))
    expect(screen.queryByTestId('task-content-groups')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
