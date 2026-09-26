// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D68 统一多源建议面板 —— 聚合 hook(六源中五源远端 + 文件源由宿主注入)。
// 取数一律走 @ihui/api-client 出口(§3 共享层优先;端内裸 fetch 会被守门 73 拦):
//   任务  listAutomations      技能  listAiSkills(category:'all')
//   插件  getInstalledPlugins  连接器 getConnectors      Agent  getAgents
//   文件  宿主传入(message-input 已有 useMentionFiles 懒加载,不新建第二条取数链)
// 每源独立 loading/ready/failed:单源失败只标失败该源,其余照常可用(三句降级的数据面)。

'use client'

import * as React from 'react'
import {
  getAgents,
  getConnectors,
  getInstalledPlugins,
  listAiSkills,
  listAutomations,
} from '@ihui/api-client'

import {
  DEFAULT_SOURCE_PROVENANCE,
  SUGGESTION_SOURCE_KINDS,
  type SuggestionSourceKind,
  type SuggestionSourceRunStatus,
  type SuggestionSourceState,
  type UnifiedSuggestionItem,
} from '@/components/chat/unified-suggestion-sources'

type RemoteSourceKind = Exclude<SuggestionSourceKind, 'file'>

const REMOTE_SOURCES: readonly RemoteSourceKind[] = ['task', 'skill', 'plugin', 'connector', 'agent']

interface SourceSlot {
  status: SuggestionSourceRunStatus
  items: UnifiedSuggestionItem[]
}

function makeItem(
  source: SuggestionSourceKind,
  id: string,
  label: string,
  detail?: string,
  provenance?: UnifiedSuggestionItem['provenance'],
): UnifiedSuggestionItem {
  return {
    id: `${source}:${id}`,
    source,
    label,
    detail,
    provenance: provenance ?? DEFAULT_SOURCE_PROVENANCE[source],
  }
}

/** 单源取数器:成功返回条目数组,失败抛错(由调用方标 failed) */
async function fetchSourceItems(source: RemoteSourceKind): Promise<UnifiedSuggestionItem[]> {
  switch (source) {
    case 'task': {
      const res = await listAutomations({ limit: 20 })
      // prompt 理论上必填;防御式取值避免个别脏行把整源炸成 failed
      return res.items.map((a) =>
        makeItem('task', a.id, a.name, typeof a.prompt === 'string' ? a.prompt.slice(0, 80) : undefined),
      )
    }
    case 'skill': {
      const res = await listAiSkills({ category: 'all' })
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error(res.success ? 'skills payload missing' : (res.error ?? 'skills request failed'))
      }
      return res.data.map((s) =>
        makeItem(
          'skill',
          s.id,
          s.name,
          s.description,
          // 唯一有逐条来源信号的源:AiSkillMeta.source==='builtin' → 内置标注
          s.source === 'builtin' ? 'builtin' : undefined,
        ),
      )
    }
    case 'plugin': {
      const res = await getInstalledPlugins()
      // authenticated=false 不是错误(未登录态),按 ready + 空列表呈现,不谎报 failed
      return Object.keys(res.states).map((pluginId) => makeItem('plugin', pluginId, pluginId))
    }
    case 'connector': {
      const res = await getConnectors()
      if (!res.success || !res.data) {
        throw new Error(res.success ? 'connectors payload missing' : (res.error ?? 'connectors request failed'))
      }
      return res.data.connectors.map((c) => makeItem('connector', c.key, c.name, c.type))
    }
    case 'agent': {
      const res = await getAgents({ page: 1, pageSize: 20 })
      if (!res.success || !res.data) {
        throw new Error(res.success ? 'agents payload missing' : (res.error ?? 'agents request failed'))
      }
      return res.data.list.map((a) => makeItem('agent', a.id, a.name, a.description))
    }
  }
}

export interface UseUnifiedSuggestionsResult {
  /** 固定六源顺序的状态数组(file 源为宿主注入条目 + ready 态) */
  states: SuggestionSourceState[]
  /** 重试单个失败源(仅远端五源有效) */
  retry: (source: SuggestionSourceKind) => void
}

/**
 * open 首次为 true 时懒加载;每源独立 settle。epoch ref 保证重进/重试后
 * 旧请求的回写被丢弃(并行会话把面板反复开关时不得出现"旧状态盖新状态")。
 */
export function useUnifiedSuggestions(
  open: boolean,
  fileItems: readonly UnifiedSuggestionItem[],
): UseUnifiedSuggestionsResult {
  const [slots, setSlots] = React.useState<Record<RemoteSourceKind, SourceSlot>>(() => ({
    task: { status: 'idle', items: [] },
    skill: { status: 'idle', items: [] },
    plugin: { status: 'idle', items: [] },
    connector: { status: 'idle', items: [] },
    agent: { status: 'idle', items: [] },
  }))
  const loadedRef = React.useRef(false)
  const epochRef = React.useRef(0)
  const fileItemsRef = React.useRef(fileItems)
  fileItemsRef.current = fileItems

  React.useEffect(() => {
    if (!open) return
    if (loadedRef.current) return
    loadedRef.current = true
    const epoch = ++epochRef.current
    const write = (source: RemoteSourceKind, patch: SourceSlot): void => {
      if (epoch !== epochRef.current) return
      setSlots((prev) => (prev[source] === patch ? prev : { ...prev, [source]: patch }))
    }
    for (const source of REMOTE_SOURCES) {
      write(source, { status: 'loading', items: [] })
      void fetchSourceItems(source)
        .then((items) => {
          write(source, { status: 'ready', items })
        })
        .catch(() => {
          // 单源失败只标该源:其余源不受影响(降级三句的消费面在渲染层)
          write(source, { status: 'failed', items: [] })
        })
    }
  }, [open])

  const retry = React.useCallback(
    (source: SuggestionSourceKind) => {
      if (!REMOTE_SOURCES.includes(source as RemoteSourceKind)) return
      const epoch = epochRef.current
      const write = (patch: SourceSlot): void => {
        if (epoch !== epochRef.current) return
        setSlots((prev) => ({ ...prev, [source]: patch }))
      }
      write({ status: 'loading', items: [] })
      void fetchSourceItems(source as RemoteSourceKind)
        .then((items) => write({ status: 'ready', items }))
        .catch(() => write({ status: 'failed', items: [] }))
    },
    [],
  )

  const states = React.useMemo<SuggestionSourceState[]>(
    () =>
      SUGGESTION_SOURCE_KINDS.map((source) =>
        source === 'file'
          ? { source, status: 'ready' as const, items: [...fileItemsRef.current] }
          : { source, ...slots[source as RemoteSourceKind] },
      ),
    [slots, fileItems],
  )

  return { states, retry }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
