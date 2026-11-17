// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 深化D/J(2026-11-17):失败归因分类共享元数据。
// 后端 SSE_FAILURE_KINDS 六桶,前端传达最关键的"该等还是该改":
//   retryable(amber)  = 等等能好(可重试):rate_limited / transient
//   fatal(red)        = 重发必败(必须换路/改配置):credentials_rejected / endpoint_unavailable / contract_mismatch
//   neutral(muted)    = 主动放弃非失败:aborted
// 单一真相源:活跃渲染组件(SubAgentTaskTree)与批次聚合层(agent-task-progress-pane)
// 共同 import 本模块,禁止各自重写一份导致两处文案漂移。

export interface FailureKindMeta {
  /** 中文标签(如"限流") */
  label: string
  /** 处置提示(回答用户"该等还是该改") */
  advice: string
  /** Tailwind 文字色 class */
  tone: string
}

export const FAILURE_KIND_META: Record<string, FailureKindMeta> = {
  rate_limited: {
    label: '限流',
    advice: '窗口滑过后重发可能成功',
    tone: 'text-amber-500',
  },
  transient: {
    label: '瞬时故障',
    advice: '重发可能成功',
    tone: 'text-amber-500',
  },
  credentials_rejected: {
    label: '凭据被拒',
    advice: '同路重发必败,需重新登录/换凭据',
    tone: 'text-red-500',
  },
  endpoint_unavailable: {
    label: '端点不可用',
    advice: '需换一条路径,等不好',
    tone: 'text-red-500',
  },
  contract_mismatch: {
    label: '契约不匹配',
    advice: '确定失败,重发与换路均无效',
    tone: 'text-red-500',
  },
  aborted: {
    label: '已放弃',
    advice: '调用方主动放弃,非失败',
    tone: 'text-muted-foreground/60',
  },
} as const

/** 已知桶集合(供分布统计等场景判定 unknown) */
export const KNOWN_FAILURE_KINDS: ReadonlySet<string> = new Set(Object.keys(FAILURE_KIND_META))

/**
 * 深化K(2026-11-17):失败来源(failureSource)中文标签 —— 与 failureKind 正交的独立维度。
 *   failureSource = 失败发生在哪个环节(provider 上游 / runtime 本地 / network 网络 / tool 工具)
 *   failureKind   = 失败的具体类型(rate_limited / credentials_rejected / ...)
 * 用户失败时第一想知道"是网络?上游?本地?"—— failureSource 直接回答这个问题。
 * 合法值来自 ErrorAttributionSource(非空四桶):provider/runtime/network/tool;空串=证据不足不造标。
 * 单一真相源:活跃渲染(sub-agent-task-tree)与批次聚合(agent-task-progress-pane)共用本表。
 *
 * 深化X(2026-11-17):升级为带 tone 的 META 表,四桶分色提升信息密度:
 *   provider=amber(上游/配额/限流,与 failureKind 的 retryable 同暖色系)
 *   runtime=muted(本地运行时,环境问题,中性)
 *   network=sky(网络链路,冷色与上游区分)
 *   tool=violet(工具调用失败,与前三者都不同色)
 * FAILURE_SOURCE_LABEL 从 META 派生保持向后兼容(活跃层与测试仍可只用 label)。
 */
export const FAILURE_SOURCE_META: Record<string, { label: string; tone: string }> = {
  provider: { label: '上游模型', tone: 'text-amber-500' },
  runtime: { label: '本地运行时', tone: 'text-muted-foreground' },
  network: { label: '网络', tone: 'text-sky-500' },
  tool: { label: '工具调用', tone: 'text-violet-500' },
}

/** 失败来源中文标签(深化X:从 META 派生,向后兼容既有引用与测试) */
export const FAILURE_SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(FAILURE_SOURCE_META).map(([k, v]) => [k, v.label]),
)

/** 已知失败来源集合(非空四桶,供分布统计判定 unknown/空串) */
export const KNOWN_FAILURE_SOURCES: ReadonlySet<string> = new Set(Object.keys(FAILURE_SOURCE_META))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
