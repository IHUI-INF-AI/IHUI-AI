// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能/市场清单的廉价判脏签名(纯函数,不读 mtime,不读盘)。
 *
 * 条目是自描述对象,按 path 的 UTF-16 码元序排列后再异或,输入顺序与换机都不改结果。
 * 空数组只有带具名件 catalog-empty-stable 才是稳定空态;没有这个标记是未判定。
 */

export const CATALOG_EMPTY_STABLE = 'catalog-empty-stable'

const SHA256_HEX = /^[0-9a-f]{64}$/

export interface CatalogProbe {
  path: string
  present: boolean
  hash: string | null
}

export interface CatalogSignature {
  ok: true
  missing: string[]
  sum: number
  xor: string
}

export interface SignCatalogInput {
  entries: CatalogProbe[] | null
  emptyMarker?: string | null
}

export type SignCatalogFailureReason =
  'entries-unmeasured' | 'roster-invalid' | 'hash-unmeasured' | 'empty-unmarked'

export type SignCatalogResult =
  | { ok: true; reason: 'signed' | 'empty-stable'; signature: CatalogSignature }
  | { ok: false; reason: 'missing-entries'; signature: null; missing: string[] }
  | { ok: false; reason: SignCatalogFailureReason; signature: null }

function reject(reason: SignCatalogFailureReason): SignCatalogResult {
  return { ok: false, reason, signature: null }
}

function compareCodeUnit(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function isSha256Hex(hash: string | null): hash is string {
  return typeof hash === 'string' && SHA256_HEX.test(hash)
}

/** 32 字节按位异或,再格式化成 64 位小写十六进制。缺文件不得进来。 */
function xorSha256Hex(hashes: readonly string[]): string {
  const acc = new Uint8Array(32)
  for (const hash of hashes) {
    for (let i = 0; i < 32; i += 1) {
      const byte = Number.parseInt(hash.slice(i * 2, i * 2 + 2), 16)
      const prev = acc[i] ?? 0
      acc[i] = prev ^ byte
    }
  }
  let hex = ''
  for (let i = 0; i < 32; i += 1) {
    hex += (acc[i] ?? 0).toString(16).padStart(2, '0')
  }
  return hex
}

export function signCatalog(input: SignCatalogInput): SignCatalogResult {
  const { entries } = input
  if (entries === null) return reject('entries-unmeasured')

  const seen = new Set<string>()
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || entry.path.length === 0 || seen.has(entry.path)) {
      return reject('roster-invalid')
    }
    seen.add(entry.path)
  }

  for (const entry of entries) {
    if (entry.present === true && !isSha256Hex(entry.hash)) return reject('hash-unmeasured')
  }

  const missing = entries
    .filter((entry) => entry.present === false)
    .map((entry) => entry.path)
    .sort(compareCodeUnit)
  if (missing.length > 0) {
    return { ok: false, reason: 'missing-entries', signature: null, missing }
  }

  if (entries.length === 0) {
    if (input.emptyMarker === CATALOG_EMPTY_STABLE) {
      return {
        ok: true,
        reason: 'empty-stable',
        signature: { ok: true, missing: [], sum: 0, xor: '0' },
      }
    }
    return reject('empty-unmarked')
  }

  const ordered = [...entries].sort((a, b) => compareCodeUnit(a.path, b.path))
  const hashes: string[] = []
  for (const entry of ordered) {
    if (!isSha256Hex(entry.hash)) return reject('hash-unmeasured')
    hashes.push(entry.hash)
  }

  return {
    ok: true,
    reason: 'signed',
    signature: {
      ok: true,
      missing: [],
      sum: entries.length,
      xor: xorSha256Hex(hashes),
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
