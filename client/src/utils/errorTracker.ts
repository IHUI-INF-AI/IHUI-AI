import { logger } from './logger'

export interface ErrorContext {
  userId?: string
  userRole?: string
  route?: string
  component?: string
  action?: string
  metadata?: Record<string, unknown>
}

export interface ErrorReport {
  id: string
  message: string
  stack?: string
  name: string
  timestamp: number
  url: string
  userAgent: string
  context: ErrorContext
  breadcrumbs: Breadcrumb[]
  level: 'error' | 'warning' | 'info'
}

export interface Breadcrumb {
  timestamp: number
  category: string
  message: string
  level: 'error' | 'warning' | 'info'
  data?: Record<string, unknown>
}

interface ErrorTrackerConfig {
  dsn?: string
  environment?: string
  release?: string
  maxBreadcrumbs?: number
  sampleRate?: number
}

class ErrorTrackerService {
  private config: ErrorTrackerConfig = {}
  private breadcrumbs: Breadcrumb[] = []
  private context: ErrorContext = {}
  private initialized = false
  private readonly MAX_BREADCRUMBS = 50

  constructor() {
    this.initFromEnv()
  }

  private initFromEnv(): void {
    const dsn = import.meta.env.VITE_ERROR_TRACKER_DSN
    const environment = import.meta.env.VITE_ERROR_TRACKER_ENV
    const sampleRate = import.meta.env.VITE_ERROR_TRACKER_SAMPLE_RATE

    if (dsn) {
      this.config = {
        dsn,
        environment: environment || 'production',
        sampleRate: sampleRate ? parseFloat(sampleRate) : 1.0,
      }
      this.initialized = true
      this.setupGlobalHandlers()
      logger.info('[ErrorTracker] Error tracking service initialized from environment variables')
    }
  }

  init(config: ErrorTrackerConfig): void {
    this.config = { ...this.config, ...config }
    if (!this.initialized) {
      this.initialized = true
      this.setupGlobalHandlers()
    }
  }

  private setupGlobalHandlers(): void {
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))
      this.captureError(error, { action: 'unhandledrejection' })
    })
  }

  setContext(context: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...context }
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    })

    if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
      this.breadcrumbs.shift()
    }
  }

  captureError(error: Error, context?: Partial<ErrorContext>): string {
    if (!this.initialized) {
      logger.error('[ErrorTracker] Service not initialized:', error)
      return ''
    }

    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return ''
    }

    const report: ErrorReport = {
      id: this.generateId(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: { ...this.context, ...context },
      breadcrumbs: [...this.breadcrumbs],
      level: 'error',
    }

    void this.sendReport(report)
    this.addBreadcrumb({
      category: 'error',
      message: error.message,
      level: 'error',
      data: { name: error.name },
    })

    return report.id
  }

  captureMessage(message: string, level: 'error' | 'warning' | 'info' = 'info', context?: Partial<ErrorContext>): string {
    if (!this.initialized) {
      const logLevel = level === 'warning' ? 'warn' : level
      logger[logLevel as 'error' | 'warn' | 'info'](`[ErrorTracker] ${message}`)
      return ''
    }

    const report: ErrorReport = {
      id: this.generateId(),
      message,
      name: 'Message',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: { ...this.context, ...context },
      breadcrumbs: [...this.breadcrumbs],
      level,
    }

    void this.sendReport(report)

    return report.id
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    try {
      if (this.config.dsn) {
        await fetch(this.config.dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...report,
            environment: this.config.environment,
            release: this.config.release,
          }),
        })
      } else {
        logger.error('[ErrorTracker] Error report:', report)
      }
    } catch (err) {
      logger.warn('[ErrorTracker] Failed to send report:', err)
    }
  }

  wrapFunction<T extends (...args: any[]) => unknown>(
    fn: T,
    context?: Partial<ErrorContext>
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args)
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.captureError(error, context)
            throw error
          })
        }
        return result
      } catch (error) {
        this.captureError(error as Error, context)
        throw error
      }
    }) as T
  }

  wrapAsyncFunction<T extends (...args: any[]) => Promise<unknown>>(
    fn: T,
    context?: Partial<ErrorContext>
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args)
      } catch (error) {
        this.captureError(error as Error, context)
        throw error
      }
    }) as T
  }
}

export const errorTracker = new ErrorTrackerService()

export function initErrorTracker(config: ErrorTrackerConfig): void {
  errorTracker.init(config)
}

export function captureError(error: Error, context?: Partial<ErrorContext>): string {
  return errorTracker.captureError(error, context)
}

export function captureMessage(message: string, level?: 'error' | 'warning' | 'info', context?: Partial<ErrorContext>): string {
  return errorTracker.captureMessage(message, level, context)
}

export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  errorTracker.addBreadcrumb(breadcrumb)
}

export function setErrorContext(context: Partial<ErrorContext>): void {
  errorTracker.setContext(context)
}
