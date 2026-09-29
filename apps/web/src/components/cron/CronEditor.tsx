// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { getNextRuns, describeCron } from './cron-parser'
import {
  CRON_FIELDS,
  type FieldConfig,
  type FieldKey,
  type FieldState,
  type Mode,
  fieldToCron,
  parseCronToBuilder,
  canVisualizeCron,
} from '@/lib/cron-roundtrip'

const MODES: Mode[] = ['every', 'step', 'range', 'specific']

/** i18n 静态映射表 — 用于消除 `t(\`field.${var}\`)` / `t(\`mode.${var}\`)` 动态拼接 */
const FIELD_KEY: Record<FieldKey, string> = {
  minute: 'field.minute',
  hour: 'field.hour',
  day: 'field.day',
  month: 'field.month',
  weekday: 'field.weekday',
}
const MODE_KEY: Record<Mode, string> = {
  every: 'mode.every',
  step: 'mode.step',
  range: 'mode.range',
  specific: 'mode.specific',
}

/** 兼容旧名:builder 双表示真相源已迁 lib/cron-roundtrip,此处仅做薄别名 */
const FIELDS: FieldConfig[] = [...CRON_FIELDS] as FieldConfig[]

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isNaN(n) ? min : n))
}

interface CronEditorProps {
  value?: string
  onChange?: (cron: string) => void
}

const DEFAULT_CRON = '0 9 * * 1-5'

export function CronEditor({ value, onChange }: CronEditorProps) {
  const t = useTranslations('cronEditor')
  const initial = value ?? DEFAULT_CRON
  const [fields, setFields] = React.useState<Record<FieldKey, FieldState>>(() =>
    parseCronToBuilder(initial),
  )
  /** b75-1#1:外部 value 无法由 builder 无损表达时进入自定义模式,保留原文不静默改写 */
  const [customMode, setCustomMode] = React.useState<boolean>(() => !canVisualizeCron(initial))
  const [customExpr, setCustomExpr] = React.useState<string>(initial)

  const cron = React.useMemo(
    () => FIELDS.map((f) => fieldToCron(fields[f.key])).join(' '),
    [fields],
  )
  /** 对外输出:自定义模式逐字保留原文,可视化模式用 builder 拼出的值 */
  const output = customMode ? customExpr : cron
  const runs = React.useMemo(() => getNextRuns(output, 5), [output])
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
  const lastEmitted = React.useRef(output)

  React.useEffect(() => {
    if (value !== undefined) {
      const visualizable = canVisualizeCron(value)
      setCustomMode(!visualizable)
      if (!visualizable) {
        setCustomExpr(value)
        lastEmitted.current = value
        return
      }
      setFields((prev) => {
        const cur = FIELDS.map((f) => fieldToCron(prev[f.key])).join(' ')
        if (cur === value) return prev
        return parseCronToBuilder(value)
      })
      lastEmitted.current = value
    }
  }, [value])

  React.useEffect(() => {
    if (onChange && output !== lastEmitted.current) {
      lastEmitted.current = output
      onChange(output)
    }
  }, [output, onChange])

  function update(key: FieldKey, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  /** 从自定义模式切回可视化:仅当当前原文可回环时才切换,否则保持自定义 */
  function trySwitchToVisual() {
    if (canVisualizeCron(customExpr)) {
      setFields(parseCronToBuilder(customExpr))
      setCustomMode(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          {t('title')}
          {customMode && (
            <span className="ml-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-normal text-amber-600">
              {t('customFallback', { defaultValue: '自定义表达式' })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {customMode ? (
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              {t('customHint', { defaultValue: '该表达式无法由可视化编辑器无损表达,以下原文逐字保留:' })}
            </p>
            <Input
              value={customExpr}
              onChange={(e) => setCustomExpr(e.target.value)}
              className="font-mono text-sm"
              spellCheck={false}
            />
            {canVisualizeCron(customExpr) && (
              <Button
                size="xs"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={trySwitchToVisual}
              >
                {t('switchToVisual', { defaultValue: '切换到可视化编辑' })}
              </Button>
            )}
          </div>
        ) : (
          FIELDS.map((cfg) => {
          const f = fields[cfg.key]
          const fieldLabel = t(FIELD_KEY[cfg.key] ?? 'field.unknown')
          return (
            <div key={cfg.key} className="flex items-center gap-3 py-1.5">
              <Label className="w-9 shrink-0 text-xs text-muted-foreground">{fieldLabel}</Label>
              <div className="flex gap-1">
                {MODES.map((mode) => (
                  <Button
                    key={mode}
                    size="xs"
                    variant="ghost"
                    className={cn(
                      'px-2 text-xs hover:bg-muted',
                      f.mode === mode && 'bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                    onClick={() => update(cfg.key, { mode })}
                  >
                    {t(MODE_KEY[mode])}
                  </Button>
                ))}
              </div>
              <div className="flex flex-1 min-w-0 items-center gap-2 text-xs text-muted-foreground">
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
        })
        )}

        <div className="mt-3 rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-base font-semibold">{output}</code>
            <span className="text-xs text-muted-foreground">{describeCron(output)}</span>
          </div>
          {runs.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-muted-foreground">{t('recentRuns')}</p>
              <ul className="grid grid-cols-1 gap-0.5 text-xs min-[640px]:grid-cols-2">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
