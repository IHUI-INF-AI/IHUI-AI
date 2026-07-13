import { describe, it, expect } from 'vitest'
import { DataLineage, NodeKind, EdgeKind } from '../src/utils/data-lineage.js'

describe('data-lineage — 数据血缘追踪', () => {
  describe('节点管理', () => {
    it('addNode 创建节点', () => {
      const g = new DataLineage()
      const n = g.addNode('t1', NodeKind.TABLE, 'users')
      expect(n.id).toBe('t1')
      expect(n.name).toBe('users')
      expect(n.kind).toBe(NodeKind.TABLE)
    })
    it('addNode 默认 name=id', () => {
      const g = new DataLineage()
      const n = g.addNode('t1', NodeKind.TABLE)
      expect(n.name).toBe('t1')
    })
    it('addNode 保留 createdAt（重复 add 不重置）', () => {
      const g = new DataLineage()
      const n1 = g.addNode('t1', NodeKind.TABLE)
      const n2 = g.addNode('t1', NodeKind.TABLE, 'new name')
      expect(n2.createdAt).toBe(n1.createdAt)
      expect(n2.name).toBe('new name')
    })
    it('getNode 返回节点', () => {
      const g = new DataLineage()
      g.addNode('t1', NodeKind.TABLE)
      expect(g.getNode('t1')).toBeDefined()
      expect(g.getNode('missing')).toBeUndefined()
    })
    it('listNodes 按 kind 过滤', () => {
      const g = new DataLineage()
      g.addNode('t1', NodeKind.TABLE)
      g.addNode('j1', NodeKind.JOB)
      g.addNode('t2', NodeKind.TABLE)
      expect(g.listNodes(NodeKind.TABLE)).toHaveLength(2)
      expect(g.listNodes()).toHaveLength(3)
    })
  })

  describe('边管理', () => {
    it('addEdge 自动补全节点', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      expect(g.getNode('a')).toBeDefined()
      expect(g.getNode('b')).toBeDefined()
    })
    it('addEdge 同 src+dst+kind 去重并累加 weight', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b', EdgeKind.DEPENDS)
      const e = g.addEdge('a', 'b', EdgeKind.DEPENDS)
      expect(e.weight).toBe(2)
      expect(g.directDownstream('a')).toEqual(['b'])
    })
    it('addEdge 不同 kind 不去重', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b', EdgeKind.READS)
      g.addEdge('a', 'b', EdgeKind.WRITES)
      expect(g.directDownstream('a')).toEqual(['b', 'b'])
    })
    it('removeEdge 返回删除数', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b', EdgeKind.READS)
      g.addEdge('a', 'b', EdgeKind.WRITES)
      expect(g.removeEdge('a', 'b')).toBe(2)
    })
    it('removeEdge 按 kind 过滤', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b', EdgeKind.READS)
      g.addEdge('a', 'b', EdgeKind.WRITES)
      expect(g.removeEdge('a', 'b', EdgeKind.READS)).toBe(1)
      expect(g.directDownstream('a')).toEqual(['b'])
    })
  })

  describe('上下游查询', () => {
    it('directDownstream 返回直接下游', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('a', 'c')
      expect(g.directDownstream('a').sort()).toEqual(['b', 'c'])
    })
    it('directUpstream 返回直接上游', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('c', 'b')
      expect(g.directUpstream('b').sort()).toEqual(['a', 'c'])
    })
    it('allDownstream BFS 递归下游', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      g.addEdge('c', 'd')
      expect(g.allDownstream('a').sort()).toEqual(['b', 'c', 'd'])
    })
    it('allUpstream BFS 递归上游', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      expect(g.allUpstream('c').sort()).toEqual(['a', 'b'])
    })
    it('allDownstream maxDepth 限制', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      g.addEdge('c', 'd')
      expect(g.allDownstream('a', 1)).toEqual(['b'])
    })
    it('不存在节点返回空数组', () => {
      const g = new DataLineage()
      expect(g.allDownstream('missing')).toEqual([])
    })
  })

  describe('impact 影响面分析', () => {
    it('返回完整影响面', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      const imp = g.impact('b')
      expect(imp.nodeId).toBe('b')
      expect(imp.directDownstream).toEqual(['c'])
      expect(imp.directUpstream).toEqual(['a'])
      expect(imp.allDownstream).toEqual(['c'])
      expect(imp.allUpstream).toEqual(['a'])
    })
  })

  describe('findCycles 环检测', () => {
    it('无环返回空', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      expect(g.findCycles()).toEqual([])
    })
    it('有环检测到环', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      g.addEdge('c', 'a')
      const cycles = g.findCycles()
      expect(cycles.length).toBeGreaterThan(0)
    })
  })

  describe('toDot', () => {
    it('生成 Graphviz dot 格式', () => {
      const g = new DataLineage()
      g.addNode('a', NodeKind.TABLE, 'A')
      g.addEdge('a', 'b', EdgeKind.READS)
      const dot = g.toDot()
      expect(dot).toContain('digraph lineage')
      expect(dot).toContain('"a" -> "b"')
      expect(dot).toContain('[label="reads"]')
    })
  })

  describe('stats', () => {
    it('反映节点/边/按 kind 分布', () => {
      const g = new DataLineage()
      g.addNode('t1', NodeKind.TABLE)
      g.addNode('t2', NodeKind.TABLE)
      g.addNode('j1', NodeKind.JOB)
      g.addEdge('t1', 't2')
      g.addEdge('t1', 'j1')
      const s = g.stats()
      expect(s.nodeCount).toBe(3)
      expect(s.edgeCount).toBe(2)
      expect(s.byKind[NodeKind.TABLE]).toBe(2)
      expect(s.byKind[NodeKind.JOB]).toBe(1)
    })
  })

  describe('removeNode', () => {
    it('删除节点及相关边', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.addEdge('b', 'c')
      expect(g.removeNode('b')).toBe(true)
      expect(g.getNode('b')).toBeUndefined()
      expect(g.directDownstream('a')).toEqual([])
      expect(g.directUpstream('c')).toEqual([])
    })
    it('不存在节点返回 false', () => {
      const g = new DataLineage()
      expect(g.removeNode('missing')).toBe(false)
    })
  })

  describe('clear', () => {
    it('清空所有数据', () => {
      const g = new DataLineage()
      g.addEdge('a', 'b')
      g.clear()
      expect(g.stats().nodeCount).toBe(0)
    })
  })
})
