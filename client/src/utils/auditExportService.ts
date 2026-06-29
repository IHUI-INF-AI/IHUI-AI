import { logger } from './logger'
import type { SecurityLogEntry } from './securityLogService'

export interface AuditExportOptions {
  format: 'json' | 'csv' | 'pdf'
  dateRange?: {
    start: Date
    end: Date
  }
  types?: string[]
  includeDeviceInfo?: boolean
}

export interface AuditReport {
  generatedAt: string
  dateRange: {
    start: string
    end: string
  }
  totalEvents: number
  summary: {
    logins: number
    failedLogins: number
    passwordChanges: number
    deviceRemovals: number
    suspiciousActivities: number
  }
  events: SecurityLogEntry[]
  recommendations: string[]
}

function generateSummary(events: SecurityLogEntry[]): AuditReport['summary'] {
  return {
    logins: events.filter(e => e.type === 'login' && e.success).length,
    failedLogins: events.filter(e => e.type === 'login' && !e.success).length,
    passwordChanges: events.filter(e => e.type === 'password_change').length,
    deviceRemovals: events.filter(e => e.type === 'device_remove').length,
    suspiciousActivities: events.filter(e => e.type === 'suspicious_login').length,
  }
}

function generateRecommendations(summary: AuditReport['summary']): string[] {
  const recommendations: string[] = []

  if (summary.failedLogins > 5) {
    recommendations.push('检测到多次登录失败，建议检查账户是否被攻击或修改密码')
  }

  if (summary.suspiciousActivities > 0) {
    recommendations.push('检测到可疑登录活动，建议启用双因素认证')
  }

  if (summary.passwordChanges === 0) {
    recommendations.push('建议定期修改密码以提高账户安全性')
  }

  if (summary.deviceRemovals > 3) {
    recommendations.push('近期多次移除设备，请确认是否为本人操作')
  }

  return recommendations
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const AuditExportService = {
  generateReport(
    events: SecurityLogEntry[],
    options: AuditExportOptions
  ): AuditReport {
    let filteredEvents = [...events]

    if (options.dateRange) {
      const startTime = options.dateRange.start.getTime()
      const endTime = options.dateRange.end.getTime()
      filteredEvents = filteredEvents.filter(
        e => e.timestamp >= startTime && e.timestamp <= endTime
      )
    }

    if (options.types && options.types.length > 0) {
      filteredEvents = filteredEvents.filter(e => options.types!.includes(e.type))
    }

    const summary = generateSummary(filteredEvents)
    const recommendations = generateRecommendations(summary)

    return {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: options.dateRange?.start.toISOString() || new Date(0).toISOString(),
        end: options.dateRange?.end.toISOString() || new Date().toISOString(),
      },
      totalEvents: filteredEvents.length,
      summary,
      events: filteredEvents,
      recommendations,
    }
  },

  exportToJSON(report: AuditReport): string {
    return JSON.stringify(report, null, 2)
  },

  exportToCSV(events: SecurityLogEntry[]): string {
    const headers = ['ID', '类型', '时间', '设备名称', 'IP地址', '成功', '详情']
    const rows = events.map(e => [
      escapeCSV(e.id),
      escapeCSV(e.type),
      escapeCSV(new Date(e.timestamp).toLocaleString()),
      escapeCSV(e.deviceName || ''),
      escapeCSV(e.ipAddress || ''),
      escapeCSV(e.success ? '是' : '否'),
      escapeCSV(e.details || ''),
    ])

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  },

  downloadReport(report: AuditReport, format: 'json' | 'csv'): void {
    let content: string
    let filename: string
    let mimeType: string

    if (format === 'json') {
      content = this.exportToJSON(report)
      filename = `security-audit-${Date.now()}.json`
      mimeType = 'application/json'
    } else {
      content = this.exportToCSV(report.events)
      filename = `security-audit-${Date.now()}.csv`
      mimeType = 'text/csv'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.info('[AuditExportService] Audit report exported', { format, filename })
  },

  generatePDFReport(report: AuditReport): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '                    安全审计报告',
      '═══════════════════════════════════════════════════════════════',
      '',
      `生成时间: ${new Date(report.generatedAt).toLocaleString()}`,
      `时间范围: ${new Date(report.dateRange.start).toLocaleString()} - ${new Date(report.dateRange.end).toLocaleString()}`,
      `事件总数: ${report.totalEvents}`,
      '',
      '───────────────────────────────────────────────────────────────',
      '                         统计摘要',
      '───────────────────────────────────────────────────────────────',
      `成功登录: ${report.summary.logins}`,
      `失败登录: ${report.summary.failedLogins}`,
      `密码修改: ${report.summary.passwordChanges}`,
      `设备移除: ${report.summary.deviceRemovals}`,
      `可疑活动: ${report.summary.suspiciousActivities}`,
      '',
    ]

    if (report.recommendations.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('                       安全建议')
      lines.push('───────────────────────────────────────────────────────────────')
      report.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`)
      })
      lines.push('')
    }

    if (report.events.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push('                       事件详情')
      lines.push('───────────────────────────────────────────────────────────────')
      report.events.slice(0, 50).forEach((event, i) => {
        lines.push(`[${i + 1}] ${event.type.toUpperCase()}`)
        lines.push(`    时间: ${new Date(event.timestamp).toLocaleString()}`)
        if (event.deviceName) lines.push(`    设备: ${event.deviceName}`)
        if (event.ipAddress) lines.push(`    IP: ${event.ipAddress}`)
        lines.push(`    状态: ${event.success ? '成功' : '失败'}`)
        lines.push('')
      })
    }

    lines.push('═══════════════════════════════════════════════════════════════')
    lines.push('                    报告结束')
    lines.push('═══════════════════════════════════════════════════════════════')

    return lines.join('\n')
  },
}
