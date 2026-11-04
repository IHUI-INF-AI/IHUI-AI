// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Download, Loader2 } from 'lucide-react'

import { fetchRaw } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { ClassSelect } from './ClassSelect'

/** 考勤导出(text/csv,后端带 BOM):GET /api/edu-ai-management/attendance/export */
export function ExportButton({
  defaultStartDate,
  defaultEndDate,
  defaultClassId = '',
}: {
  defaultStartDate: string
  defaultEndDate: string
  defaultClassId?: string
}) {
  const t = useTranslations('eduAttendance')
  const [classId, setClassId] = React.useState(defaultClassId)
  const [startDate, setStartDate] = React.useState(defaultStartDate)
  const [endDate, setEndDate] = React.useState(defaultEndDate)
  const [exporting, setExporting] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [failureMessage, setFailureMessage] = React.useState('')

  React.useEffect(() => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    if (defaultClassId) setClassId(defaultClassId)
  }, [defaultStartDate, defaultEndDate, defaultClassId])

  const handleExport = async () => {
    if (!classId || exporting) return
    setExporting(true)
    setFailed(false)
    try {
      const params = new URLSearchParams({
        classId,
        startDate,
        endDate,
        format: 'csv',
      })
      const blob = await fetchRaw(`/api/edu-ai-management/attendance/export?${params.toString()}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-${classId}-${startDate}_${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setFailed(true)
      // 后端可读 message 优先显示,不许静默
      setFailureMessage(error instanceof Error ? error.message.trim() : '')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="font-[weight:inherit] text-label text-muted-foreground">
          {t('classLabel')}
        </Label>
        <ClassSelect value={classId} onChange={setClassId} />
      </div>
      <div className="grid gap-1.5">
        <Label className="font-[weight:inherit] text-label text-muted-foreground">
          {t('startDate')}
        </Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-36"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="font-[weight:inherit] text-label text-muted-foreground">
          {t('endDate')}
        </Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-36"
        />
      </div>
      <Button size="sm" variant="outline" onClick={handleExport} disabled={!classId || exporting}>
        {exporting ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1 h-3.5 w-3.5" />
        )}
        {t('exportCsv')}
      </Button>
      {failed && <Alert variant="danger" description={failureMessage || t('exportFailed')} />}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
