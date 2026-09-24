// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bot,
  Check,
  Copy,
  FileJson,
  HeartPulse,
  Info,
  Loader2,
  ScrollText,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import {
  runDeployDiagnosis,
  type DeployDiagnosisInput,
  type DeployDiagnosisReport,
} from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Button } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { BackButton } from '@/components/common'

interface InputSection {
  key: keyof DeployDiagnosisInput
  icon: LucideIcon
  labelKey: string
  hintKey: string
  rows: number
}

const SECTIONS: InputSection[] = [
  {
    key: 'deployResult',
    icon: FileJson,
    labelKey: 'deployResult',
    hintKey: 'deployResultHint',
    rows: 3,
  },
  {
    key: 'healthJson',
    icon: HeartPulse,
    labelKey: 'healthJson',
    hintKey: 'healthJsonHint',
    rows: 5,
  },
  { key: 'logTail', icon: ScrollText, labelKey: 'logTail', hintKey: 'logTailHint', rows: 6 },
  {
    key: 'containerLogs',
    icon: Wrench,
    labelKey: 'containerLogs',
    hintKey: 'containerLogsHint',
    rows: 6,
  },
]

export default function DeployDiagnosisPage() {
  const t = useTranslations('admin.deployDiagnosis')

  const [inputs, setInputs] = React.useState<DeployDiagnosisInput>({
    deployResult: '',
    healthJson: '',
    logTail: '',
    containerLogs: '',
  })
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [report, setReport] = React.useState<DeployDiagnosisReport | null>(null)
  const [meta, setMeta] = React.useState<{ model?: string | null; durationMs?: number } | null>(
    null,
  )
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null)

  const hasInput = Object.values(inputs).some((v) => v.trim().length > 0)

  const handleRun = async () => {
    if (!hasInput || running) return
    setRunning(true)
    setError(null)
    setReport(null)
    setMeta(null)
    try {
      const payload: DeployDiagnosisInput = {}
      for (const s of SECTIONS) {
        const v = inputs[s.key]?.trim()
        if (v) payload[s.key] = v
      }
      const r = await runDeployDiagnosis(payload)
      if (!r.success || !r.data) {
        throw new Error(r.error || 'diagnosis failed')
      }
      setReport(r.data.report)
      setMeta({ model: r.data.model, durationMs: r.data.durationMs })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const handleCopy = async (cmd: string, index: number) => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)
    } catch {
      // 剪贴板不可用时静默失败(禁用原生 alert)
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bot className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 浏览器无法读服务器文件,必须手动粘贴 */}
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('pasteNote')}</span>
      </div>

      {/* 四个输入区 */}
      <div className="space-y-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(s.labelKey)}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t(s.hintKey)}</p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={inputs[s.key] ?? ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  rows={s.rows}
                  className="font-mono text-xs"
                  placeholder={t(s.hintKey)}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 开始诊断 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleRun} disabled={!hasInput || running} size="default">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('running')}
            </>
          ) : (
            <>
              <Bot className="mr-2 h-4 w-4" />
              {t('run')}
            </>
          )}
        </Button>
      </div>

      {/* 诊断结果 */}
      {report ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('reportTitle')}</h2>
            <span className="text-xs text-muted-foreground">
              {meta?.model ? `${t('model')}: ${meta.model}` : ''}
              {meta?.model && meta.durationMs !== undefined ? ' · ' : ''}
              {meta?.durationMs !== undefined ? `${t('duration')}: ${meta.durationMs}ms` : ''}
            </span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('rootCause')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{report.rootCause || '-'}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('impact')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{report.impact || '-'}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {t('fixCommands')}
                {report.fixCommands.length === 0 ? ' (0)' : ` (${report.fixCommands.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.fixCommands.length === 0 ? (
                <span className="text-sm text-muted-foreground">-</span>
              ) : (
                report.fixCommands.map((cmd, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs">
                      {cmd}
                    </code>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => handleCopy(cmd, i)}
                      aria-label={t('copy')}
                    >
                      {copiedIndex === i ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('summary')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{report.summary || '-'}</CardContent>
          </Card>

          {!report.parseOk && report.raw && (
            <div className="rounded-lg border border-dashed p-3">
              <p className="mb-2 text-xs text-muted-foreground">{t('rawNote')}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">
                {report.raw}
              </pre>
            </div>
          )}
        </div>
      ) : (
        !running && (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        )
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
