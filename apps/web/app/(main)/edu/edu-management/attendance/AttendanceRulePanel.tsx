// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Save } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Alert } from '@/components/feedback'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@ihui/ui-react'
import { ClassSelect } from './ClassSelect'

/**
 * `GET/PUT /api/edu-ai-management/attendance/rule` 的出参投影(现读 edu-ai-management.ts
 * 的 toAttendanceRuleDto):**不含 qrSecret 原文**,只有 qrSecretConfigured 布尔。
 * createdAt/updatedAt 后端回 Date(Fastify 序列化成 ISO 字符串),界面不渲染它们,故留 optional。
 */
export interface AttendanceRuleDto {
  id: string
  classId: string
  lateAfter: string | null
  earlyBefore: string | null
  absentAfter: string | null
  enabled: boolean
  qrSecretConfigured: boolean
}

/** 三个阈值的字段名与词条键同源,禁止在别处再抄一份字段清单 */
const THRESHOLDS = [
  { field: 'lateAfter', labelKey: 'ruleLateAfter' },
  { field: 'earlyBefore', labelKey: 'ruleEarlyBefore' },
  { field: 'absentAfter', labelKey: 'ruleAbsentAfter' },
] as const

type ThresholdField = (typeof THRESHOLDS)[number]['field']
type Draft = Partial<Record<ThresholdField, string>>

/** 用户改过的字段存草稿;未改的字段一律以服务端现值为准(切班即清空,防跨班串味) */
export function AttendanceRulePanel({
  classId,
  onClassChange,
}: {
  /** 传入则复用外部班级口径;不传则面板自带 ClassSelect(自成一格) */
  classId?: string
  onClassChange?: (v: string) => void
} = {}) {
  const t = useTranslations('eduAttendance')
  const qc = useQueryClient()

  const [innerClassId, setInnerClassId] = React.useState('')
  const selectedClassId = classId ?? innerClassId
  const handleClassChange = onClassChange ?? setInnerClassId

  const [draft, setDraft] = React.useState<Draft>({})
  const [enabledDraft, setEnabledDraft] = React.useState<boolean | null>(null)
  const [savedTip, setSavedTip] = React.useState('')

  const ruleQuery = useQuery({
    queryKey: ['edu-attendance-rule', selectedClassId],
    queryFn: () =>
      apiOrThrow<{ rule: AttendanceRuleDto | null }>(
        `/api/edu-ai-management/attendance/rule?classId=${encodeURIComponent(selectedClassId)}`,
      ),
    enabled: Boolean(selectedClassId),
  })
  const rule = ruleQuery.data?.rule ?? null

  React.useEffect(() => {
    setDraft({})
    setEnabledDraft(null)
    setSavedTip('')
  }, [selectedClassId])

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiOrThrow<{ rule: AttendanceRuleDto | null }>('/api/edu-ai-management/attendance/rule', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setDraft({})
      setEnabledDraft(null)
      setSavedTip(t('ruleSaved'))
      void qc.invalidateQueries({ queryKey: ['edu-attendance-rule', selectedClassId] })
    },
  })

  const valueOf = (field: ThresholdField): string => draft[field] ?? rule?.[field] ?? ''
  const enabled = enabledDraft ?? rule?.enabled ?? false

  function submit() {
    setSavedTip('')
    // 空串会被后端 z.string().min(1) 判 400,故留空 = 不提交该字段(= 不改)
    const body: Record<string, unknown> = { classId: selectedClassId, enabled }
    for (const { field } of THRESHOLDS) {
      const raw = valueOf(field).trim()
      if (raw) body[field] = raw
    }
    saveMutation.mutate(body)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t('rulePanelTitle')}</CardTitle>
        {classId === undefined ? (
          <ClassSelect
            value={selectedClassId}
            onChange={handleClassChange}
            triggerClassName="w-40"
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedClassId && <p className="text-xs text-muted-foreground">{t('ruleClassHint')}</p>}

        {ruleQuery.error ? (
          <Alert variant="danger" description={String((ruleQuery.error as Error).message)} />
        ) : rule === null && !ruleQuery.isLoading ? (
          <Alert variant="warning" description={t('ruleNotConfigured')} />
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          {THRESHOLDS.map(({ field, labelKey }) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`att-rule-${field}`} className="text-xs text-muted-foreground">
                {t(labelKey)}
              </Label>
              <Input
                id={`att-rule-${field}`}
                value={valueOf(field)}
                onChange={(e) => {
                  setSavedTip('')
                  setDraft((d) => ({ ...d, [field]: e.target.value }))
                }}
                placeholder={t('ruleNotConfigured')}
                inputMode="numeric"
                autoComplete="off"
                className="w-32"
              />
            </div>
          ))}
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="att-rule-enabled"
              checked={enabled}
              onCheckedChange={(v) => {
                setSavedTip('')
                setEnabledDraft(v)
              }}
            />
            <Label htmlFor="att-rule-enabled" className="text-xs">
              {t('ruleEnabledLabel')}
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={submit} disabled={!selectedClassId || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            {t('ruleSave')}
          </Button>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t('ruleTimeHint')}
          </span>
          {rule && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {t('ruleQrSecretState')}
              {rule.qrSecretConfigured ? t('ruleQrSecretOn') : t('ruleQrSecretOff')}
            </span>
          )}
        </div>

        {savedTip && <p className="text-xs text-emerald-600 dark:text-emerald-500">{savedTip}</p>}
        {saveMutation.error ? (
          <Alert
            variant="danger"
            description={String((saveMutation.error as Error).message)}
            action={<p className="text-xs">{t('ruleTimeHint')}</p>}
          />
        ) : null}
        {rule && !rule.qrSecretConfigured && (
          <Alert variant="info" description={t('ruleQrSecretGuide')} />
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
