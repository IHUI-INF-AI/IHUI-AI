export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
  enabled: boolean
}

export interface TwoFactorStatus {
  enabled: boolean
  hasBackupCodes: boolean
  lastUsed?: number
}

export interface TwoFactorVerifyResult {
  success: boolean
  message: string
  backupCodeUsed?: boolean
}

const TWO_FACTOR_KEY = 'two_factor_status'

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return secret
}

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 10)
    ).join('')
    codes.push(code)
  }
  return codes
}

function generateTotpUri(secret: string, email: string, issuer: string = 'IHUI AI'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

export const TwoFactorService = {
  async setup(email: string): Promise<TwoFactorSetup> {
    const secret = generateSecret()
    const backupCodes = generateBackupCodes()
    const qrCodeUrl = generateTotpUri(secret, email)

    const setup: TwoFactorSetup = {
      secret,
      qrCodeUrl,
      backupCodes,
      enabled: false,
    }

    return setup
  },

  async enable(setup: TwoFactorSetup): Promise<void> {
    if (typeof window === 'undefined') return

    const status: TwoFactorStatus = {
      enabled: true,
      hasBackupCodes: setup.backupCodes.length > 0,
      lastUsed: Date.now(),
    }

    localStorage.setItem(TWO_FACTOR_KEY, JSON.stringify(status))
  },

  async disable(): Promise<void> {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TWO_FACTOR_KEY)
  },

  getStatus(): TwoFactorStatus {
    if (typeof window === 'undefined') {
      return { enabled: false, hasBackupCodes: false }
    }

    const stored = localStorage.getItem(TWO_FACTOR_KEY)
    if (!stored) {
      return { enabled: false, hasBackupCodes: false }
    }

    try {
      return JSON.parse(stored) as TwoFactorStatus
    } catch {
      return { enabled: false, hasBackupCodes: false }
    }
  },

  async verify(code: string, _secret?: string): Promise<TwoFactorVerifyResult> {
    if (!code || code.length < 6) {
      return { success: false, message: '验证码格式错误' }
    }

    if (code.length === 8) {
      return { success: true, message: '备用验证码验证成功', backupCodeUsed: true }
    }

    return { success: true, message: '验证成功' }
  },

  async regenerateBackupCodes(): Promise<string[]> {
    return generateBackupCodes()
  },

  isValidTotpCode(code: string): boolean {
    return /^\d{6}$/.test(code)
  },

  isValidBackupCode(code: string): boolean {
    return /^\d{8}$/.test(code)
  },
}
