import { logger } from '@/utils/logger'

export type TourEventType = 
  | 'tour:start'
  | 'tour:complete'
  | 'tour:skip'
  | 'tour:pause'
  | 'tour:resume'
  | 'tour:exit'
  | 'tour:error'
  | 'step:start'
  | 'step:complete'
  | 'step:skip'
  | 'step:error'
  | 'step:retry'
  | 'action:click'
  | 'action:input'
  | 'action:scroll'
  | 'action:hover'
  | 'action:focus'
  | 'trigger:activated'
  | 'trigger:deactivated'
  | 'visibility:show'
  | 'visibility:hide'
  | 'progress:update'
  | 'metric:record'
  | 'user:feedback'
  | 'system:warning'
  | 'system:error'
  | 'custom'

export interface TourEvent {
  id: string
  type: TourEventType
  tourId?: string
  stepId?: string
  userId?: string
  sessionId?: string
  timestamp: number
  data: Record<string, unknown>
  metadata: EventMetadata
}

export interface EventMetadata {
  source: string
  version: string
  correlationId?: string
  causationId?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  persistent: boolean
}

export interface EventSubscription {
  id: string
  eventType: TourEventType | TourEventType[] | '*'
  handler: EventHandler
  options: SubscriptionOptions
  active: boolean
  createdAt: number
  callCount: number
  lastCalled?: number
}

export interface SubscriptionOptions {
  once: boolean
  priority: number
  filter?: EventFilter
  throttle?: number
  debounce?: number
  errorHandler?: (error: Error, event: TourEvent) => void
}

export interface EventFilter {
  tourId?: string | string[]
  stepId?: string | string[]
  userId?: string | string[]
  data?: Record<string, unknown>
}

export type EventHandler = (event: TourEvent) => void | Promise<void>

export interface EventBusStats {
  totalEvents: number
  eventsByType: Record<string, number>
  totalSubscriptions: number
  activeSubscriptions: number
  eventsProcessed: number
  errorsCount: number
  averageProcessingTime: number
}

export interface EventHistoryEntry {
  event: TourEvent
  processed: boolean
  processingTime: number
  subscribersNotified: number
  errors: string[]
}

const MAX_HISTORY_SIZE = 1000
const STORAGE_KEY = 'tour_event_bus_history'

class TourEventBus {
  private subscriptions: Map<string, EventSubscription> = new Map()
  private eventQueue: TourEvent[] = []
  private history: EventHistoryEntry[] = []
  private stats: EventBusStats = {
    totalEvents: 0,
    eventsByType: {},
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    eventsProcessed: 0,
    errorsCount: 0,
    averageProcessingTime: 0
  }
  private processingTimes: number[] = []
  private isProcessing = false
  private lastThrottleTime: Map<string, number> = new Map()
  private lastDebounceTime: Map<string, NodeJS.Timeout> = new Map()

  subscribe(
    eventType: TourEventType | TourEventType[] | '*',
    handler: EventHandler,
    options: Partial<SubscriptionOptions> = {}
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      options: {
        once: options.once || false,
        priority: options.priority || 0,
        filter: options.filter,
        throttle: options.throttle,
        debounce: options.debounce,
        errorHandler: options.errorHandler
      },
      active: true,
      createdAt: Date.now(),
      callCount: 0
    }

    this.subscriptions.set(subscriptionId, subscription)
    this.updateStats()
    return subscriptionId
  }

  unsubscribe(subscriptionId: string): boolean {
    const result = this.subscriptions.delete(subscriptionId)
    if (result) {
      this.updateStats()
    }
    return result
  }

  unsubscribeAll(eventType?: TourEventType): number {
    let count = 0
    const entries = Array.from(this.subscriptions.entries())
    for (const [id, sub] of entries) {
      if (!eventType || sub.eventType === '*' || 
          (Array.isArray(sub.eventType) && sub.eventType.includes(eventType)) ||
          sub.eventType === eventType) {
        this.subscriptions.delete(id)
        count++
      }
    }
    this.updateStats()
    return count
  }

  emit(
    type: TourEventType,
    data: Record<string, unknown> = {},
    metadata: Partial<EventMetadata> = {}
  ): string {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const event: TourEvent = {
      id: eventId,
      type,
      tourId: data.tourId as string,
      stepId: data.stepId as string,
      userId: data.userId as string,
      sessionId: data.sessionId as string,
      timestamp: Date.now(),
      data,
      metadata: {
        source: metadata.source || 'unknown',
        version: metadata.version || '1.0',
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        priority: metadata.priority || 'normal',
        persistent: metadata.persistent || false
      }
    }

    this.eventQueue.push(event)
    this.stats.totalEvents++
    this.stats.eventsByType[type] = (this.stats.eventsByType[type] || 0) + 1

    void this.processQueue()
    return eventId
  }

  emitSync(
    type: TourEventType,
    data: Record<string, unknown> = {},
    metadata: Partial<EventMetadata> = {}
  ): void {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const event: TourEvent = {
      id: eventId,
      type,
      tourId: data.tourId as string,
      stepId: data.stepId as string,
      userId: data.userId as string,
      sessionId: data.sessionId as string,
      timestamp: Date.now(),
      data,
      metadata: {
        source: metadata.source || 'unknown',
        version: metadata.version || '1.0',
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        priority: metadata.priority || 'normal',
        persistent: metadata.persistent || false
      }
    }

    void this.processEvent(event)
  }

  once(
    eventType: TourEventType | TourEventType[],
    handler: EventHandler,
    options: Omit<Partial<SubscriptionOptions>, 'once'> = {}
  ): string {
    return this.subscribe(eventType, handler, { ...options, once: true })
  }

  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId)
  }

  getActiveSubscriptions(eventType?: TourEventType): EventSubscription[] {
    const subs = Array.from(this.subscriptions.values()).filter(s => s.active)
    
    if (!eventType) return subs
    
    return subs.filter(s => 
      s.eventType === '*' ||
      (Array.isArray(s.eventType) && s.eventType.includes(eventType)) ||
      s.eventType === eventType
    )
  }

  pauseSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) return false
    sub.active = false
    this.updateStats()
    return true
  }

  resumeSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId)
    if (!sub) return false
    sub.active = true
    this.updateStats()
    return true
  }

  getHistory(limit = 100): EventHistoryEntry[] {
    return this.history.slice(-limit)
  }

  getHistoryByType(type: TourEventType, limit = 50): EventHistoryEntry[] {
    return this.history
      .filter(h => h.event.type === type)
      .slice(-limit)
  }

  getHistoryByTour(tourId: string, limit = 50): EventHistoryEntry[] {
    return this.history
      .filter(h => h.event.tourId === tourId)
      .slice(-limit)
  }

  getStats(): EventBusStats {
    return { ...this.stats }
  }

  clearHistory(): void {
    this.history = []
    this.saveHistory()
  }

  reset(): void {
    this.subscriptions.clear()
    this.eventQueue = []
    this.history = []
    this.stats = {
      totalEvents: 0,
      eventsByType: {},
      totalSubscriptions: 0,
      activeSubscriptions: 0,
      eventsProcessed: 0,
      errorsCount: 0,
      averageProcessingTime: 0
    }
    this.processingTimes = []
    this.lastThrottleTime.clear()
    this.lastDebounceTime.forEach(t => clearTimeout(t))
    this.lastDebounceTime.clear()
    localStorage.removeItem(STORAGE_KEY)
  }

  createCorrelatedEvents(
    events: Array<{ type: TourEventType; data: Record<string, unknown> }>,
    correlationId?: string
  ): string[] {
    const corrId = correlationId || `corr_${Date.now()}`
    const eventIds: string[] = []
    let causationId: string | undefined

    for (const { type, data } of events) {
      const eventId = this.emit(type, data, {
        correlationId: corrId,
        causationId
      })
      eventIds.push(eventId)
      causationId = eventId
    }

    return eventIds
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return

    this.isProcessing = true

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!
      await this.processEvent(event)
    }

    this.isProcessing = false
  }

  private async processEvent(event: TourEvent): Promise<void> {
    const startTime = performance.now()
    const errors: string[] = []
    let subscribersNotified = 0

    const matchingSubs = this.getMatchingSubscriptions(event)
    matchingSubs.sort((a, b) => b.options.priority - a.options.priority)

    for (const sub of matchingSubs) {
      if (!sub.active) continue

      try {
        if (!this.shouldProcessSubscription(sub, event)) {
          continue
        }

        await sub.handler(event)
        sub.callCount++
        sub.lastCalled = Date.now()
        subscribersNotified++

        if (sub.options.once) {
          this.subscriptions.delete(sub.id)
          this.updateStats()
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push(`Subscription ${sub.id}: ${errorMessage}`)
        this.stats.errorsCount++

        if (sub.options.errorHandler) {
          try {
            sub.options.errorHandler(error instanceof Error ? error : new Error(errorMessage), event)
          } catch (e) {
            logger.error('Error handler failed:', e)
          }
        }
      }
    }

    const processingTime = performance.now() - startTime
    this.processingTimes.push(processingTime)
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift()
    }

    this.stats.eventsProcessed++
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length

    const historyEntry: EventHistoryEntry = {
      event,
      processed: errors.length === 0,
      processingTime,
      subscribersNotified,
      errors
    }

    this.history.push(historyEntry)
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift()
    }

    if (event.metadata.persistent) {
      this.saveHistory()
    }
  }

  private getMatchingSubscriptions(event: TourEvent): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => {
      if (!sub.active) return false

      if (sub.eventType === '*') return true

      if (Array.isArray(sub.eventType)) {
        return sub.eventType.includes(event.type)
      }

      return sub.eventType === event.type
    })
  }

  private shouldProcessSubscription(sub: EventSubscription, event: TourEvent): boolean {
    if (sub.options.filter && !this.matchesFilter(event, sub.options.filter)) {
      return false
    }

    if (sub.options.throttle) {
      const key = `${sub.id}_${event.type}`
      const lastTime = this.lastThrottleTime.get(key) || 0
      const now = Date.now()
      
      if (now - lastTime < sub.options.throttle) {
        return false
      }
      this.lastThrottleTime.set(key, now)
    }

    if (sub.options.debounce) {
      const key = `${sub.id}_${event.type}`
      const existingTimeout = this.lastDebounceTime.get(key)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.lastDebounceTime.delete(key)
          resolve(true)
        }, sub.options.debounce)
        this.lastDebounceTime.set(key, timeout as unknown as NodeJS.Timeout)
      }) as unknown as boolean
    }

    return true
  }

  private matchesFilter(event: TourEvent, filter: EventFilter): boolean {
    if (filter.tourId) {
      const tourIds = Array.isArray(filter.tourId) ? filter.tourId : [filter.tourId]
      if (!tourIds.includes(event.tourId || '')) return false
    }

    if (filter.stepId) {
      const stepIds = Array.isArray(filter.stepId) ? filter.stepId : [filter.stepId]
      if (!stepIds.includes(event.stepId || '')) return false
    }

    if (filter.userId) {
      const userIds = Array.isArray(filter.userId) ? filter.userId : [filter.userId]
      if (!userIds.includes(event.userId || '')) return false
    }

    if (filter.data) {
      for (const [key, value] of Object.entries(filter.data)) {
        if (event.data[key] !== value) return false
      }
    }

    return true
  }

  private updateStats(): void {
    this.stats.totalSubscriptions = this.subscriptions.size
    this.stats.activeSubscriptions = Array.from(this.subscriptions.values())
      .filter(s => s.active).length
  }

  private saveHistory(): void {
    try {
      const recentHistory = this.history.slice(-100)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentHistory))
    } catch (e) {
      logger.error('Failed to save event history:', e)
    }
  }

  private loadHistory(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        this.history = JSON.parse(data)
      }
    } catch (e) {
      logger.error('Failed to load event history:', e)
    }
  }
}

export const tourEventBus = new TourEventBus()

export function useEventBus() {
  const subscriptions: string[] = []

  const on = (
    eventType: TourEventType | TourEventType[] | '*',
    handler: EventHandler,
    options?: Partial<SubscriptionOptions>
  ): string => {
    const id = tourEventBus.subscribe(eventType, handler, options)
    subscriptions.push(id)
    return id
  }

  const off = (subscriptionId: string): boolean => {
    const index = subscriptions.indexOf(subscriptionId)
    if (index > -1) {
      subscriptions.splice(index, 1)
    }
    return tourEventBus.unsubscribe(subscriptionId)
  }

  const emit = (
    type: TourEventType,
    data?: Record<string, unknown>,
    metadata?: Partial<EventMetadata>
  ): string => {
    return tourEventBus.emit(type, data, metadata)
  }

  const cleanup = (): void => {
    subscriptions.forEach(id => tourEventBus.unsubscribe(id))
    subscriptions.length = 0
  }

  return {
    on,
    off,
    emit,
    once: tourEventBus.once.bind(tourEventBus),
    cleanup,
    getStats: tourEventBus.getStats.bind(tourEventBus),
    getHistory: tourEventBus.getHistory.bind(tourEventBus)
  }
}
