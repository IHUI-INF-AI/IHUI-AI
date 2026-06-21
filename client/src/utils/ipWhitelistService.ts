import { logger } from './logger'

const IP_WHITELIST_KEY = 'ip_whitelist'

export interface IPWhitelistEntry {
  id: string
  ip: string
  label: string
  createdAt: number
  lastUsed?: number
}

export interface IPWhitelistConfig {
  enabled: boolean
  strictMode: boolean
}

const CONFIG_KEY = 'ip_whitelist_config'

function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/

  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }

  return ipv6Regex.test(ip) || cidrRegex.test(ip)
}

function isIPInRange(ip: string, range: string): boolean {
  if (range === ip) return true

  if (range.includes('/')) {
    const [rangeIP, prefixStr] = range.split('/')
    const prefix = parseInt(prefixStr, 10)

    if (!isValidIP(rangeIP) || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return false
    }

    const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0)
    const rangeNum = rangeIP.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0)
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0

    return (ipNum & mask) === (rangeNum & mask)
  }

  return false
}

export const IPWhitelistService = {
  getWhitelist(): IPWhitelistEntry[] {
    if (typeof window === 'undefined') return []

    const stored = localStorage.getItem(IP_WHITELIST_KEY)
    if (!stored) return []

    try {
      return JSON.parse(stored) as IPWhitelistEntry[]
    } catch {
      return []
    }
  },

  getConfig(): IPWhitelistConfig {
    if (typeof window === 'undefined') {
      return { enabled: false, strictMode: false }
    }

    const stored = localStorage.getItem(CONFIG_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return { enabled: false, strictMode: false }
      }
    }
    return { enabled: false, strictMode: false }
  },

  updateConfig(config: Partial<IPWhitelistConfig>): void {
    if (typeof window === 'undefined') return

    const current = this.getConfig()
    const updated = { ...current, ...config }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated))

    logger.info('[IPWhitelist] Configuration updated', { enabled: updated.enabled, strictMode: updated.strictMode })
  },

  addEntry(ip: string, label: string): IPWhitelistEntry | null {
    if (typeof window === 'undefined') return null

    if (!isValidIP(ip)) {
      logger.warn('[IPWhitelist] Invalid IP address', { ip })
      return null
    }

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()
    if (whitelist.some((e: IPWhitelistEntry) => e.ip === ip)) {
      logger.warn('[IPWhitelist] IP already exists', { ip })
      return null
    }

    const entry: IPWhitelistEntry = {
      id: `ip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ip,
      label,
      createdAt: Date.now(),
    }

    whitelist.push(entry)
    localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist))

    logger.info('[IPWhitelist] IP added', { ip, label })
    return entry
  },

  removeEntry(entryId: string): boolean {
    if (typeof window === 'undefined') return false

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()
    const index = whitelist.findIndex((e: IPWhitelistEntry) => e.id === entryId)

    if (index === -1) return false

    whitelist.splice(index, 1)
    localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist))

    logger.info('[IPWhitelist] IP removed', { entryId })
    return true
  },

  updateEntry(entryId: string, updates: Partial<Pick<IPWhitelistEntry, 'label'>>): boolean {
    if (typeof window === 'undefined') return false

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()
    const entry = whitelist.find((e: IPWhitelistEntry) => e.id === entryId)

    if (!entry) return false

    if (updates.label) entry.label = updates.label
    localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist))

    return true
  },

  isIPAllowed(ip: string): boolean {
    const config = this.getConfig()

    if (!config.enabled) return true

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()

    if (whitelist.length === 0) return !config.strictMode

    return whitelist.some((entry: IPWhitelistEntry) => isIPInRange(ip, entry.ip))
  },

  checkIP(ip: string): { allowed: boolean; reason: string } {
    const config = this.getConfig()

    if (!config.enabled) {
      return { allowed: true, reason: 'IP白名单未启用' }
    }

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()

    if (whitelist.length === 0) {
      if (config.strictMode) {
        return { allowed: false, reason: '白名单为空，严格模式拒绝所有访问' }
      }
      return { allowed: true, reason: '白名单为空，非严格模式允许访问' }
    }

    const matchedEntry = whitelist.find((entry: IPWhitelistEntry) => isIPInRange(ip, entry.ip))

    if (matchedEntry) {
      this.updateLastUsed(matchedEntry.id)
      return { allowed: true, reason: `匹配白名单规则: ${matchedEntry.label}` }
    }

    return { allowed: false, reason: 'IP不在白名单中' }
  },

  updateLastUsed(entryId: string): void {
    if (typeof window === 'undefined') return

    const whitelist: IPWhitelistEntry[] = this.getWhitelist()
    const entry = whitelist.find((e: IPWhitelistEntry) => e.id === entryId)

    if (entry) {
      entry.lastUsed = Date.now()
      localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist))
    }
  },

  clearWhitelist(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(IP_WHITELIST_KEY)
    logger.info('[IPWhitelist] Whitelist cleared')
  },

  exportWhitelist(): string {
    const whitelist = this.getWhitelist()
    return JSON.stringify(whitelist, null, 2)
  },

  importWhitelist(json: string): boolean {
    try {
      const entries = JSON.parse(json) as IPWhitelistEntry[]

      if (!Array.isArray(entries)) return false

      const validEntries = entries.filter(e => isValidIP(e.ip))

      localStorage.setItem(IP_WHITELIST_KEY, JSON.stringify(validEntries))
      logger.info('[IPWhitelist] Whitelist imported', { count: validEntries.length })
      return true
    } catch {
      return false
    }
  },
}
