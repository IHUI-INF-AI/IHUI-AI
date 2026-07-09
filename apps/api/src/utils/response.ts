/** 统一 API 响应辅助函数,所有路由共享。 */

export interface ApiSuccess<T> {
  code: 0;
  message: 'success';
  data: T;
}

export interface ApiError {
  code: number;
  message: string;
}

export function success<T>(data: T): ApiSuccess<T> {
  return { code: 0, message: 'success', data };
}

export function error(code: number, message: string): ApiError {
  return { code, message };
}

/** 将空字符串/null/undefined 转为 undefined,用于 Zod preprocess。 */
export function emptyToUndefined(v: unknown): unknown {
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
}
