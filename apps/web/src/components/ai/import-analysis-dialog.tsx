// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 导入会话「用场景分析」弹窗(D28 补齐层第 1 条,2026-10-03)
 *
 * **这是"导入 → 拿来分析"那一层融合的唯一入口**。用户导完一堆微信群聊记录,
 * 最想要的是"帮我分析";此前导入只做到落库,落进来的会话与自建会话在侧栏同形、
 * 消息区也没有任何差异化后续 —— 想分析只能自己进去手打。
 *
 * 三段结构:
 *   1. 选场景 —— 推荐区(按**导入来源**给默认:wechat → 聊天记录类,其余四源 → 编程会话类)
 *      + 全库 20 分类 210 条(库本体是 products/ai-prompt-library 的机器投影,不自造场景)
 *   2. 填 variables —— 模板占位符逐条填,可留空(留空按"待补充"渲染,不静默丢要求)
 *   3. 发起 —— 拼成一条**普通用户消息**,经 chat store 的 draftInput + draftAutoSend
 *      通道自动发出。**复用既有聊天/agent 通道,不新造一条 LLM 调用链。**
 *
 * 为什么要动态 import 场景目录:`import-analysis-scenarios.ts` 连带 210 条模板正文
 * ≈493KB,静态 import 会把这份体积拖进每一个引用本弹窗的 chunk。目录只在用户
 * 真要点开弹窗时才拉 —— 挂载后再 load,首屏不等它(见下方 catalog 状态)。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@ihui/ui-react'

import { useChatStore } from '@/stores/chat'
import { buildAnalysisPrompt, type ImportSource } from '@ihui/shared/import-analysis'
import type { ImportAnalysisCategory, ImportAnalysisScenario } from '@ihui/shared/import-analysis/scenarios'

export interface ImportAnalysisDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** 会话来源(决定推荐场景);null = 非导入会话,只给全库 */
  readonly source: ImportSource | null
  /** 变量默认值(如 wechat 场景把 `raw_info` 预填为"本次导入的聊天记录") */
  readonly initialVariables?: Readonly<Record<string, string>>
}

/** 目录加载态(动态 import 的真实阶段,不是"假装在加载") */
type CatalogState =
  | { phase: 'loading' }
  | { phase: 'ready'; categories: readonly ImportAnalysisCategory[]; recommended: ImportAnalysisScenario[]; all: readonly ImportAnalysisScenario[] }
  | { phase: 'error'; message: string }

export function ImportAnalysisDialog({
  open,
  onOpenChange,
  source,
  initialVariables,
}: ImportAnalysisDialogProps) {
  const t = useTranslations('conversationImport')
  const [catalog, setCatalog] = React.useState<CatalogState>({ phase: 'loading' })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [variables, setVariables] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)

  // 未填变量的占位提示(i18n 一处,buildAnalysisPrompt 与预览共用同一个函数)
  const pendingLabel = React.useCallback(
    (name: string) => t('analysisPendingVar', { name }),
    [t],
  )

  // 目录动态加载:仅在弹窗打开时拉一次,关闭后保留已加载结果(重开不再等)
  React.useEffect(() => {
    if (!open || catalog.phase === 'ready') return
    let cancelled = false
    setCatalog({ phase: 'loading' })
    void import('@ihui/shared/import-analysis/scenarios')
      .then((m) => {
        if (cancelled) return
        setCatalog({
          phase: 'ready',
          categories: m.listCategories(),
          recommended: m.recommendedScenarios(source),
          all: m.listScenarios(),
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setCatalog({
          phase: 'error',
          message: e instanceof Error ? e.message : String(e),
        })
      })
    return () => {
      cancelled = true
    }
  }, [open, catalog.phase, source])

  const selected: ImportAnalysisScenario | null =
    catalog.phase === 'ready' && selectedId !== null
      ? (catalog.all.find((s) => s.id === selectedId) ?? null)
      : null

  // 选中新场景时重置变量表单:上一个场景的 {var} 与新场景无关,留着等于预填错值
  const handleSelect = React.useCallback((s: ImportAnalysisScenario) => {
    setSelectedId(s.id)
    setVariables({ ...(initialVariables ?? {}) })
  }, [initialVariables])

  const preview = React.useMemo(
    () => (selected ? buildAnalysisPrompt(selected, variables, pendingLabel) : null),
    [selected, variables, pendingLabel],
  )

  /**
   * 发起分析:写 chat store 的待发草稿队列,MessageInput 消费后作为**本会话的下一条
   * 用户消息**自动发出。
   *
   * 通道选择的理由(与 goal-card / next-steps-card / d176-task-recap 同款,见 d176 文件头):
   * 程序化 sendMessage 出口(send-message.ts 的 sendMessageInstance 模块单例)不导出,
   * 而 draftInput + draftAutoSend 是仓内既有的惯例通道,不是新路径。
   * 不新建会话 —— 分析必须落在**这个导入会话**里,历史消息才是本轮上下文。
   */
  const handleSubmit = React.useCallback(() => {
    if (!selected || !preview) return
    setSubmitting(true)
    useChatStore.setState({ draftInput: preview, draftAutoSend: true })
    onOpenChange(false)
  }, [selected, preview, onOpenChange])

  const inCategory =
    catalog.phase === 'ready' && categoryId !== null
      ? catalog.all.filter((s) => s.categoryId === categoryId)
      : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle data-testid="import-analysis-dialog-title">
            {t('analysisTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('analysisDesc')}</DialogDescription>

        {catalog.phase === 'loading' && (
          <div
            className="flex items-center py-6 text-xs text-muted-foreground"
            data-testid="import-analysis-loading"
          >
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            {t('analysisLoading')}
          </div>
        )}

        {catalog.phase === 'error' && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] text-destructive"
            data-testid="import-analysis-error"
            role="alert"
          >
            {t('analysisLoadFailed', { error: catalog.message })}
          </p>
        )}

        {catalog.phase === 'ready' && (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pt-1">
            {/* ① 选场景:推荐区(按来源给默认)+ 全库浏览 */}
            <section className="space-y-1.5">
              <p className="text-xs font-medium text-foreground/80">
                {t('analysisScenarioLabel')}
              </p>
              {catalog.recommended.length > 0 && (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    {t('analysisRecommended')}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 min-[480px]:grid-cols-2">
                    {catalog.recommended.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        data-testid="import-analysis-recommended"
                        data-scenario-id={s.id}
                        onClick={() => handleSelect(s)}
                        className={
                          selectedId === s.id
                            ? 'rounded-sm border border-primary/60 bg-primary/10 p-2 text-left'
                            : 'rounded-sm border border-border p-2 text-left hover:bg-accent'
                        }
                      >
                        <span className="block text-xs font-medium">{s.title}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {s.useCase || s.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <details className="rounded-sm border border-border px-2 py-1.5">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  {t('analysisBrowseAll', { count: catalog.all.length })}
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  <select
                    aria-label={t('analysisCategoryLabel')}
                    data-testid="import-analysis-category"
                    className="w-full rounded-sm border border-border bg-background px-2 py-1 text-[11px]"
                    value={categoryId ?? ''}
                    onChange={(e) => setCategoryId(e.target.value || null)}
                  >
                    <option value="">{t('analysisPickCategory')}</option>
                    {catalog.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.categoryZh}({c.count})
                      </option>
                    ))}
                  </select>
                  {categoryId !== null && (
                    <div className="grid grid-cols-1 gap-1 min-[480px]:grid-cols-2">
                      {inCategory.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          data-testid="import-analysis-browse-item"
                          onClick={() => handleSelect(s)}
                          className={
                            selectedId === s.id
                              ? 'rounded-sm border border-primary/60 bg-primary/10 p-1.5 text-left text-[11px]'
                              : 'rounded-sm border border-border p-1.5 text-left text-[11px] hover:bg-accent'
                          }
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            </section>

            {/* ② 填 variables */}
            {selected && (
              <section className="space-y-1.5" data-testid="import-analysis-variables">
                <p className="text-xs font-medium text-foreground/80">
                  {t('analysisVariablesLabel', { title: selected.title })}
                </p>
                {selected.variables.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t('analysisNoVariables')}
                  </p>
                ) : (
                  selected.variables.map((name) => (
                    <div key={name} className="space-y-0.5">
                      <Label
                        htmlFor={`analysis-var-${selected.id}-${name}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        {name}
                      </Label>
                      <Input
                        id={`analysis-var-${selected.id}-${name}`}
                        data-testid={`import-analysis-var-${name}`}
                        value={variables[name] ?? ''}
                        placeholder={t('analysisVarPlaceholder', { name })}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [name]: e.target.value }))
                        }
                        className="h-7 text-[11px]"
                      />
                    </div>
                  ))
                )}
                <p className="text-[11px] text-muted-foreground">{t('analysisOptionalHint')}</p>
              </section>
            )}

            {/* ③ 发起 */}
            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
              <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {selected
                  ? t('analysisEstimate', { tokens: selected.estimatedTokens, difficulty: selected.difficulty })
                  : t('analysisPickFirst')}
              </p>
              <Button
                type="button"
                size="sm"
                data-testid="import-analysis-submit"
                disabled={!selected || !preview || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                <span>{t('analysisSubmit')}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ImportAnalysisDialog
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
