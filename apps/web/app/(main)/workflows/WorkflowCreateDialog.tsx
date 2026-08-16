'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { WorkflowEditor } from './editor/WorkflowEditor'
import type { TriggerType, WorkflowForm, WorkflowStep } from './types'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  form: WorkflowForm
  setForm: React.Dispatch<React.SetStateAction<WorkflowForm>>
  formErr: string | null
  createPending: boolean
  onSubmit: (e: React.FormEvent, steps: string) => void
  onCancel: () => void
}

/** 将 steps JSON 字符串解析为 WorkflowStep[] */
function parseSteps(raw: string): WorkflowStep[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function WorkflowCreateDialog({
  open,
  onOpenChange,
  form,
  setForm,
  formErr,
  createPending,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('workflows')
  const tc = useTranslations('common')
  const [editorSteps, setEditorSteps] = React.useState<WorkflowStep[]>(() => parseSteps(form.steps))

  // 对话框打开时同步 editorSteps
  React.useEffect(() => {
    if (open) {
      setEditorSteps(parseSteps(form.steps))
    }
  }, [open, form.steps])

  const handleSubmit = (e: React.FormEvent) => {
    // 直接传递编辑器序列化的 steps，避免 setForm 异步导致 form.steps 过时
    const serialized = JSON.stringify(editorSteps)
    onSubmit(e, serialized)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t('create.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>{t('create.desc')}</DialogDescription>
          </DialogHeader>
          {formErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formErr}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wf-name">{t('create.name')}</Label>
              <Input
                id="wf-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('create.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-trigger">{t('create.triggerType')}</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v) => setForm({ ...form, triggerType: v as TriggerType })}
              >
                <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{t('triggers.manual')}</SelectItem>
                  <SelectItem value="schedule">{t('triggers.schedule')}</SelectItem>
                  <SelectItem value="event">{t('triggers.event')}</SelectItem>
                  <SelectItem value="webhook">{t('triggers.webhook')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wf-desc">{t('create.description')}</Label>
            <textarea
              id="wf-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('create.steps')}</Label>
            <WorkflowEditor steps={editorSteps} onChange={setEditorSteps} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={createPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={createPending}>
              {createPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
