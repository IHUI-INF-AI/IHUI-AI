import { StorageManager } from '@/utils/storage'

interface TourStep {
  id: string
  [key: string]: any
}

interface TourData {
  id: string
  steps: TourStep[]
  config: Record<string, unknown>
  loadedAt: number
  size: number
}

interface PreloadConfig {
  enabled: boolean
  maxCacheSize: number
  preloadDelay: number
  expirationTime: number
}

interface LazyLoadState {
  loaded: Set<string>
  loading: Set<string>
  preloadQueue: string[]
  cache: Map<string, TourData>
}

const STORAGE_KEY = 'tour_performance_cache'
const DEFAULT_CONFIG: PreloadConfig = {
  enabled: true,
  maxCacheSize: 5 * 1024 * 1024,
  preloadDelay: 1000,
  expirationTime: 24 * 60 * 60 * 1000,
}

class TourPerformanceService {
  private state: LazyLoadState
  private config: PreloadConfig
  private preloadTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.config = this.loadConfig()
    this.state = {
      loaded: new Set(),
      loading: new Set(),
      preloadQueue: [],
      cache: new Map(),
    }
    this.loadCache()
  }

  private loadConfig(): PreloadConfig {
    const stored = StorageManager.getItem<PreloadConfig>(`${STORAGE_KEY}_config`)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  }

  private saveConfig(): void {
    StorageManager.setItem(`${STORAGE_KEY}_config`, this.config)
  }

  private loadCache(): void {
    const stored = StorageManager.getItem<Map<string, TourData>>(STORAGE_KEY)
    if (stored) {
      Object.entries(stored).forEach(([key, value]) => {
        if (Date.now() - value.loadedAt < this.config.expirationTime) {
          this.state.cache.set(key, value as TourData)
          this.state.loaded.add(key)
        }
      })
    }
  }

  private saveCache(): void {
    const cacheObj: Record<string, TourData> = {}
    this.state.cache.forEach((value, key) => {
      cacheObj[key] = value
    })
    StorageManager.setItem(STORAGE_KEY, cacheObj)
  }

  private getCacheSize(): number {
    let size = 0
    this.state.cache.forEach(data => {
      size += data.size
    })
    return size
  }

  private evictOldest(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity
    this.state.cache.forEach((data, key) => {
      if (data.loadedAt < oldestTime) {
        oldestKey = key
        oldestTime = data.loadedAt
      }
    })
    if (oldestKey !== undefined) {
      this.state.cache.delete(oldestKey)
      this.state.loaded.delete(oldestKey)
    }
  }

  async lazyLoad(tourId: string): Promise<TourData | null> {
    if (this.state.loaded.has(tourId)) {
      return this.state.cache.get(tourId) || null
    }

    if (this.state.loading.has(tourId)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.state.loaded.has(tourId)) {
            clearInterval(checkInterval)
            clearTimeout(timeoutId)
            resolve(this.state.cache.get(tourId) || null)
          }
        }, 50)

        // 30 秒超时保护，避免轮询永久运行导致内存泄漏
        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval)
          resolve(null)
        }, 30000)
      })
    }

    this.state.loading.add(tourId)

    try {
      const data = await this.fetchTourData(tourId)
      if (data) {
        const tourData: TourData = {
          ...data,
          loadedAt: Date.now(),
          size: JSON.stringify(data).length,
        }

        while (this.getCacheSize() + tourData.size > this.config.maxCacheSize) {
          this.evictOldest()
        }

        this.state.cache.set(tourId, tourData)
        this.state.loaded.add(tourId)
        this.saveCache()
        return tourData
      }
      return null
    } finally {
      this.state.loading.delete(tourId)
    }
  }

  private async fetchTourData(tourId: string): Promise<Omit<TourData, 'loadedAt' | 'size'> | null> {
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const storedSteps = StorageManager.getItem<TourStep[]>(`tour_steps_${tourId}`)
    const storedConfig = StorageManager.getItem<Record<string, unknown>>(`tour_config_${tourId}`)
    
    return {
      id: tourId,
      steps: storedSteps || [],
      config: storedConfig || {},
    }
  }

  preload(tourIds: string[]): void {
    if (!this.config.enabled) return

    tourIds.forEach(id => {
      if (!this.state.loaded.has(id) && !this.state.preloadQueue.includes(id)) {
        this.state.preloadQueue.push(id)
      }
    })

    this.schedulePreload()
  }

  private schedulePreload(): void {
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer)
    }

    this.preloadTimer = setTimeout(() => {
      void this.processPreloadQueue()
    }, this.config.preloadDelay)
  }

  private async processPreloadQueue(): Promise<void> {
    while (this.state.preloadQueue.length > 0) {
      const tourId = this.state.preloadQueue.shift()
      if (tourId && !this.state.loaded.has(tourId)) {
        await this.lazyLoad(tourId)
      }
    }
  }

  prefetchRelated(currentTourId: string): void {
    const relatedTours = this.getRelatedTours(currentTourId)
    this.preload(relatedTours)
  }

  private getRelatedTours(tourId: string): string[] {
    const tourRelations: Record<string, string[]> = {
      'feature-tour': ['advanced-tour', 'tips-tour'],
      'settings-tour': ['privacy-tour', 'notification-tour'],
    }
    return tourRelations[tourId] || []
  }

  getCached(tourId: string): TourData | null {
    return this.state.cache.get(tourId) || null
  }

  isLoaded(tourId: string): boolean {
    return this.state.loaded.has(tourId)
  }

  isLoading(tourId: string): boolean {
    return this.state.loading.has(tourId)
  }

  clearCache(): void {
    this.state.cache.clear()
    this.state.loaded.clear()
    this.state.loading.clear()
    this.state.preloadQueue = []
    StorageManager.removeItem(STORAGE_KEY)
  }

  getStats(): {
    cacheSize: number
    loadedCount: number
    loadingCount: number
    queueLength: number
  } {
    return {
      cacheSize: this.getCacheSize(),
      loadedCount: this.state.loaded.size,
      loadingCount: this.state.loading.size,
      queueLength: this.state.preloadQueue.length,
    }
  }

  setConfig(updates: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  getConfig(): PreloadConfig {
    return { ...this.config }
  }

  async warmup(tourIds: string[]): Promise<void> {
    const promises = tourIds.map(id => this.lazyLoad(id))
    try { await Promise.all(promises) } catch (e) { console.error(e) }
  }

  invalidate(tourId: string): void {
    this.state.cache.delete(tourId)
    this.state.loaded.delete(tourId)
    this.saveCache()
  }

  refresh(tourId: string): Promise<TourData | null> {
    this.invalidate(tourId)
    return this.lazyLoad(tourId)
  }
}

export const tourPerformanceService = new TourPerformanceService()

export function useTourPerformance() {
  return {
    lazyLoad: (tourId: string) => tourPerformanceService.lazyLoad(tourId),
    preload: (tourIds: string[]) => tourPerformanceService.preload(tourIds),
    prefetchRelated: (tourId: string) => tourPerformanceService.prefetchRelated(tourId),
    getCached: (tourId: string) => tourPerformanceService.getCached(tourId),
    isLoaded: (tourId: string) => tourPerformanceService.isLoaded(tourId),
    isLoading: (tourId: string) => tourPerformanceService.isLoading(tourId),
    clearCache: () => tourPerformanceService.clearCache(),
    getStats: () => tourPerformanceService.getStats(),
    setConfig: (config: Partial<PreloadConfig>) => tourPerformanceService.setConfig(config),
    getConfig: () => tourPerformanceService.getConfig(),
    warmup: (tourIds: string[]) => tourPerformanceService.warmup(tourIds),
    invalidate: (tourId: string) => tourPerformanceService.invalidate(tourId),
    refresh: (tourId: string) => tourPerformanceService.refresh(tourId),
  }
}
