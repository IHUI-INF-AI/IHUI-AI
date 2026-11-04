// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 规范性字节:逐文件 sha256、校验和清单、发布者签名。
 *
 * 可重现的三个固定点(专家包验收项):
 *   1. `canonicalJson` 递归排序对象键、固定 2 空格缩进、结尾单个 `\n`;
 *   2. `buildChecksums` 的文件名列表按字典序,摘要为小写 hex;
 *   3. ed25519 **签名确定性**(RFC 8032):同一 key + 同一字节 ⇒ 同一签名。
 * 三者叠加后,同一组文件的 `checksums.json` 与整包字节都可逐字节复现。
 */

import { createHash, createPrivateKey, sign, verify, type KeyObject } from 'node:crypto'
import * as fs from 'node:fs'
import { SkillPackageError } from './errors.js'
import { SKILL_TRUST_STORE_ALGORITHM, type TrustedKeyStore } from './trust-store.js'

export const CHECKSUMS_FILE = 'checksums.json'
export const MANIFEST_FILE = 'manifest.json'
export const SIGNATURE_FILE = 'signature.json'
export const SIGNATURE_PAYLOAD = CHECKSUMS_FILE

/** 不参与 checksums 自身的两个元数据文件(它们描述"其余文件",不能描述自己)。 */
export const CHECKSUM_EXCLUDED_FILES: readonly string[] = [CHECKSUMS_FILE, SIGNATURE_FILE]

export interface ChecksumsDocument {
  algorithm: 'sha256'
  files: Record<string, string>
}

export interface SignatureDocument {
  algorithm: typeof SKILL_TRUST_STORE_ALGORITHM
  keyId: string
  payload: typeof SIGNATURE_PAYLOAD
  signature: string
}

export function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

/** 递归排序对象键后再序列化;数组顺序保留(顺序本身是入参语义的一部分)。 */
export function canonicalJson(value: unknown): Buffer {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize)
    if (input && typeof input === 'object') {
      const obj = input as Record<string, unknown>
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(obj).sort()) sorted[key] = normalize(obj[key])
      return sorted
    }
    return input
  }
  return Buffer.from(`${JSON.stringify(normalize(value), null, 2)}\n`, 'utf8')
}

/** 从"文件路径 → 字节"构建规范化 checksums.json 字节。 */
export function buildChecksums(files: ReadonlyMap<string, Buffer>): Buffer {
  const digests: Record<string, string> = {}
  for (const file of [...files.keys()].sort()) {
    if (CHECKSUM_EXCLUDED_FILES.includes(file)) continue
    digests[file] = sha256Hex(files.get(file)!)
  }
  return canonicalJson({ algorithm: 'sha256', files: digests } satisfies ChecksumsDocument)
}

/** 解析 checksums.json;形状不合法 ⇒ SKILL_PKG_CHECKSUMS_INVALID。 */
export function parseChecksums(bytes: Buffer): ChecksumsDocument {
  let raw: unknown
  try {
    raw = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (err) {
    throw new SkillPackageError('SKILL_PKG_CHECKSUMS_INVALID', 'checksums.json 不是合法 JSON', {
      cause: err instanceof Error ? err.message : String(err),
    })
  }
  const doc = raw as Record<string, unknown> | null
  if (!doc || typeof doc !== 'object' || doc.algorithm !== 'sha256') {
    throw new SkillPackageError('SKILL_PKG_CHECKSUMS_INVALID', 'checksums.json 的 algorithm 必须是 sha256')
  }
  const files = doc.files
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new SkillPackageError('SKILL_PKG_CHECKSUMS_INVALID', 'checksums.json 缺少 files 对象')
  }
  const normalized: Record<string, string> = {}
  for (const [file, digest] of Object.entries(files as Record<string, unknown>)) {
    if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest)) {
      throw new SkillPackageError('SKILL_PKG_CHECKSUMS_INVALID', `checksums.files["${file}"] 不是 64 位小写 sha256`, {
        file,
      })
    }
    normalized[file] = digest
  }
  return { algorithm: 'sha256', files: normalized }
}

/** 解析 signature.json;形状/算法不合法 ⇒ SKILL_PKG_SIGNATURE_INVALID。 */
export function parseSignature(bytes: Buffer): SignatureDocument {
  let raw: unknown
  try {
    raw = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (err) {
    throw new SkillPackageError('SKILL_PKG_SIGNATURE_INVALID', 'signature.json 不是合法 JSON', {
      cause: err instanceof Error ? err.message : String(err),
    })
  }
  const doc = raw as Record<string, unknown> | null
  if (
    !doc ||
    typeof doc !== 'object' ||
    doc.algorithm !== SKILL_TRUST_STORE_ALGORITHM ||
    typeof doc.keyId !== 'string' ||
    doc.keyId.length === 0 ||
    doc.payload !== SIGNATURE_PAYLOAD ||
    typeof doc.signature !== 'string' ||
    doc.signature.length === 0
  ) {
    throw new SkillPackageError(
      'SKILL_PKG_SIGNATURE_INVALID',
      'signature.json 字段不合法(需要 algorithm=ed25519/keyId/payload=checksums.json/signature)',
    )
  }
  return {
    algorithm: SKILL_TRUST_STORE_ALGORITHM,
    keyId: doc.keyId,
    payload: SIGNATURE_PAYLOAD,
    signature: doc.signature,
  }
}

/** 用私钥对 checksums.json 的**原始字节**签名(不是重新序列化的版本)。 */
export function signChecksums(checksumsBytes: Buffer, privateKey: KeyObject, keyId: string): SignatureDocument {
  return {
    algorithm: SKILL_TRUST_STORE_ALGORITHM,
    keyId,
    payload: SIGNATURE_PAYLOAD,
    signature: sign(null, checksumsBytes, privateKey).toString('base64'),
  }
}

/** 读 PEM 私钥(CLI --signing-key 用)。 */
export function loadPrivateKey(pemPath: string): KeyObject {
  const text = fs.readFileSync(pemPath, 'utf8')
  return createPrivateKey(text)
}

/**
 * 用 trustedKeys 校验签名。调用方必须先断言"签名文件存在"(否则本函数无法区分
 * "没签名"和"签名坏" —— 两种都必须是不同的错误码)。
 */
export function verifyChecksumsSignature(
  checksumsBytes: Buffer,
  signature: SignatureDocument,
  store: TrustedKeyStore,
): void {
  const trusted = store.keys.get(signature.keyId)
  if (!trusted) {
    throw new SkillPackageError(
      'SKILL_PKG_SIGNATURE_KEY_UNTRUSTED',
      `签名 keyId=${signature.keyId} 不在 trustedKeys 内(信任锚:${store.source})`,
      { keyId: signature.keyId, trustStore: store.source },
    )
  }
  let ok = false
  try {
    ok = verify(null, checksumsBytes, trusted.publicKey, Buffer.from(signature.signature, 'base64'))
  } catch {
    ok = false
  }
  if (!ok) {
    throw new SkillPackageError('SKILL_PKG_SIGNATURE_INVALID', `签名校验失败(keyId=${signature.keyId})`, {
      keyId: signature.keyId,
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
