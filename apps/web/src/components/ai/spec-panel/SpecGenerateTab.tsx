// Spec 模式面板:智能生成标签页(2026-07-23 超越创新)
import { Wand2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'
import type { SpecPanelApi } from './useSpecPanel'

export function SpecGenerateTab({ p }: { p: SpecPanelApi }) {
  const { t } = p
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Wand2 className="h-3 w-3 text-muted-foreground" />
        <Tooltip content={t('requirementFormat')}>
          <select
            value={p.requirementFormat}
            onChange={(e) =>
              p.setRequirementFormat(e.target.value as 'text' | 'markdown' | 'image_description')
            }
            className="h-7 rounded-md border border-border bg-background px-1 text-xs text-foreground focus:outline-none"
          >
            <option value="text">纯文本</option>
            <option value="markdown">markdown</option>
            <option value="image_description">截图描述</option>
          </select>
        </Tooltip>
        <button
          type="button"
          onClick={p.handleGenerateFromRequirement}
          disabled={p.genLoading || !p.requirementInput.trim()}
          className={cn(
            'flex shrink-0 whitespace-nowrap h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            (p.genLoading || !p.requirementInput.trim()) && 'cursor-not-allowed opacity-60',
          )}
        >
          {p.genLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          <span>{p.genLoading ? '生成中' : '生成 spec 草稿'}</span>
        </button>
      </div>
      <textarea
        value={p.requirementInput}
        onChange={(e) => p.setRequirementInput(e.target.value)}
        placeholder={
          p.requirementFormat === 'image_description'
            ? '描述截图内容(如:登录页有用户名/密码输入框 + 登录按钮 + 找回密码链接)'
            : '需求描述(支持 markdown,LLM 生成 5 章节 spec 草稿)'
        }
        rows={6}
        className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/20 focus:outline-none"
      />
      {p.genResult?.spec ? (
        <div className="max-h-[45vh] overflow-auto rounded-md border border-border bg-background p-3">
          {p.genResult.sections.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {p.genResult.sections.map((s, i) => (
                <span
                  key={i}
                  className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {s.title}
                </span>
              ))}
            </div>
          )}
          <MarkdownViewer content={p.genResult.spec} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground p-2">
          填写需求后点击「生成 spec 草稿」,LLM 生成包含 概述 / 模块结构 / API 契约 / 数据模型 /
          测试用例 的 5 章节 spec
        </p>
      )}
    </div>
  )
}
