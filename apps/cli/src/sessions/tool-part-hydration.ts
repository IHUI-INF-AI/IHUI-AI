// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话水合读侧的**唯一**入口(G-719,2026-10-03):落库工具结果元数据
 * (schemaVersion + 内层 strict + 外层 passthrough)的读侧收敛到这里,
 * 与 `@ihui/types` 的 `safeParseToolResultMetadata`(唯一剥离卡点 + literal 版本)成对。
 *
 * 为什么住在 cli:水合判定本身(版本分账、剥后校验、失败降级)是读侧行为,
 * types 只出 schema 与卡点;两处各写一遍版本/降级判据必漂移(本仓记过最多次的失败型)。
 *
 * 版本号的真实消费者(台账原文:"只抄版本号=造'有版本没人判'的新空支票"):
 *   - `schemaVersion === 1` ⇒ strict 校验;内层多一键 ⇒ **整块拒**(display 放弃,
 *     外层 passthrough 字段保留 —— 旧客户端口径);
 *   - 未知/缺席版本 ⇒ 同样按旧客户端口径剥 display 保外层,并单独报 `version` 档;
 *   - 非 tool-part 形状的条目 ⇒ 一个字节都不动(不误伤 toolState 的其他用途)。
 */

import {
  safeParseToolResultMetadata,
  type ToolResultMetadata,
} from '@ihui/types'

/** 单条水合结果三态:`hydrated`(合法 v1)/ `degraded`(剥 display 保外层)/ `untouched`(非本族形状)。 */
export type ToolPartHydrationOutcome =
  | { outcome: 'hydrated'; key: string; value: ToolResultMetadata }
  | { outcome: 'degraded'; key: string; reason: 'invalid' | 'version'; issues?: readonly string[] }
  | { outcome: 'untouched'; key: string }

/** 判"这条 toolState 值是不是落库工具结果元数据"——只认形状,不猜用途。 */
function isToolPartCandidate(v: unknown): v is Record<string, unknown> {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof (v as Record<string, unknown>)['toolName'] === 'string' &&
    'display' in v
  )
}

/** 逐条水合(纯函数版,便于直接喂构造面验证)。 */
export function hydratePersistedToolPart(key: string, raw: unknown): ToolPartHydrationOutcome {
  if (!isToolPartCandidate(raw)) return { outcome: 'untouched', key }
  const parsed = safeParseToolResultMetadata(raw)
  if (parsed.success) return { outcome: 'hydrated', key, value: parsed.data }
  const versionIssue = parsed.issues.find((i) => i.startsWith('schemaVersion'))
  return {
    outcome: 'degraded',
    key,
    reason: versionIssue ? 'version' : 'invalid',
    issues: parsed.issues,
  }
}

export interface ToolStateHydrationReport {
  /** 原样透传的条目数(非本族形状,一个字节没动)。 */
  untouched: number
  /** 合法 v1 元数据条目数。 */
  hydrated: number
  /** 降级条目数(display 被剥,外层保留)。 */
  degraded: number
  /** 降级明细(键 + 档位 + issues),调用方据此打日志。 */
  degradedEntries: Array<{ key: string; reason: 'invalid' | 'version'; issues?: readonly string[] }>
}

/**
 * toolState 整表水合:条目就地降级(删 `display`,其余字段保留),绝不因元数据
 * 不合法让整份会话/子代理状态读不出来(resume 依赖 toolState 完整 —— 行为不变量)。
 * 返回清洗后的映射与逐条报告;调用方负责把 degradedEntries 打进日志。
 */
export function hydrateToolStateMap(
  toolState: Record<string, unknown> | undefined,
): { toolState: Record<string, unknown>; report: ToolStateHydrationReport } {
  const report: ToolStateHydrationReport = {
    untouched: 0,
    hydrated: 0,
    degraded: 0,
    degradedEntries: [],
  }
  if (!toolState || typeof toolState !== 'object') return { toolState: toolState ?? {}, report }
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(toolState)) {
    const outcome = hydratePersistedToolPart(key, toolState[key])
    if (outcome.outcome === 'untouched') {
      out[key] = toolState[key]
      report.untouched += 1
    } else if (outcome.outcome === 'hydrated') {
      out[key] = outcome.value
      report.hydrated += 1
    } else {
      const raw = toolState[key] as Record<string, unknown>
      const stripped: Record<string, unknown> = { ...raw }
      delete stripped['display']
      out[key] = stripped
      report.degraded += 1
      report.degradedEntries.push({ key: outcome.key, reason: outcome.reason, issues: outcome.issues })
    }
  }
  return { toolState: out, report }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
