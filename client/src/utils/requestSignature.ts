import CryptoJS from 'crypto-js'

interface SignatureConfig {
  secretKey: string
  appId?: string
  expireSeconds?: number
}

interface SignatureData {
  timestamp: number
  nonce: string
  signature: string
  appId?: string
}

class RequestSignatureService {
  private config: SignatureConfig | null = null
  private nonceCache: Set<string> = new Set()
  private readonly MAX_NONCE_CACHE_SIZE = 1000
  private readonly NONCE_EXPIRE_MS = 60000
  private initialized = false

  constructor() {
    this.initFromEnv()
  }

  private initFromEnv(): void {
    const secretKey = import.meta.env.VITE_REQUEST_SIGNATURE_SECRET
    const appId = import.meta.env.VITE_REQUEST_SIGNATURE_APP_ID

    if (secretKey) {
      this.config = {
        secretKey,
        appId: appId || undefined,
        expireSeconds: 300,
      }
      this.initialized = true
    }
  }

  init(config: SignatureConfig): void {
    this.config = config
    this.initialized = true
  }

  generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
  }

  generateSignature(
    method: string,
    url: string,
    body?: any,
    timestamp?: number
  ): SignatureData | null {
    if (!this.config) {
      return null
    }

    const ts = timestamp || Date.now()
    const nonce = this.generateNonce()

    const bodyStr = body ? JSON.stringify(body) : ''
    const bodyHash = bodyStr ? CryptoJS.MD5(bodyStr).toString() : ''

    const path = this.extractPath(url)
    const stringToSign = `${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${bodyHash}`

    const signature = CryptoJS.HmacSHA256(stringToSign, this.config.secretKey).toString()

    return {
      timestamp: ts,
      nonce,
      signature,
      appId: this.config.appId,
    }
  }

  getHeaders(
    method: string,
    url: string,
    body?: any
  ): Record<string, string> {
    const signatureData = this.generateSignature(method, url, body)
    if (!signatureData) {
      return {}
    }

    const headers: Record<string, string> = {
      'X-Signature-Timestamp': signatureData.timestamp.toString(),
      'X-Signature-Nonce': signatureData.nonce,
      'X-Signature': signatureData.signature,
    }

    if (signatureData.appId) {
      headers['X-App-Id'] = signatureData.appId
    }

    return headers
  }

  verifySignature(
    method: string,
    url: string,
    timestamp: number,
    nonce: string,
    signature: string,
    body?: any
  ): { valid: boolean; error?: string } {
    if (!this.config) {
      return { valid: false, error: '签名服务未初始化' }
    }

    const now = Date.now()
    const expireSeconds = this.config.expireSeconds || 300

    if (Math.abs(now - timestamp) > expireSeconds * 1000) {
      return { valid: false, error: '签名已过期' }
    }

    if (this.nonceCache.has(nonce)) {
      return { valid: false, error: '重复的请求' }
    }

    this.addNonceToCache(nonce)

    const bodyStr = body ? JSON.stringify(body) : ''
    const bodyHash = bodyStr ? CryptoJS.MD5(bodyStr).toString() : ''

    const path = this.extractPath(url)
    const stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`

    const expectedSignature = CryptoJS.HmacSHA256(stringToSign, this.config.secretKey).toString()

    if (expectedSignature !== signature) {
      return { valid: false, error: '签名验证失败' }
    }

    return { valid: true }
  }

  private addNonceToCache(nonce: string): void {
    if (this.nonceCache.size >= this.MAX_NONCE_CACHE_SIZE) {
      this.nonceCache.clear()
    }
    this.nonceCache.add(nonce)

    setTimeout(() => {
      this.nonceCache.delete(nonce)
    }, this.NONCE_EXPIRE_MS)
  }

  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url, window.location.origin)
      return urlObj.pathname + urlObj.search
    } catch {
      return url
    }
  }

  isEnabled(): boolean {
    return this.initialized && this.config !== null && !!this.config.secretKey
  }
}

export const requestSignatureService = new RequestSignatureService()

export function initRequestSignature(config: SignatureConfig): void {
  requestSignatureService.init(config)
}

export function getRequestSignatureHeaders(
  method: string,
  url: string,
  body?: any
): Record<string, string> {
  return requestSignatureService.getHeaders(method, url, body)
}
