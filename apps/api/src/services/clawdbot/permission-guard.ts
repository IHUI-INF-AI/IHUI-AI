import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type PermissionAction = 'read' | 'write' | 'execute' | 'delete' | 'admin'

export interface PermissionRule {
  id: string
  role: string
  resource: string
  actions: PermissionAction[]
  effect: 'allow' | 'deny'
}

export interface PermissionCheckInput {
  role: string
  resource: string
  action: PermissionAction
}

export class PermissionGuardError extends Error {
  constructor(
    message: string,
    readonly code: 'denied' | 'not_found' | 'invalid',
  ) {
    super(message)
    this.name = 'PermissionGuardError'
  }
}

export class PermissionGuard extends EventEmitter {
  private readonly rules = new Map<string, PermissionRule>()
  private readonly defaultAllow = false

  addRule(rule: Omit<PermissionRule, 'id'>): PermissionRule {
    const id = `perm_${crypto.randomUUID()}`
    const full: PermissionRule = { ...rule, id }
    this.rules.set(id, full)
    logger.info(
      { ruleId: id, role: rule.role, resource: rule.resource },
      '[PermissionGuard] Rule added',
    )
    this.emit('rule:added', full)
    return full
  }

  removeRule(id: string): boolean {
    const removed = this.rules.delete(id)
    if (removed) this.emit('rule:removed', id)
    return removed
  }

  check(input: PermissionCheckInput): boolean {
    const { role, resource, action } = input
    const matching = Array.from(this.rules.values())
      .filter((r) => r.role === role && r.resource === resource)
      .sort((a) => (a.effect === 'deny' ? -1 : 1))
    if (matching.length === 0) return this.defaultAllow
    for (const rule of matching) {
      if (rule.actions.includes(action)) {
        return rule.effect === 'allow'
      }
    }
    return this.defaultAllow
  }

  require(input: PermissionCheckInput): void {
    if (!this.check(input)) {
      throw new PermissionGuardError(
        `权限拒绝: role=${input.role} resource=${input.resource} action=${input.action}`,
        'denied',
      )
    }
  }

  listRules(): PermissionRule[] {
    return Array.from(this.rules.values())
  }

  listByRole(role: string): PermissionRule[] {
    return this.listRules().filter((r) => r.role === role)
  }

  listByResource(resource: string): PermissionRule[] {
    return this.listRules().filter((r) => r.resource === resource)
  }

  getMatrix(): Array<{ role: string; resource: string; actions: PermissionAction[] }> {
    const map = new Map<
      string,
      { role: string; resource: string; actions: Set<PermissionAction> }
    >()
    for (const rule of this.rules.values()) {
      if (rule.effect !== 'allow') continue
      const key = `${rule.role}:${rule.resource}`
      let entry = map.get(key)
      if (!entry) {
        entry = { role: rule.role, resource: rule.resource, actions: new Set() }
        map.set(key, entry)
      }
      rule.actions.forEach((a) => entry!.actions.add(a))
    }
    return Array.from(map.values()).map((e) => ({ ...e, actions: Array.from(e.actions) }))
  }

  getRoles(): string[] {
    return Array.from(new Set(Array.from(this.rules.values()).map((r) => r.role)))
  }

  getResources(): string[] {
    return Array.from(new Set(Array.from(this.rules.values()).map((r) => r.resource)))
  }

  getStats() {
    return {
      totalRules: this.rules.size,
      roles: this.getRoles().length,
      resources: this.getResources().length,
    }
  }
}

let instance: PermissionGuard | null = null

export function getPermissionGuard(): PermissionGuard {
  if (!instance) instance = new PermissionGuard()
  return instance
}
