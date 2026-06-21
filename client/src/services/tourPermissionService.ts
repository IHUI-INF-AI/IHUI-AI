import { StorageManager } from '@/utils/storage'

export type UserRole = 'new_user' | 'regular' | 'premium' | 'admin'
export type TourPermission = 'view' | 'edit' | 'delete' | 'manage'

export interface TourPermissionRule {
  tourId: string
  allowedRoles: UserRole[]
  deniedRoles: UserRole[]
  permissions: Record<TourPermission, UserRole[]>
  enabled: boolean
  priority: number
}

export interface TourAccessConfig {
  defaultRole: UserRole
  roleHierarchy: Record<UserRole, number>
  globalEnabled: boolean
  adminOverride: boolean
}

const STORAGE_KEY = 'tour_permissions'
const CONFIG_KEY = 'tour_access_config'

const DEFAULT_CONFIG: TourAccessConfig = {
  defaultRole: 'new_user',
  roleHierarchy: {
    'new_user': 0,
    'regular': 1,
    'premium': 2,
    'admin': 3,
  },
  globalEnabled: true,
  adminOverride: true,
}

const DEFAULT_PERMISSIONS: TourPermissionRule[] = [
  {
    tourId: 'vip-tour',
    allowedRoles: ['premium', 'admin'],
    deniedRoles: ['new_user'],
    permissions: {
      view: ['premium', 'admin'],
      edit: ['admin'],
      delete: ['admin'],
      manage: ['admin'],
    },
    enabled: true,
    priority: 90,
  },
  {
    tourId: 'admin-tour',
    allowedRoles: ['admin'],
    deniedRoles: ['new_user', 'regular', 'premium'],
    permissions: {
      view: ['admin'],
      edit: ['admin'],
      delete: ['admin'],
      manage: ['admin'],
    },
    enabled: true,
    priority: 80,
  },
]

class TourPermissionService {
  private rules: Map<string, TourPermissionRule>
  private config: TourAccessConfig

  constructor() {
    this.rules = new Map()
    this.config = this.loadConfig()
    this.loadRules()
  }

  private loadConfig(): TourAccessConfig {
    const stored = StorageManager.getItem<TourAccessConfig>(CONFIG_KEY)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  }

  private saveConfig(): void {
    StorageManager.setItem(CONFIG_KEY, this.config)
  }

  private loadRules(): void {
    DEFAULT_PERMISSIONS.forEach(rule => {
      this.rules.set(rule.tourId, rule)
    })

    const stored = StorageManager.getItem<Record<string, TourPermissionRule>>(STORAGE_KEY)
    if (stored) {
      Object.entries(stored).forEach(([tourId, rule]) => {
        this.rules.set(tourId, rule)
      })
    }
  }

  private saveRules(): void {
    const rulesObj: Record<string, TourPermissionRule> = {}
    this.rules.forEach((rule, tourId) => {
      rulesObj[tourId] = rule
    })
    StorageManager.setItem(STORAGE_KEY, rulesObj)
  }

  canAccess(tourId: string, userRole: UserRole): boolean {
    if (!this.config.globalEnabled) {
      return true
    }

    if (this.config.adminOverride && userRole === 'admin') {
      return true
    }

    const rule = this.rules.get(tourId)
    if (!rule) {
      return this.checkDefaultAccess(userRole)
    }

    if (!rule.enabled) {
      return false
    }

    if (rule.deniedRoles.includes(userRole)) {
      return false
    }

    if (rule.allowedRoles.length > 0 && !rule.allowedRoles.includes(userRole)) {
      return false
    }

    return true
  }

  private checkDefaultAccess(_userRole: UserRole): boolean {
    return true
  }

  hasPermission(tourId: string, userRole: UserRole, permission: TourPermission): boolean {
    if (!this.config.globalEnabled) {
      return true
    }

    if (this.config.adminOverride && userRole === 'admin') {
      return true
    }

    const rule = this.rules.get(tourId)
    if (!rule) {
      return this.checkDefaultPermission(userRole, permission)
    }

    if (!rule.enabled) {
      return false
    }

    const allowedRoles = rule.permissions[permission]
    return allowedRoles.includes(userRole)
  }

  private checkDefaultPermission(userRole: UserRole, permission: TourPermission): boolean {
    const roleLevel = this.config.roleHierarchy[userRole]
    
    switch (permission) {
      case 'view':
        return roleLevel >= 0
      case 'edit':
      case 'delete':
      case 'manage':
        return roleLevel >= 3
      default:
        return false
    }
  }

  getAccessibleTours(userRole: UserRole): string[] {
    const accessibleTours: string[] = []
    
    this.rules.forEach((rule, tourId) => {
      if (this.canAccess(tourId, userRole)) {
        accessibleTours.push(tourId)
      }
    })
    
    return accessibleTours
  }

  getToursByPermission(userRole: UserRole, permission: TourPermission): string[] {
    const tours: string[] = []
    
    this.rules.forEach((rule, tourId) => {
      if (this.hasPermission(tourId, userRole, permission)) {
        tours.push(tourId)
      }
    })
    
    return tours
  }

  setRule(tourId: string, rule: Partial<TourPermissionRule>): TourPermissionRule {
    const existingRule = this.rules.get(tourId)
    
    const newRule: TourPermissionRule = {
      tourId,
      allowedRoles: rule.allowedRoles || existingRule?.allowedRoles || ['new_user', 'regular', 'premium', 'admin'],
      deniedRoles: rule.deniedRoles || existingRule?.deniedRoles || [],
      permissions: rule.permissions || existingRule?.permissions || {
        view: ['new_user', 'regular', 'premium', 'admin'],
        edit: ['admin'],
        delete: ['admin'],
        manage: ['admin'],
      },
      enabled: rule.enabled ?? existingRule?.enabled ?? true,
      priority: rule.priority ?? existingRule?.priority ?? 50,
    }
    
    this.rules.set(tourId, newRule)
    this.saveRules()
    return newRule
  }

  removeRule(tourId: string): boolean {
    if (this.rules.has(tourId)) {
      this.rules.delete(tourId)
      this.saveRules()
      return true
    }
    return false
  }

  getRule(tourId: string): TourPermissionRule | undefined {
    return this.rules.get(tourId)
  }

  getAllRules(): TourPermissionRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority)
  }

  setConfig(updates: Partial<TourAccessConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  getConfig(): TourAccessConfig {
    return { ...this.config }
  }

  enableGlobal(): void {
    this.config.globalEnabled = true
    this.saveConfig()
  }

  disableGlobal(): void {
    this.config.globalEnabled = false
    this.saveConfig()
  }

  isGlobalEnabled(): boolean {
    return this.config.globalEnabled
  }

  getUserRoles(): { value: UserRole; label: string; level: number }[] {
    return [
      { value: 'new_user', label: '新用户', level: 0 },
      { value: 'regular', label: '普通用户', level: 1 },
      { value: 'premium', label: '高级用户', level: 2 },
      { value: 'admin', label: '管理员', level: 3 },
    ]
  }

  getPermissions(): { value: TourPermission; label: string }[] {
    return [
      { value: 'view', label: '查看' },
      { value: 'edit', label: '编辑' },
      { value: 'delete', label: '删除' },
      { value: 'manage', label: '管理' },
    ]
  }

  bulkUpdatePermissions(tourIds: string[], updates: Partial<TourPermissionRule>): void {
    tourIds.forEach(tourId => {
      this.setRule(tourId, updates)
    })
  }

  grantAccess(tourId: string, roles: UserRole[]): void {
    const rule = this.rules.get(tourId)
    if (rule) {
      const newAllowedRoles = [...new Set([...rule.allowedRoles, ...roles])]
      const newDeniedRoles = rule.deniedRoles.filter(r => !roles.includes(r))
      this.setRule(tourId, {
        allowedRoles: newAllowedRoles,
        deniedRoles: newDeniedRoles,
      })
    } else {
      this.setRule(tourId, {
        allowedRoles: roles,
        deniedRoles: [],
      })
    }
  }

  revokeAccess(tourId: string, roles: UserRole[]): void {
    const rule = this.rules.get(tourId)
    if (rule) {
      const newAllowedRoles = rule.allowedRoles.filter(r => !roles.includes(r))
      const newDeniedRoles = [...new Set([...rule.deniedRoles, ...roles])]
      this.setRule(tourId, {
        allowedRoles: newAllowedRoles,
        deniedRoles: newDeniedRoles,
      })
    }
  }

  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      rules: Array.from(this.rules.entries()),
    }, null, 2)
  }

  importConfig(json: string): boolean {
    try {
      const data = JSON.parse(json)
      if (data.config) {
        this.config = { ...DEFAULT_CONFIG, ...data.config }
        this.saveConfig()
      }
      if (data.rules && Array.isArray(data.rules)) {
        this.rules.clear()
        data.rules.forEach(([tourId, rule]: [string, TourPermissionRule]) => {
          this.rules.set(tourId, rule)
        })
        this.saveRules()
      }
      return true
    } catch {
      return false
    }
  }
}

export const tourPermissionService = new TourPermissionService()
