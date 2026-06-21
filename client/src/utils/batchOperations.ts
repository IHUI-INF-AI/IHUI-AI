interface BatchOperation<T> {
  id: string
  items: T[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  completed: number
  failed: number
  total: number
  errors: Array<{ item: T; error: Error }>
  startTime: number | null
  endTime: number | null
}

type OperationHandler<T, R> = (item: T, index: number) => Promise<R>

class BatchOperationManager<T, R> {
  private operations: Map<string, BatchOperation<T>> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()

  async execute(
    items: T[],
    handler: OperationHandler<T, R>,
    options: {
      concurrency?: number
      onProgress?: (operation: BatchOperation<T>) => void
      onComplete?: (results: R[], operation: BatchOperation<T>) => void
      onError?: (errors: Array<{ item: T; error: Error }>) => void
    } = {}
  ): Promise<R[]> {
    const { concurrency = 3, onProgress, onComplete, onError } = options

    const id = this.generateId()
    const operation: BatchOperation<T> = {
      id,
      items,
      status: 'running',
      progress: 0,
      completed: 0,
      failed: 0,
      total: items.length,
      errors: [],
      startTime: Date.now(),
      endTime: null
    }

    this.operations.set(id, operation)

    const abortController = new AbortController()
    this.abortControllers.set(id, abortController)

    const results: R[] = []
    const queue = [...items.entries()]
    const executing: Promise<void>[] = []

    const processItem = async (index: number, item: T) => {
      if (abortController.signal.aborted) {
        operation.status = 'cancelled'
        return
      }

      try {
        const result = await handler(item, index)
        results[index] = result
        operation.completed++
      } catch (error) {
        operation.failed++
        operation.errors.push({ item, error: error as Error })
      }

      operation.progress = Math.round(
        ((operation.completed + operation.failed) / operation.total) * 100
      )
      onProgress?.(operation)
    }

    while (queue.length > 0) {
      if (abortController.signal.aborted) break

      const [index, item] = queue.shift()!

      const promise = processItem(index, item).then(() => {
        const idx = executing.indexOf(promise)
        if (idx > -1) void executing.splice(idx, 1)
      })

      executing.push(promise)

      if (executing.length >= concurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)

    operation.endTime = Date.now()
    operation.status = operation.failed > 0 ? 
      (operation.completed > 0 ? 'completed' : 'failed') : 
      'completed'

    if (operation.errors.length > 0) {
      onError?.(operation.errors)
    }

    onComplete?.(results, operation)

    return results
  }

  cancel(id: string): boolean {
    const controller = this.abortControllers.get(id)
    if (controller) {
      controller.abort()
      const operation = this.operations.get(id)
      if (operation) {
        operation.status = 'cancelled'
      }
      return true
    }
    return false
  }

  getOperation(id: string): BatchOperation<T> | undefined {
    return this.operations.get(id)
  }

  getActiveOperations(): BatchOperation<T>[] {
    return Array.from(this.operations.values()).filter(
      op => op.status === 'running'
    )
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export function createBatchOperation<T, R>() {
  const manager = new BatchOperationManager<T, R>()
  
  return {
    execute: (
      items: T[],
      handler: OperationHandler<T, R>,
      options?: Parameters<typeof manager.execute>[2]
    ) => manager.execute(items, handler, options),
    cancel: (id: string) => manager.cancel(id),
    getOperation: (id: string) => manager.getOperation(id),
    getActiveOperations: () => manager.getActiveOperations()
  }
}

export function useBatchUpload() {
  const batchUpload = createBatchOperation<File, { url: string; file: File }>()

  const uploadFiles = async (
    files: File[],
    uploadUrl: string,
    options?: {
      concurrency?: number
      onProgress?: (completed: number, total: number) => void
    }
  ) => {
    return batchUpload.execute(
      files,
      async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        const result = await response.json()
        return { url: result.url, file }
      },
      {
        concurrency: options?.concurrency || 3,
        onProgress: (op) => {
          options?.onProgress?.(op.completed, op.total)
        }
      }
    )
  }

  return {
    uploadFiles,
    cancel: batchUpload.cancel,
    getOperation: batchUpload.getOperation,
    getActiveOperations: batchUpload.getActiveOperations
  }
}

export function useBatchDownload() {
  const batchDownload = createBatchOperation<
    { url: string; fileName: string },
    { blob: Blob; fileName: string }
  >()

  const downloadFiles = async (
    files: Array<{ url: string; fileName: string }>,
    options?: {
      concurrency?: number
      onProgress?: (completed: number, total: number) => void
    }
  ) => {
    return batchDownload.execute(
      files,
      async ({ url, fileName }) => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download ${fileName}`)
        }
        const blob = await response.blob()
        return { blob, fileName }
      },
      {
        concurrency: options?.concurrency || 3,
        onProgress: (op) => {
          options?.onProgress?.(op.completed, op.total)
        }
      }
    )
  }

  return {
    downloadFiles,
    cancel: batchDownload.cancel,
    getOperation: batchDownload.getOperation,
    getActiveOperations: batchDownload.getActiveOperations
  }
}
