// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 自动化新建/编辑弹窗(2026-09-07 立)。
 * 一次性 → datetime-local;重复 → 频率(每小时/每天/每周) + 时间 + 周几多选(仅每周)。
 * 提交时前端把表单态拼成 rrule / scheduledAt,调 createAutomation / updateAutomation。
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
  createAutomation,
  updateAutomation,
  type UserAutomation,
  type AutomationScheduleType,
} from '@ihui/api-client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Frequency = 'hourly' | 'daily' | 'weekly'

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

/** 周几代码 → i18n 键(静态映射,避免动态 t() 拼接) */
const WEEKDAY_LABEL_KEYS: Record<(typeof DAY_CODES)[number], 'weekdayMo' | 'weekdayTu' | 'weekdayWe' | 'weekdayTh' | 'weekdayFr' | 'weekdaySa' | 'weekdaySu'> = {
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
  prompt: string
  scheduleType: AutomationScheduleType
  scheduledAt: string // datetime-local 原始值(仅 once)
  frequency: Frequency
  time: string // HH:MM(仅 daily/weekly)
  days: string[] // MO/TU/... (仅 weekly)
}

const EMPTY_FORM: FormState = {
  name: '',
  prompt: '',
  scheduleType: 'once',
  scheduledAt: '',
  frequency: 'daily',
  time: '09:00',
  days: ['MO', 'TU', 'WE', 'TH', 'FR'],
}

/** 把 UI 表单态拼成 MVP rrule */
function buildRrule(form: FormState): string {
  const [h, m] = form.time.split(':')
  const byHour = String(Number(h ?? '0'))
  const byMinute = String(Number(m ?? '0'))
  if (form.frequency === 'hourly') return 'FREQ=HOURLY'
  if (form.frequency === 'daily') return `FREQ=DAILY;BYHOUR=${byHour};BYMINUTE=${byMinute}`
  return `FREQ=WEEKLY;BYDAY=${form.days.join(',')};BYHOUR=${byHour};BYMINUTE=${byMinute}`
}

/** 把 rrule 拆解回 UI 表单态(解析失败回默认值) */
function rruleToForm(rrule: string | null): Partial<FormState> {
  if (!rrule) return {}
  const parts: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const idx = seg.indexOf('=')
    if (idx > 0) parts[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
  }
  const freq = parts.FREQ?.toUpperCase()
  const time =
    parts.BYHOUR !== undefined || parts.BYMINUTE !== undefined
      ? `${String(Number(parts.BYHOUR ?? '0')).padStart(2, '0')}:${String(
          Number(parts.BYMINUTE ?? '0'),
        ).padStart(2, '0')}`
      : undefined
  if (freq === 'HOURLY') return { frequency: 'hourly', time: time ?? EMPTY_FORM.time }
  if (freq === 'DAILY') return { frequency: 'daily', time: time ?? EMPTY_FORM.time }
  if (freq === 'WEEKLY' && parts.BYDAY) {
    return {
      frequency: 'weekly',
      time: time ?? EMPTY_FORM.time,
      days: parts.BYDAY.split(',').map((d) => d.trim().toUpperCase()),
    }
  }
  return {}
}

/** datetime-local 值 → ISO(含时区);空值返回 null */
function localToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO → datetime-local 本地值(编辑回显) */
function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑目标;null 表示新建 */
  editing: UserAutomation | null
  onSaved: () => void
}

export function AutomationFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const t = useTranslations('automations')
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
        prompt: editing.prompt,
        scheduleType: editing.scheduleType,
        scheduledAt: isoToLocal(editing.scheduledAt),
        frequency: 'daily',
        time: EMPTY_FORM.time,
        days: EMPTY_FORM.days,
        ...rruleToForm(editing.rrule),
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
    if (!form.prompt.trim()) return setFormErr(t('form.errPrompt'))
    if (form.scheduleType === 'once' && !localToIso(form.scheduledAt)) {
      return setFormErr(t('form.errScheduledAt'))
    }
    if (form.scheduleType === 'recurring' && form.frequency === 'weekly' && form.days.length === 0) {
      return setFormErr(t('form.errDays'))
    }

    setPending(true)
    try {
      if (editing) {
        await updateAutomation(editing.id, {
          name: form.name.trim(),
          prompt: form.prompt.trim(),
          ...(form.scheduleType === 'once'
            ? { scheduledAt: localToIso(form.scheduledAt) }
            : { rrule: buildRrule(form) }),
        })
        toast.success(t('toast.updated'))
      } else {
        await createAutomation({
          name: form.name.trim(),
          prompt: form.prompt.trim(),
          scheduleType: form.scheduleType,
          ...(form.scheduleType === 'once'
            ? { scheduledAt: localToIso(form.scheduledAt) ?? undefined }
            : { rrule: buildRrule(form) }),
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
            <DialogTitle>
              {editing ? t('form.editTitle') : t('form.createTitle')}
            </DialogTitle>
            <DialogDescription>{t('form.desc')}</DialogDescription>
          </DialogHeader>

          {formErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formErr}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="auto-name">{t('form.name')}</Label>
            <Input
              id="auto-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('form.namePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-prompt">{t('form.prompt')}</Label>
            <textarea
              id="auto-prompt"
              value={form.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder={t('form.promptPlaceholder')}
              rows={4}
              maxLength={8000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('form.scheduleType')}</Label>
            <div className="flex gap-2">
              {(
                [
                  ['once', t('form.typeOnce')],
                  ['recurring', t('form.typeRecurring')],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.scheduleType === value}
                  onClick={() => patch({ scheduleType: value })}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    form.scheduleType === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.scheduleType === 'once' ? (
            <div className="space-y-2">
              <Label htmlFor="auto-scheduled-at">{t('form.scheduledAt')}</Label>
              <Input
                id="auto-scheduled-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => patch({ scheduledAt: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('form.frequency')}</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => patch({ frequency: v as Frequency })}
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
                  <Label htmlFor="auto-time">{t('form.time')}</Label>
                  <Input
                    id="auto-time"
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
                              ? 'border-primary bg-primary text-primary-foreground'
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
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
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
