// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商汤小浣熊 Web 端凭据加密(2026-11-11 立,逆向自站点自身 bundle)。
 *
 * 取证链(逐字节对照,非猜测):
 *   源: https://xiaohuanxiong.com/_next/static/chunks/4528.be0e99847a1dc7c9.js 模块 54528
 *   function encryptCredential(e, r) {
 *     let n = CryptoJS.enc.Utf8.parse(r);                       // key = config.publicKey
 *     if (![16,24,32].includes(n.sigBytes)) throw Error('INVALID_ENCRYPTION_CONFIG');
 *     let t = CryptoJS.lib.WordArray.random(16);                // 随机 16 字节 IV
 *     let a = CryptoJS.AES.encrypt(e, n, {
 *       iv: t.clone(), mode: CryptoJS.mode.CFB, padding: CryptoJS.pad.NoPadding,
 *     });
 *     return t.concat(a.ciphertext).toString(CryptoJS.enc.Base64);   // IV ‖ 密文
 *   }
 *   key 取值: 注册页内联 config.publicKey = "senseraccoon2023"(16 字节 ⇒ AES-128)。
 *
 * 实测判据(2026-11-11,POST /api/web/auth/v1/register):
 *   明文 phone        → {"code":100003,"details":"param phone encrypted error"}
 *   本模块加密 phone  → 越过 phone 关,推进到下一字段 ⇒ 加密口径与服务端一致。
 *
 * 形状: Base64( IV[16B] ‖ AES-128-CFB(plaintext, key, iv) )。
 * CFB 是流模式 ⇒ 任意明文长度都不做填充(NoPadding),密文长度恒等于明文长度。
 */
import crypto from 'node:crypto'

/** 站点自身用的 AES key(来自注册页内联 config.publicKey) */
export const WEB_KEY_UTF8 = 'senseraccoon2023'

/** 允许的 key 长度(AES-128/192/256),与前端 `[16,24,32].includes(sigBytes)` 同口径 */
const ALLOWED_KEY_BYTES = Object.freeze([16, 24, 32])

function normalizeKey(keyText) {
  const key = Buffer.from(String(keyText ?? WEB_KEY_UTF8), 'utf8')
  if (!ALLOWED_KEY_BYTES.includes(key.length)) {
    // 与前端同措辞,便于对照排查
    throw new Error('INVALID_ENCRYPTION_CONFIG')
  }
  return key
}

function cipherName(key) {
  return `aes-${key.length * 8}-cfb`
}

/**
 * 加密单值。IV 每次随机(与前端 `WordArray.random(16)` 一致),同明文两次加密结果不同。
 * @param {string} plain 明文
 * @param {string} [keyText] AES key 文本,默认站点 key
 * @returns {string} Base64(IV ‖ ciphertext)
 */
export function encryptCredential(plain, keyText = WEB_KEY_UTF8) {
  const key = normalizeKey(keyText)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(cipherName(key), key, iv)
  cipher.setAutoPadding(false)
  const body = Buffer.concat([cipher.update(Buffer.from(String(plain), 'utf8')), cipher.final()])
  return Buffer.concat([iv, body]).toString('base64')
}

/**
 * 解密回明文。只用于本地自检/往返断言,生产链路不依赖。
 * @param {string} encoded Base64(IV ‖ ciphertext)
 * @param {string} [keyText]
 * @returns {string}
 */
export function decryptCredential(encoded, keyText = WEB_KEY_UTF8) {
  const key = normalizeKey(keyText)
  const raw = Buffer.from(String(encoded), 'base64')
  if (raw.length < 16) throw new Error('INVALID_CIPHERTEXT')
  const iv = raw.subarray(0, 16)
  const body = raw.subarray(16)
  const decipher = crypto.createDecipheriv(cipherName(key), key, iv)
  decipher.setAutoPadding(false)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}

/**
 * 批量加密对象中的指定字段(未命中或非字符串的字段原样保留)。
 * 小浣熊各接口只在少数敏感字段上做这层加密(phone / password / email),
 * 逐接口按需传字段名,避免把 ID 之类也加密掉。
 * @param {Record<string, unknown>} obj
 * @param {readonly string[]} fields
 * @param {string} [keyText]
 * @returns {Record<string, unknown>}
 */
export function encryptCredentialFields(obj, fields, keyText = WEB_KEY_UTF8) {
  const out = { ...obj }
  for (const f of fields) {
    const v = out[f]
    if (typeof v === 'string' && v.length > 0) out[f] = encryptCredential(v, keyText)
  }
  return out
}

/** 加密结果的字节长度(应为 16 + 明文 UTF-8 字节数),供断言用 */
export function cipherLength(encoded) {
  return Buffer.from(String(encoded), 'base64').length
}

export const __test__ = { normalizeKey, cipherName, ALLOWED_KEY_BYTES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
