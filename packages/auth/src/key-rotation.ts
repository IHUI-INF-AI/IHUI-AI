/**
 * JWT 签名密钥周期轮换。
 *
 * 等价自旧架构 server/app/utils/secret_rotation.py。
 *
 * 设计要点：
 * 1. 多版本共存：轮换时旧密钥进入宽限期 (grace period)，仍可验证旧 token。
 * 2. 灰度切换：advanceRollout 推进比例，complete 完成切换并回收旧密钥。
 * 3. rotateKey(newKey) / getActiveKey() / verifyWithGracePeriod(token)。
 * 4. 回滚：rollback 回到上一版本。
 * 5. 复用 jwt.ts 的签发/验证逻辑与 JWTPayload 结构。
 */

import { createHash } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { getJwtSecret, type JWTPayload } from './jwt.js'

/** 密钥版本 */
export interface KeyVersion {
  version: number
  /** 签名密钥 (Uint8Array) */
  key: Uint8Array
  createdAt: number
  /** 过期时间戳 (毫秒)；超过此时间不再用于验证 */
  expiresAt: number
  /** 密钥指纹 (sha256 前 16 位)，用于审计 */
  fingerprint: string
}

/** 轮换阶段 */
export type RotationPhase =
  | 'stable' // 仅 current
  | 'canary' // 双版本共存 (灰度)
  | 'rollout' // 灰度推广中
  | 'deprecating' // 旧版本宽限期
  | 'rotated' // 已完成
  | 'rolled_back' // 已回滚

const ISSUER = 'ihui-ai'
const ALG = 'HS256'
/** 旧密钥宽限期，默认 1 天 (覆盖 access token 短期重叠) */
const DEFAULT_GRACE_PERIOD_SEC = 24 * 3600
/** 灰度比例 */
const DEFAULT_CANARY_RATIO = 0.1

/**
 * JWT 密钥轮换协调器。
 *
 * @example
 * const rotator = getJwtKeyRotator();
 * // 轮换: 旧密钥进入宽限期，新密钥用于签发
 * rotator.rotateKey(new TextEncoder().encode(process.env.JWT_SECRET_V2));
 * // 验证: 自动尝试 current 与 previous (宽限期内)
 * const payload = await rotator.verifyWithGracePeriod(token);
 */
export class JwtKeyRotator {
  private current: KeyVersion
  private previous: KeyVersion | null = null
  private phase: RotationPhase = 'stable'
  private readonly gracePeriodSec: number
  private advanceRatio = 1.0

  constructor(options: { initialKey?: Uint8Array; gracePeriodSec?: number } = {}) {
    this.gracePeriodSec = options.gracePeriodSec ?? DEFAULT_GRACE_PERIOD_SEC
    const key = options.initialKey ?? getJwtSecret()
    const now = Date.now()
    this.current = {
      version: 1,
      key,
      createdAt: now,
      expiresAt: now + this.gracePeriodSec * 1000,
      fingerprint: fingerprint(key),
    }
  }

  /** 获取当前活跃密钥 (用于签发新 token)。 */
  getActiveKey(): Uint8Array {
    return this.current.key
  }

  /** 获取当前版本号。 */
  getActiveVersion(): number {
    return this.current.version
  }

  /** 获取当前阶段。 */
  getPhase(): RotationPhase {
    return this.phase
  }

  /** 获取灰度比例 (0~1)。 */
  getAdvanceRatio(): number {
    return this.advanceRatio
  }

  /** 获取可用于验证的密钥列表 (current + 宽限期内的 previous)。 */
  getVerificationKeys(): KeyVersion[] {
    const keys: KeyVersion[] = [this.current]
    if (this.previous && this.previous.expiresAt > Date.now()) {
      keys.push(this.previous)
    }
    return keys
  }

  /**
   * 开始一次轮换：生成新版本，旧版本进入宽限期 (canary 阶段)。
   * 此后签发使用新密钥，验证同时接受新旧密钥。
   */
  rotateKey(newKey: Uint8Array): KeyVersion {
    const now = Date.now()
    // 旧密钥进入宽限期
    this.previous = {
      version: this.current.version,
      key: this.current.key,
      createdAt: this.current.createdAt,
      expiresAt: now + this.gracePeriodSec * 1000,
      fingerprint: this.current.fingerprint,
    }
    const newVersion: KeyVersion = {
      version: this.current.version + 1,
      key: newKey,
      createdAt: now,
      expiresAt: now + this.gracePeriodSec * 1000,
      fingerprint: fingerprint(newKey),
    }
    this.current = newVersion
    this.phase = 'canary'
    this.advanceRatio = DEFAULT_CANARY_RATIO
    return newVersion
  }

  /**
   * 推进灰度比例。ratio >= 1 时进入 stable 阶段。
   * @returns 实际生效的比例 (0~1)
   */
  advanceRollout(ratio: number): number {
    const r = Math.max(0, Math.min(1, ratio))
    this.advanceRatio = r
    if (r >= 1) {
      this.phase = 'stable'
    } else if (r > DEFAULT_CANARY_RATIO) {
      this.phase = 'rollout'
    }
    return r
  }

  /**
   * 完成轮换：清除旧密钥 (不再接受 previous 验证)。
   */
  complete(): void {
    this.previous = null
    this.phase = 'rotated'
    this.advanceRatio = 1.0
  }

  /**
   * 回滚到上一版本。
   * @returns 回滚后的密钥版本；无上一版本时返回 null
   */
  rollback(): KeyVersion | null {
    if (!this.previous) return null
    const rolledBack = this.previous
    this.current = rolledBack
    this.previous = null
    this.phase = 'rolled_back'
    this.advanceRatio = 1.0
    return rolledBack
  }

  /**
   * 使用当前活跃密钥签发 access token。
   */
  async signAccessToken(payload: JWTPayload): Promise<string> {
    return new SignJWT({
      phone: payload.phone,
      familyId: payload.familyId,
      roleId: payload.roleId,
    })
      .setProtectedHeader({ alg: ALG })
      .setSubject(payload.userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.current.key)
  }

  /**
   * 验证 access token，支持宽限期：先尝试 current，失败再尝试 previous。
   * 拒绝 refresh token 被当作 access token。
   */
  async verifyWithGracePeriod(token: string): Promise<JWTPayload> {
    const keys = this.getVerificationKeys()
    let lastErr: unknown = null
    for (const kv of keys) {
      try {
        const { payload } = await jwtVerify(token, kv.key, {
          issuer: ISSUER,
          algorithms: [ALG],
        })
        if (payload.type === 'refresh') {
          throw new Error('refresh token 不能用作 access token')
        }
        return {
          userId: payload.sub ?? '',
          phone: String(payload.phone ?? ''),
          familyId: String(payload.familyId ?? ''),
          roleId: Number(payload.roleId ?? 0),
        }
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('token 验证失败')
  }

  /**
   * 检查当前密钥是否即将过期 / 已过期。
   */
  checkExpiring(): {
    currentVersion: number
    fingerprint: string
    expiresAt: number
    remainingSec: number
    needsRotation: boolean
    expired: boolean
  } {
    const now = Date.now()
    const remainingSec = Math.floor((this.current.expiresAt - now) / 1000)
    const warningSec = Math.floor(this.gracePeriodSec / 3)
    return {
      currentVersion: this.current.version,
      fingerprint: this.current.fingerprint,
      expiresAt: this.current.expiresAt,
      remainingSec,
      needsRotation: remainingSec < warningSec,
      expired: remainingSec <= 0,
    }
  }

  /** 统计信息。 */
  getStats(): {
    currentVersion: number
    previousVersion: number | null
    phase: RotationPhase
    advanceRatio: number
    verificationKeyCount: number
  } {
    return {
      currentVersion: this.current.version,
      previousVersion: this.previous ? this.previous.version : null,
      phase: this.phase,
      advanceRatio: this.advanceRatio,
      verificationKeyCount: this.getVerificationKeys().length,
    }
  }
}

/** 计算密钥指纹 (sha256 前 16 位)。 */
function fingerprint(key: Uint8Array): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

// ---------------------------------------------------------------------------
// 默认单例 + 便捷函数
// ---------------------------------------------------------------------------

let defaultRotator: JwtKeyRotator | null = null

/** 获取默认轮换器单例。 */
export function getJwtKeyRotator(): JwtKeyRotator {
  if (!defaultRotator) defaultRotator = new JwtKeyRotator()
  return defaultRotator
}

/** 便捷：轮换密钥。 */
export function rotateJwtKey(newKey: Uint8Array): KeyVersion {
  return getJwtKeyRotator().rotateKey(newKey)
}

/** 便捷：获取当前活跃密钥。 */
export function getActiveJwtKey(): Uint8Array {
  return getJwtKeyRotator().getActiveKey()
}

/** 便捷：带宽限期验证 access token。 */
export async function verifyTokenWithGracePeriod(token: string): Promise<JWTPayload> {
  return getJwtKeyRotator().verifyWithGracePeriod(token)
}
