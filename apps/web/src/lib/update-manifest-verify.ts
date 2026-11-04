// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端「安装前」逐文件 sha256 校验(2026-11-04 立)。
 *
 * 与发布侧 `scripts/update-file-manifest.mjs` 同一份清单契约(`update-files.json`),
 * 本模块只负责**桌面客户端真正安装前**的那一步:把即将交给 Tauri 安装器的包与清单对齐,
 * size/sha256 任一不符即抛错 ⇒ 上层中止安装并展示点名错误。
 *
 * 清单缺失策略:**拒绝更新**(`manifest_missing`)。理由:发布链 `sync-downloads.mjs`
 * 每次同步都同批生成 `update-files.json`(scripts/sync-downloads.mjs:696),不存在
 * "发了包但没清单"的合法发布形态;缺失即说明这份产物没经过自校验,按不可信处理。
 */

export const UPDATE_MANIFEST_PATH = '/downloads/update-files.json'

export type UpdateManifestErrorCode =
  | 'manifest_missing'
  | 'manifest_corrupt'
  | 'package_entry_missing'
  | 'package_fetch_failed'
  | 'size_mismatch'
  | 'sha256_mismatch'

export interface UpdateManifestDetail {
  path: string
  expected?: string
  actual?: string
}

/** 校验失败的具名错误:message 直接可展示(文件 + 期望 + 实际)。 */
export class UpdateManifestError extends Error {
  constructor(
    readonly code: UpdateManifestErrorCode,
    message: string,
    readonly detail: UpdateManifestDetail,
  ) {
    super(message)
    this.name = 'UpdateManifestError'
  }
}

export interface UpdateFileEntry {
  path: string
  sha256: string
  size: number
}

export interface VerifyUpdatePackageOptions {
  /** 即将安装的包 URL(取自 Tauri `update.rawJson.platforms[...].url`);缺省时按平台从清单里挑。 */
  assetUrl?: string | null
  /** 清单地址,默认 `/downloads/update-files.json`。 */
  manifestUrl?: string
  /** 文件下载基地址(仅缺省 assetUrl 时用),默认取清单地址。 */
  fileBaseUrl?: string
  fetchImpl?: typeof fetch
  sha256Impl?: (data: ArrayBuffer) => Promise<string>
  /** 无 assetUrl 时用于在清单里挑包,默认按 UA 探测。 */
  platformToken?: string
  userAgent?: string
}

const SHA256_RE = /^[0-9a-f]{64}$/

/** 清单路径只收相对 POSIX 路径;绝对路径/盘符/`..` 一律判损坏。 */
export function isSafeManifestPath(p: unknown): p is string {
  if (typeof p !== 'string' || p.length === 0) return false
  const s = p.replace(/\\/g, '/')
  if (s.startsWith('/') || /^[A-Za-z]:/.test(s)) return false
  return s.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

/** 按 UA 推断平台 token(产物名里的 win / darwin / linux)。 */
export function detectPlatformToken(userAgent?: string): string {
  const ua = (
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  ).toLowerCase()
  if (ua.includes('windows') || ua.includes('win32') || ua.includes('win64')) return 'win'
  if (ua.includes('mac os') || ua.includes('macintosh') || ua.includes('darwin')) return 'darwin'
  return 'linux'
}

/** 同平台多格式时的取舍顺序:与发布链产物命名对齐。 */
const EXT_PREFERENCE = ['.exe', '.msi', '.dmg', '.appimage', '.deb', '.rpm', '.tar.gz', '.zip']

function pickByPlatform(entries: UpdateFileEntry[], token: string): UpdateFileEntry | null {
  const candidates = entries.filter(
    (e) => e.path.startsWith('desktop/') && e.path.toLowerCase().includes(token),
  )
  if (candidates.length === 0) return null
  for (const ext of EXT_PREFERENCE) {
    const hit = candidates.find((e) => e.path.toLowerCase().endsWith(ext))
    if (hit) return hit
  }
  return candidates[0] ?? null
}

function basename(urlOrName: string): string {
  const raw = urlOrName.split('?')[0]?.split('#')[0] ?? ''
  const last = raw.split('/').filter(Boolean).pop() ?? ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

async function defaultSha256(data: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('crypto.subtle 不可用,无法校验 sha256')
  const digest = await subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function parseManifest(raw: unknown): UpdateFileEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new UpdateManifestError('manifest_corrupt', '更新清单损坏:不是对象', { path: '' })
  }
  const rec = raw as Record<string, unknown>
  if (rec.schemaVersion !== 1) {
    throw new UpdateManifestError(
      'manifest_corrupt',
      `更新清单损坏:schemaVersion 期望 1,实际 ${JSON.stringify(rec.schemaVersion)}`,
      { path: '' },
    )
  }
  if (!Array.isArray(rec.files)) {
    throw new UpdateManifestError('manifest_corrupt', '更新清单损坏:缺 files 数组', { path: '' })
  }
  const seen = new Set<string>()
  return (rec.files as unknown[]).map((item) => {
    const e = item as Record<string, unknown>
    if (!e || typeof e !== 'object' || !isSafeManifestPath(e.path)) {
      throw new UpdateManifestError(
        'manifest_corrupt',
        `更新清单损坏:非法路径 ${JSON.stringify(e?.path)}`,
        { path: String(e?.path ?? '') },
      )
    }
    const path = (e.path as string).replace(/\\/g, '/')
    if (seen.has(path)) {
      throw new UpdateManifestError('manifest_corrupt', `更新清单损坏:重复条目 ${path}`, { path })
    }
    if (typeof e.sha256 !== 'string' || !SHA256_RE.test(e.sha256)) {
      throw new UpdateManifestError('manifest_corrupt', `更新清单损坏:${path} 的 sha256 非法`, {
        path,
        actual: String(e.sha256 ?? ''),
      })
    }
    if (!Number.isInteger(e.size) || (e.size as number) < 0) {
      throw new UpdateManifestError('manifest_corrupt', `更新清单损坏:${path} 的 size 非法`, {
        path,
        actual: String(e.size ?? ''),
      })
    }
    seen.add(path)
    return { path, sha256: e.sha256, size: e.size as number }
  })
}

/**
 * 安装前校验:清单可读且未损坏 → 定位即将安装的包 → 下载该包字节核对 size/sha256。
 * 任何一步不合规都抛 `UpdateManifestError`,调用方**必须先中止安装**再展示 message。
 */
export async function verifyUpdatePackageBeforeInstall(
  opts: VerifyUpdatePackageOptions = {},
): Promise<{ path: string; size: number; sha256: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const hash = opts.sha256Impl ?? defaultSha256
  const manifestUrl = opts.manifestUrl ?? UPDATE_MANIFEST_PATH

  let res: Response
  try {
    res = await fetchImpl(manifestUrl, { cache: 'no-store' })
  } catch (e) {
    throw new UpdateManifestError(
      'manifest_missing',
      `更新清单不可达(${manifestUrl}):${(e as Error)?.message ?? e} ⇒ 拒绝更新`,
      { path: manifestUrl },
    )
  }
  if (!res.ok) {
    throw new UpdateManifestError(
      'manifest_missing',
      `更新清单缺失(${manifestUrl} 返回 ${res.status})⇒ 拒绝更新(发布链必须随包发布清单)`,
      { path: manifestUrl, actual: String(res.status) },
    )
  }
  let raw: unknown
  try {
    raw = await res.json()
  } catch (e) {
    throw new UpdateManifestError(
      'manifest_corrupt',
      `更新清单解析失败:${(e as Error)?.message ?? e}`,
      { path: manifestUrl },
    )
  }
  const entries = parseManifest(raw)

  const assetName = opts.assetUrl ? basename(opts.assetUrl) : ''
  let target: UpdateFileEntry | null
  if (assetName) {
    const hits = entries.filter((e) => basename(e.path) === assetName)
    if (hits.length === 0) {
      throw new UpdateManifestError(
        'package_entry_missing',
        `清单缺项:即将安装的包 ${assetName} 未在 update-files.json 中登记 ⇒ 拒绝更新`,
        { path: assetName },
      )
    }
    if (hits.length > 1) {
      throw new UpdateManifestError('manifest_corrupt', `清单损坏:${assetName} 命中多条`, {
        path: assetName,
      })
    }
    target = hits[0] as UpdateFileEntry
  } else {
    target = pickByPlatform(entries, opts.platformToken ?? detectPlatformToken(opts.userAgent))
    if (!target) {
      throw new UpdateManifestError(
        'package_entry_missing',
        '清单缺项:清单里没有当前平台的安装包 ⇒ 拒绝更新',
        { path: 'desktop/*' },
      )
    }
  }

  const assetUrl =
    opts.assetUrl ??
    new URL(target.path, new URL(opts.fileBaseUrl ?? manifestUrl, 'http://localhost')).href
  let pkg: Response
  try {
    pkg = await fetchImpl(assetUrl, { cache: 'no-store' })
  } catch (e) {
    throw new UpdateManifestError(
      'package_fetch_failed',
      `更新包下载失败(${target.path}):${(e as Error)?.message ?? e} ⇒ 拒绝安装`,
      { path: target.path },
    )
  }
  if (!pkg.ok) {
    throw new UpdateManifestError(
      'package_fetch_failed',
      `更新包不可取(${target.path} 返回 ${pkg.status})⇒ 拒绝安装`,
      { path: target.path, actual: String(pkg.status) },
    )
  }
  const buf = await pkg.arrayBuffer()
  if (buf.byteLength !== target.size) {
    throw new UpdateManifestError(
      'size_mismatch',
      `size 不符 → ${target.path}(期望 ${target.size} B,实际 ${buf.byteLength} B)⇒ 中止安装`,
      { path: target.path, expected: `${target.size} B`, actual: `${buf.byteLength} B` },
    )
  }
  const actual = await hash(buf)
  if (actual !== target.sha256) {
    throw new UpdateManifestError(
      'sha256_mismatch',
      `sha256 不符 → ${target.path}(期望 ${target.sha256},实际 ${actual})⇒ 中止安装`,
      { path: target.path, expected: target.sha256, actual },
    )
  }
  return { path: target.path, size: target.size, sha256: target.sha256 }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
