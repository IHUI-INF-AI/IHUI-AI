// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-35 方案②(2026-11-16 机主定案):users.phone/email 改加密存储 + 确定性盲索引。
 *
 * 设计(见迁移 20261116174441_users_contact_blind_index.sql):
 *   · `phone`/`email` 列存密文 `enc:v1:iv:tag:ct`(utils/crypto.ts encryptCredential,随机 IV ⇒ 非确定性);
 *   · `phoneLookup`/`emailLookup` 列存 sha256(归一后值) 的十六进制小写 —— 确定性,供精确匹配 + 唯一索引;
 *   · 唯一索引从明文列迁到 lookup 列(users_phone_lookup_unique / users_email_lookup_unique);
 *   · ilike 模糊搜索降级为 eq(lookup, hash(term)) —— 方案②的既定代价(机主已接受)。
 *
 * 本文件是归一/hash 的**唯一实现**(§0.6 单一真相源),必须与迁移 SQL 里的回填表达式逐字等价:
 *   · phone 归一:trim + 去空白/连字符 + 去 +86/0086/86 前缀(复用 utils/phone.ts stripCnSmsPrefix);
 *   · email 归一:trim + 全小写;
 *   · hash:sha256(utf8(归一后值)) 的十六进制小写。
 * 改任一侧(本文件或迁移)必须同步另一侧,否则盲索引失配 ⇒ 登录/查重静默失效。
 */
import { createHash } from 'node:crypto'
import { decryptCredential, encryptCredential } from './crypto.js'
import { stripCnSmsPrefix } from './phone.js'

/** lookup 列长度上限(sha256 hex = 64 字符)。 */
const LOOKUP_HEX_LEN = 64

/** 手机号归一:与迁移回填表达式逐字等价(trim → 去 \s/- → 去 +86/0086)。 */
function normalizePhone(raw: string): string {
  return stripCnSmsPrefix(raw)
}

/** 邮箱归一:trim + 全小写(与迁移 lower(btrim(email)) 等价)。 */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * 联系方式归一(按字段类型分派)。
 * 这是 hash 前的唯一归一入口;query 层查 lookup 前必须先走这里,否则查不准。
 */
export function normalizeUserContact(field: 'phone' | 'email', raw: string): string {
  return field === 'phone' ? normalizePhone(raw) : normalizeEmail(raw)
}

/**
 * 联系方式盲索引 hash:sha256(utf8(归一后值)) 的十六进制小写。
 * 与迁移 `encode(sha256(convert_to(<归一值>, 'UTF8')), 'hex')` 同一算法。
 * 空串原样返回(与"未填写"同义,不参与唯一性)。
 */
export function hashUserContact(field: 'phone' | 'email', raw: string): string {
  const normalized = normalizeUserContact(field, raw)
  if (normalized === '') return ''
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * 加密一个联系方式(写 users.phone/email 前调用)。
 * null/undefined/空串原样透传;已加密值幂等返回(encryptCredential 内置)。
 */
export function encryptUserContact(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  if (value === '') return value
  return encryptCredential(value)
}

/**
 * 解密一个联系方式(读 users.phone/email 展示时调用)。
 * null/undefined 原样透传;存量明文(无 enc:v1: 前缀)由 decryptCredential 原样返回。
 * 密文格式/认证失败由 decryptCredential 抛错(fail-closed,绝不把密文当明文返回)。
 */
export function decryptUserContact(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value
  if (value === '') return value
  return decryptCredential(value)
}

/**
 * 展示投影解密:对 select 出的密文列做应用层解密。
 * DB-35:phone/email(含 ownerPhone/ownerEmail 等别名投影)列存密文,读出后必须解密再下发。
 * 密文格式(enc:v1:...)由 decryptCredential 认证解码;存量明文原样透传;解密失败抛错(fail-closed)。
 * 默认解密 phone/email 两列;传 keys 可解密任意命名的密文列(如 'ownerPhone','ownerEmail')。
 * 行其余列(id/Date/number 等)原样保留;只要求被解密的列可空字符串(明文/密文/未填写)。
 * usercenter-queries / admin-queries / member-queries 共用此实现(§0.6 单一真相源)。
 */
export function decryptPublicContact<T extends object>(row: T, ...keys: readonly string[]): T {
  const fields = keys.length > 0 ? [...keys] : ['phone', 'email']
  const out = { ...row } as Record<string, unknown>
  for (const k of fields) {
    const v = (row as Record<string, unknown>)[k]
    if (k in (row as Record<string, unknown>))
      out[k] = decryptUserContact(v as string | null | undefined) ?? null
  }
  return out as T
}

/**
 * 搜索层 lookup helper:把用户输入的搜索词归一+hash 成 lookup 值。
 * DB-35 方案②:phone/email 列存密文,ilike 中缀模糊搜索不可用,统一降级为
 * eq(users.<field>Lookup, <hash>) 精确匹配(机主已接受此代价)。
 * 返回 null 表示该词无法归一成有效联系方式(调用方不应添加任何 phone/email 条件,
 * 而非退回明文 ilike —— 那会静默查不到密文数据)。
 * usercenter-queries / admin-queries / search-queries 等共用此实现(§0.6 单一真相源)。
 */
export function contactLookupForSearch(field: 'phone' | 'email', term: string): string | null {
  const norm = normalizeUserContact(field, term)
  if (norm === '') return null
  return hashUserContact(field, norm)
}

/**
 * 写入层 helper:把用户输入的 phone/email 转成"密文 + lookup" 对,供 insert/update users 用。
 * DB-35:phone/email 列存密文(encryptUserContact);phoneLookup/emailLookup 存 sha256 hash。
 * 返回 { value, lookup }，其中 value 为密文或 null(空值)，lookup 为哈希或 null(空值)。
 * usercenter-queries / member-queries / queries.ts 共用此实现(§0.6 单一真相源)。
 */
export function contactWritePair(
  field: 'phone' | 'email',
  raw: string | null | undefined,
): { value: string | null; lookup: string | null } {
  if (raw === null || raw === undefined || raw === '') return { value: null, lookup: null }
  const norm = normalizeUserContact(field, raw)
  if (norm === '') return { value: encryptUserContact(raw) ?? null, lookup: null }
  return { value: encryptUserContact(raw) ?? null, lookup: hashUserContact(field, norm) }
}

export const USER_CONTACT_LOOKUP_LEN = LOOKUP_HEX_LEN
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
