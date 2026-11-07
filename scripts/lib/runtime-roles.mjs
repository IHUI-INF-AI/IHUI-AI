// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时角色准入。不读盘、不算哈希，只看调用方已经量到的 ABI 号和各角色摘要。
 *
 * 只承认已经取证的那一个 ABI。别的号一律未判定：不装，也不改写成已知的拒绝原因。
 * 八个角色缺任一就拒绝，并按清单顺序点名。
 * 角色值不是对象，或摘要不是 64 位小写十六进制，视为哈希没量到：未判定，缺哈希的角色不得拿去装。
 * 清单以外的角色名忽略，不因此拒绝。
 */

export const REQUIRED_RUNTIME_ROLES = Object.freeze([
  'entry',
  'scanWorker',
  'legacyMigrationWorker',
  'mtreeLoader',
  'mtreeBinary',
  'ripgrep',
  'assetModule',
  'assetBinary',
])

/** 已经取证的原生 ABI 号。除此之外都不认识。 */
export const OBSERVED_NAPI_ABI = 10

const SHA256_RE = /^[0-9a-f]{64}$/

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 有限正整数。零、负数、小数、非数字都算没量到。 */
function isFinitePositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function unjudged(reason) {
  return { disposition: 'unjudged', reason, missing: null }
}

function hashMeasured(role) {
  return isPlainObject(role) && typeof role.sha256 === 'string' && SHA256_RE.test(role.sha256)
}

/**
 * @param {{ abiVersion?: unknown, files?: unknown }} input
 * @returns {{ disposition: 'unjudged' | 'refused' | 'admitted', reason: string, missing: string[] | null }}
 */
export function judgeRuntimeRoles(input) {
  const files = input !== null && typeof input === 'object' ? input.files : undefined
  const abiVersion = input !== null && typeof input === 'object' ? input.abiVersion : undefined

  if (!isPlainObject(files)) return unjudged('files-unmeasured')
  if (!isFinitePositiveInteger(abiVersion)) return unjudged('abi-unmeasured')
  if (abiVersion !== OBSERVED_NAPI_ABI) return unjudged('abi-unknown')

  const missing = REQUIRED_RUNTIME_ROLES.filter((role) => !Object.hasOwn(files, role))
  if (missing.length > 0) {
    return { disposition: 'refused', reason: 'role-absent', missing }
  }

  for (const role of REQUIRED_RUNTIME_ROLES) {
    if (!hashMeasured(files[role])) return unjudged('hash-unmeasured')
  }

  return { disposition: 'admitted', reason: 'roles-sealed', missing: [] }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
