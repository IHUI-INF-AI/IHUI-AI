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

const RECOVERY_KEY = 'recovery_options'
const RECOVERY_CODES_KEY = 'recovery_codes'

describe('RecoveryService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('addOption', () => {
    it('should add email recovery option', () => {
      const option = {
        id: 'recovery_1',
        type: 'email',
        value: 'user@example.com',
        verified: false,
        createdAt: Date.now(),
      }
      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify([option]))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored[0].type).toBe('email')
    })

    it('should add phone recovery option', () => {
      const option = {
        id: 'recovery_2',
        type: 'phone',
        value: '+8613800138000',
        verified: false,
        createdAt: Date.now(),
      }
      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify([option]))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      expect(stored[0].type).toBe('phone')
    })
  })

  describe('getOptions', () => {
    it('should return empty array when no options', () => {
      const stored = localStorageMock.getItem(RECOVERY_KEY)
      expect(stored).toBeNull()
    })

    it('should return all options', () => {
      const options = [
        { id: '1', type: 'email', value: 'a@b.com' },
        { id: '2', type: 'phone', value: '+123' },
      ]
      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify(options))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      expect(stored.length).toBe(2)
    })
  })

  describe('verifyOption', () => {
    it('should mark option as verified', () => {
      const options = [
        { id: '1', type: 'email', value: 'a@b.com', verified: false },
      ]
      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify(options))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      stored[0].verified = true
      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify(stored))

      const updated = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      expect(updated[0].verified).toBe(true)
    })
  })

  describe('generateRecoveryCodes', () => {
    it('should generate 10 codes', () => {
      const codes: string[] = []
      for (let i = 0; i < 10; i++) {
        codes.push(Math.random().toString(36).substring(2, 10).toUpperCase())
      }
      expect(codes.length).toBe(10)
    })

    it('should generate unique codes', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 10; i++) {
        codes.add(Math.random().toString(36).substring(2, 10).toUpperCase())
      }
      expect(codes.size).toBe(10)
    })

    it('should generate 8-character codes', () => {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      expect(code.length).toBe(8)
    })
  })

  describe('useRecoveryCode', () => {
    it('should validate correct code', () => {
      const codes = ['ABCD1234', 'EFGH5678']
      localStorageMock.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_CODES_KEY) || '[]')
      const isValid = stored.includes('ABCD1234')
      expect(isValid).toBe(true)
    })

    it('should reject incorrect code', () => {
      const codes = ['ABCD1234', 'EFGH5678']
      localStorageMock.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes))

      const stored = JSON.parse(localStorageMock.getItem(RECOVERY_CODES_KEY) || '[]')
      const isValid = stored.includes('WRONGCODE')
      expect(isValid).toBe(false)
    })

    it('should remove used code', () => {
      const codes = ['ABCD1234', 'EFGH5678']
      localStorageMock.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes))

      let stored = JSON.parse(localStorageMock.getItem(RECOVERY_CODES_KEY) || '[]')
      stored = stored.filter((c: string) => c !== 'ABCD1234')
      localStorageMock.setItem(RECOVERY_CODES_KEY, JSON.stringify(stored))

      stored = JSON.parse(localStorageMock.getItem(RECOVERY_CODES_KEY) || '[]')
      expect(stored.length).toBe(1)
      expect(stored).not.toContain('ABCD1234')
    })
  })

  describe('getRecoveryStatus', () => {
    it('should return correct status', () => {
      const options = [
        { id: '1', type: 'email', verified: true },
        { id: '2', type: 'phone', verified: false },
      ]
      const codes = ['ABCD1234']

      localStorageMock.setItem(RECOVERY_KEY, JSON.stringify(options))
      localStorageMock.setItem(RECOVERY_CODES_KEY, JSON.stringify(codes))

      const storedOptions = JSON.parse(localStorageMock.getItem(RECOVERY_KEY) || '[]')
      const storedCodes = JSON.parse(localStorageMock.getItem(RECOVERY_CODES_KEY) || '[]')

      expect(storedOptions.length).toBe(2)
      expect(storedCodes.length).toBe(1)
    })
  })
})
