// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 巡检任务新建/编辑弹窗(2026-09-17 立,P3 #40)。
 * 巡检类型(CI/依赖/日志/死链/自定义) + 目标 + 附加指令 + rrule 计划(复用
 * lib/rrule-form 共享互转,与 automations 同一套频率语义)。
 * 提交时调 createPatrolTask / updatePatrolTask。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import {
  createPatrolTask,
  updatePatrolTask,
  type PatrolTask,
  type PatrolType,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { buildRruleFromParts, rruleToParts, DEFAULT_RRULE_PARTS } from '@/lib/rrule-form'

const PATROL_TYPES: PatrolType[] = ['ci', 'dependency', 'log', 'deadlink', 'workspace', 'custom']

/** 巡检类型 → i18n 键(静态映射,避免动态 t() 拼接) */
const TYPE_LABEL_KEYS: Record<
  PatrolType,
  'typeCi' | 'typeDependency' | 'typeLog' | 'typeDeadlink' | 'typeWorkspace' | 'typeCustom'
> = {
  ci: 'typeCi',
  dependency: 'typeDependency',
  log: 'typeLog',
  deadlink: 'typeDeadlink',
  workspace: 'typeWorkspace',
  custom: 'typeCustom',
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

/** 周几代码 → i18n 键(静态映射,避免动态 t() 拼接) */
const WEEKDAY_LABEL_KEYS: Record<
  (typeof DAY_CODES)[number],
  'weekdayMo' | 'weekdayTu' | 'weekdayWe' | 'weekdayTh' | 'weekdayFr' | 'weekdaySa' | 'weekdaySu'
> = {
  MO: 'weekdayMo',
  TU: 'weekdayTu',
  WE: 'weekdayWe',
  TH: 'weekdayTh',
  FR: 'weekdayFr',
  SA: 'weekdaySa',
  SU: 'weekdaySu',
}

/** 表单态(rrule 拆解前的 UI 表示) */
interface FormState {
  name: string
  patrolType: PatrolType
  target: string
  prompt: string
  frequency: 'hourly' | 'daily' | 'weekly'
  time: string
  days: string[]
}

const EMPTY_FORM: FormState = {
  name: '',
  patrolType: 'custom',
  target: '',
  prompt: '',
  ...DEFAULT_RRULE_PARTS,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑目标;null 表示新建 */
  editing: PatrolTask | null
  onSaved: () => void
}

export function PatrolFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const t = useTranslations('patrol')
  const toast = useToast()
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [pending, setPending] = React.useState(false)
  const [formErr, setFormErr] = React.useState<string | null>(null)

  // 打开时初始化:编辑回显 / 新建清空
  React.useEffect(() => {
    if (!open) return
    setFormErr(null)
    if (editing) {
      setForm({
        name: editing.name,
        patrolType: editing.patrolType,
        target: editing.target ?? '',
        prompt: editing.prompt ?? '',
        ...(rruleToParts(editing.rrule) ?? DEFAULT_RRULE_PARTS),
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, editing])

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))

  const toggleDay = (code: string) => {
    setForm((f) => ({
      ...f,
      days: f.days.includes(code) ? f.days.filter((d) => d !== code) : [...f.days, code],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr(null)

    if (!form.name.trim()) return setFormErr(t('form.errName'))
    if (form.frequency === 'weekly' && form.days.length === 0) {
      return setFormErr(t('form.errDays'))
    }

    setPending(true)
    try {
      const rrule = buildRruleFromParts(form)
      if (editing) {
        await updatePatrolTask(editing.id, {
          name: form.name.trim(),
          patrolType: form.patrolType,
          target: form.target.trim() || null,
          prompt: form.prompt.trim() || null,
          rrule,
        })
        toast.success(t('toast.updated'))
      } else {
        await createPatrolTask({
          name: form.name.trim(),
          patrolType: form.patrolType,
          target: form.target.trim() || undefined,
          prompt: form.prompt.trim() || undefined,
          rrule,
        })
        toast.success(t('toast.created'))
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('toast.saveFailed')
      setFormErr(message)
      toast.error(t('toast.saveFailed'), message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
            <DialogDescription>{t('form.desc')}</DialogDescription>
          </DialogHeader>

          {formErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formErr}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="patrol-name">{t('form.name')}</Label>
            <Input
              id="patrol-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('form.namePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.patrolType')}</Label>
            <Select
              value={form.patrolType}
              onValueChange={(v) => patch({ patrolType: v as PatrolType })}
            >
              <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PATROL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(TYPE_LABEL_KEYS[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="patrol-target">{t('form.target')}</Label>
            <Input
              id="patrol-target"
              value={form.target}
              onChange={(e) => patch({ target: e.target.value })}
              placeholder={t('form.targetPlaceholder')}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patrol-prompt">{t('form.prompt')}</Label>
            <textarea
              id="patrol-prompt"
              value={form.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder={t('form.promptPlaceholder')}
              rows={3}
              maxLength={8000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('form.frequency')}</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => patch({ frequency: v as FormState['frequency'] })}
              >
                <SelectTrigger className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">{t('form.freqHourly')}</SelectItem>
                  <SelectItem value="daily">{t('form.freqDaily')}</SelectItem>
                  <SelectItem value="weekly">{t('form.freqWeekly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.frequency !== 'hourly' && (
              <div className="space-y-2">
                <Label htmlFor="patrol-time">{t('form.time')}</Label>
                <Input
                  id="patrol-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => patch({ time: e.target.value })}
                />
              </div>
            )}

            {form.frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>{t('form.weekdays')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_CODES.map((code) => {
                    const active = form.days.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleDay(code)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                          active
                            ? 'border-primary bg-cta text-cta-foreground'
                            : 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10',
                        )}
                      >
                        {t(WEEKDAY_LABEL_KEYS[code])}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
