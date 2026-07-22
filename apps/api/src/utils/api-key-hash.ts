/**
 * API Key secret 哈希与生成工具。
 *
 * 2026-07-22 安全审计加固:
 * - secret 字段从明文存储改为 sha256 哈希存储(与 schema 注释"存储需哈希"对齐)
 * - sha256 而非 bcrypt:API key 是高熵随机串(非低熵用户密码),sha256 足够且可索引
 * - 哈希值以 `sha256:` 前缀标识,过渡期老明文数据用 isHashed() 判断
 * - verifySecret 同时支持明文与哈希,避免一次性迁移卡死
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'

const HASH_PREFIX = 'sha256:'

/**
 * 对 secret 明文做 sha256 哈希。
 * @returns 形如 `sha256:<64 hex>` 的哈希字符串
 */
export function hashSecret(plain: string): string {
  return HASH_PREFIX + createHash('sha256').update(plain, 'utf8').digest('hex')
}

/**
 * 判断存储值是否已哈希(以 `sha256:` 前缀标识)。
 * 用于过渡期区分老明文数据与新哈希数据。
 */
export function isHashed(value: string): boolean {
  return value.startsWith(HASH_PREFIX)
}

/**
 * 校验 secret 明文与存储值是否匹配。
 * - 存储值已哈希:对明文做 hashSecret 后比对
 * - 存储值为老明文:直接比对(兼容过渡)
 */
export function verifySecret(plain: string, stored: string): boolean {
  if (isHashed(stored)) {
    return hashSecret(plain) === stored
  }
  return plain === stored
}

/**
 * 统一生成 API Key 的公开标识与 secret。
 * - key: `ihui_` + 24 位随机 hex(12 字节 CSPRNG),公开标识可展示
 * - secret: `sk_` + 32 位 hex(uuid 无横线),仅创建/轮换时返回明文,存储为哈希
 */
export function generateApiKey(): { key: string; secret: string } {
  const key = `ihui_${randomBytes(12).toString('hex')}`
  const secret = `sk_${randomUUID().replace(/-/g, '')}`
  return { key, secret }
}
