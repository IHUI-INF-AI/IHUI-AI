export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}
