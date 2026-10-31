// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 metadata 九类过程信息的**摘要投影**(2026-10-31 立)。
 *
 * 票面口径:「metadata 九类只回摘要 + 展开时懒取全文」。九类的分类口径唯一出处是
 * `PROJECT_PLAN.md` 的 D35 行与 H14 验收句 ——
 * 「plan / 工具 / 终端 / 引用 / 计量 / 压缩 / 降级 / 记忆 / 队列 九类过程信息」。
 * 代码里此前只有各消费点分散读单键,没有任何一份清单;清单落在这里,
 * 服务端摘要投影、web 懒取判定与测试三处共用这一份(第二份必然漂移,AGENTS §0.6)。
 *
 * 字段形状不另造:`satisfies readonly (keyof ChatMessageMetadata)[]` 把每个键钉在
 * `@ihui/api-client` 的 `ChatMessageMetadata` 上 —— 该类型是 `chat_messages.metadata`
 * 的唯一结构化声明,本文件只登记"哪九个键属于九类",不抄它的字段类型。
 */
import type { ChatMessageMetadata } from '@ihui/api-client'

export const METADATA_PROCESS_KIND_KEYS = [
  'planSteps', // plan(计划快照)
  'toolCalls', // 工具
  'terminalTasks', // 终端
  'citations', // 引用
  'usageDetail', // 计量
  'compaction', // 压缩
  'fallback', // 降级
  'memoryUpdates', // 记忆
  'queueItems', // 队列
] as const satisfies readonly (keyof ChatMessageMetadata)[]

export type MetadataProcessKindKey = (typeof METADATA_PROCESS_KIND_KEYS)[number]

/**
 * 一类的摘要信封。正文只在懒取出口
 * (`GET /conversations/:id/messages/:messageId/metadata`)下发。
 */
export interface ChatMetadataKindSummary {
  /** 判别字(固定 true)。消费侧只认它,不靠"看起来像不像数组"猜。 */
  summary: true
  /** 数组类 = 元素数;对象类没有条数(不编造 1)。 */
  count?: number
  /** 正文字节上界(JSON 序列化长度);量不到时缺席,不写 0 冒充。 */
  bytes?: number
}

/** 是否为摘要信封(而非该类正文)。 */
export function isChatMetadataKindSummary(value: unknown): value is ChatMetadataKindSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as { summary?: unknown }).summary === true
}

function byteLengthOf(value: unknown): number | undefined {
  try {
    const text = JSON.stringify(value)
    return typeof text === 'string' ? text.length : undefined
  } catch {
    // 来自 DB jsonb 的值不会循环引用;真取不到就缺席(§0.3:不写 0 冒充"空")。
    return undefined
  }
}

/**
 * 完整 metadata → 摘要形态(消息列表读面用)。
 *
 * - 九类过程信息替换为 `ChatMetadataKindSummary`(数组给条数,对象给字节上界);
 * - 其余键原样保留(permissionMode / interrupted 等是标量,不撑体积);
 * - 幂等:已是摘要信封的类原样返回,重复投影不叠加;
 * - metadata 为 null / 非对象 / 数组 ⇒ null(该行本来就没有 metadata)。
 */
export function projectChatMetadataSummary(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const source = metadata as Record<string, unknown>
  const kindKeys = new Set<string>(METADATA_PROCESS_KIND_KEYS)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (!kindKeys.has(key)) {
      out[key] = value
      continue
    }
    if (isChatMetadataKindSummary(value)) {
      out[key] = value
      continue
    }
    const entry: ChatMetadataKindSummary = { summary: true }
    if (Array.isArray(value)) entry.count = value.length
    const bytes = byteLengthOf(value)
    if (bytes !== undefined) entry.bytes = bytes
    out[key] = entry
  }
  return out
}

/**
 * 本地 metadata 是否只剩摘要(任一九类键是摘要信封 ⇒ 需要走懒取出口取全文)。
 *
 * 注意方向:九类**全部缺席**(老消息 / 该轮确实没有过程信息)返回 false ——
 * 缺席不等于摘要,拿它触发懒取等于给每条老消息多发一次请求。
 */
export function hasSummarizedMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const source = metadata as Record<string, unknown>
  return METADATA_PROCESS_KIND_KEYS.some((key) => isChatMetadataKindSummary(source[key]))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
