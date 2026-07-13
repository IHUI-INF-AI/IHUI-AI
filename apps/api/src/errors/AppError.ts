/**
 * 后端统一业务错误基类。
 * 携带 HTTP statusCode + 稳定的 errorCode 字符串标识符。
 * 由全局 errorHandler 识别并透传到响应体。
 */
export class AppError extends Error {
  statusCode: number
  errorCode: string
  constructor(message: string, statusCode: number, errorCode: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}
