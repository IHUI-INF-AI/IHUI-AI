import { StorageManager } from '@/utils/storage'

export interface HeatmapPoint {
  x: number
  y: number
  value: number
  selector?: string
  page?: string
}

export interface ClickData {
  x: number
  y: number
  selector: string
  page: string
  timestamp: number
  tourId: string
  stepId: string
}

export interface UserPath {
  sessionId: string
  tourId: string
  steps: PathStep[]
  startTime: number
  endTime?: number
  completed: boolean
}

export interface PathStep {
  stepId: string
  action: 'view' | 'click' | 'skip' | 'complete'
  timestamp: number
  duration: number
  element?: string
}

export interface RealtimeStats {
  activeUsers: number
  activeTours: number
  completionsLastHour: number
  averageDuration: number
  topTours: { tourId: string; count: number }[]
  recentEvents: RecentEvent[]
}

export interface RecentEvent {
  type: 'start' | 'complete' | 'skip' | 'step'
  tourId: string
  stepId?: string
  timestamp: number
}

const CLICK_STORAGE_KEY = 'tour_heatmap_clicks'
const PATH_STORAGE_KEY = 'tour_user_paths'
const _REALTIME_KEY = 'tour_realtime_stats'

class TourVisualizationService {
  private clicks: ClickData[] = []
  private paths: UserPath[] = []
  private realtimeListeners: ((stats: RealtimeStats) => void)[] = []
  private updateInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.loadData()
  }

  private loadData(): void {
    this.clicks = StorageManager.getItem<ClickData[]>(CLICK_STORAGE_KEY) || []
    this.paths = StorageManager.getItem<UserPath[]>(PATH_STORAGE_KEY) || []
  }

  private saveClicks(): void {
    StorageManager.setItem(CLICK_STORAGE_KEY, this.clicks.slice(-10000))
  }

  private savePaths(): void {
    StorageManager.setItem(PATH_STORAGE_KEY, this.paths.slice(-1000))
  }

  recordClick(data: Omit<ClickData, 'timestamp'>): void {
    this.clicks.push({
      ...data,
      timestamp: Date.now(),
    })
    this.saveClicks()
    this.notifyRealtimeUpdate({
      type: 'step',
      tourId: data.tourId,
      stepId: data.stepId,
      timestamp: Date.now(),
    })
  }

  getHeatmapData(options: {
    page?: string
    tourId?: string
    selector?: string
    timeRange?: { start: number; end: number }
  }): HeatmapPoint[] {
    let filtered = [...this.clicks]

    if (options.page) {
      filtered = filtered.filter(c => c.page === options.page)
    }
    if (options.tourId) {
      filtered = filtered.filter(c => c.tourId === options.tourId)
    }
    if (options.selector) {
      filtered = filtered.filter(c => c.selector === options.selector)
    }
    if (options.timeRange) {
      filtered = filtered.filter(c => 
        c.timestamp >= options.timeRange!.start && 
        c.timestamp <= options.timeRange!.end
      )
    }

    const grid: Record<string, { x: number; y: number; count: number }> = {}
    const gridSize = 20

    filtered.forEach(click => {
      const gridX = Math.floor(click.x / gridSize) * gridSize
      const gridY = Math.floor(click.y / gridSize) * gridSize
      const key = `${gridX}-${gridY}`

      if (!grid[key]) {
        grid[key] = { x: gridX, y: gridY, count: 0 }
      }
      grid[key].count++
    })

    return Object.values(grid).map(g => ({
      x: g.x,
      y: g.y,
      value: g.count,
    }))
  }

  getClickDensity(selector: string): number {
    const clicks = this.clicks.filter(c => c.selector === selector)
    return clicks.length
  }

  getTopClickedElements(limit: number = 10): { selector: string; count: number }[] {
    const counts: Record<string, number> = {}
    
    this.clicks.forEach(click => {
      counts[click.selector] = (counts[click.selector] || 0) + 1
    })

    return Object.entries(counts)
      .map(([selector, count]) => ({ selector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  startPath(sessionId: string, tourId: string): void {
    const path: UserPath = {
      sessionId,
      tourId,
      steps: [],
      startTime: Date.now(),
      completed: false,
    }
    this.paths.push(path)
    this.savePaths()
    this.notifyRealtimeUpdate({
      type: 'start',
      tourId,
      timestamp: Date.now(),
    })
  }

  recordPathStep(
    sessionId: string,
    step: Omit<PathStep, 'timestamp'>
  ): void {
    const path = this.paths.find(p => p.sessionId === sessionId)
    if (path) {
      path.steps.push({
        ...step,
        timestamp: Date.now(),
      })
      this.savePaths()
    }
  }

  completePath(sessionId: string): void {
    const path = this.paths.find(p => p.sessionId === sessionId)
    if (path) {
      path.completed = true
      path.endTime = Date.now()
      this.savePaths()
      this.notifyRealtimeUpdate({
        type: 'complete',
        tourId: path.tourId,
        timestamp: Date.now(),
      })
    }
  }

  getUserPaths(tourId?: string): UserPath[] {
    let filtered = [...this.paths]
    if (tourId) {
      filtered = filtered.filter(p => p.tourId === tourId)
    }
    return filtered
  }

  getPathAnalysis(tourId: string): {
    totalPaths: number
    completedPaths: number
    averageSteps: number
    averageDuration: number
    commonPatterns: string[][]
    dropOffPoints: { stepId: string; count: number }[]
  } {
    const paths = this.getUserPaths(tourId)
    const completed = paths.filter(p => p.completed)
    
    const totalSteps = paths.reduce((sum, p) => sum + p.steps.length, 0)
    const totalDuration = paths.reduce((sum, p) => {
      if (p.endTime) {
        return sum + (p.endTime - p.startTime)
      }
      return sum
    }, 0)

    const patterns: Record<string, number> = {}
    paths.forEach(path => {
      const pattern = path.steps.map(s => s.stepId)
      const key = pattern.join(' -> ')
      patterns[key] = (patterns[key] || 0) + 1
    })

    const dropOff: Record<string, number> = {}
    paths.filter(p => !p.completed).forEach(path => {
      if (path.steps.length > 0) {
        const lastStep = path.steps[path.steps.length - 1].stepId
        dropOff[lastStep] = (dropOff[lastStep] || 0) + 1
      }
    })

    return {
      totalPaths: paths.length,
      completedPaths: completed.length,
      averageSteps: paths.length > 0 ? totalSteps / paths.length : 0,
      averageDuration: completed.length > 0 ? totalDuration / completed.length : 0,
      commonPatterns: Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern]) => pattern.split(' -> ')),
      dropOffPoints: Object.entries(dropOff)
        .map(([stepId, count]) => ({ stepId, count }))
        .sort((a, b) => b.count - a.count),
    }
  }

  getFunnelData(tourId: string): { stepId: string; count: number; percentage: number }[] {
    const paths = this.getUserPaths(tourId)
    if (paths.length === 0) return []

    const stepCounts: Record<string, number> = {}
    paths.forEach(path => {
      path.steps.forEach(step => {
        stepCounts[step.stepId] = (stepCounts[step.stepId] || 0) + 1
      })
    })

    const totalPaths = paths.length
    return Object.entries(stepCounts)
      .map(([stepId, count]) => ({
        stepId,
        count,
        percentage: (count / totalPaths) * 100,
      }))
      .sort((a, b) => b.count - a.count)
  }

  getRealtimeStats(): RealtimeStats {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    const recentPaths = this.paths.filter(p => p.startTime >= oneHourAgo)
    const activeSessions = new Set(recentPaths.map(p => p.sessionId))
    
    const recentClicks = this.clicks.filter(c => c.timestamp >= oneHourAgo)
    const activeTours = new Set(recentClicks.map(c => c.tourId))

    const completions = recentPaths.filter(p => p.completed && p.endTime && p.endTime >= oneHourAgo)
    
    const tourCounts: Record<string, number> = {}
    recentClicks.forEach(c => {
      tourCounts[c.tourId] = (tourCounts[c.tourId] || 0) + 1
    })

    const recentEvents: RecentEvent[] = this.clicks
      .slice(-20)
      .reverse()
      .map(c => ({
        type: 'step' as const,
        tourId: c.tourId,
        stepId: c.stepId,
        timestamp: c.timestamp,
      }))

    return {
      activeUsers: activeSessions.size,
      activeTours: activeTours.size,
      completionsLastHour: completions.length,
      averageDuration: this.calculateAverageDuration(completions),
      topTours: Object.entries(tourCounts)
        .map(([tourId, count]) => ({ tourId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      recentEvents,
    }
  }

  private calculateAverageDuration(paths: UserPath[]): number {
    const durations = paths
      .filter(p => p.endTime)
      .map(p => p.endTime! - p.startTime)
    
    if (durations.length === 0) return 0
    return durations.reduce((a, b) => a + b, 0) / durations.length
  }

  subscribeToRealtime(callback: (stats: RealtimeStats) => void): () => void {
    this.realtimeListeners.push(callback)
    
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => {
        const stats = this.getRealtimeStats()
        this.realtimeListeners.forEach(cb => cb(stats))
      }, 5000)
    }

    return () => {
      const index = this.realtimeListeners.indexOf(callback)
      if (index > -1) {
        this.realtimeListeners.splice(index, 1)
      }
      if (this.realtimeListeners.length === 0 && this.updateInterval) {
        clearInterval(this.updateInterval)
        this.updateInterval = null
      }
    }
  }

  private notifyRealtimeUpdate(event: RecentEvent): void {
    const stats = this.getRealtimeStats()
    stats.recentEvents = [event, ...stats.recentEvents].slice(0, 20)
    this.realtimeListeners.forEach(cb => cb(stats))
  }

  clearData(): void {
    this.clicks = []
    this.paths = []
    StorageManager.removeItem(CLICK_STORAGE_KEY)
    StorageManager.removeItem(PATH_STORAGE_KEY)
  }

  exportData(): { clicks: ClickData[]; paths: UserPath[] } {
    return {
      clicks: [...this.clicks],
      paths: [...this.paths],
    }
  }

  importData(data: { clicks: ClickData[]; paths: UserPath[] }): void {
    this.clicks = data.clicks || []
    this.paths = data.paths || []
    this.saveClicks()
    this.savePaths()
  }
}

export const tourVisualizationService = new TourVisualizationService()
