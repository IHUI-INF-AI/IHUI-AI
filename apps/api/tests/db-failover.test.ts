import { describe, it, expect } from 'vitest'
import { FailoverManager, DbRole, DEFAULT_FAILOVER_CONFIG } from '../src/utils/db-failover.js'

describe('db-failover — 数据库故障转移', () => {
  describe('DEFAULT_FAILOVER_CONFIG', () => {
    it('checkIntervalSec=1', () => expect(DEFAULT_FAILOVER_CONFIG.checkIntervalSec).toBe(1))
    it('failThreshold=3', () => expect(DEFAULT_FAILOVER_CONFIG.failThreshold).toBe(3))
    it('recoveryThreshold=2', () => expect(DEFAULT_FAILOVER_CONFIG.recoveryThreshold).toBe(2))
    it('maxLagSec=10', () => expect(DEFAULT_FAILOVER_CONFIG.maxLagSec).toBe(10))
  })

  describe('add 注册节点', () => {
    it('默认 role=SLAVE priority=100', () => {
      const f = new FailoverManager()
      f.add('s1')
      const s = f.status()
      expect(s.s1.role).toBe(DbRole.SLAVE)
      expect(s.s1.priority).toBe(100)
      expect(s.s1.healthy).toBe(true)
    })
    it('自定义 role 和 priority', () => {
      const f = new FailoverManager()
      f.add('m1', DbRole.MASTER, 200)
      expect(f.status().m1.role).toBe(DbRole.MASTER)
      expect(f.status().m1.priority).toBe(200)
    })
  })

  describe('heartbeat 健康探测', () => {
    it('失败累计 failThreshold 次后标记不健康', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 3 })
      f.add('m1', DbRole.MASTER)
      f.heartbeat('m1', false)
      f.heartbeat('m1', false)
      expect(f.status().m1.healthy).toBe(true)
      f.heartbeat('m1', false)
      expect(f.status().m1.healthy).toBe(false)
    })
    it('成功减少 failCount', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 3 })
      f.add('m1', DbRole.MASTER)
      f.heartbeat('m1', false)
      f.heartbeat('m1', false)
      f.heartbeat('m1', true)
      expect(f.status().m1.failCount).toBe(1)
    })
    it('从库 lagSec 超阈值标记不健康', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, maxLagSec: 10 })
      f.add('s1', DbRole.SLAVE)
      f.heartbeat('s1', true, 15)
      expect(f.status().s1.healthy).toBe(false)
    })
    it('不存在的节点不抛错', () => {
      const f = new FailoverManager()
      expect(() => f.heartbeat('missing', true)).not.toThrow()
    })
  })

  describe('failover 选举', () => {
    it('主库不健康时自动选举优先级最高的健康从库', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 1 })
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      f.add('s2', DbRole.SLAVE, 150)
      f.heartbeat('m1', false) // 触发主库不健康 + maybeElect
      expect(f.getMasterId()).toBe('s1') // 优先级最高
      expect(f.status().m1.role).toBe(DbRole.OFFLINE)
    })
    it('优先级相同选延迟最低的', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 1 })
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      f.add('s2', DbRole.SLAVE, 200)
      f.heartbeat('s1', true, 5)
      f.heartbeat('s2', true, 1)
      f.heartbeat('m1', false) // 触发选举
      expect(f.getMasterId()).toBe('s2') // 延迟更低
    })
    it('forceFailover 手动触发', () => {
      const f = new FailoverManager()
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      const newMaster = f.forceFailover()
      expect(newMaster).toBe('s1')
      expect(f.status().m1.role).toBe(DbRole.OFFLINE)
    })
    it('无健康从库返回 null', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 1 })
      f.add('m1', DbRole.MASTER)
      f.add('s1', DbRole.SLAVE)
      f.heartbeat('s1', false) // 从库不健康
      f.heartbeat('m1', false) // 主库不健康
      expect(f.forceFailover()).toBeNull()
    })
    it('onChange 回调被调用', () => {
      const calls: Array<[string, DbRole, DbRole]> = []
      const f = new FailoverManager({}, (id, oldR, newR) => calls.push([id, oldR, newR]))
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      f.forceFailover()
      expect(calls.length).toBeGreaterThan(0)
    })
  })

  describe('getReadableNodeId', () => {
    it('优先返回健康主节点', () => {
      const f = new FailoverManager()
      f.add('m1', DbRole.MASTER)
      f.add('s1', DbRole.SLAVE)
      expect(f.getReadableNodeId()).toBe('m1')
    })
    it('主节点不健康时返回优先级最高的健康从库', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 1 })
      f.add('m1', DbRole.MASTER)
      f.add('s1', DbRole.SLAVE, 200)
      f.add('s2', DbRole.SLAVE, 100)
      f.heartbeat('m1', false)
      // 选举后 s1 成为主，可读
      expect(f.getReadableNodeId()).toBe('s1')
    })
    it('无可用节点返回 null', () => {
      const f = new FailoverManager({ ...DEFAULT_FAILOVER_CONFIG, failThreshold: 1 })
      f.add('s1', DbRole.SLAVE)
      f.heartbeat('s1', false)
      expect(f.getReadableNodeId()).toBeNull()
    })
  })

  describe('getEvents', () => {
    it('记录角色变更事件', () => {
      const f = new FailoverManager()
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      f.forceFailover()
      const events = f.getEvents()
      expect(events.length).toBeGreaterThanOrEqual(2) // 老主降级 + 新主提升
    })
    it('limit 限制返回数', () => {
      const f = new FailoverManager()
      f.add('m1', DbRole.MASTER, 100)
      f.add('s1', DbRole.SLAVE, 200)
      f.forceFailover()
      expect(f.getEvents(1).length).toBeLessThanOrEqual(1)
    })
  })
})
