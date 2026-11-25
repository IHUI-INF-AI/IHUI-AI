// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// WATERMARK_PLACEHOLDER

'use client'

import * as React from 'react'
import { FileDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ShareToolCall } from '@ihui/api-client/endpoints/share'

/**
 * ExportAuditReport — 审计报告导出(P3 #39 阶段2,2026-09-16 立)。
 *
 * 把分享快照的执行轨迹(白名单字段)序列化为 Markdown 文本并触发 .md 下载。
 * 公开只读场景的审计语义:任何人拿到分享链接都能导出 agent 执行过程的
 * 结构化记录(序号/工具名/状态/耗时),无需登录或额外权限。
 */
export function ExportAuditReport({
  question,
  toolCalls,
}: {
  question: string
  toolCalls: ShareToolCall[]
}) {
  const t = useTranslations('shareContentPage')

  const handleExport = () => {
    const lines: string[] = [
      `# ${t('auditReportTitle')}`,
      '',
      `- ${t('auditQuestion')}: ${question || '—'}`,
      `- ${t('auditExportedAt')}: ${new Date().toISOString()}`,
      `- ${t('auditStepCount')}: ${toolCalls.length}`,
      '',
      `| ${t('auditColStep')} | ${t('auditColTool')} | ${t('auditColStatus')} | ${t('auditColDuration')} |`,
      '| --- | --- | --- | --- |',
      ...toolCalls.map(
        (c, i) =>
          `| ${i + 1} | \`${c.toolName}\` | ${t(`auditStatus_${c.status}` as 'auditStatus_success')} | ${c.durationMs !== undefined ? `${c.durationMs}ms` : '—'} |`,
      ),
      '',
      `> ${t('auditFooter')}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-report-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      data-testid="export-audit-report"
      className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
    >
      <FileDown className="h-3 w-3" aria-hidden />
      {t('auditExportBtn')}
    </button>
  )
}

export default ExportAuditReport
