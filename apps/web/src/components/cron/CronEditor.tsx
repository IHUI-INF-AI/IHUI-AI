'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { getNextRuns, describeCron } from './cron-parser'

type Mode = 'every' | 'step' | 'range' | 'specific'
type FieldKey = 'minute' | 'hour' | 'day' | 'month' | 'weekday'

interface FieldConfig {
  key: FieldKey
  min: number
  max: number
}
interface FieldState {
  mode: Mode
  step: number
  rangeStart: number
  rangeEnd: number
  specific: number[]
}

const FIELDS: FieldConfig[] = [
  { key: 'minute', min: 0, max: 59 },
  { key: 'hour', min: 0, max: 23 },
  { key: 'day', min: 1, max: 31 },
  { key: 'month', min: 1, max: 12 },
  { key: 'weekday', min: 0, max: 6 },
]
const MODES: Mode[] = ['every', 'step', 'range', 'specific']

function defaultState(cfg: FieldConfig): FieldState {
  return { mode: 'every', step: 2, rangeStart: cfg.min, rangeEnd: cfg.max, specific: [cfg.min] }
}

function parseFieldState(raw: string, cfg: FieldConfig): FieldState {
  const base = defaultState(cfg)
  if (!raw || raw === '*') return { ...base, mode: 'every' }
  const slashIdx = raw.indexOf('/')
  if (slashIdx >= 0) {
    const basePart = raw.slice(0, slashIdx)
    const n = parseInt(raw.slice(slashIdx + 1), 10)
    if (basePart === '*') return { ...base, mode: 'step', step: Number.isNaN(n) ? 2 : n }
    if (basePart.includes('-')) {
      const segs = basePart.split('-')
      const a = parseInt(segs[0] ?? '', 10)
      const b = parseInt(segs[1] ?? '', 10)
      return {
        ...base,
        mode: 'range',
        rangeStart: Number.isNaN(a) ? cfg.min : a,
        rangeEnd: Number.isNaN(b) ? cfg.max : b,
      }
    }
  }
  if (raw.includes('-')) {
    const segs = raw.split('-')
    const a = parseInt(segs[0] ?? '', 10)
    const b = parseInt(segs[1] ?? '', 10)
    return {
      ...base,
      mode: 'range',
      rangeStart: Number.isNaN(a) ? cfg.min : a,
      rangeEnd: Number.isNaN(b) ? cfg.max : b,
    }
  }
  if (raw.includes(',')) {
    const arr = raw
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !Number.isNaN(n))
    return { ...base, mode: 'specific', specific: arr.length ? arr : [cfg.min] }
  }
  const n = parseInt(raw, 10)
  return { ...base, mode: 'specific', specific: Number.isNaN(n) ? [cfg.min] : [n] }
}

function parseValue(expr: string): Record<FieldKey, FieldState> {
  const parts = expr.trim().split(/\s+/)
  const out = {} as Record<FieldKey, FieldState>
  FIELDS.forEach((f, i) => {
    out[f.key] = parseFieldState(parts[i] ?? '*', f)
  })
  return out
}

function fieldToCron(f: FieldState): string {
  if (f.mode === 'every') return '*'
  if (f.mode === 'step') return `*/${f.step || 1}`
  if (f.mode === 'range') return `${f.rangeStart}-${f.rangeEnd}`
  return f.specific.length ? [...f.specific].sort((a, b) => a - b).join(',') : '*'
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isNaN(n) ? min : n))
}

interface CronEditorProps {
  value?: string
  onChange?: (cron: string) => void
}

export function CronEditor({ value, onChange }: CronEditorProps) {
  const t = useTranslations('cronEditor')
  const [fields, setFields] = React.useState<Record<FieldKey, FieldState>>(() =>
    parseValue(value ?? '0 9 * * 1-5'),
  )

  const cron = React.useMemo(
    () => FIELDS.map((f) => fieldToCron(fields[f.key])).join(' '),
    [fields],
  )
  const runs = React.useMemo(() => getNextRuns(cron, 5), [cron])
  const dtf = React.useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    [],
  )
  const lastEmitted = React.useRef(cron)

  React.useEffect(() => {
    if (value !== undefined) {
      setFields((prev) => {
        const cur = FIELDS.map((f) => fieldToCron(prev[f.key])).join(' ')
        if (cur === value) return prev
        return parseValue(value)
      })
      lastEmitted.current = value
    }
  }, [value])

  React.useEffect(() => {
    if (onChange && cron !== lastEmitted.current) {
      lastEmitted.current = cron
      onChange(cron)
    }
  }, [cron, onChange])

  function update(key: FieldKey, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {FIELDS.map((cfg) => {
          const f = fields[cfg.key]
          const fieldLabel = t(`field.${cfg.key}`)
          return (
            <div key={cfg.key} className="flex items-center gap-3 py-1.5">
              <Label className="w-9 shrink-0 text-xs text-muted-foreground">{fieldLabel}</Label>
              <div className="flex gap-1">
                {MODES.map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant="ghost"
                    className={cn(
                      'h-7 px-2 text-xs hover:bg-muted',
                      f.mode === mode && 'bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                    onClick={() => update(cfg.key, { mode })}
                  >
                    {t(`mode.${mode}`)}
                  </Button>
                ))}
              </div>
              <div className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                {f.mode === 'every' && <span>{t('everyField', { field: fieldLabel })}</span>}
                {f.mode === 'step' && (
                  <>
                    {t('stepPrefix')}
                    <Input
                      type="number"
                      className="h-7 w-14 text-xs"
                      min={1}
                      max={cfg.max}
                      value={f.step}
                      onChange={(e) =>
                        update(cfg.key, { step: clamp(parseInt(e.target.value, 10), 1, cfg.max) })
                      }
                    />
                    {fieldLabel}
                  </>
                )}
                {f.mode === 'range' && (
                  <>
                    <Input
                      type="number"
                      className="h-7 w-14 text-xs"
                      min={cfg.min}
                      max={cfg.max}
                      value={f.rangeStart}
                      onChange={(e) =>
                        update(cfg.key, {
                          rangeStart: clamp(parseInt(e.target.value, 10), cfg.min, cfg.max),
                        })
                      }
                    />
                    <span>-</span>
                    <Input
                      type="number"
                      className="h-7 w-14 text-xs"
                      min={cfg.min}
                      max={cfg.max}
                      value={f.rangeEnd}
                      onChange={(e) =>
                        update(cfg.key, {
                          rangeEnd: clamp(parseInt(e.target.value, 10), cfg.min, cfg.max),
                        })
                      }
                    />
                    {fieldLabel}
                  </>
                )}
                {f.mode === 'specific' && (
                  <Input
                    className="h-7 flex-1 text-xs"
                    placeholder={t('specificPlaceholder', { min: cfg.min, max: cfg.max })}
                    value={f.specific.join(',')}
                    onChange={(e) =>
                      update(cfg.key, {
                        specific: [
                          ...new Set(
                            e.target.value
                              .split(',')
                              .map((s) => parseInt(s.trim(), 10))
                              .filter((n) => !Number.isNaN(n) && n >= cfg.min && n <= cfg.max),
                          ),
                        ].sort((a, b) => a - b),
                      })
                    }
                  />
                )}
              </div>
            </div>
          )
        })}

        <div className="mt-3 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-base font-semibold">{cron}</code>
            <span className="text-xs text-muted-foreground">{describeCron(cron)}</span>
          </div>
          {runs.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-muted-foreground">{t('recentRuns')}</p>
              <ul className="grid grid-cols-1 gap-0.5 text-xs sm:grid-cols-2">
                {runs.map((d, i) => (
                  <li key={i} className="inline-flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-primary/60" />
                    {dtf.format(d)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
