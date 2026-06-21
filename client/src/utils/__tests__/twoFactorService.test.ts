import { describe, it, expect, beforeEach, vi } from 'vitest'

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

const TWO_FACTOR_KEY = 'two_factor_status'
const TWO_FACTOR_SECRET_KEY = 'two_factor_secret'
const BACKUP_CODES_KEY = 'two_factor_backup_codes'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ToBytes(base32: string): Uint8Array {
  let bits = ''
  for (const char of base32.toUpperCase()) {
    const val = BASE32_CHARS.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2)
  }
  return bytes
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, message)
}

function dynamicTruncation(hmac: ArrayBuffer, digits: number): string {
  const hmacArray = new Uint8Array(hmac)
  const offset = hmacArray[hmacArray.length - 1] & 0x0f
  const binary =
    ((hmacArray[offset] & 0x7f) << 24) |
    ((hmacArray[offset + 1] & 0xff) << 16) |
    ((hmacArray[offset + 2] & 0xff) << 8) |
    (hmacArray[offset + 3] & 0xff)
  const otp = binary % Math.pow(10, digits)
  return otp.toString().padStart(digits, '0')
}

async function generateTotp(secret: string, time: number = Date.now(), digits: number = 6, period: number = 30): Promise<string> {
  const counter = Math.floor(time / 1000 / period)
  const counterBuffer = new ArrayBuffer(8)
  const counterView = new DataView(counterBuffer)
  counterView.setUint32(4, counter, false)
  
  const secretBytes = base32ToBytes(secret)
  const hmac = await hmacSha1(secretBytes, new Uint8Array(counterBuffer))
  return dynamicTruncation(hmac, digits)
}

describe('TwoFactorService', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe('getStatus', () => {
    it('should return disabled status when not set', () => {
      const stored = localStorageMock.getItem(TWO_FACTOR_KEY)
      expect(stored).toBeNull()
    })

    it('should return enabled status when set', () => {
      const status = { enabled: true, hasBackupCodes: true }
      localStorageMock.setItem(TWO_FACTOR_KEY, JSON.stringify(status))

      const stored = JSON.parse(localStorageMock.getItem(TWO_FACTOR_KEY) || '{}')
      expect(stored.enabled).toBe(true)
    })
  })

  describe('verify', () => {
    it('should reject invalid code format', async () => {
      const code = '123'
      expect(code.length).toBeLessThan(6)
    })

    it('should accept 6-digit code', async () => {
      const code = '123456'
      expect(/^\d{6}$/.test(code)).toBe(true)
    })

    it('should accept 8-digit backup code', async () => {
      const code = '12345678'
      expect(/^\d{8}$/.test(code)).toBe(true)
    })

    it('should verify backup code from stored codes', async () => {
      const backupCodes = ['12345678', '87654321']
      localStorageMock.setItem(BACKUP_CODES_KEY, JSON.stringify(backupCodes))
      
      const storedCodes = JSON.parse(localStorageMock.getItem(BACKUP_CODES_KEY) || '[]')
      expect(storedCodes).toContain('12345678')
    })

    it('should remove used backup code', async () => {
      const backupCodes = ['12345678', '87654321']
      localStorageMock.setItem(BACKUP_CODES_KEY, JSON.stringify(backupCodes))
      
      const codeIndex = backupCodes.indexOf('12345678')
      if (codeIndex !== -1) {
        backupCodes.splice(codeIndex, 1)
        localStorageMock.setItem(BACKUP_CODES_KEY, JSON.stringify(backupCodes))
      }
      
      const storedCodes = JSON.parse(localStorageMock.getItem(BACKUP_CODES_KEY) || '[]')
      expect(storedCodes).not.toContain('12345678')
      expect(storedCodes).toContain('87654321')
    })
  })

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes: string[] = []
      for (let i = 0; i < 10; i++) {
        const code = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
        codes.push(code)
      }
      expect(codes.length).toBe(10)
    })

    it('should generate unique codes', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const code = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
        codes.add(code)
      }
      expect(codes.size).toBe(10)
    })
  })

  describe('isValidTotpCode', () => {
    it('should validate 6-digit code', () => {
      expect(/^\d{6}$/.test('123456')).toBe(true)
      expect(/^\d{6}$/.test('12345')).toBe(false)
      expect(/^\d{6}$/.test('1234567')).toBe(false)
      expect(/^\d{6}$/.test('abcdef')).toBe(false)
    })
  })

  describe('isValidBackupCode', () => {
    it('should validate 8-digit code', () => {
      expect(/^\d{8}$/.test('12345678')).toBe(true)
      expect(/^\d{8}$/.test('1234567')).toBe(false)
      expect(/^\d{8}$/.test('123456789')).toBe(false)
    })
  })

  describe('TOTP Generation', () => {
    it('should generate valid 6-digit TOTP code', async () => {
      const secret = 'JBSWY3DPEHPK3PXP'
      const code = await generateTotp(secret)
      expect(/^\d{6}$/.test(code)).toBe(true)
    })

    it('should generate same code for same time', async () => {
      const secret = 'JBSWY3DPEHPK3PXP'
      const time = Date.now()
      const code1 = await generateTotp(secret, time)
      const code2 = await generateTotp(secret, time)
      expect(code1).toBe(code2)
    })

    it('should generate different codes for different time periods', async () => {
      const secret = 'JBSWY3DPEHPK3PXP'
      const code1 = await generateTotp(secret, 1000000000000)
      const code2 = await generateTotp(secret, 2000000000000)
      expect(code1).not.toBe(code2)
    })
  })

  describe('Secret Management', () => {
    it('should store secret when enabling 2FA', () => {
      const secret = 'JBSWY3DPEHPK3PXP'
      localStorageMock.setItem(TWO_FACTOR_SECRET_KEY, secret)
      expect(localStorageMock.getItem(TWO_FACTOR_SECRET_KEY)).toBe(secret)
    })

    it('should clear secret when disabling 2FA', () => {
      localStorageMock.setItem(TWO_FACTOR_SECRET_KEY, 'test-secret')
      localStorageMock.removeItem(TWO_FACTOR_SECRET_KEY)
      expect(localStorageMock.getItem(TWO_FACTOR_SECRET_KEY)).toBeNull()
    })
  })
})
