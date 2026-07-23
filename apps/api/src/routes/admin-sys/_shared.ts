/**
 * admin-sys 子路由共享工具(从原 admin-sys.ts 拆分)。
 */
export function parseNum(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === '') return fallback
  const n = Number(v)
  return Number.isNaN(n) ? fallback : n
}

export function parseStr(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return String(v)
}
