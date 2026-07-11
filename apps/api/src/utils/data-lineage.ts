/**
 * 数据血缘追踪.
 *
 * 设计:
 *   - 节点: 表 / 字段 / 任务 / 产物
 *   - 边: 上游 -> 下游 (支持 reads/writes/derives/depends)
 *   - 反查: 给定节点, 查所有上游/下游 (递归)
 *   - 影响面分析: 节点变更时, 列出所有受影响的下游
 *   - 可视化友好: dot 格式输出
 *
 * 参考: git show 3ee96cf0:server/app/utils/data_lineage.py
 */

/** 节点类型. */
export enum NodeKind {
  TABLE = 'table',
  COLUMN = 'column',
  JOB = 'job',
  ARTIFACT = 'artifact',
  DATASET = 'dataset',
  METRIC = 'metric',
}

/** 边类型. */
export enum EdgeKind {
  READS = 'reads',
  WRITES = 'writes',
  DERIVES = 'derives',
  DEPENDS = 'depends',
}

/** 血缘节点. */
export interface LineageNode {
  id: string
  kind: string
  name: string
  extra: Record<string, unknown>
  createdAt: number
}

/** 血缘边. */
export interface LineageEdge {
  src: string
  dst: string
  kind: string
  weight: number
  createdAt: number
}

/** 影响面分析结果. */
export interface LineageImpact {
  nodeId: string
  directDownstream: string[]
  allDownstream: string[]
  directUpstream: string[]
  allUpstream: string[]
}

/**
 * 数据血缘追踪器.
 * 支持字段级/表级 lineage 追踪, 影响面分析, 环检测.
 */
export class DataLineage {
  private readonly nodes = new Map<string, LineageNode>()
  /** 出边: src -> edges */
  private readonly out = new Map<string, LineageEdge[]>()
  /** 入边: dst -> edges */
  private readonly inn = new Map<string, LineageEdge[]>()

  /** 添加节点. */
  addNode(id: string, kind: string, name = '', extra?: Record<string, unknown>): LineageNode {
    const old = this.nodes.get(id)
    const n: LineageNode = {
      id,
      kind,
      name: name || id,
      extra: extra ?? {},
      createdAt: old?.createdAt ?? Date.now() / 1000,
    }
    this.nodes.set(id, n)
    return n
  }

  /** 获取节点. */
  getNode(id: string): LineageNode | undefined {
    return this.nodes.get(id)
  }

  /** 列出节点 (可按 kind 过滤). */
  listNodes(kind?: string): LineageNode[] {
    const arr = Array.from(this.nodes.values())
    return kind ? arr.filter((n) => n.kind === kind) : arr
  }

  /** 添加边 (自动补全节点). */
  addEdge(src: string, dst: string, kind: string = EdgeKind.DEPENDS, weight = 1): LineageEdge {
    if (!this.nodes.has(src)) this.addNode(src, NodeKind.TABLE, src)
    if (!this.nodes.has(dst)) this.addNode(dst, NodeKind.TABLE, dst)
    // 去重 (同 src+dst+kind 视为同一条边, weight 累加)
    const existing = this.out.get(src)
    if (existing) {
      for (const e of existing) {
        if (e.dst === dst && e.kind === kind) {
          e.weight += weight
          return e
        }
      }
    }
    const e: LineageEdge = { src, dst, kind, weight, createdAt: Date.now() / 1000 }
    if (!this.out.has(src)) this.out.set(src, [])
    this.out.get(src)!.push(e)
    if (!this.inn.has(dst)) this.inn.set(dst, [])
    this.inn.get(dst)!.push(e)
    return e
  }

  /** 删除边. */
  removeEdge(src: string, dst: string, kind?: string): number {
    let n = 0
    const outArr = this.out.get(src)
    if (outArr) {
      const kept = outArr.filter((e) => {
        if (e.dst === dst && (kind === undefined || e.kind === kind)) {
          n += 1
          return false
        }
        return true
      })
      this.out.set(src, kept)
    }
    const inArr = this.inn.get(dst)
    if (inArr) {
      this.inn.set(
        dst,
        inArr.filter((e) => !(e.src === src && (kind === undefined || e.kind === kind))),
      )
    }
    return n
  }

  /** 删除节点 (含相关边). */
  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false
    const outEdges = this.out.get(id) ?? []
    const inEdges = this.inn.get(id) ?? []
    for (const e of outEdges) {
      const arr = this.inn.get(e.dst)
      if (arr)
        this.inn.set(
          e.dst,
          arr.filter((x) => x.src !== id),
        )
    }
    for (const e of inEdges) {
      const arr = this.out.get(e.src)
      if (arr)
        this.out.set(
          e.src,
          arr.filter((x) => x.dst !== id),
        )
    }
    this.out.delete(id)
    this.inn.delete(id)
    this.nodes.delete(id)
    return true
  }

  /** 直接下游. */
  directDownstream(id: string): string[] {
    return (this.out.get(id) ?? []).map((e) => e.dst)
  }

  /** 直接上游. */
  directUpstream(id: string): string[] {
    return (this.inn.get(id) ?? []).map((e) => e.src)
  }

  /** 全部下游 (BFS, 最大深度限制). */
  allDownstream(id: string, maxDepth = 10): string[] {
    return this.bfs(id, 'downstream', maxDepth)
  }

  /** 全部上游 (BFS). */
  allUpstream(id: string, maxDepth = 10): string[] {
    return this.bfs(id, 'upstream', maxDepth)
  }

  private bfs(start: string, direction: 'downstream' | 'upstream', maxDepth: number): string[] {
    if (!this.nodes.has(start)) return []
    const visited = new Set<string>([start])
    const order: string[] = []
    const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }]
    while (queue.length > 0) {
      const { id: cur, depth } = queue.shift()!
      if (depth >= maxDepth) continue
      const edges = direction === 'downstream' ? this.out.get(cur) : this.inn.get(cur)
      const nextIds = (edges ?? []).map((e) => (direction === 'downstream' ? e.dst : e.src))
      for (const nid of nextIds) {
        if (visited.has(nid)) continue
        visited.add(nid)
        order.push(nid)
        queue.push({ id: nid, depth: depth + 1 })
      }
    }
    return order
  }

  /** 影响面分析. */
  impact(id: string, maxDepth = 10): LineageImpact {
    return {
      nodeId: id,
      directDownstream: this.directDownstream(id),
      allDownstream: this.allDownstream(id, maxDepth),
      directUpstream: this.directUpstream(id),
      allUpstream: this.allUpstream(id, maxDepth),
    }
  }

  /** 检测环 (DFS). */
  findCycles(): string[][] {
    const cycles: string[][] = []
    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    for (const id of this.nodes.keys()) color.set(id, WHITE)
    const path: string[] = []

    const dfs = (u: string): void => {
      color.set(u, GRAY)
      path.push(u)
      for (const e of this.out.get(u) ?? []) {
        const v = e.dst
        const c = color.get(v) ?? WHITE
        if (c === GRAY) {
          const idx = path.indexOf(v)
          cycles.push([...path.slice(idx), v])
        } else if (c === WHITE) {
          dfs(v)
        }
      }
      path.pop()
      color.set(u, BLACK)
    }

    for (const id of this.nodes.keys()) {
      if (color.get(id) === WHITE) dfs(id)
    }
    return cycles
  }

  /** 生成 Graphviz dot 格式. */
  toDot(): string {
    const nodes = Array.from(this.nodes.values())
    const edges: LineageEdge[] = []
    for (const arr of this.out.values()) edges.push(...arr)
    const lines = ['digraph lineage {']
    for (const n of nodes) {
      const label = `${n.name}\\n(${n.kind})`
      lines.push(`  "${n.id}" [label="${label}"];`)
    }
    for (const e of edges) {
      lines.push(`  "${e.src}" -> "${e.dst}" [label="${e.kind}"];`)
    }
    lines.push('}')
    return lines.join('\n')
  }

  /** 统计. */
  stats(): { nodeCount: number; edgeCount: number; byKind: Record<string, number> } {
    let edgeCount = 0
    for (const arr of this.out.values()) edgeCount += arr.length
    const byKind: Record<string, number> = {}
    for (const n of this.nodes.values()) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1
    return { nodeCount: this.nodes.size, edgeCount, byKind }
  }

  /** 清空. */
  clear(): void {
    this.nodes.clear()
    this.out.clear()
    this.inn.clear()
  }
}

/** 全局单例. */
export const dataLineage = new DataLineage()
