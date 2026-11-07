// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export interface ChildTool {
  name: string
  detail: unknown
}

export interface ChildRequest {
  id: string
  summary: string
}

export interface ChildRecord {
  id: string
  status: string
  requests: ChildRequest[]
  tools: ChildTool[]
}

export type ChildRead =
  | {
      disposition: 'ok'
      surface: 'snapshots'
      snapshots: { id: string; status: string; requestCount: number; toolCount: number }[]
    }
  | { disposition: 'ok'; surface: 'requests'; childId: string; requests: ChildRequest[] }
  | { disposition: 'ok'; surface: 'tool'; childId: string; tool: ChildTool }
  | { disposition: 'absent'; reason: 'child-absent' | 'tool-absent' }
  | {
      disposition: 'unjudged'
      reason: 'children-unmeasured' | 'roster-invalid' | 'child-unmeasured' | 'tool-unmeasured'
    }

function named(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function indexChildren(children: ChildRecord[]): Map<string, ChildRecord> | null {
  const map = new Map<string, ChildRecord>()
  for (const child of children) {
    const id = named(child?.id)
    if (!id || map.has(id)) return null
    if (!Array.isArray(child.requests) || !Array.isArray(child.tools)) return null
    map.set(id, child)
  }
  return map
}

/**
 * 子代理分三层读：快照、某一个的请求、某一个工具的明细。
 * 快照不带请求正文和工具明细。没点名子代理或工具时不把全体倒出来。
 */
export function readChildSurface(input: {
  children: ChildRecord[] | null
  surface: 'snapshots' | 'requests' | 'tool'
  childId?: string | null
  toolName?: string | null
}): ChildRead {
  if (input.children === null) return { disposition: 'unjudged', reason: 'children-unmeasured' }
  if (!Array.isArray(input.children)) return { disposition: 'unjudged', reason: 'roster-invalid' }
  const roster = indexChildren(input.children)
  if (!roster) return { disposition: 'unjudged', reason: 'roster-invalid' }

  if (input.surface === 'snapshots') {
    const snapshots = [...roster.values()].map((child) => ({
      id: child.id,
      status: child.status,
      requestCount: child.requests.length,
      toolCount: child.tools.length,
    }))
    return { disposition: 'ok', surface: 'snapshots', snapshots }
  }

  const childId = named(input.childId)
  if (!childId) return { disposition: 'unjudged', reason: 'child-unmeasured' }
  const child = roster.get(childId)
  if (!child) return { disposition: 'absent', reason: 'child-absent' }

  if (input.surface === 'requests') {
    return {
      disposition: 'ok',
      surface: 'requests',
      childId,
      requests: child.requests.map((row) => ({ id: row.id, summary: row.summary })),
    }
  }

  const toolName = named(input.toolName)
  if (!toolName) return { disposition: 'unjudged', reason: 'tool-unmeasured' }
  const tool = child.tools.find((row) => row.name === toolName)
  if (!tool) return { disposition: 'absent', reason: 'tool-absent' }
  return {
    disposition: 'ok',
    surface: 'tool',
    childId,
    tool: { name: tool.name, detail: tool.detail },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
