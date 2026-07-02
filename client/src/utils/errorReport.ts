export interface ErrorReportInput {
  source: string
  message?: string
  stack?: string
  path?: string
  url?: string
  userAgent?: string
  platform?: string
  extra?: Record<string, unknown>
}

const pad2 = (n: number): string => n.toString().padStart(2, '0')

const formatTimestamp = (date: Date = new Date()): string => {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  )
}

const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const buildErrorReport = (input: ErrorReportInput): string => {
  const lines: string[] = []
  lines.push(`## 错误日志 (${input.source})`)
  lines.push('')
  lines.push(`- 时间: ${formatTimestamp()}`)
  if (input.path) lines.push(`- 路径: ${input.path}`)
  if (input.url) lines.push(`- URL: ${input.url}`)
  if (input.platform) lines.push(`- 平台: ${input.platform}`)
  if (input.userAgent) lines.push(`- UserAgent: ${input.userAgent}`)
  lines.push('')
  lines.push('### 错误信息')
  lines.push('')
  lines.push(safeString(input.message) || '(无)')
  lines.push('')
  if (input.stack) {
    lines.push('### 错误堆栈')
    lines.push('')
    lines.push('```')
    lines.push(input.stack)
    lines.push('```')
    lines.push('')
  }
  if (input.extra && Object.keys(input.extra).length > 0) {
    lines.push('### 附加信息')
    lines.push('')
    lines.push('```json')
    lines.push(safeString(input.extra))
    lines.push('```')
    lines.push('')
  }
  return lines.join('\n')
}

export const collectBrowserContext = () => {
  if (typeof window === 'undefined') {
    return { userAgent: '', platform: '' }
  }
  return {
    userAgent: window.navigator?.userAgent ?? '',
    platform:
      (window.navigator as Navigator & { userAgentData?: { platform?: string } })?.userAgentData
        ?.platform ?? window.navigator?.platform ?? '',
  }
}
