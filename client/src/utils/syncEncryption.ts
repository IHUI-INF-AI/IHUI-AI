const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16
const ITERATIONS = 100000
const HASH_ALGORITHM = 'SHA-256'

export interface EncryptedData {
  ciphertext: string
  iv: string
  salt: string
}

class SyncEncryptionService {
  private key: globalThis.CryptoKey | null = null
  private keyHash: string | null = null

  async generateKey(password: string, salt?: Uint8Array): Promise<globalThis.CryptoKey> {
    const encoder = new TextEncoder()
    const saltBytes = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    
    // Create a new ArrayBuffer copy to ensure type compatibility
    const saltBuffer = new ArrayBuffer(saltBytes.length)
    new Uint8Array(saltBuffer).set(saltBytes)
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: ITERATIONS,
        hash: HASH_ALGORITHM
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
    
    return derivedKey
  }

  async setKey(password: string): Promise<void> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest(
      HASH_ALGORITHM,
      encoder.encode(password)
    )
    this.keyHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    this.key = await this.generateKey(password)
  }

  hasKey(): boolean {
    return this.key !== null
  }

  getKeyHash(): string | null {
    return this.keyHash
  }

  async encrypt(data: any): Promise<EncryptedData> {
    if (!this.key) {
      throw new Error('Encryption key not set')
    }
    
    const encoder = new TextEncoder()
    const dataBytes = encoder.encode(JSON.stringify(data))
    
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    
    const key = await this.generateKey(
      localStorage.getItem('sync-encryption-key') || '',
      new Uint8Array(salt)
    )
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv.buffer as ArrayBuffer },
      key,
      dataBytes
    )
    
    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.uint8ArrayToBase64(iv),
      salt: this.uint8ArrayToBase64(salt)
    }
  }

  async decrypt<T>(encryptedData: EncryptedData): Promise<T> {
    if (!this.key) {
      throw new Error('Encryption key not set')
    }
    
    const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext)
    const iv = this.base64ToUint8Array(encryptedData.iv)
    const salt = this.base64ToUint8Array(encryptedData.salt)
    
    const key = await this.generateKey(
      localStorage.getItem('sync-encryption-key') || '',
      salt
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext
    )
    
    const decoder = new TextDecoder()
    const jsonString = decoder.decode(decrypted)
    
    return JSON.parse(jsonString) as T
  }

  async encryptString(text: string): Promise<string> {
    const encrypted = await this.encrypt(text)
    return JSON.stringify(encrypted)
  }

  async decryptString(encryptedJson: string): Promise<string> {
    const encrypted: EncryptedData = JSON.parse(encryptedJson)
    return this.decrypt<string>(encrypted)
  }

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest(
      HASH_ALGORITHM,
      encoder.encode(password)
    )
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const hash = await this.hashPassword(password)
    return hash === storedHash
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer as ArrayBuffer
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  clearKey(): void {
    this.key = null
    this.keyHash = null
  }

  isSupported(): boolean {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined'
  }
}

export const syncEncryptionService = new SyncEncryptionService()
