// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 正整数环境变量的唯一解析出口。
 *
 * 为什么需要它(2026-10-26 代码审查):
 *   过去两处上限各写一份 `Number(env.X ?? 默认值)` ——
 *   `SMS_MARKETING_GLOBAL_DAILY_CAP` 只判 `Number.isFinite && > 0`,
 *   空串得 0 / 填 `abc` 得 NaN 时上限**被静默关闭**(费用兜底形同不存在);
 *   `SMS_BROADCAST_MAX_PER_RUN` 更直接,`''` ⇒ 0(群发静默发 0 条)、`abc` ⇒ `LIMIT NaN`(500)。
 *   配置写错的方向必须落到「用默认值 + 告警」,不能落到「取消限制」或「SQL 报错」。
 */

import { logger } from './logger.js'

/**
 * 解析正整数配置。
 *
 * @param raw      环境变量原始值(未设置为 undefined)
 * @param fallback 非法时使用的默认值(必须是正整数)
 * @param name     变量名,只用于日志定位
 * @param opts.min / opts.max 合法区间,越界按边界夹取并告警
 */
export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
  opts?: { min?: number; max?: number },
): number {
  const min = opts?.min ?? 1
  const max = opts?.max ?? Number.MAX_SAFE_INTEGER
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))

  if (raw === undefined) return clamp(fallback)
  const trimmed = raw.trim()
  if (trimmed === '') {
    logger.warn('配置为空串,已回落默认值', { name, fallback: clamp(fallback) })
    return clamp(fallback)
  }
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n <= 0) {
    logger.warn('配置不是正整数,已回落默认值', { name, raw: trimmed, fallback: clamp(fallback) })
    return clamp(fallback)
  }
  if (n < min || n > max) {
    const clamped = clamp(n)
    logger.warn('配置超出合法区间,已按边界夹取', { name, raw: trimmed, min, max, clamped })
    return clamped
  }
  return n
}

export const __test__ = { parsePositiveInt }
