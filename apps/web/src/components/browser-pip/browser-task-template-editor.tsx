// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 可视化任务模板编辑器 —— 2026-11-26 立。
 *
 * TRAE 文章里的“任务模板”在 IHUI 里不能只是四枚写死的 id:用户要能自己写
 * 目标、运行要求、检查点和等待上限,保存后跨设备还在。本组件是纯 UI,
 * 校验与持久化都在服务端 `browser_task_template_store`;这里不复制第二套规则。
 *
 * 交互:
 * - 左列是模板目录(内置只读 + 我的模板),每行可直接“开画中画”;
 * - 右列是编辑器:名称/目标/要求/检查点/超时,新建或编辑同一条;
 * - 保存后刷新目录,关闭弹窗不丢已保存内容。
 */

import * as React from 'react'
import { Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
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
import {
  deleteBrowserTaskTemplate,
  listBrowserTaskTemplates,
  saveBrowserTaskTemplate,
  type BrowserTaskTemplate,
} from '@ihui/api-client'

interface CheckpointDraft {
  id: string
  label: string
  match: string
}

interface TemplateDraft {
  id?: string
  name: string
  goal: string
  requirements: string[]
  checkpoints: CheckpointDraft[]
  checkpoint_timeout_seconds: number
}

const TIMEOUT_OPTIONS = [60, 300, 600, 900, 1800, 3600]
const CHECKPOINT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/

function emptyDraft(): TemplateDraft {
  return {
    name: '',
    goal: '',
    requirements: [''],
    checkpoints: [{ id: 'checkpoint-1', label: '', match: '' }],
    checkpoint_timeout_seconds: 900,
  }
}

function toDraft(template: BrowserTaskTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name || template.id,
    goal: template.goal,
    requirements: template.requirements.length ? template.requirements : [''],
    checkpoints: template.checkpoints.map((cp) => ({
      id: cp.id,
      label: cp.label,
      match: cp.match || '',
    })),
    checkpoint_timeout_seconds: template.checkpoint_timeout_seconds || 900,
  }
}

function builtinLabel(t: (key: string) => string, id: string): string {
  const key =
    id === 'login-handoff'
      ? 'pictureInPicture.templateLogin'
      : id === 'form-commit'
        ? 'pictureInPicture.templateForm'
        : id === 'payment-confirm'
          ? 'pictureInPicture.templatePayment'
          : 'pictureInPicture.templateDownload'
  return t(key)
}

export interface BrowserTaskTemplateEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 用某模板/自定义任务直接开画中画(父组件负责绑定会话 + 开窗)。 */
  onStart: (templateId: string) => void | Promise<void>
}

export function BrowserTaskTemplateEditor({
  open,
  onOpenChange,
  onStart,
}: BrowserTaskTemplateEditorProps) {
  const t = useTranslations('aiChat')
  const [templates, setTemplates] = React.useState<BrowserTaskTemplate[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [draft, setDraft] = React.useState<TemplateDraft | null>(null)
  const [loadError, setLoadError] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await listBrowserTaskTemplates()
      if (!res.success) {
        setLoadError(res.error || t('pictureInPicture.templateLoadFailed'))
        return
      }
      setTemplates(res.data?.templates ?? [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    if (!open) return
    setDraft(null)
    void load()
  }, [open, load])

  const updateDraft = (patch: Partial<TemplateDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateRequirement = (index: number, value: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            requirements: prev.requirements.map((item, i) => (i === index ? value : item)),
          }
        : prev,
    )
  }

  const updateCheckpoint = (index: number, patch: Partial<CheckpointDraft>) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            checkpoints: prev.checkpoints.map((item, i) =>
              i === index ? { ...item, ...patch } : item,
            ),
          }
        : prev,
    )
  }

  const save = async () => {
    if (!draft || saving) return
    const name = draft.name.trim()
    if (!name) {
      toast.error(t('pictureInPicture.templateNameRequired'))
      return
    }
    if (!draft.goal.trim()) {
      toast.error(t('pictureInPicture.templateGoalRequired'))
      return
    }
    if (draft.checkpoints.length === 0) {
      toast.error(t('pictureInPicture.templateCheckpointRequired'))
      return
    }
    for (const cp of draft.checkpoints) {
      if (!cp.id.trim() || !CHECKPOINT_ID_RE.test(cp.id.trim())) {
        toast.error(t('pictureInPicture.templateCheckpointIdInvalid'))
        return
      }
      if (!cp.label.trim()) {
        toast.error(t('pictureInPicture.templateCheckpointLabelRequired'))
        return
      }
    }
    setSaving(true)
    try {
      const res = await saveBrowserTaskTemplate({
        id: draft.id,
        name,
        goal: draft.goal.trim(),
        requirements: draft.requirements.map((item) => item.trim()).filter(Boolean),
        checkpoints: draft.checkpoints.map((cp) => ({
          id: cp.id.trim(),
          label: cp.label.trim(),
          match: cp.match.trim() || null,
        })),
        checkpoint_timeout_seconds: draft.checkpoint_timeout_seconds,
      })
      if (!res.success) {
        toast.error(res.error || t('pictureInPicture.templateSaveFailed'))
        return
      }
      toast.success(t('pictureInPicture.templateSaved'))
      setDraft(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (template: BrowserTaskTemplate) => {
    try {
      const res = await deleteBrowserTaskTemplate(template.id)
      if (!res.success) {
        toast.error(res.error || t('pictureInPicture.templateDeleteFailed'))
        return
      }
      toast.success(t('pictureInPicture.templateDeleted'))
      if (draft?.id === template.id) setDraft(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const start = async (templateId: string) => {
    onOpenChange(false)
    await onStart(templateId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('pictureInPicture.templateEditorTitle')}</DialogTitle>
          <DialogDescription>{t('pictureInPicture.templateEditorHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-[520px] grid-cols-[300px_1fr] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r bg-muted/20">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{t('pictureInPicture.templateCatalog')}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(emptyDraft())}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('pictureInPicture.templateNew')}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {loading ? (
                <p className="px-2 py-6 text-sm text-muted-foreground">
                  {t('pictureInPicture.templateLoading')}
                </p>
              ) : loadError ? (
                <div className="px-2 py-6 text-sm text-destructive">
                  {loadError}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => void load()}
                  >
                    {t('pictureInPicture.templateRetry')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-md border bg-background p-3 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {template.source === 'custom'
                              ? template.name
                              : builtinLabel(t, template.id)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {template.goal}
                          </p>
                        </div>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {template.source === 'custom'
                            ? t('pictureInPicture.templateCustomBadge')
                            : t('pictureInPicture.templateBuiltinBadge')}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void start(template.id)}
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          {t('pictureInPicture.templateRun')}
                        </Button>
                        {template.source === 'custom' && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDraft(toDraft(template))}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              {t('pictureInPicture.templateEdit')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => void remove(template)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            {draft ? (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pip-template-name">
                        {t('pictureInPicture.templateName')}
                      </Label>
                      <Input
                        id="pip-template-name"
                        value={draft.name}
                        maxLength={40}
                        placeholder={t('pictureInPicture.templateNamePlaceholder')}
                        onChange={(e) => updateDraft({ name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pip-template-timeout">
                        {t('pictureInPicture.templateTimeout')}
                      </Label>
                      <select
                        id="pip-template-timeout"
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={draft.checkpoint_timeout_seconds}
                        onChange={(e) =>
                          updateDraft({ checkpoint_timeout_seconds: Number(e.target.value) })
                        }
                      >
                        {TIMEOUT_OPTIONS.map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {t('pictureInPicture.templateTimeoutOption', { minutes: seconds / 60 })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pip-template-goal">{t('pictureInPicture.templateGoal')}</Label>
                    <textarea
                      id="pip-template-goal"
                      className="min-h-[72px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
                      value={draft.goal}
                      maxLength={160}
                      placeholder={t('pictureInPicture.templateGoalPlaceholder')}
                      onChange={(e) => updateDraft({ goal: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('pictureInPicture.templateRequirements')}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={draft.requirements.length >= 8}
                        onClick={() => updateDraft({ requirements: [...draft.requirements, ''] })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {t('pictureInPicture.templateAddRequirement')}
                      </Button>
                    </div>
                    {draft.requirements.map((requirement, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={requirement}
                          maxLength={80}
                          placeholder={t('pictureInPicture.templateRequirementPlaceholder')}
                          onChange={(e) => updateRequirement(index, e.target.value)}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={t('pictureInPicture.templateRemoveRequirement')}
                          onClick={() =>
                            updateDraft({
                              requirements: draft.requirements.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t('pictureInPicture.templateCheckpoints')}</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={draft.checkpoints.length >= 8}
                        onClick={() =>
                          updateDraft({
                            checkpoints: [
                              ...draft.checkpoints,
                              {
                                id: `checkpoint-${draft.checkpoints.length + 1}`,
                                label: '',
                                match: '',
                              },
                            ],
                          })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {t('pictureInPicture.templateAddCheckpoint')}
                      </Button>
                    </div>
                    {draft.checkpoints.map((checkpoint, index) => (
                      <div key={index} className="grid grid-cols-[110px_1fr_120px_auto] gap-2">
                        <Input
                          value={checkpoint.id}
                          maxLength={32}
                          aria-label={t('pictureInPicture.templateCheckpointId')}
                          placeholder="checkpoint-1"
                          onChange={(e) => updateCheckpoint(index, { id: e.target.value })}
                        />
                        <Input
                          value={checkpoint.label}
                          maxLength={40}
                          aria-label={t('pictureInPicture.templateCheckpointLabel')}
                          placeholder={t('pictureInPicture.templateCheckpointLabelPlaceholder')}
                          onChange={(e) => updateCheckpoint(index, { label: e.target.value })}
                        />
                        <Input
                          value={checkpoint.match}
                          maxLength={24}
                          aria-label={t('pictureInPicture.templateCheckpointMatch')}
                          placeholder="login"
                          onChange={(e) => updateCheckpoint(index, { match: e.target.value })}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={t('pictureInPicture.templateRemoveCheckpoint')}
                          disabled={draft.checkpoints.length <= 1}
                          onClick={() =>
                            updateDraft({
                              checkpoints: draft.checkpoints.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {t('pictureInPicture.templateCheckpointHint')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                  <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                    {t('pictureInPicture.templateCancel')}
                  </Button>
                  <Button type="button" onClick={() => void save()} disabled={saving}>
                    {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    {t('pictureInPicture.templateSave')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('pictureInPicture.templateEmptyEditor')}
                </p>
                <Button type="button" onClick={() => setDraft(emptyDraft())}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t('pictureInPicture.templateNew')}
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
