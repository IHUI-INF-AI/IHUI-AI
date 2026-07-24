/**
 * 国安级密码哈希工具(argon2id + bcrypt 兼容)。
 *
 * 设计目标:
 * - 新密码用 argon2id(抗 GPU/ASIC 攻击,OWASP 2023 推荐)
 * - 老密码用 bcrypt(通过前缀 $2a$/$2b$ 识别),登录成功后自动升级到 argon2id
 * - 平滑迁移:无需强制重置密码,登录时透明升级
 *
 * argon2id 参数(OWASP 2023 推荐):
 * - type: argon2id(混合抗侧信道 + 抗 GPU)
 * - memoryCost: 19456 KiB(19 MB,OWASP 最小值)
 * - timeCost: 2(迭代次数)
 * - parallelism: 1(单线程,防 DoS)
 *
 * 安全保证:
 * - argon2id 自带 salt(每用户独立,无需全局 salt)
 * - 恒定时间比较(argon2.verify 内部实现)
 * - 哈希输出含算法参数,可未来平滑升级到更强算法
 */
import argon2 from 'argon2'
import bcrypt from 'bcryptjs'

/** argon2id 参数(OWASP 2023 推荐,国安级标准) */
const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MB(OWASP 最小值,抗 GPU)
  timeCost: 2, // 2 次迭代
  parallelism: 1, // 单线程(防 DoS)
} as const

/** 哈希算法版本(用于未来升级到更强算法时识别) */
export const HASH_VERSION = 2 // 1=bcrypt, 2=argon2id

/** bcrypt 哈希前缀(用于识别老密码) */
const BCRYPT_PREFIX_RE = /^\$2[abxy]\$/

/**
 * 判断哈希是否为 bcrypt(老密码)。
 * argon2id 哈希以 $argon2id$ 开头,bcrypt 以 $2a$/$2b$ 开头。
 */
export function isBcryptHash(hash: string): boolean {
  return BCRYPT_PREFIX_RE.test(hash)
}

/**
 * 判断哈希是否为 argon2id(新密码)。
 */
export function isArgon2Hash(hash: string): boolean {
  return hash.startsWith('$argon2id$')
}

/**
 * 哈希密码(新密码用 argon2id)。
 *
 * 用于:
 * - 用户注册
 * - 密码重置
 * - 密码修改
 */
export async function hashPassword(password: string): Promise<string> {
  // 国安级:argon2id 替代 bcrypt(抗 GPU/ASIC 攻击)
  return argon2.hash(password, ARGON2ID_OPTIONS)
}

/**
 * 验证密码(兼容 bcrypt + argon2id)。
 *
 * 用于:
 * - 用户登录
 * - 修改密码时校验旧密码
 *
 * 自动升级:如果哈希是 bcrypt(老密码),验证成功后调用 shouldUpgradeHash 判断是否需要升级。
 * 调用方应在登录成功后调用 upgradeHashIfNeeded 完成透明迁移。
 *
 * 恒定时间比较:argon2.verify 和 bcrypt.compare 都是恒定时间(抗时序攻击)。
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (isArgon2Hash(hash)) {
      // 新密码:argon2id 验证(argon2.verify 接受 string | Buffer)
      return await argon2.verify(hash, Buffer.from(password, 'utf8'))
    }
    if (isBcryptHash(hash)) {
      // 老密码:bcrypt 验证(兼容)
      return await bcrypt.compare(password, hash)
    }
    // 未知格式:SHA256 无盐?(member.ts 可能)或其他 — 用 bcrypt.compare 兜底
    return await bcrypt.compare(password, hash)
  } catch {
    // 任何异常都返回 false(防 oracle 攻击)
    return false
  }
}

/**
 * 判断密码哈希是否需要升级到 argon2id。
 * - bcrypt 哈希 → 需要升级
 * - argon2id 哈希 → 不需要升级
 */
export function shouldUpgradeHash(hash: string): boolean {
  return isBcryptHash(hash) || !isArgon2Hash(hash)
}

/**
 * 透明升级密码哈希(登录成功后调用)。
 *
 * 如果哈希是 bcrypt(老密码),用 argon2id 重新哈希并返回新哈希。
 * 调用方应将新哈希存入 DB,完成平滑迁移。
 *
 * 如果已经是 argon2id,返回 null(无需升级)。
 */
export async function upgradeHashIfNeeded(
  password: string,
  currentHash: string,
): Promise<string | null> {
  if (!shouldUpgradeHash(currentHash)) return null
  try {
    return await hashPassword(password)
  } catch {
    // 升级失败不影响登录(下次再试)
    return null
  }
}
