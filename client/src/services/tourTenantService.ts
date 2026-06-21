import { StorageManager } from '@/utils/storage'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: 'free' | 'basic' | 'pro' | 'enterprise'
  status: 'active' | 'suspended' | 'trial'
  createdAt: number
  settings: TenantSettings
  usage: TenantUsage
  metadata?: Record<string, unknown>
}

export interface TenantSettings {
  maxTours: number
  maxStepsPerTour: number
  maxUsers: number
  features: string[]
  branding: {
    logo?: string
    primaryColor?: string
    customDomain?: string
  }
  security: {
    ssoEnabled: boolean
    mfaRequired: boolean
    ipWhitelist: string[]
  }
}

export interface TenantUsage {
  tours: number
  steps: number
  users: number
  sessions: number
  storage: number
  lastUpdated: number
}

export interface TenantConfig {
  tourDefaults: {
    autoStart: boolean
    showProgress: boolean
    allowSkip: boolean
    theme: string
  }
  analytics: {
    enabled: boolean
    retentionDays: number
    exportFormats: string[]
  }
  notifications: {
    email: boolean
    webhook: string[]
  }
}

const TENANTS_KEY = 'tour_tenants'
const CURRENT_TENANT_KEY = 'tour_current_tenant'
const TENANT_DATA_PREFIX = 'tenant_'

const PLAN_LIMITS: Record<Tenant['plan'], Partial<TenantSettings>> = {
  free: {
    maxTours: 5,
    maxStepsPerTour: 10,
    maxUsers: 1,
    features: ['basic_tours', 'analytics'],
  },
  basic: {
    maxTours: 20,
    maxStepsPerTour: 30,
    maxUsers: 5,
    features: ['basic_tours', 'analytics', 'templates', 'export'],
  },
  pro: {
    maxTours: 100,
    maxStepsPerTour: 50,
    maxUsers: 25,
    features: ['basic_tours', 'analytics', 'templates', 'export', 'ab_testing', 'api_access', 'custom_branding'],
  },
  enterprise: {
    maxTours: -1,
    maxStepsPerTour: -1,
    maxUsers: -1,
    features: ['basic_tours', 'analytics', 'templates', 'export', 'ab_testing', 'api_access', 'custom_branding', 'sso', 'priority_support', 'custom_integrations'],
  },
}

class TourTenantService {
  private tenants: Map<string, Tenant> = new Map()
  private currentTenantId: string | null = null

  constructor() {
    this.load()
  }

  private load(): void {
    const stored = StorageManager.getItem<Record<string, Tenant>>(TENANTS_KEY)
    if (stored) {
      Object.entries(stored).forEach(([id, tenant]) => {
        this.tenants.set(id, tenant)
      })
    }
    
    this.currentTenantId = StorageManager.getItem<string>(CURRENT_TENANT_KEY)
  }

  private save(): void {
    const obj: Record<string, Tenant> = {}
    this.tenants.forEach((tenant, id) => {
      obj[id] = tenant
    })
    StorageManager.setItem(TENANTS_KEY, obj)
    StorageManager.setItem(CURRENT_TENANT_KEY, this.currentTenantId)
  }

  createTenant(data: {
    name: string
    slug: string
    plan: Tenant['plan']
    metadata?: Record<string, unknown>
  }): Tenant {
    const planSettings = PLAN_LIMITS[data.plan]
    
    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: data.name,
      slug: data.slug,
      plan: data.plan,
      status: 'trial',
      createdAt: Date.now(),
      settings: {
        maxTours: planSettings.maxTours || 5,
        maxStepsPerTour: planSettings.maxStepsPerTour || 10,
        maxUsers: planSettings.maxUsers || 1,
        features: planSettings.features || ['basic_tours'],
        branding: {},
        security: {
          ssoEnabled: false,
          mfaRequired: false,
          ipWhitelist: [],
        },
      },
      usage: {
        tours: 0,
        steps: 0,
        users: 0,
        sessions: 0,
        storage: 0,
        lastUpdated: Date.now(),
      },
      metadata: data.metadata,
    }

    this.tenants.set(tenant.id, tenant)
    this.save()
    return tenant
  }

  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId)
  }

  getTenantBySlug(slug: string): Tenant | undefined {
    return Array.from(this.tenants.values()).find(t => t.slug === slug)
  }

  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values())
  }

  updateTenant(tenantId: string, updates: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Tenant | null {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return null

    const updated = { ...tenant, ...updates }
    this.tenants.set(tenantId, updated)
    this.save()
    return updated
  }

  deleteTenant(tenantId: string): boolean {
    if (!this.tenants.has(tenantId)) return false

    this.clearTenantData(tenantId)
    this.tenants.delete(tenantId)
    this.save()
    return true
  }

  setCurrentTenant(tenantId: string): boolean {
    if (!this.tenants.has(tenantId)) return false
    this.currentTenantId = tenantId
    this.save()
    return true
  }

  getCurrentTenant(): Tenant | null {
    if (!this.currentTenantId) return null
    return this.tenants.get(this.currentTenantId) || null
  }

  upgradePlan(tenantId: string, plan: Tenant['plan']): Tenant | null {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return null

    const planSettings = PLAN_LIMITS[plan]
    tenant.plan = plan
    tenant.settings.maxTours = planSettings.maxTours || tenant.settings.maxTours
    tenant.settings.maxStepsPerTour = planSettings.maxStepsPerTour || tenant.settings.maxStepsPerTour
    tenant.settings.maxUsers = planSettings.maxUsers || tenant.settings.maxUsers
    tenant.settings.features = planSettings.features || tenant.settings.features

    this.save()
    return tenant
  }

  suspendTenant(tenantId: string): boolean {
    return this.updateTenant(tenantId, { status: 'suspended' }) !== null
  }

  activateTenant(tenantId: string): boolean {
    return this.updateTenant(tenantId, { status: 'active' }) !== null
  }

  updateUsage(tenantId: string, usage: Partial<TenantUsage>): void {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return

    tenant.usage = { ...tenant.usage, ...usage, lastUpdated: Date.now() }
    this.save()
  }

  checkLimit(tenantId: string, type: 'tours' | 'steps' | 'users' | 'storage'): { allowed: boolean; current: number; limit: number } {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return { allowed: false, current: 0, limit: 0 }

    const limitKey = type === 'tours' ? 'maxTours' : type === 'steps' ? 'maxStepsPerTour' : type === 'users' ? 'maxUsers' : 'maxTours'
    const limit = tenant.settings[limitKey as keyof TenantSettings] as number

    return {
      allowed: limit === -1 || tenant.usage[type] < limit,
      current: tenant.usage[type],
      limit,
    }
  }

  hasFeature(tenantId: string, feature: string): boolean {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return false
    return tenant.settings.features.includes(feature)
  }

  private getTenantDataKey(tenantId: string, key: string): string {
    return `${TENANT_DATA_PREFIX}${tenantId}_${key}`
  }

  setTenantData<T>(tenantId: string, key: string, value: T): void {
    StorageManager.setItem(this.getTenantDataKey(tenantId, key), value)
  }

  getTenantData<T>(tenantId: string, key: string): T | null {
    return StorageManager.getItem<T>(this.getTenantDataKey(tenantId, key))
  }

  removeTenantData(tenantId: string, key: string): void {
    StorageManager.removeItem(this.getTenantDataKey(tenantId, key))
  }

  private clearTenantData(tenantId: string): void {
    const prefix = `${TENANT_DATA_PREFIX}${tenantId}_`
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  getTenantStorageUsage(tenantId: string): number {
    const prefix = `${TENANT_DATA_PREFIX}${tenantId}_`
    let totalSize = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += value.length * 2
        }
      }
    }

    return totalSize
  }

  exportTenantData(tenantId: string): string {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return '{}'

    const prefix = `${TENANT_DATA_PREFIX}${tenantId}_`
    const data: Record<string, unknown> = { _tenant: tenant }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            data[key.replace(prefix, '')] = JSON.parse(value)
          } catch {
            data[key.replace(prefix, '')] = value
          }
        }
      }
    }

    return JSON.stringify(data, null, 2)
  }

  importTenantData(tenantId: string, jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData)
      const tenant = data._tenant

      if (tenant) {
        this.tenants.set(tenantId, tenant)
        delete data._tenant
      }

      Object.entries(data).forEach(([key, value]) => {
        this.setTenantData(tenantId, key, value)
      })

      this.save()
      return true
    } catch {
      return false
    }
  }

  getTenantStats(tenantId: string): {
    usagePercent: Record<string, number>
    featureUsage: Record<string, boolean>
    healthScore: number
  } {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      return { usagePercent: {}, featureUsage: {}, healthScore: 0 }
    }

    const usagePercent: Record<string, number> = {}
    const limits = ['tours', 'users'] as const
    limits.forEach(type => {
      const limitKey = type === 'tours' ? 'maxTours' : 'maxUsers'
      const limit = tenant.settings[limitKey as keyof TenantSettings] as number
      if (limit > 0) {
        usagePercent[type] = (tenant.usage[type] / limit) * 100
      }
    })

    const featureUsage: Record<string, boolean> = {}
    tenant.settings.features.forEach(feature => {
      featureUsage[feature] = true
    })

    let healthScore = 100
    Object.values(usagePercent).forEach(percent => {
      if (percent > 90) healthScore -= 20
      else if (percent > 75) healthScore -= 10
    })
    if (tenant.status === 'suspended') healthScore = 0

    return { usagePercent, featureUsage, healthScore }
  }
}

export const tourTenantService = new TourTenantService()
