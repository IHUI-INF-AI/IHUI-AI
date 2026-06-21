import { StorageManager } from '@/utils/storage'

interface TourReport {
  title: string
  generatedAt: number
  summary: ReportSummary
  tours: TourReportItem[]
  charts: ChartData[]
}

interface ReportSummary {
  totalTours: number
  totalSessions: number
  averageCompletionRate: number
  averageDuration: number
  topPerformingTour: string | null
  period: {
    start: number
    end: number
  }
}

interface TourReportItem {
  tourId: string
  tourName: string
  sessions: number
  completions: number
  completionRate: number
  averageDuration: number
  skipRate: number
  stepStats: StepStat[]
}

interface StepStat {
  stepId: string
  stepTitle: string
  avgDuration: number
  skipCount: number
  completionCount: number
}

interface ChartData {
  type: 'funnel' | 'line' | 'bar' | 'pie'
  title: string
  data: Record<string, unknown>
}

interface AnalyticsRecord {
  tourId: string
  startTime: number
  endTime?: number
  completed: boolean
  steps?: { stepId: string; duration: number; skipped: boolean }[]
  stepData?: { stepId: string; duration?: number; action?: string }[]
  skipped?: boolean
  [key: string]: any
}

const STORAGE_KEY = 'tour_reports'

class TourReportService {
  generateReport(tourIds?: string[]): TourReport {
    const allRecords = this.getAllAnalyticsRecords()
    const filteredRecords = tourIds 
      ? allRecords.filter(r => tourIds.includes(r.tourId))
      : allRecords

    const now = Date.now()
    const periodStart = now - 30 * 24 * 60 * 60 * 1000

    const summary = this.calculateSummary(filteredRecords, periodStart, now)
    const tours = this.calculateTourStats(filteredRecords)
    const charts = this.generateChartData(filteredRecords)

    const report: TourReport = {
      title: '引导系统分析报告',
      generatedAt: now,
      summary,
      tours,
      charts,
    }

    this.saveReport(report)
    return report
  }

  private getAllAnalyticsRecords(): AnalyticsRecord[] {
    const records: AnalyticsRecord[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('tour_analytics_records_')) {
        const data = StorageManager.getItem<AnalyticsRecord[]>(key)
        if (Array.isArray(data)) {
          records.push(...data)
        }
      }
    }
    return records
  }

  private calculateSummary(records: AnalyticsRecord[], start: number, end: number): ReportSummary {
    const filteredRecords = records.filter(r => r.startTime >= start && r.startTime <= end)
    const uniqueTours = new Set(filteredRecords.map(r => r.tourId))
    const completedRecords = filteredRecords.filter(r => r.completed)
    
    const durations = filteredRecords
      .filter(r => r.completed && r.endTime)
      .map(r => r.endTime! - r.startTime)
    
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0

    const tourCompletionRates: Record<string, { total: number; completed: number }> = {}
    filteredRecords.forEach(r => {
      if (!tourCompletionRates[r.tourId]) {
        tourCompletionRates[r.tourId] = { total: 0, completed: 0 }
      }
      tourCompletionRates[r.tourId].total++
      if (r.completed) {
        tourCompletionRates[r.tourId].completed++
      }
    })

    let topTour: string | null = null
    let topRate = 0
    Object.entries(tourCompletionRates).forEach(([tourId, stats]) => {
      const rate = stats.completed / stats.total
      if (rate > topRate && stats.total >= 5) {
        topRate = rate
        topTour = tourId
      }
    })

    return {
      totalTours: uniqueTours.size,
      totalSessions: filteredRecords.length,
      averageCompletionRate: filteredRecords.length > 0
        ? completedRecords.length / filteredRecords.length
        : 0,
      averageDuration: avgDuration,
      topPerformingTour: topTour,
      period: { start, end },
    }
  }

  private calculateTourStats(records: AnalyticsRecord[]): TourReportItem[] {
    const tourMap: Record<string, {
      sessions: number
      completions: number
      skips: number
      durations: number[]
      steps: Record<string, { durations: number[]; skips: number; completions: number }>
    }> = {}

    records.forEach(r => {
      if (!tourMap[r.tourId]) {
        tourMap[r.tourId] = {
          sessions: 0,
          completions: 0,
          skips: 0,
          durations: [],
          steps: {},
        }
      }
      
      tourMap[r.tourId].sessions++
      if (r.completed) {
        tourMap[r.tourId].completions++
        if (r.endTime) {
          tourMap[r.tourId].durations.push(r.endTime - r.startTime)
        }
      }
      if (r.skipped) {
        tourMap[r.tourId].skips++
      }

      if (r.stepData && Array.isArray(r.stepData)) {
        r.stepData.forEach((step: { stepId: string; duration?: number; action?: string }) => {
          if (!tourMap[r.tourId].steps[step.stepId]) {
            tourMap[r.tourId].steps[step.stepId] = {
              durations: [],
              skips: 0,
              completions: 0,
            }
          }
          if (step.duration) {
            tourMap[r.tourId].steps[step.stepId].durations.push(step.duration)
          }
          if (step.action === 'skip') {
            tourMap[r.tourId].steps[step.stepId].skips++
          }
          if (step.action === 'complete') {
            tourMap[r.tourId].steps[step.stepId].completions++
          }
        })
      }
    })

    return Object.entries(tourMap).map(([tourId, stats]) => ({
      tourId,
      tourName: this.getTourName(tourId),
      sessions: stats.sessions,
      completions: stats.completions,
      completionRate: stats.sessions > 0 ? stats.completions / stats.sessions : 0,
      averageDuration: stats.durations.length > 0
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : 0,
      skipRate: stats.sessions > 0 ? stats.skips / stats.sessions : 0,
      stepStats: Object.entries(stats.steps).map(([stepId, stepStats]) => ({
        stepId,
        stepTitle: this.getStepTitle(tourId, stepId),
        avgDuration: stepStats.durations.length > 0
          ? stepStats.durations.reduce((a, b) => a + b, 0) / stepStats.durations.length
          : 0,
        skipCount: stepStats.skips,
        completionCount: stepStats.completions,
      })),
    }))
  }

  private getTourName(tourId: string): string {
    const names: Record<string, string> = {
      'feature-tour': '功能引导',
      'settings-tour': '设置引导',
      'vip-tour': 'VIP引导',
    }
    return names[tourId] || tourId
  }

  private getStepTitle(tourId: string, stepId: string): string {
    return stepId
  }

  private generateChartData(records: AnalyticsRecord[]): ChartData[] {
    return [
      this.generateFunnelChart(records),
      this.generateTrendChart(records),
      this.generateDurationChart(records),
    ]
  }

  private generateFunnelChart(records: AnalyticsRecord[]): ChartData {
    const total = records.length
    const started = records.filter(r => r.startTime).length
    const completed = records.filter(r => r.completed).length
    const skipped = records.filter(r => r.skipped).length

    return {
      type: 'funnel',
      title: '完成漏斗',
      data: {
        stages: [
          { name: '开始', count: started, percentage: 100 },
          { name: '完成', count: completed, percentage: total > 0 ? (completed / total * 100) : 0 },
          { name: '跳过', count: skipped, percentage: total > 0 ? (skipped / total * 100) : 0 },
        ],
      },
    }
  }

  private generateTrendChart(records: AnalyticsRecord[]): ChartData {
    const dailyData: Record<string, { starts: number; completions: number }> = {}
    
    records.forEach(r => {
      const date = new Date(r.startTime).toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = { starts: 0, completions: 0 }
      }
      dailyData[date].starts++
      if (r.completed) {
        dailyData[date].completions++
      }
    })

    const sortedDates = Object.keys(dailyData).sort()
    const last7Days = sortedDates.slice(-7)

    return {
      type: 'line',
      title: '趋势图',
      data: {
        labels: last7Days,
        datasets: [
          {
            label: '开始次数',
            data: last7Days.map(d => dailyData[d].starts),
          },
          {
            label: '完成次数',
            data: last7Days.map(d => dailyData[d].completions),
          },
        ],
      },
    }
  }

  private generateDurationChart(records: AnalyticsRecord[]): ChartData {
    const tourDurations: Record<string, number[]> = {}
    
    records.filter(r => r.completed && r.endTime).forEach(r => {
      if (!tourDurations[r.tourId]) {
        tourDurations[r.tourId] = []
      }
      tourDurations[r.tourId].push((r.endTime as number) - r.startTime)
    })

    return {
      type: 'bar',
      title: '平均完成时间',
      data: {
        labels: Object.keys(tourDurations),
        datasets: [
          {
            label: '平均时间(秒)',
            data: Object.values(tourDurations).map(durations => 
              Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
            ),
          },
        ],
      },
    }
  }

  private saveReport(report: TourReport): void {
    const reports = StorageManager.getItem<TourReport[]>(STORAGE_KEY) || []
    reports.push(report)
    if (reports.length > 10) {
      reports.shift()
    }
    StorageManager.setItem(STORAGE_KEY, reports)
  }

  getReportHistory(): TourReport[] {
    return StorageManager.getItem<TourReport[]>(STORAGE_KEY) || []
  }

  exportToPDF(report: TourReport): string {
    const pdfContent = this.generatePDFContent(report)
    return pdfContent
  }

  private generatePDFContent(report: TourReport): string {
    const lines: string[] = []
    
    lines.push('═'.repeat(50))
    lines.push(report.title)
    lines.push('═'.repeat(50))
    lines.push('')
    lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`)
    lines.push(`统计周期: ${new Date(report.summary.period.start).toLocaleDateString('zh-CN')} - ${new Date(report.summary.period.end).toLocaleDateString('zh-CN')}`)
    lines.push('')
    lines.push('─'.repeat(50))
    lines.push('概要统计')
    lines.push('─'.repeat(50))
    lines.push(`引导总数: ${report.summary.totalTours}`)
    lines.push(`会话总数: ${report.summary.totalSessions}`)
    lines.push(`平均完成率: ${(report.summary.averageCompletionRate * 100).toFixed(1)}%`)
    lines.push(`平均完成时间: ${Math.round(report.summary.averageDuration / 1000)}秒`)
    lines.push(`最佳引导: ${report.summary.topPerformingTour || '无'}`)
    lines.push('')
    
    lines.push('─'.repeat(50))
    lines.push('引导详情')
    lines.push('─'.repeat(50))
    
    report.tours.forEach(tour => {
      lines.push(``)
      lines.push(`【${tour.tourName}】`)
      lines.push(`  会话数: ${tour.sessions}`)
      lines.push(`  完成数: ${tour.completions}`)
      lines.push(`  完成率: ${(tour.completionRate * 100).toFixed(1)}%`)
      lines.push(`  平均时间: ${Math.round(tour.averageDuration / 1000)}秒`)
      lines.push(`  跳过率: ${(tour.skipRate * 100).toFixed(1)}%`)
      
      if (tour.stepStats.length > 0) {
        lines.push(`  步骤统计:`)
        tour.stepStats.forEach(step => {
          lines.push(`    - ${step.stepTitle}: 平均${Math.round(step.avgDuration / 1000)}秒, 完成${step.completionCount}次`)
        })
      }
    })
    
    lines.push('')
    lines.push('─'.repeat(50))
    lines.push('图表数据')
    lines.push('─'.repeat(50))
    
    report.charts.forEach(chart => {
      lines.push(``)
      lines.push(`【${chart.title}】`)
      lines.push(JSON.stringify(chart.data, null, 2))
    })
    
    lines.push('')
    lines.push('═'.repeat(50))
    lines.push('报告结束')
    lines.push('═'.repeat(50))
    
    return lines.join('\n')
  }

  downloadReport(report: TourReport, format: 'txt' | 'json' = 'txt'): void {
    let content: string
    let filename: string
    let mimeType: string

    if (format === 'json') {
      content = JSON.stringify(report, null, 2)
      filename = `tour-report-${Date.now()}.json`
      mimeType = 'application/json'
    } else {
      content = this.exportToPDF(report)
      filename = `tour-report-${Date.now()}.txt`
      mimeType = 'text/plain'
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
  }

  scheduleReport(interval: 'daily' | 'weekly' | 'monthly'): void {
    const config = StorageManager.getItem<Record<string, unknown>>('tour_report_schedule') || {}
    config.enabled = true
    config.interval = interval
    config.lastRun = Date.now()
    StorageManager.setItem('tour_report_schedule', config)
  }

  cancelScheduledReport(): void {
    StorageManager.removeItem('tour_report_schedule')
  }

  getScheduledReport(): { enabled: boolean; interval: string; lastRun: number } | null {
    return StorageManager.getItem('tour_report_schedule')
  }
}

export const tourReportService = new TourReportService()
