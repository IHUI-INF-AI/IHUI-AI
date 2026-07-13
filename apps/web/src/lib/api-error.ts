export class ApiError extends Error {
  status?: number
  errorCode?: string
  constructor(message: string, status?: number, errorCode?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}

export function isErrorCode(err: unknown, code: string): boolean {
  return err instanceof ApiError && err.errorCode === code
}
