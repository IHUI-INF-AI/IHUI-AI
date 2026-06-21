import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || ''

export interface SecureStorageOptions {
  encrypt?: boolean
  expiresIn?: number
}

interface StoredData<T> {
  value: T
  expiry?: number
  encrypted: boolean
}

class SecureStorageManagerClass {
  private key: string

  constructor() {
    this.key = ENCRYPTION_KEY
  }

  private encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, this.key).toString()
  }

  private decrypt(data: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(data, this.key)
      return bytes.toString(CryptoJS.enc.Utf8)
    } catch {
      return ''
    }
  }

  setItem<T>(key: string, value: T, options: SecureStorageOptions = {}): void {
    const { encrypt = false, expiresIn } = options

    const data: StoredData<T> = {
      value,
      expiry: expiresIn ? Date.now() + expiresIn : undefined,
      encrypted: encrypt,
    }

    let serialized = JSON.stringify(data)

    if (encrypt) {
      serialized = this.encrypt(serialized)
    }

    localStorage.setItem(key, serialized)
  }

  getItem<T>(key: string): T | null {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    try {
      let data: StoredData<T>

      if (raw.startsWith('U2F') || raw.includes('==')) {
        const decrypted = this.decrypt(raw)
        if (!decrypted) return null
        data = JSON.parse(decrypted)
      } else {
        data = JSON.parse(raw)
      }

      if (data.expiry && Date.now() > data.expiry) {
        this.removeItem(key)
        return null
      }

      return data.value
    } catch {
      return null
    }
  }

  removeItem(key: string): void {
    localStorage.removeItem(key)
  }

  setSessionItem<T>(key: string, value: T, options: SecureStorageOptions = {}): void {
    const { encrypt = false, expiresIn } = options

    const data: StoredData<T> = {
      value,
      expiry: expiresIn ? Date.now() + expiresIn : undefined,
      encrypted: encrypt,
    }

    let serialized = JSON.stringify(data)

    if (encrypt) {
      serialized = this.encrypt(serialized)
    }

    sessionStorage.setItem(key, serialized)
  }

  getSessionItem<T>(key: string): T | null {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null

    try {
      let data: StoredData<T>

      if (raw.startsWith('U2F') || raw.includes('==')) {
        const decrypted = this.decrypt(raw)
        if (!decrypted) return null
        data = JSON.parse(decrypted)
      } else {
        data = JSON.parse(raw)
      }

      if (data.expiry && Date.now() > data.expiry) {
        this.removeSessionItem(key)
        return null
      }

      return data.value
    } catch {
      return null
    }
  }

  removeSessionItem(key: string): void {
    sessionStorage.removeItem(key)
  }

  clearAll(): void {
    localStorage.clear()
    sessionStorage.clear()
  }

  clearSensitiveData(): void {
    const sensitiveKeys = [
      'token',
      'refresh_token',
      'user',
      'password',
      'secret',
      'key',
      'credential',
    ]

    sensitiveKeys.forEach((prefix) => {
      Object.keys(localStorage).forEach((key) => {
        if (key.toLowerCase().includes(prefix)) {
          localStorage.removeItem(key)
        }
      })
      Object.keys(sessionStorage).forEach((key) => {
        if (key.toLowerCase().includes(prefix)) {
          sessionStorage.removeItem(key)
        }
      })
    })
  }

  isEncrypted(key: string): boolean {
    const raw = localStorage.getItem(key)
    if (!raw) return false
    return raw.startsWith('U2F') || raw.includes('==')
  }
}

export const SecureStorageManager = new SecureStorageManagerClass()

export const SENSITIVE_KEY_PREFIX = 'secure_'

export function setSecureItem<T>(key: string, value: T, expiresIn?: number): void {
  SecureStorageManager.setItem(SENSITIVE_KEY_PREFIX + key, value, {
    encrypt: true,
    expiresIn,
  })
}

export function getSecureItem<T>(key: string): T | null {
  return SecureStorageManager.getItem<T>(SENSITIVE_KEY_PREFIX + key)
}

export function removeSecureItem(key: string): void {
  SecureStorageManager.removeItem(SENSITIVE_KEY_PREFIX + key)
}
