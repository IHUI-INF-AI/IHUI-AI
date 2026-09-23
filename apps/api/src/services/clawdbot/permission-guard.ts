// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { EventEmitter } from 'node:events'
import { PERMISSION_MODE_SET } from '@ihui/types/permission-mode'
import type { PermissionModeId } from '@ihui/types/permission-mode'
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

/**
 * 权限档词汇的唯一真源是 `@ihui/types/permission-mode`(G-161)。
 *
 * 本行此前是**残留的第 8 套副本**:`'default'|'acceptEdits'|'bypassPermissions'|'plan'|'manual'`
 * 五值手抄。守门第 68 项的 R4 只扫 `KNOWN_CONSUMERS` 硬编码清单,本文件不在其中,
 * 所以这份副本一直没被咬到 —— 新增第 6 档时这里必漏接(静默 `parsePermissionMode` 返回
 * undefined,即"客户端发了但服务端当没发")。改 `PermissionModeId` 后漂移会以 tsc 报错
 * 的形式暴露,并由 `packages/types/tests/permission-mode-vocabulary.test.ts` 全仓兜底。
 */
export type PermissionMode = PermissionModeId

export type PermissionDecision = 'allow' | 'deny' | 'ask'

export type DangerLevel = 'read' | 'write' | 'dangerous'

/** 与注册表同一 Set 实例(取值集合逐字不变:仍是 5 个规范档精确匹配,不做归一)。 */
const VALID_PERMISSION_MODES: ReadonlySet<string> = PERMISSION_MODE_SET

export function parsePermissionMode(s: string | undefined | null): PermissionMode | undefined {
  if (!s || typeof s !== 'string') return undefined
  const trimmed = s.trim()
  if (VALID_PERMISSION_MODES.has(trimmed)) return trimmed as PermissionMode
  return undefined
}

export function checkPermissionMode(
  toolName: string,
  mode: PermissionMode | undefined,
  dangerLevel: DangerLevel,
): PermissionDecision {
  void toolName
  const resolvedMode: PermissionMode = mode ?? 'default'
  switch (resolvedMode) {
    case 'bypassPermissions':
      return 'allow'
    case 'default':
      return dangerLevel === 'read' ? 'allow' : 'ask'
    case 'acceptEdits':
      return dangerLevel === 'dangerous' ? 'ask' : 'allow'
    case 'plan':
      return dangerLevel === 'read' ? 'allow' : 'deny'
    case 'manual':
      return 'ask'
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
