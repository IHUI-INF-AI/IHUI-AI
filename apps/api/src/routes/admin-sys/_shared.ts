// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
