export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  failureThreshold: number
  successThreshold: number
  minSamples: number
  windowSizeMs: number
  halfOpenTimeoutMs: number
}

export interface CircuitBreakerStats {
  successes: number
  failures: number
  total: number
  failureRate: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  minSamples: 10,
  windowSizeMs: 60_000,
  halfOpenTimeoutMs: 30_000,
}

const MAX_WINDOW_ENTRIES = 10_000

export class CircuitOpenError extends Error {
  readonly breakerName: string
  readonly state: CircuitState
  constructor(breakerName: string, state: CircuitState) {
    super(`CircuitBreaker[${breakerName}] is ${state}; request rejected`)
    this.name = 'CircuitOpenError'
    this.breakerName = breakerName
    this.state = state
  }
}

interface WindowEntry {
  ts: number
  isFailure: boolean
}

export class CircuitBreaker {
  private readonly name: string
  private readonly options: CircuitBreakerOptions
  private state: CircuitState = 'closed'
  private readonly window: WindowEntry[] = []
  private failureCount = 0
  private openedAt = 0
  private halfOpenSuccesses = 0
  private halfOpenProbeInFlight = false

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen()
    if (this.state === 'open') {
      throw new CircuitOpenError(this.name, this.state)
    }
    if (this.state === 'half-open') {
      if (this.halfOpenProbeInFlight) {
        throw new CircuitOpenError(this.name, this.state)
      }
      this.halfOpenProbeInFlight = true
      try {
        const result = await fn()
        this.recordHalfOpenSuccess()
        return result
      } catch (err) {
        this.recordHalfOpenFailure()
        throw err
      } finally {
        this.halfOpenProbeInFlight = false
      }
    }
    try {
      const result = await fn()
      this.recordClosed(true)
      return result
    } catch (err) {
      this.recordClosed(false)
      throw err
    }
  }

  getState(): CircuitState {
    this.maybeTransitionToHalfOpen()
    return this.state
  }

  getStats(): CircuitBreakerStats {
    this.evictExpired()
    const total = this.window.length
    const failures = this.failureCount
    const successes = total - failures
    const failureRate = total === 0 ? 0 : failures / total
    return { successes, failures, total, failureRate }
  }

  reset(): void {
    this.state = 'closed'
    this.window.length = 0
    this.failureCount = 0
    this.openedAt = 0
    this.halfOpenSuccesses = 0
    this.halfOpenProbeInFlight = false
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.state !== 'open') return
    const now = Date.now()
    if (now - this.openedAt >= this.options.halfOpenTimeoutMs) {
      this.state = 'half-open'
      this.halfOpenSuccesses = 0
      this.halfOpenProbeInFlight = false
    }
  }

  private recordClosed(success: boolean): void {
    const now = Date.now()
    this.pushWindow(now, !success)
    this.evictExpired(now)
    const total = this.window.length
    if (
      total >= this.options.minSamples &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.trip()
    }
  }

  private recordHalfOpenSuccess(): void {
    this.halfOpenSuccesses += 1
    if (this.halfOpenSuccesses >= this.options.successThreshold) {
      this.state = 'closed'
      this.window.length = 0
      this.failureCount = 0
      this.openedAt = 0
      this.halfOpenSuccesses = 0
    }
  }

  private recordHalfOpenFailure(): void {
    this.state = 'open'
    this.openedAt = Date.now()
    this.halfOpenSuccesses = 0
  }

  private trip(): void {
    this.state = 'open'
    this.openedAt = Date.now()
    this.halfOpenSuccesses = 0
  }

  private pushWindow(ts: number, isFailure: boolean): void {
    if (this.window.length >= MAX_WINDOW_ENTRIES) {
      const evicted = this.window.shift()
      if (evicted?.isFailure) this.failureCount -= 1
    }
    this.window.push({ ts, isFailure })
    if (isFailure) this.failureCount += 1
  }

  private evictExpired(now: number = Date.now()): void {
    const cutoff = now - this.options.windowSizeMs
    while (this.window.length > 0 && this.window[0]!.ts < cutoff) {
      const evicted = this.window.shift()!
      if (evicted.isFailure) this.failureCount -= 1
    }
  }
}

export const serverPreset: Partial<CircuitBreakerOptions> = {
  failureThreshold: 5,
  minSamples: 10,
  windowSizeMs: 60_000,
  halfOpenTimeoutMs: 30_000,
}

export const clientPreset: Partial<CircuitBreakerOptions> = {
  failureThreshold: 3,
  minSamples: 5,
  windowSizeMs: 30_000,
  halfOpenTimeoutMs: 15_000,
}
