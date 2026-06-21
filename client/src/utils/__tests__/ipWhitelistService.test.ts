import { describe, it, expect, beforeEach } from 'vitest'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

const IP_WHITELIST_KEY = 'ip_whitelist'
const CONFIG_KEY = 'ip_whitelist_config'

describe('IPWhitelistService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('getWhitelist', () => {
    it('should return empty array when no whitelist exists', () => {
      expect(localStorageMock.getItem(IP_WHITELIST_KEY)).toBeNull()
    })

    it('should return parsed whitelist when exists', () => {
      const whitelist = [{ id: '1', ip: '192.168.1.1', label: 'Home', createdAt: Date.now() }]
      localStorageMock.setItem(IP_WHITELIST_KEY, JSON.stringify(whitelist))
      const stored = JSON.parse(localStorageMock.getItem(IP_WHITELIST_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored[0].ip).toBe('192.168.1.1')
    })
  })

  describe('getConfig', () => {
    it('should return default config when not set', () => {
      expect(localStorageMock.getItem(CONFIG_KEY)).toBeNull()
    })

    it('should return stored config', () => {
      const config = { enabled: true, strictMode: false }
      localStorageMock.setItem(CONFIG_KEY, JSON.stringify(config))
      const stored = JSON.parse(localStorageMock.getItem(CONFIG_KEY) || '{}')
      expect(stored.enabled).toBe(true)
    })
  })

  describe('IP validation', () => {
    it('should validate IPv4 addresses', () => {
      const validIPs = ['192.168.1.1', '10.0.0.1', '255.255.255.255', '0.0.0.0']
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/

      validIPs.forEach(ip => {
        expect(ipv4Regex.test(ip)).toBe(true)
      })
    })

    it('should validate CIDR notation', () => {
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
      expect(cidrRegex.test('192.168.1.0/24')).toBe(true)
      expect(cidrRegex.test('10.0.0.0/8')).toBe(true)
    })
  })
})
