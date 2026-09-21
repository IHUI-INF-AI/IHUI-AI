// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, GitFork, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input, Label } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { TruncatedText } from '@/components/common'
import { useWorldsStore, type WorldBranch } from '@/stores/worlds'

/**
 * WorldsCompare — 并行世界线对比视图(P3 #38,2026-09-17 落地)。
 *
 * 数据源:useWorldsStore(工具面板 worlds tab 挂载)。
 * - 创建表单:任务描述 + 模型列表(逗号分隔,预填当前会话模型)→ startWorld
 * - N 条世界线并排卡片:模型标签/状态(执行中 spinner / 成功 / 失败隔离)/耗时/内容
 * - 择优「采纳为主线」:高亮选中分支,内容由宿主 onAdopt 写入会话消息流
 *   (复用 #36 BestOfCompare 落盘模式)
 */

export interface WorldsCompareProps {
  /** 采纳回调:宿主决定选中内容如何写入会话 */
  onAdopt?: (content: string, model: string) => void
  /** 当前会话模型(创建表单默认值) */
  currentModel?: string
}

export function WorldsCompare({ onAdopt, currentModel }: WorldsCompareProps) {
  const t = useTranslations('worlds')
  const task = useWorldsStore((s) => s.task)
  const branches = useWorldsStore((s) => s.branches)
  const running = useWorldsStore((s) => s.running)
  const adoptedId = useWorldsStore((s) => s.adoptedId)
  const adopt = useWorldsStore((s) => s.adopt)
  const reset = useWorldsStore((s) => s.reset)
  const startWorld = useWorldsStore((s) => s.startWorld)

  // 创建表单态
  const [taskInput, setTaskInput] = React.useState('')
  const [modelsInput, setModelsInput] = React.useState('')
  const [formErr, setFormErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    // currentModel 到位且表单为空时预填
    if (currentModel && !modelsInput) setModelsInput(currentModel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModel])

  const handleFork = () => {
    setFormErr(null)
    if (!taskInput.trim()) return setFormErr(t('errTask'))
    const models = modelsInput
      .split(/[,，;；\s]+/)
      .map((m) => m.trim())
      .filter(Boolean)
    if (models.length < 2) return setFormErr(t('errModels'))
    startWorld(taskInput.trim(), models)
  }

  const hasWorld = Boolean(task) && branches.length > 0

  return (
    <div className="space-y-3" data-testid="worlds-compare">
      {/* 创建表单(进行中禁用) */}
      <div className="space-y-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-1.5">
          <GitFork className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">{t('forkTitle')}</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="worlds-task">{t('taskLabel')}</Label>
          <textarea
            id="worlds-task"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder={t('taskPlaceholder')}
            rows={2}
            maxLength={2000}
            disabled={running}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="worlds-models">{t('modelsLabel')}</Label>
          <Input
            id="worlds-models"
            value={modelsInput}
            onChange={(e) => setModelsInput(e.target.value)}
            placeholder={t('modelsPlaceholder')}
            maxLength={500}
            disabled={running}
          />
        </div>
        {formErr && <p className="text-xs text-destructive">{formErr}</p>}
        <Button size="sm" onClick={handleFork} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitFork className="h-4 w-4" />}
          {t('fork')}
        </Button>
      </div>

      {hasWorld && (
        <>
          {/* 头部:任务 + 状态 + 重置 */}
          <div className="flex items-center gap-2">
            <TruncatedText value={task} className="min-w-0 flex-1 text-xs text-muted-foreground" />
            {running && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('running')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              data-testid="worlds-reset"
              disabled={running}
            >
              {t('reset')}
            </Button>
          </div>

          {/* 分支并排 */}
          <div
            className={cn(
              'grid gap-2',
              branches.length >= 3
                ? 'grid-cols-1 min-[900px]:grid-cols-3'
                : 'grid-cols-1 min-[700px]:grid-cols-2',
            )}
          >
            {branches.map((b) => (
              <WorldBranchCard
                key={b.id}
                branch={b}
                adopted={adoptedId === b.id}
                onAdopt={() => {
                  adopt(b.id)
                  onAdopt?.(b.content, b.model)
                }}
              />
            ))}
          </div>
        </>
      )}

      {!hasWorld && !running && (
        <p className="py-2 text-center text-sm text-muted-foreground">{t('empty')}</p>
      )}
    </div>
  )
}

function WorldBranchCard({
  branch,
  adopted,
  onAdopt,
}: {
  branch: WorldBranch
  adopted: boolean
  onAdopt: () => void
}) {
  const t = useTranslations('worlds')
  const isError = branch.status === 'error'

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border p-2.5 transition-colors',
        adopted ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
      )}
      data-testid={`world-branch-${branch.id}`}
      data-world-status={branch.status}
    >
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {branch.label}
        </span>
        {branch.status === 'running' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        )}
        {branch.status === 'success' && <Check className="h-3.5 w-3.5 text-green-500" />}
        {isError && <X className="h-3.5 w-3.5 text-red-500" />}
      </div>

      {isError ? (
        <p className="line-clamp-3 text-xs text-red-500/90">{branch.error}</p>
      ) : branch.status === 'running' ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{t('branchRunning')}</p>
      ) : (
        <p className="line-clamp-6 min-h-[3rem] whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {branch.content || t('emptyReply')}
        </p>
      )}

      <div className="flex items-center gap-2">
        {branch.latencyMs !== undefined && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {(branch.latencyMs / 1000).toFixed(1)}s
          </span>
        )}
        <span className="flex-1" />
        {branch.status === 'success' && (
          <Button
            variant={adopted ? 'secondary' : 'outline'}
            size="sm"
            onClick={onAdopt}
            data-testid={`world-adopt-${branch.id}`}
            disabled={adopted}
          >
            {adopted ? t('adopted') : t('adopt')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default WorldsCompare
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
