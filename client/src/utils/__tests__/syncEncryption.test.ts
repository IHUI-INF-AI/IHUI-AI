import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('syncEncryptionService', () => {
  let originalCrypto: Crypto
  
  beforeEach(async () => {
    originalCrypto = global.crypto
    localStorage.clear()
    
    vi.resetModules()
    
    const mockCrypto = {
      subtle: {
        importKey: vi.fn().mockResolvedValue({} as CryptoKey),
        deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('null')),
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
      },
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256)
        }
        return arr
      }
    }
    
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true
    })
  })
  
  afterEach(() => {
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true
    })
    localStorage.clear()
    vi.restoreAllMocks()
  })
  
  describe('isSupported', () => {
    it('应该返回 true 当 crypto 可用时', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      expect(syncEncryptionService.isSupported()).toBe(true)
    })
  })
  
  describe('setKey', () => {
    it('应该设置密钥', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      await syncEncryptionService.setKey('test-password')
      expect(syncEncryptionService.hasKey()).toBe(true)
    })
    
    it('应该生成密钥哈希', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      await syncEncryptionService.setKey('test-password')
      const hash = syncEncryptionService.getKeyHash()
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })
  })
  
  describe('hasKey', () => {
    it('初始状态应该返回 false', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      syncEncryptionService.clearKey()
      expect(syncEncryptionService.hasKey()).toBe(false)
    })
    
    it('设置密钥后应该返回 true', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      await syncEncryptionService.setKey('test-password')
      expect(syncEncryptionService.hasKey()).toBe(true)
    })
  })
  
  describe('clearKey', () => {
    it('应该清除密钥', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      await syncEncryptionService.setKey('test-password')
      syncEncryptionService.clearKey()
      expect(syncEncryptionService.hasKey()).toBe(false)
    })
  })
  
  describe('hashPassword', () => {
    it('应该生成密码哈希', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      const hash = await syncEncryptionService.hashPassword('test-password')
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(64)
    })
    
    it('相同密码应该生成相同哈希', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      const hash1 = await syncEncryptionService.hashPassword('same-password')
      const hash2 = await syncEncryptionService.hashPassword('same-password')
      expect(hash1).toBe(hash2)
    })
  })
  
  describe('verifyPassword', () => {
    it('应该验证正确的密码', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      const hash = await syncEncryptionService.hashPassword('correct-password')
      const isValid = await syncEncryptionService.verifyPassword('correct-password', hash)
      expect(isValid).toBe(true)
    })
  })
  
  describe('encrypt', () => {
    it('应该加密数据并返回加密结果', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      localStorage.setItem('sync-encryption-key', 'test-password')
      await syncEncryptionService.setKey('test-password')
      
      const encrypted = await syncEncryptionService.encrypt('test data')
      
      expect(encrypted).toHaveProperty('ciphertext')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('salt')
      expect(typeof encrypted.ciphertext).toBe('string')
      expect(typeof encrypted.iv).toBe('string')
      expect(typeof encrypted.salt).toBe('string')
    })
    
    it('未设置密钥时加密应该抛出错误', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      syncEncryptionService.clearKey()
      localStorage.removeItem('sync-encryption-key')

      await expect(syncEncryptionService.encrypt('test')).rejects.toThrow()
    })

    it('没有 localStorage key 时应该使用空字符串加密', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      await syncEncryptionService.setKey('test-password')
      localStorage.removeItem('sync-encryption-key')

      const encrypted = await syncEncryptionService.encrypt('test')
      expect(encrypted.ciphertext).toBeDefined()
    })

    it('应该加密复杂对象', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      localStorage.setItem('sync-encryption-key', 'test-password')
      await syncEncryptionService.setKey('test-password')

      const obj = { name: 'test', items: [1, 2, 3], nested: { a: 1 } }
      const encrypted = await syncEncryptionService.encrypt(obj)
      expect(encrypted.ciphertext).toBeDefined()
    })
  })

  describe('decrypt', () => {
    it('未设置密钥时解密应该抛出错误', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      syncEncryptionService.clearKey()
      localStorage.removeItem('sync-encryption-key')

      await expect(syncEncryptionService.decrypt({
        ciphertext: 'YWJj',
        iv: 'YWJj',
        salt: 'YWJj'
      })).rejects.toThrow()
    })

    it('应该解密数据', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      localStorage.setItem('sync-encryption-key', 'test-password')
      await syncEncryptionService.setKey('test-password')

      // mock decrypt 返回有效的 JSON 字符串字节
      const data = { msg: 'hello' }
      const encoded = new TextEncoder().encode(JSON.stringify(data)).buffer
      ;(global.crypto.subtle.decrypt as any).mockResolvedValue(encoded)

      const encrypted = await syncEncryptionService.encrypt({ msg: 'hello' })
      const decrypted = await syncEncryptionService.decrypt(encrypted)
      expect(decrypted).toEqual(data)
    })
  })

  describe('encryptString', () => {
    it('应该加密字符串并返回 JSON 字符串', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      localStorage.setItem('sync-encryption-key', 'test-password')
      await syncEncryptionService.setKey('test-password')

      const result = await syncEncryptionService.encryptString('hello world')
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('ciphertext')
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('salt')
    })
  })

  describe('decryptString', () => {
    it('应该解密 JSON 字符串', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')
      localStorage.setItem('sync-encryption-key', 'test-password')
      await syncEncryptionService.setKey('test-password')

      // mock decrypt 返回带引号的字符串
      const encoded = new TextEncoder().encode('"hello"').buffer
      ;(global.crypto.subtle.decrypt as any).mockResolvedValue(encoded)

      const encrypted = await syncEncryptionService.encryptString('hello')
      const decrypted = await syncEncryptionService.decryptString(encrypted)
      expect(decrypted).toBe('hello')
    })
  })

  describe('isSupported', () => {
    it('应该返回 false 当 crypto 不存在时', async () => {
      const savedCrypto = global.crypto
      Object.defineProperty(global, 'crypto', { value: undefined, writable: true, configurable: true })

      const { syncEncryptionService } = await import('../syncEncryption')
      expect(syncEncryptionService.isSupported()).toBe(false)

      Object.defineProperty(global, 'crypto', { value: savedCrypto, writable: true, configurable: true })
    })

    it('应该返回 false 当 subtle 不存在时', async () => {
      const savedSubtle = global.crypto.subtle
      Object.defineProperty(global.crypto, 'subtle', { value: undefined, writable: true, configurable: true })

      const { syncEncryptionService } = await import('../syncEncryption')
      expect(syncEncryptionService.isSupported()).toBe(false)

      Object.defineProperty(global.crypto, 'subtle', { value: savedSubtle, writable: true, configurable: true })
    })
  })

  describe('verifyPassword', () => {
    it('应该拒绝错误的密码', async () => {
      const { syncEncryptionService } = await import('../syncEncryption')

      // 根据调用次数返回不同的哈希值，模拟不同密码
      let count = 0
      ;(global.crypto.subtle.digest as any).mockImplementation(async () => {
        count++
        const hex = count === 1 ? 'aa'.repeat(32) : 'bb'.repeat(32)
        const bytes = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        return bytes.buffer
      })

      const hash = await syncEncryptionService.hashPassword('correct-password')
      const isValid = await syncEncryptionService.verifyPassword('wrong-password', hash)
      expect(isValid).toBe(false)
    })
  })
})
