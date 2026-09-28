// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
