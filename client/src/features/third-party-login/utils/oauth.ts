/**
 * 生成随机state参数，用于防止CSRF攻击
 * @returns 随机state字符串
 */
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
