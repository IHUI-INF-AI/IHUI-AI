// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D68 统一多源建议面板 —— 纯逻辑层(不取数、不依赖 React / i18n)。
// 六源聚合 / 逐源来源标注 / 部分失败降级三句 / 引用上限 / 粘贴引用有效性预览
// 的判定全部集中在本文件,渲染层(unified-suggestion-panel.tsx)与聚合 hook
// (use-unified-suggestions.ts)只消费这里的出口,禁止在别处再算一遍(§22c 同型)。

/** 六源(台账 D68 固定清单:任务/技能/插件/连接器/Agent/文件) */
export type SuggestionSourceKind = 'task' | 'skill' | 'plugin' | 'connector' | 'agent' | 'file'

/** 封闭集顺序即面板分组顺序(不得随意调换:用例与截图都锚定它) */
export const SUGGESTION_SOURCE_KINDS: readonly SuggestionSourceKind[] = [
  'task',
  'skill',
  'plugin',
  'connector',
  'agent',
  'file',
] as const

/**
 * 逐源来源标注的封闭词表(台账 D68:内置/用户配置本地/用户配置远程/项目配置/市场/插件提供)。
 * 今天的真实生产者:builtin←source==='builtin' 的技能;userRemote←任务/技能/连接器/文件;
 * market←插件/Agent。userLocal / project / pluginProvided 已登记词表但**今日无生产端**
 * (项目配置与插件提供建议尚无 API 出口)——如实登记为未接通,不得拿假数据凑成已命中。
 */
export type SuggestionProvenance =
  | 'builtin'
  | 'userLocal'
  | 'userRemote'
  | 'project'
  | 'market'
  | 'pluginProvided'

export const SUGGESTION_PROVENANCES: readonly SuggestionProvenance[] = [
  'builtin',
  'userLocal',
  'userRemote',
  'project',
  'market',
  'pluginProvided',
] as const

/** 每源的默认来源标注;条目可带 item.provenance 覆盖(如 builtin 技能) */
export const DEFAULT_SOURCE_PROVENANCE: Record<SuggestionSourceKind, SuggestionProvenance> = {
  task: 'userRemote',
  skill: 'userRemote',
  plugin: 'market',
  connector: 'userRemote',
  agent: 'market',
  file: 'userRemote',
}

/** 单源运行态:idle=未加载;loading=取数中;ready=已出结果(含空结果);failed=本源取数失败 */
export type SuggestionSourceRunStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface UnifiedSuggestionItem {
  /** 稳定 id:建议用 `{source}:{原始 id}` 形态 */
  id: string
  source: SuggestionSourceKind
  /** 主位展示文本(来自服务端数据本身,不属于界面文案,不经 i18n) */
  label: string
  /** 副位说明(路径 / 描述),可选 */
  detail?: string
  /** 缺省取 DEFAULT_SOURCE_PROVENANCE[source] */
  provenance?: SuggestionProvenance
}

export interface SuggestionSourceState {
  source: SuggestionSourceKind
  status: SuggestionSourceRunStatus
  items: UnifiedSuggestionItem[]
}

export function resolveProvenance(
  item: Pick<UnifiedSuggestionItem, 'source' | 'provenance'>,
): SuggestionProvenance {
  return item.provenance ?? DEFAULT_SOURCE_PROVENANCE[item.source]
}

/**
 * 聚合:按 SUGGESTION_SOURCE_KINDS 固定顺序输出六源分节(缺哪一源即补 idle 空节,
 * 保证渲染面永远是六格 —— 「少一格」正是聚合面板最危险的静默失效形态)。
 * query 对 label/detail 做大小写不敏感子串过滤;空 query 原样返回。
 */
export function aggregateUnifiedSuggestions(
  states: readonly SuggestionSourceState[],
  query: string,
): SuggestionSourceState[] {
  const bySource = new Map<SuggestionSourceKind, SuggestionSourceState>()
  for (const s of states) {
    // 同名源后到覆盖前到(聚合 hook 重进 loading 时正常发生,不视为错误)
    bySource.set(s.source, s)
  }
  const q = query.trim().toLowerCase()
  return SUGGESTION_SOURCE_KINDS.map((source) => {
    const state = bySource.get(source) ?? { source, status: 'idle' as const, items: [] }
    if (!q) return state
    return {
      ...state,
      items: state.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.detail?.toLowerCase().includes(q) ?? false),
      ),
    }
  })
}

/** 面板引用上限(建议条目计入草稿引用的硬顶;超限拒收并回显提示,不静默丢) */
export const MAX_PANEL_REFERENCES = 10

export interface ReferenceCapResult<T> {
  kept: T[]
  rejected: T[]
}

/**
 * 引用上限判定:existingCount + incoming 超过 max 时,前若干条保留、其余进 rejected。
 * 拒收必须可见(调用方把 rejected 非空渲染成提示),静默截断=伪造完整性(§5e 同族)。
 */
export function capReferences<T>(
  existingCount: number,
  incoming: readonly T[],
  max: number = MAX_PANEL_REFERENCES,
): ReferenceCapResult<T> {
  const room = Math.max(max - existingCount, 0)
  return {
    kept: incoming.slice(0, room),
    rejected: incoming.slice(room),
  }
}

/**
 * 部分失败降级三句(台账 D68「X 暂时无法加载,仍可继续使用 Y」):
 * - none    无失败源,不渲染降级条
 * - single  恰一个源失败 → 「{failed} 暂时无法加载」
 * - partial 若干失败且仍有 ready 源 → 「{failed} 暂时无法加载，仍可继续使用 {ok}」
 * - all     六源全部失败 → 收尾句(仍可直接输入发送,面板绝不拦消息)
 * 本函数只回结构,不拼文案;文案由渲染层按 kind 走三个独立 i18n 键。
 */
export type DegradationNotice =
  | { kind: 'none' }
  | { kind: 'single'; failed: SuggestionSourceKind }
  | { kind: 'partial'; failed: SuggestionSourceKind[]; usable: SuggestionSourceKind[] }
  | { kind: 'all' }

export function computeDegradationNotice(
  states: readonly SuggestionSourceState[],
): DegradationNotice {
  const failed = states.filter((s) => s.status === 'failed').map((s) => s.source)
  if (failed.length === 0) return { kind: 'none' }
  const usable = states.filter((s) => s.status === 'ready').map((s) => s.source)
  if (usable.length === 0) return { kind: 'all' }
  if (failed.length === 1 && failed[0]) return { kind: 'single', failed: failed[0] }
  return { kind: 'partial', failed, usable }
}

export interface PastedReferencePreview {
  /** 剪贴板里的原文片段(含 sigil),原样回显 */
  raw: string
  /** 归一后的比对键(小写,去 sigil / 反引号) */
  normalized: string
  /** 能否在已知引用集(当前文件列表等)里对应上 */
  recognized: boolean
}

/**
 * 粘贴引用有效性预览:从粘贴文本提取 `@token`(词字符/./_/ -)与反引号包裹的
 * \`path\` 两类引用 sigil,与 knownPaths / knownLabels 逐一比对(大小写不敏感)。
 * 判不了的不猜:空集输入 → 空数组(调用方不渲染预览条)。
 */
export function previewPastedReferences(
  text: string,
  known: { paths: readonly string[]; labels: readonly string[] },
): PastedReferencePreview[] {
  if (!text) return []
  const knownSet = new Set<string>([
    ...known.paths.map((p) => p.toLowerCase()),
    ...known.labels.map((l) => l.toLowerCase()),
  ])
  const out: PastedReferencePreview[] = []
  const seen = new Set<string>()
  const patterns: RegExp[] = [/@([\w./-]+)/g, /`([^`\n]+)`/g]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const inner = m[1]
      if (!inner) continue
      const normalized = inner.toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push({ raw: m[0], normalized, recognized: knownSet.has(normalized) })
    }
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
