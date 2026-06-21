/**
 * API请求取消机制
 * 提供请求取消、批量取消和AbortController管理
 */

export interface CancelableRequest {
  id: string
  controller: AbortController
  url: string
  timestamp: number
}

class RequestCancelManager {
  private requests: Map<string, CancelableRequest> = new Map()
  private requestCounter = 0

  generateId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`
  }

  createController(url: string): { id: string; controller: AbortController } {
    const id = this.generateId()
    const controller = new AbortController()

    this.requests.set(id, {
      id,
      controller,
      url,
      timestamp: Date.now(),
    })

    return { id, controller }
  }

  cancel(id: string): boolean {
    const request = this.requests.get(id)
    if (request) {
      request.controller.abort()
      this.requests.delete(id)
      return true
    }
    return false
  }

  cancelByUrl(urlPattern: string | RegExp): number {
    let cancelled = 0
    const idsToRemove: string[] = []

    for (const [id, request] of this.requests) {
      if (typeof urlPattern === 'string') {
        if (request.url.includes(urlPattern)) {
          idsToRemove.push(id)
        }
      } else {
        if (urlPattern.test(request.url)) {
          idsToRemove.push(id)
        }
      }
    }

    for (const id of idsToRemove) {
      if (this.cancel(id)) {
        cancelled++
      }
    }

    return cancelled
  }

  cancelAll(): number {
    let cancelled = 0
    for (const [id] of this.requests) {
      if (this.cancel(id)) {
        cancelled++
      }
    }
    return cancelled
  }

  getActiveRequests(): CancelableRequest[] {
    return Array.from(this.requests.values())
  }

  getRequest(id: string): CancelableRequest | undefined {
    return this.requests.get(id)
  }

  remove(id: string): boolean {
    return this.requests.delete(id)
  }

  cleanup(maxAge: number = 5 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0
    const idsToRemove: string[] = []

    for (const [id, request] of this.requests) {
      if (now - request.timestamp > maxAge) {
        idsToRemove.push(id)
      }
    }

    for (const id of idsToRemove) {
      this.requests.delete(id)
      cleaned++
    }

    return cleaned
  }

  getSignal(id: string): AbortSignal | undefined {
    return this.requests.get(id)?.controller.signal
  }
}

export const requestCancelManager = new RequestCancelManager()

export function createCancelableRequest<T>(
  url: string,
  fetcher: (signal: AbortSignal) => Promise<T>
): { id: string; promise: Promise<T>; cancel: () => void } {
  const { id, controller } = requestCancelManager.createController(url)

  const promise = fetcher(controller.signal).finally(() => {
    requestCancelManager.remove(id)
  })

  const cancel = () => {
    requestCancelManager.cancel(id)
  }

  return { id, promise, cancel }
}

export async function withCancel<T>(
  url: string,
  fetcher: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const { promise } = createCancelableRequest(url, fetcher)
  return promise
}

export function useRequestCancel() {
  return {
    createController: (url: string) => requestCancelManager.createController(url),
    cancel: (id: string) => requestCancelManager.cancel(id),
    cancelByUrl: (pattern: string | RegExp) => requestCancelManager.cancelByUrl(pattern),
    cancelAll: () => requestCancelManager.cancelAll(),
    getActiveRequests: () => requestCancelManager.getActiveRequests(),
    cleanup: (maxAge?: number) => requestCancelManager.cleanup(maxAge),
  }
}

export default requestCancelManager
