// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  DEFAULT_BULK_DELETE_THRESHOLD,
  DEFAULT_DISPLAY_CAP,
  DEFAULT_SAMPLE_SIZE,
} from './constants'
import type { DeleteCandidate, ThresholdDecision } from './types'

/**
 * 阈值判定(纯判据)。输入取不到 ⇒ undetermined(§0.3),绝不冒 clean 也绝不冒 blocked。
 *
 * 超越点:对方把计数埋在 shell 里;本层带 expectedCount 交叉核对 ——
 * 调用方声称扫出了 N 个删除候选而实际枚举 < N,是"清单与内容不同面"的形态,判未判定。
 */
export function evaluateBulkThreshold(
  candidates: readonly DeleteCandidate[] | null | undefined,
  opts: {
    threshold?: number
    sampleSize?: number
    displayCap?: number
    /** 调用方声称的删除候选数(交叉核对用;缺省不核对) */
    expectedCount?: number
  } = {},
): ThresholdDecision {
  const threshold = opts.threshold ?? DEFAULT_BULK_DELETE_THRESHOLD
  const sampleSize = Math.min(
    opts.sampleSize ?? DEFAULT_SAMPLE_SIZE,
    opts.displayCap ?? DEFAULT_DISPLAY_CAP,
  )

  if (!Array.isArray(candidates)) {
    return {
      verdict: 'undetermined',
      deleteCount: 0,
      threshold,
      requiresApproval: false,
      reason: '删除候选集取不到(非数组/为 null):未判定,不放行也不定罪',
      samples: [],
      samplesTruncated: false,
    }
  }

  const deleteCount = candidates.length
  if (typeof opts.expectedCount === 'number' && deleteCount < opts.expectedCount) {
    return {
      verdict: 'undetermined',
      deleteCount,
      threshold,
      requiresApproval: false,
      reason: `候选枚举(${deleteCount})少于调用方声称(${opts.expectedCount}):清单与内容不同面,未判定`,
      samples: candidates.slice(0, sampleSize).map((c) => c.path),
      samplesTruncated: deleteCount > sampleSize,
    }
  }

  const requiresApproval = deleteCount >= threshold
  return {
    verdict: requiresApproval ? 'blocked' : 'clean',
    deleteCount,
    threshold,
    requiresApproval,
    reason: requiresApproval
      ? `批量删除 ${deleteCount} 项 ≥ 阈值 ${threshold}:必须持本次扫描凭据走 approve 相`
      : undefined,
    samples: candidates.slice(0, sampleSize).map((c) => c.path),
    samplesTruncated: deleteCount > sampleSize,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
