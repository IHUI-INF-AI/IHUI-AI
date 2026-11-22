// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 发布清单的纯判据。不读盘、不算哈希：调用方把已经量到的 sha256 和字节数交进来。
// 对方 install-manifest 只有相对路径字符串，内容被换也判不出来。
// 这里每条必须同时有 path、sha256、bytes，整份清单再带 arch。

const ARCHES = new Set(['win32-x64', 'darwin-arm64', 'linux-x64'])
const SHA256_HEX = /^[0-9a-f]{64}$/

function fail(reason) {
  return { ok: false, reason, manifest: null }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/** 相对路径。绝对路径、`..`、反斜杠、空段一律拒绝。 */
function judgePath(path) {
  if (typeof path !== 'string' || path.trim() === '') return 'path-invalid'
  if (path.includes('\\')) return 'path-invalid'
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return 'path-invalid'
  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment.includes('..'))) return 'path-invalid'
  return null
}

/**
 * 一条文件记录。哈希不是 64 位小写十六进制（含缺失、大写）整条作废，
 * 不把缺哈希写成空串。bytes 必须是已经量到的非负整数，boolean 不是整数。
 */
function normalizeFile(file) {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) {
    return { ok: false, reason: 'entry-invalid' }
  }
  const pathReason = judgePath(file.path)
  if (pathReason) return { ok: false, reason: pathReason }
  if (typeof file.sha256 !== 'string' || !SHA256_HEX.test(file.sha256)) {
    return { ok: false, reason: 'hash-unmeasured' }
  }
  if (typeof file.bytes !== 'number' || !Number.isInteger(file.bytes) || file.bytes < 0) {
    return { ok: false, reason: 'bytes-unmeasured' }
  }
  return {
    ok: true,
    file: { path: file.path, sha256: file.sha256, bytes: file.bytes },
  }
}

/**
 * @param {{ appVersion?: unknown, generatedAt?: unknown, arch?: unknown, files?: unknown }} input
 * @returns {{ ok: true, reason: 'planned', manifest: { appVersion: string, generatedAt: string, arch: string, files: { path: string, sha256: string, bytes: number }[] } } | { ok: false, reason: string, manifest: null }}
 */
export function planReleaseManifest(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return fail('input-unreadable')
  }
  if (!nonEmptyString(input.appVersion)) return fail('version-absent')
  if (!nonEmptyString(input.generatedAt)) return fail('generated-at-absent')
  if (Number.isNaN(Date.parse(input.generatedAt))) return fail('generated-at-unparseable')
  if (!ARCHES.has(input.arch)) return fail('arch-invalid')
  if (!Array.isArray(input.files)) return fail('files-absent')

  const files = []
  const seen = new Set()
  for (const entry of input.files) {
    const normalized = normalizeFile(entry)
    if (!normalized.ok) return fail(normalized.reason)
    if (seen.has(normalized.file.path)) return fail('duplicate-path')
    seen.add(normalized.file.path)
    files.push(normalized.file)
  }

  return {
    ok: true,
    reason: 'planned',
    manifest: {
      appVersion: input.appVersion,
      generatedAt: input.generatedAt,
      arch: input.arch,
      files,
    },
  }
}

function breach(reason, path) {
  return path === undefined ? { verdict: 'breach', reason } : { verdict: 'breach', reason, path }
}

function compareFiles(expected, actual) {
  const actualByPath = new Map(actual.map((file) => [file.path, file]))
  for (const file of expected) {
    const got = actualByPath.get(file.path)
    if (!got) return breach('missing-file', file.path)
    if (got.sha256 !== file.sha256 || got.bytes !== file.bytes) {
      return breach('content-mismatch', file.path)
    }
  }
  const expectedPaths = new Set(expected.map((file) => file.path))
  for (const file of actual) {
    if (!expectedPaths.has(file.path)) return breach('extra-file', file.path)
  }
  return { verdict: 'ok', reason: 'matched' }
}

/**
 * 用 planReleaseManifest 复核清单形状，不另写一套判据。
 * measured === null 是没量到，不是空目录，不得因此通过。
 * @param {object | null} manifest
 * @param {{ arch?: unknown, files?: unknown } | null} measured
 */
export function verifyReleaseManifest(manifest, measured) {
  if (measured === null) return { verdict: 'unjudged', reason: 'measure-absent' }
  const planned = planReleaseManifest(manifest)
  if (!planned.ok) return { verdict: 'unjudged', reason: planned.reason }
  if (measured === undefined || typeof measured !== 'object' || Array.isArray(measured)) {
    return { verdict: 'unjudged', reason: 'measure-absent' }
  }
  const measuredPlan = planReleaseManifest({
    appVersion: planned.manifest.appVersion,
    generatedAt: planned.manifest.generatedAt,
    arch: measured.arch,
    files: measured.files,
  })
  if (!measuredPlan.ok) return { verdict: 'unjudged', reason: measuredPlan.reason }
  if (measuredPlan.manifest.arch !== planned.manifest.arch) {
    return breach('arch-mismatch')
  }
  return compareFiles(planned.manifest.files, measuredPlan.manifest.files)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
