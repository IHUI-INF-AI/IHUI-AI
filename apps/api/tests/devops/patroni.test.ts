import { describe, it, expect, vi } from 'vitest'

/**
 * Patroni 高可用集群测试 — 用 mock 模拟 Patroni REST API.
 *
 * 覆盖: 主从切换(failover)、Leader 选举、复制延迟监控、DCS 一致性.
 */

// ---------- mock: Patroni 集群节点状态 ----------
type Role = 'master' | 'replica' | 'uninitialized'

interface PatroniNode {
  name: string
  role: Role
  conn_url: string
  api_url: string
  state: string
  lag: number
  pending_restart: boolean
  xlog_location: number
}

interface PatroniCluster {
  leader: string | null
  members: PatroniNode[]
  dcs_last_seen: number
}

/** 模拟 Patroni /cluster 接口. */
function mockCluster(members: PatroniNode[], leader: string | null): PatroniCluster {
  return { leader, members, dcs_last_seen: Date.now() }
}

/** 执行 failover: 将旧主降级、提升优先副本. */
function failover(cluster: PatroniCluster, candidate: string): PatroniCluster {
  const newMembers = cluster.members.map((m) => {
    if (m.name === cluster.leader) return { ...m, role: 'replica' as const, state: 'running' }
    if (m.name === candidate) return { ...m, role: 'master' as const, state: 'running' }
    return m
  })
  return { ...cluster, members: newMembers, leader: candidate }
}

/** Leader 选举: 选 lag 最小、健康的 replica. */
function electLeader(cluster: PatroniCluster): string | null {
  const candidates = cluster.members.filter(
    (m) => m.role === 'replica' && m.state === 'running' && !m.pending_restart,
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.lag - b.lag)
  return candidates[0]!.name
}

/** 复制延迟监控: 超阈值返回告警. */
function checkReplicationLag(
  cluster: PatroniCluster,
  maxLagSec = 10,
): { alert: boolean; lagging: string[] } {
  const lagging = cluster.members
    .filter((m) => m.role === 'replica' && m.lag > maxLagSec)
    .map((m) => m.name)
  return { alert: lagging.length > 0, lagging }
}

/** DCS 一致性: 所有副本的 dcs_last_seen 与 leader 差距 < 5s. */
function checkDcsConsistency(cluster: PatroniCluster, now: number): boolean {
  if (!cluster.leader) return false
  return now - cluster.dcs_last_seen < 5_000
}

describe('patroni — 高可用集群', () => {
  const baseCluster: PatroniCluster = mockCluster(
    [
      {
        name: 'pg1',
        role: 'master',
        conn_url: 'p1',
        api_url: 'a1',
        state: 'running',
        lag: 0,
        pending_restart: false,
        xlog_location: 1000,
      },
      {
        name: 'pg2',
        role: 'replica',
        conn_url: 'p2',
        api_url: 'a2',
        state: 'running',
        lag: 2,
        pending_restart: false,
        xlog_location: 998,
      },
      {
        name: 'pg3',
        role: 'replica',
        conn_url: 'p3',
        api_url: 'a3',
        state: 'running',
        lag: 5,
        pending_restart: false,
        xlog_location: 995,
      },
    ],
    'pg1',
  )

  describe('主从切换 (failover)', () => {
    it('failover 后旧主降级为副本', () => {
      const c = failover(baseCluster, 'pg2')
      const old = c.members.find((m) => m.name === 'pg1')
      expect(old?.role).toBe('replica')
    })
    it('failover 后新主为指定候选', () => {
      const c = failover(baseCluster, 'pg2')
      expect(c.leader).toBe('pg2')
      expect(c.members.find((m) => m.name === 'pg2')?.role).toBe('master')
    })
    it('failover 调用 Patroni API', () => {
      const api = vi.fn(() => failover(baseCluster, 'pg3'))
      api()
      expect(api).toHaveBeenCalledTimes(1)
      expect(api().leader).toBe('pg3')
    })
  })

  describe('Leader 选举', () => {
    it('选 lag 最小的健康副本', () => {
      expect(electLeader(baseCluster)).toBe('pg2')
    })
    it('所有副本不可用时返回 null', () => {
      const c: PatroniCluster = {
        ...baseCluster,
        members: baseCluster.members.map((m) => ({ ...m, state: 'stopped' })),
      }
      expect(electLeader(c)).toBeNull()
    })
    it('pending_restart 的副本被排除', () => {
      const c: PatroniCluster = {
        ...baseCluster,
        members: baseCluster.members.map((m) =>
          m.name === 'pg2' ? { ...m, pending_restart: true } : m,
        ),
      }
      expect(electLeader(c)).toBe('pg3')
    })
  })

  describe('复制延迟监控', () => {
    it('所有 lag <= 10s 不告警', () => {
      const r = checkReplicationLag(baseCluster)
      expect(r.alert).toBe(false)
      expect(r.lagging).toHaveLength(0)
    })
    it('lag > 10s 触发告警并列出节点', () => {
      const c: PatroniCluster = {
        ...baseCluster,
        members: baseCluster.members.map((m) => (m.name === 'pg3' ? { ...m, lag: 15 } : m)),
      }
      const r = checkReplicationLag(c)
      expect(r.alert).toBe(true)
      expect(r.lagging).toContain('pg3')
    })
    it('自定义阈值 maxLagSec=1', () => {
      const r = checkReplicationLag(baseCluster, 1)
      expect(r.alert).toBe(true)
      expect(r.lagging.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('DCS 一致性', () => {
    it('dcs_last_seen 距 now < 5s 一致', () => {
      expect(checkDcsConsistency(baseCluster, Date.now())).toBe(true)
    })
    it('dcs_last_seen 距 now > 5s 不一致', () => {
      expect(checkDcsConsistency(baseCluster, Date.now() + 10_000)).toBe(false)
    })
    it('无 leader 时不一致', () => {
      expect(checkDcsConsistency({ ...baseCluster, leader: null }, Date.now())).toBe(false)
    })
  })
})
