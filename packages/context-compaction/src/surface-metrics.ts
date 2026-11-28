// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话面计价 —— 从 `session-surface.ts` 按 AGENTS §3(每页 <250 行)拆出来的一格。
 *
 * 拆档只搬函数,不复制判据:绝对计价 `measureSurface` 与带符号增量价
 * `measureReplacement` 仍各只有一份实现,`session-surface.ts` 与本档都不再各算一遍。
 */

import { estimateMessagesTokens } from './token-estimate.js'
import type { SurfaceNode } from './session-surface.js'

export interface SurfaceMeasurement {
  totalTokens: number
  nodes: Array<{ nodeId: string; seq: number; tokens: number }>
}

/**
 * 一次替换的增量价:与绝对计价同源,只做减法。
 *
 * 对侧(dsh-token-meter)把替换按"相对锚点的带符号 delta"计价,缩减替换是负值;
 * 这里保留同一语义:`deltaTokens = after - before`,负数就是"这次替换省下来的"。
 * 不做百分比/取整,避免把"省了多少"变成第二个估算器。
 */
export interface ReplacementMeasurement {
  beforeTokens: number
  afterTokens: number
  deltaTokens: number
}

/** 投影计价:逐节点求和,结果确定,可直接进缓存(revision = 最后一条事件 seq) */
export function measureSurface(nodes: readonly SurfaceNode[]): SurfaceMeasurement {
  let totalTokens = 0
  const measured: SurfaceMeasurement['nodes'] = []
  for (const node of nodes) {
    if (node.removed === true) continue
    const tokens = estimateMessagesTokens([node.message])
    totalTokens += tokens
    measured.push({ nodeId: node.nodeId, seq: node.seq, tokens })
  }
  return { totalTokens, nodes: measured }
}

/** 带符号增量价:after − before;缩减替换为负,扩写为正。 */
export function measureReplacement(
  before: readonly SurfaceNode[],
  after: readonly SurfaceNode[],
): ReplacementMeasurement {
  const beforeTokens = measureSurface(before).totalTokens
  const afterTokens = measureSurface(after).totalTokens
  return { beforeTokens, afterTokens, deltaTokens: afterTokens - beforeTokens }
}
