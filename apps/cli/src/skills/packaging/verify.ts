// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 技能包安装期校验链 — 严格按验收要求的顺序执行,每一步都有稳定错误码:
 *
 *   1. 包完整性 + 逐文件 sha256(含"清单缺项 / 清单多项"两类)
 *   2. 发布者签名(trustedKeys,缺配置即拒,不存在"没签名就放行")
 *   3. manifest 合法性(经 ManifestGate,可对接并行会话的扩展 manifest 校验器)
 *   4. 路径安全(绝对路径 / `..` / 符号链接 / 可执行位 / 重复路径)
 *
 * **安装期不执行包内任何代码**:本模块只做 `readFileSync` / `Buffer` 解析 / 哈希 /
 * 签名校验;没有任何 spawn/exec/eval/动态 import。落盘只在 install.ts 的 staging 里
 * 写常规文件(0644),见该文件顶部说明。
 */

import * as fs from 'node:fs'
import { createHash } from 'node:crypto'
import { SkillPackageError, type SkillPackageCheck } from './errors.js'
import { CHECKSUMS_FILE, MANIFEST_FILE, SIGNATURE_FILE, parseChecksums, parseSignature, verifyChecksumsSignature } from './canonical.js'
import { readTar, type TarReadEntry } from './tar.js'
import { assertManifestGate, createStructuralManifestGate, type ManifestGate, type ManifestIdentity } from './manifest-gate.js'
import { loadTrustedKeyStore, type TrustedKeyStore } from './trust-store.js'

export interface VerifySkillPackageOptions {
  /** trustStore 的磁盘路径;不传用 ~/.ihui/skill-trusted-keys.json */
  trustedKeysPath?: string
  /** 测试/上层注入已加载的信任锚(优先于 trustedKeysPath) */
  trustStore?: TrustedKeyStore
  /** manifest 门;缺省安装期最小结构门(见 manifest-gate.ts 的耦合说明) */
  manifestGate?: ManifestGate
}

export interface SkillPackageVerification {
  ok: boolean
  /** 逐阶段结论(成功/失败都留痕) */
  checks: SkillPackageCheck[]
  /** 常规文件路径列表(相对包根,已校验) */
  files: string[]
  identity?: ManifestIdentity
  manifest?: Record<string, unknown>
  /** ok=false 时的结构化错误 */
  error?: SkillPackageError
  /** 已校验的常规文件字节(install.ts 直接落盘,不二次解析未校验内容) */
  contents?: Map<string, Buffer>
}

function append(checks: SkillPackageCheck[], check: SkillPackageCheck): void {
  checks.push(check)
}

function fail(
  checks: SkillPackageCheck[],
  error: SkillPackageError,
  stage: number,
  item: string,
): SkillPackageVerification {
  append(checks, { stage, item, ok: false, code: error.code, message: error.message })
  return { ok: false, checks, files: [], error }
}

/** 路径安全判定:返回 null 表示安全,否则给出错误码与原因。 */
function classifyPath(rawPath: string): { code: 'SKILL_PKG_PATH_ABSOLUTE' | 'SKILL_PKG_PATH_TRAVERSAL'; reason: string } | null {
  if (rawPath.length === 0) return { code: 'SKILL_PKG_PATH_TRAVERSAL', reason: 'empty-path' }
  if (rawPath.includes('\0')) return { code: 'SKILL_PKG_PATH_TRAVERSAL', reason: 'nul-byte' }
  // Windows 盘符/UNC/反斜杠根优先判绝对:`C:\evil.txt` 必须报绝对路径而不是"分隔符异常"。
  if (/^[A-Za-z]:/.test(rawPath)) return { code: 'SKILL_PKG_PATH_ABSOLUTE', reason: 'windows-drive' }
  if (rawPath.startsWith('\\')) return { code: 'SKILL_PKG_PATH_ABSOLUTE', reason: 'windows-rooted' }
  if (rawPath.startsWith('/')) return { code: 'SKILL_PKG_PATH_ABSOLUTE', reason: 'unix-absolute' }
  // 相对路径里的反斜杠:不是我们接受的 tar 路径分隔符,按越界处理。
  if (rawPath.includes('\\')) return { code: 'SKILL_PKG_PATH_TRAVERSAL', reason: 'backslash-separator' }
  const segments = rawPath.replace(/\/+$/, '').split('/')
  if (segments.some((segment) => segment === '' || segment === '.')) {
    return { code: 'SKILL_PKG_PATH_TRAVERSAL', reason: 'empty-or-dot-segment' }
  }
  if (segments.some((segment) => segment === '..')) {
    return { code: 'SKILL_PKG_PATH_TRAVERSAL', reason: 'parent-segment' }
  }
  return null
}

function checkPathSafety(rawOrder: readonly TarReadEntry[], duplicates: readonly string[]): SkillPackageError | null {
  if (duplicates.length > 0) {
    return new SkillPackageError('SKILL_PKG_PATH_DUPLICATE', `包内路径重复:${duplicates.join(', ')}`, {
      path: duplicates[0],
      duplicates: [...duplicates],
    })
  }
  for (const entry of rawOrder) {
    if (entry.type === 'symlink' || entry.type === 'unsupported') {
      return new SkillPackageError(
        'SKILL_PKG_PATH_LINK',
        `包内不允许符号链接/硬链接/特殊档形:${entry.path}(type=${entry.type})`,
        { path: entry.path, type: entry.type, linkname: entry.linkname },
      )
    }
    const verdict = classifyPath(entry.path)
    if (verdict) {
      return new SkillPackageError(verdict.code, `包内路径不安全:${entry.path}(${verdict.reason})`, {
        path: entry.path,
        reason: verdict.reason,
      })
    }
    if (entry.type === 'file' && (entry.mode & 0o111) !== 0) {
      return new SkillPackageError(
        'SKILL_PKG_PATH_EXECUTABLE',
        `包内常规文件带可执行位:${entry.path}(mode=${entry.mode.toString(8)})`,
        { path: entry.path, mode: entry.mode.toString(8) },
      )
    }
  }
  return null
}

/** 校验一个已读入内存的包(测试与 CLI 共用同一条链,避免两份判据漂移)。 */
export function verifySkillPackageBuffer(
  buffer: Buffer,
  options: VerifySkillPackageOptions = {},
): SkillPackageVerification {
  const checks: SkillPackageCheck[] = []
  const gate = options.manifestGate ?? createStructuralManifestGate()

  // ---------- 归档结构 ----------
  let raw: ReturnType<typeof readTar>
  try {
    raw = readTar(buffer)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', String(err))
    return fail(checks, error, 1, 'archive')
  }
  append(checks, { stage: 1, item: 'archive', ok: true })

  // ---------- 1. 完整性 + 逐文件 sha256 ----------
  const checksumsEntry = raw.entries.get(CHECKSUMS_FILE)
  if (!checksumsEntry) {
    return fail(
      checks,
      new SkillPackageError('SKILL_PKG_CHECKSUMS_MISSING', `包内缺少 ${CHECKSUMS_FILE}`, { file: CHECKSUMS_FILE }),
      1,
      'checksums-present',
    )
  }
  const manifestEntry = raw.entries.get(MANIFEST_FILE)
  if (!manifestEntry) {
    return fail(
      checks,
      new SkillPackageError('SKILL_PKG_MANIFEST_MISSING', `包内缺少 ${MANIFEST_FILE}`, { file: MANIFEST_FILE }),
      1,
      'manifest-present',
    )
  }

  const actualFiles = new Map<string, Buffer>()
  for (const entry of raw.rawOrder) {
    if (entry.type !== 'file') continue
    if (entry.path === CHECKSUMS_FILE || entry.path === SIGNATURE_FILE) continue
    if (!actualFiles.has(entry.path)) actualFiles.set(entry.path, entry.content)
  }

  let checksums: ReturnType<typeof parseChecksums>
  try {
    checksums = parseChecksums(checksumsEntry.content)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_CHECKSUMS_INVALID', String(err))
    return fail(checks, error, 1, 'checksums-parse')
  }
  append(checks, { stage: 1, item: 'checksums-parse', ok: true })

  const listed = new Set(Object.keys(checksums.files))
  for (const file of actualFiles.keys()) {
    if (!listed.has(file)) {
      return fail(
        checks,
        new SkillPackageError('SKILL_PKG_CHECKSUM_MISSING_ENTRY', `checksums 清单缺项:本次包内存在但未登记:${file}`, {
          file,
        }),
        1,
        'checksums-completeness',
      )
    }
  }
  for (const file of listed) {
    if (!actualFiles.has(file)) {
      return fail(
        checks,
        new SkillPackageError('SKILL_PKG_CHECKSUM_EXTRA_ENTRY', `checksums 清单多项:登记了包内不存在的文件:${file}`, {
          file,
        }),
        1,
        'checksums-completeness',
      )
    }
  }
  append(checks, { stage: 1, item: 'checksums-completeness', ok: true })

  for (const [file, bytes] of actualFiles) {
    const expected = checksums.files[file]!
    const actual = createDigest(bytes)
    if (expected !== actual) {
      return fail(
        checks,
        new SkillPackageError('SKILL_PKG_CHECKSUM_MISMATCH', `逐文件 sha256 不匹配:${file}(expected=${expected}, actual=${actual})`, {
          file,
          expected,
          actual,
        }),
        1,
        'checksums-digest',
      )
    }
  }
  append(checks, { stage: 1, item: 'checksums-digest', ok: true })

  // ---------- 2. 发布者签名 ----------
  const signatureEntry = raw.entries.get(SIGNATURE_FILE)
  if (!signatureEntry) {
    return fail(
      checks,
      new SkillPackageError(
        'SKILL_PKG_SIGNATURE_MISSING',
        `包内缺少 ${SIGNATURE_FILE}(无签名即拒装,不存在"没签名就放行")`,
        { file: SIGNATURE_FILE },
      ),
      2,
      'signature-present',
    )
  }
  let signature: ReturnType<typeof parseSignature>
  try {
    signature = parseSignature(signatureEntry.content)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_SIGNATURE_INVALID', String(err))
    return fail(checks, error, 2, 'signature-parse')
  }
  let store: TrustedKeyStore
  try {
    store = options.trustStore ?? loadTrustedKeyStore(options.trustedKeysPath)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_TRUST_STORE_INVALID', String(err))
    return fail(checks, error, 2, 'trust-store')
  }
  try {
    verifyChecksumsSignature(checksumsEntry.content, signature, store)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_SIGNATURE_INVALID', String(err))
    return fail(checks, error, 2, 'signature-verify')
  }
  append(checks, { stage: 2, item: 'signature-verify', ok: true })

  // ---------- 3. manifest ----------
  let manifestRaw: unknown
  try {
    manifestRaw = JSON.parse(manifestEntry.content.toString('utf8')) as unknown
  } catch (err) {
    return fail(
      checks,
      new SkillPackageError('SKILL_PKG_MANIFEST_INVALID', `${MANIFEST_FILE} 不是合法 JSON`, {
        file: MANIFEST_FILE,
        cause: err instanceof Error ? err.message : String(err),
      }),
      3,
      'manifest-parse',
    )
  }
  let validated: ReturnType<typeof assertManifestGate>
  try {
    validated = assertManifestGate(gate, manifestRaw)
  } catch (err) {
    const error = err instanceof SkillPackageError ? err : new SkillPackageError('SKILL_PKG_MANIFEST_INVALID', String(err))
    return fail(checks, error, 3, 'manifest-validate')
  }
  append(checks, { stage: 3, item: `manifest-validate(${validated.gate})`, ok: true })

  // ---------- 4. 路径安全 ----------
  const unsafe = checkPathSafety(raw.rawOrder, raw.duplicates)
  if (unsafe) return fail(checks, unsafe, 4, 'path-safety')
  append(checks, { stage: 4, item: 'path-safety', ok: true })

  return {
    ok: true,
    checks,
    files: [...actualFiles.keys()].sort(),
    identity: validated.identity,
    manifest: validated.raw,
    contents: actualFiles,
  }
}

/** 从磁盘读包并校验。 */
export function verifySkillPackage(
  packagePath: string,
  options: VerifySkillPackageOptions = {},
): SkillPackageVerification {
  let buffer: Buffer
  try {
    buffer = fs.readFileSync(packagePath)
  } catch (err) {
    return fail(
      [],
      new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', `无法读取包文件:${packagePath}`, {
        path: packagePath,
        cause: err instanceof Error ? err.message : String(err),
      }),
      1,
      'archive-read',
    )
  }
  return verifySkillPackageBuffer(buffer, options)
}

function createDigest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
