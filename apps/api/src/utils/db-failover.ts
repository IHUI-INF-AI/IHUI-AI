/**
 * 数据库故障转移（bug170）。
 *
 * 主库故障时自动检测 → 选举优先级最高的健康从库 → 提升为新主。
 * 支持：健康探测 + 选举 + 角色变更回调。
 *
 * 迁移自旧架构 bug170_db_failover.py。
 */

/** 数据库节点角色。 */
export enum DbRole {
  MASTER = 'MASTER',
  SLAVE = 'SLAVE',
  OFFLINE = 'OFFLINE',
}

/** 数据库节点状态。 */
export interface DbNode {
  id: string
  role: DbRole
  /** 选举优先级（数值越大优先级越高） */
  priority: number
  /** 是否健康 */
  healthy: boolean
  /** 复制延迟（秒） */
  lagSec: number
  /** 最近一次探测时间戳（epoch ms） */
  lastCheck: number
  /** 连续失败次数 */
  failCount: number
}

/** 故障转移配置。 */
export interface FailoverConfig {
  /** 探测间隔（秒），默认 1 */
  checkIntervalSec: number
  /** 连续失败多少次标记为不健康，默认 3 */
  failThreshold: number
  /** 连续成功多少次恢复健康，默认 2 */
  recoveryThreshold: number
  /** 最大允许复制延迟（秒），超过标记从库不健康，默认 10 */
  maxLagSec: number
}

/** 默认配置。 */
export const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  checkIntervalSec: 1,
  failThreshold: 3,
  recoveryThreshold: 2,
  maxLagSec: 10,
}

/** 角色变更回调。 */
export type RoleChangeCallback = (nodeId: string, oldRole: DbRole, newRole: DbRole) => void

/** 角色变更事件记录。 */
export interface RoleChangeEvent {
  /** 时间戳（epoch ms） */
  ts: number
  nodeId: string
  oldRole: DbRole
  newRole: DbRole
}

/** 最大保留事件数。 */
const MAX_EVENTS = 200

/**
 * 主从故障转移管理器。
 *
 * 使用方式：
 * 1. add() 注册所有节点
 * 2. 定期调用 heartbeat() 上报健康状态
 * 3. 当主库不健康时自动触发选举
 * 4. forceFailover() 手动触发切换
 */
export class FailoverManager {
  private readonly cfg: FailoverConfig
  private readonly onChange?: RoleChangeCallback
  private readonly nodes = new Map<string, DbNode>()
  private readonly events: RoleChangeEvent[] = []

  constructor(config: FailoverConfig = DEFAULT_FAILOVER_CONFIG, onChange?: RoleChangeCallback) {
    this.cfg = config
    this.onChange = onChange
  }

  /** 注册一个数据库节点。 */
  add(nodeId: string, role: DbRole = DbRole.SLAVE, priority = 100): void {
    this.nodes.set(nodeId, {
      id: nodeId,
      role,
      priority,
      healthy: true,
      lagSec: 0,
      lastCheck: 0,
      failCount: 0,
    })
  }

  /**
   * 健康探测心跳。
   *
   * @param nodeId 节点 ID
   * @param ok 探测是否成功
   * @param lagSec 复制延迟（秒）
   */
  heartbeat(nodeId: string, ok: boolean, lagSec = 0): void {
    const node = this.nodes.get(nodeId)
    if (!node) return

    node.lastCheck = Date.now()
    node.lagSec = lagSec

    if (ok) {
      // 成功：减少失败计数
      node.failCount = Math.max(0, node.failCount - 1)
      // 连续成功达到阈值 → 恢复健康
      if (node.failCount === 0 && !node.healthy) {
        node.healthy = true
      }
    } else {
      // 失败：增加失败计数
      node.failCount++
      if (node.failCount >= this.cfg.failThreshold) {
        node.healthy = false
      }
    }

    // 从库延迟过大也标记不健康
    if (node.role === DbRole.SLAVE && lagSec > this.cfg.maxLagSec) {
      node.healthy = false
    }

    // 尝试选举
    this.maybeElect()
  }

  /**
   * 自动切换到优先级最高的健康从节点。
   * @returns 新主节点 ID，无可用节点时返回 null
   */
  failover(): string | null {
    return this.elect()
  }

  /** 强制触发故障转移（等同于 failover）。 */
  forceFailover(): string | null {
    return this.elect()
  }

  /** 获取所有节点状态快照。 */
  status(): Record<string, Omit<DbNode, 'id'>> {
    const result: Record<string, Omit<DbNode, 'id'>> = {}
    for (const [id, node] of this.nodes) {
      result[id] = {
        role: node.role,
        healthy: node.healthy,
        priority: node.priority,
        lagSec: node.lagSec,
        lastCheck: node.lastCheck,
        failCount: node.failCount,
      }
    }
    return result
  }

  /** 获取角色变更事件历史。 */
  getEvents(limit = 20): RoleChangeEvent[] {
    return this.events.slice(-limit)
  }

  /** 获取当前主节点 ID。 */
  getMasterId(): string | null {
    for (const node of this.nodes.values()) {
      if (node.role === DbRole.MASTER) return node.id
    }
    return null
  }

  /**
   * 获取当前可用于读取的节点（优先主节点，其次健康从节点）。
   * @returns 节点 ID，无可用节点时返回 null
   */
  getReadableNodeId(): string | null {
    // 优先返回主节点
    const master = this.getMasterId()
    if (master) {
      const masterNode = this.nodes.get(master)
      if (masterNode?.healthy) return master
    }
    // 其次返回优先级最高的健康从节点
    let best: DbNode | null = null
    for (const node of this.nodes.values()) {
      if (node.role === DbRole.SLAVE && node.healthy) {
        if (!best || node.priority > best.priority) {
          best = node
        }
      }
    }
    return best?.id ?? null
  }

  /** 检查是否需要选举，需要则执行。 */
  private maybeElect(): void {
    let masterExists = false
    let masterHealthy = true
    for (const node of this.nodes.values()) {
      if (node.role === DbRole.MASTER) {
        masterExists = true
        masterHealthy = node.healthy
        break
      }
    }
    // 无主或主不健康 → 触发选举
    if (!masterExists || !masterHealthy) {
      this.elect()
    }
  }

  /**
   * 从健康的从库中选优先级最高的提升为 MASTER。
   * @returns 新主节点 ID，无可用从库时返回 null
   */
  private elect(): string | null {
    // 筛选健康从库
    const candidates: DbNode[] = []
    let currentMaster: DbNode | null = null
    for (const node of this.nodes.values()) {
      if (node.role === DbRole.MASTER) currentMaster = node
      if (node.role === DbRole.SLAVE && node.healthy) {
        candidates.push(node)
      }
    }
    if (candidates.length === 0) return null

    // 选举：优先级最高 → 延迟最低
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return a.lagSec - b.lagSec
    })
    const winner = candidates[0]
    if (!winner) return null

    // 如果当前主就是 winner，无需切换
    if (currentMaster?.id === winner.id) return null

    // 老主降为 OFFLINE
    if (currentMaster) {
      this.setRole(currentMaster.id, DbRole.OFFLINE)
    }
    // 提升新主
    this.setRole(winner.id, DbRole.MASTER)
    return winner.id
  }

  /** 设置节点角色并记录事件。 */
  private setRole(nodeId: string, newRole: DbRole): void {
    const node = this.nodes.get(nodeId)
    if (!node) return
    const oldRole = node.role
    if (oldRole === newRole) return
    node.role = newRole
    this.events.push({
      ts: Date.now(),
      nodeId,
      oldRole,
      newRole,
    })
    if (this.events.length > MAX_EVENTS) {
      this.events.shift()
    }
    // 触发回调
    if (this.onChange) {
      try {
        this.onChange(nodeId, oldRole, newRole)
      } catch {
        // 回调失败不影响故障转移流程
      }
    }
  }
}
