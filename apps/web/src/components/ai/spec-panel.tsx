'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'
import { useSpecPanel } from './spec-panel/useSpecPanel'
import {
  SpecScopeSelector,
  SpecResultHeader,
  SpecTabNav,
  SpecWatchControl,
  DiffView,
} from './spec-panel/components'
import { SpecCodegenTab } from './spec-panel/SpecCodegenTab'
import { SpecReviewTab } from './spec-panel/SpecReviewTab'
import { SpecTasksTab } from './spec-panel/SpecTasksTab'
import { SpecEnhanceTab } from './spec-panel/SpecEnhanceTab'
import { SpecPipelineTab } from './spec-panel/SpecPipelineTab'
import { SpecImpactTab } from './spec-panel/SpecImpactTab'
import { SpecBranchesTab } from './spec-panel/SpecBranchesTab'
import { SpecGenerateTab } from './spec-panel/SpecGenerateTab'

/**
 * Spec 模式专用面板(2026-07-22 立,对标 Trae IDE Spec 模式)。
 *
 * 从代码 AST 反向生成规格文档(markdown):
 * - scope 选择:单文件 / 目录 / 全工作区
 * - 生成按钮 → POST /api/spec/generate → ai-service tree-sitter AST 解析
 * - 历史版本下拉 → GET /api/spec/history + GET /api/spec/load
 * - 对比当前 → POST /api/spec/diff(unified diff 行级着色)
 * - 导出 → 下载 spec markdown 文件
 *
 * 2026-07-22 深化(对标 Copilot Workspace / Aider):
 * - 代码生成标签页:POST /api/spec/apply → LLM 生成 patch + 应用按钮
 * - 评审标签页:submit / approve / reject 状态机
 * - 任务拆分标签页:POST /api/spec/split-tasks → LLM 拆分任务
 * - 智能分析标签页:POST /api/spec/enhance → LLM 风险点 + 改进建议
 * - watch 控件:启动/停止监听 + 活跃 watcher 列表
 *
 * 2026-07-23 超越创新:全流程 / 影响分析 / 版本树 / 智能生成
 *
 * 紧凑风格(AGENTS.md §4):Card 容器,无 rounded-full / 蓝色发光 / hr / divide-y。
 *
 * 2026-08 重构:状态与事件处理器抽离到 ./spec-panel/useSpecPanel + ./spec-panel/useSpecHandlers,
 * 各标签页/头部/工具区抽离到 ./spec-panel/* 子组件,本文件仅负责组合渲染,保持对外 API 与行为不变。
 */

export function SpecPanel({ className }: { className?: string }) {
  const p = useSpecPanel()

  return (
    <div className={cn('rounded-xl border border-border bg-card p-3', className)}>
      {/* 范围选择 */}
      <SpecScopeSelector p={p} />

      {/* 统计 + 标签页导航 + 操作按钮(生成后) */}
      {p.result && (
        <>
          <SpecResultHeader p={p} />

          {/* 标签页导航 */}
          <SpecTabNav p={p} />

          {/* 标签页内容 */}
          <div className="mt-2">
            {/* spec 标签页 */}
            {p.tabMode === 'spec' && (
              <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-background p-3">
                <MarkdownViewer content={p.result.spec} />
              </div>
            )}

            {/* diff 标签页 */}
            {p.tabMode === 'diff' && (
              <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-background p-2">
                {p.diffResult?.diff ? (
                  <DiffView diff={p.diffResult.diff} className="text-xs leading-5" />
                ) : (
                  <p className="text-xs text-muted-foreground p-2">点击「对比当前」生成 diff</p>
                )}
              </div>
            )}

            {/* 代码生成标签页 */}
            {p.tabMode === 'codegen' && <SpecCodegenTab p={p} />}

            {/* 评审标签页 */}
            {p.tabMode === 'review' && <SpecReviewTab p={p} />}

            {/* 任务拆分标签页 */}
            {p.tabMode === 'tasks' && <SpecTasksTab p={p} />}

            {/* 智能分析标签页 */}
            {p.tabMode === 'enhance' && <SpecEnhanceTab p={p} />}

            {/* 全流程标签页(2026-07-23 超越创新) */}
            {p.tabMode === 'pipeline' && <SpecPipelineTab p={p} />}

            {/* 影响分析标签页(2026-07-23 超越创新) */}
            {p.tabMode === 'impact' && <SpecImpactTab p={p} />}

            {/* 版本树标签页(2026-07-23 超越创新) */}
            {p.tabMode === 'branches' && <SpecBranchesTab p={p} />}

            {/* 智能生成标签页(2026-07-23 超越创新) */}
            {p.tabMode === 'generate' && <SpecGenerateTab p={p} />}
          </div>
        </>
      )}

      {/* Watch 控件(始终显示,独立于 spec 生成) */}
      <SpecWatchControl p={p} />
    </div>
  )
}
