/**
 * 从 API 错误中提取后端返回的 message，用于 ElMessage.error 等
 */
export function getApiErrorMessage(err: any, fallback: string): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message || e?.message || fallback
}
