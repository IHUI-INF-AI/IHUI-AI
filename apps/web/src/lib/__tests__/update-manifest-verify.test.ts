// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端安装前逐文件 sha256 校验 — 判据测试(2026-11-04 立)。
 * 判的是"桌面端安装前一步":清单缺失/损坏/缺项、size 不符、sha256 不符、包取不到,
 * 每一档都必须抛出**点名**错误(文件 + 期望 + 实际),而不是放行或只打日志。
 */
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  detectPlatformToken,
  isSafeManifestPath,
  UpdateManifestError,
  verifyUpdatePackageBeforeInstall,
  type UpdateFileEntry,
} from '../update-manifest-verify'

const PKG = new TextEncoder().encode('ihui-update-pkg-fixture')
const PKG_SHA = createHash('sha256').update(PKG).digest('hex')

function entry(path: string, bytes: Uint8Array = PKG): UpdateFileEntry {
  return { path, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength }
}

function manifestOf(files: UpdateFileEntry[]) {
  return { schemaVersion: 1, generatedAt: '', files }
}

/** 极简 fetch 桩:manifest 命中 `/update-files.json`,其余按包字节返回。 */
function stubFetch(opts: {
  manifest?: unknown
  manifestStatus?: number
  manifestThrows?: boolean
  pkg?: Uint8Array
  pkgStatus?: number
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('update-files.json')) {
      if (opts.manifestThrows) throw new Error('network down')
      return {
        ok: (opts.manifestStatus ?? 200) < 400,
        status: opts.manifestStatus ?? 200,
        json: async () => opts.manifest,
      } as unknown as Response
    }
    if ((opts.pkgStatus ?? 200) >= 400) {
      return { ok: false, status: opts.pkgStatus } as unknown as Response
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => (opts.pkg ?? PKG).buffer,
    } as unknown as Response
  }) as unknown as typeof fetch
}

async function expectError(p: Promise<unknown>): Promise<UpdateManifestError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(UpdateManifestError)
  return err as UpdateManifestError
}

describe('安装前逐文件校验', () => {
  it('清单与包都合规 ⇒ 通过并返回实际 path/size/sha256', async () => {
    const fetchImpl = stubFetch({
      manifest: manifestOf([entry('desktop/IHUI-0.3.0-win-x64.exe')]),
    })
    const r = await verifyUpdatePackageBeforeInstall({
      assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
      manifestUrl: 'https://example.test/downloads/update-files.json',
      fetchImpl,
    })
    expect(r).toEqual({
      path: 'desktop/IHUI-0.3.0-win-x64.exe',
      size: PKG.byteLength,
      sha256: PKG_SHA,
    })
  })

  it('包内文件被篡改 1 字节 ⇒ sha256_mismatch 且点名文件/期望/实际', async () => {
    const tampered = new TextEncoder().encode('ihui-update-pkg-fixturf')
    const fetchImpl = stubFetch({
      manifest: manifestOf([entry('desktop/IHUI-0.3.0-win-x64.exe')]),
      pkg: tampered,
    })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        manifestUrl: 'https://example.test/downloads/update-files.json',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('sha256_mismatch')
    expect(err.detail.path).toBe('desktop/IHUI-0.3.0-win-x64.exe')
    expect(err.detail.expected).toBe(PKG_SHA)
    expect(err.detail.actual).toBe(createHash('sha256').update(tampered).digest('hex'))
    expect(err.message).toContain('中止安装')
  })

  it('size 不符(字节数不同)⇒ size_mismatch 并给期望/实际', async () => {
    const fetchImpl = stubFetch({
      manifest: manifestOf([entry('desktop/IHUI-0.3.0-win-x64.exe')]),
      pkg: new TextEncoder().encode('short'),
    })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        manifestUrl: 'https://example.test/downloads/update-files.json',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('size_mismatch')
    expect(err.detail.expected).toBe(`${PKG.byteLength} B`)
    expect(err.detail.actual).toBe('5 B')
  })

  it('清单缺失(404)⇒ manifest_missing 且拒绝更新(不是按旧逻辑放行)', async () => {
    const fetchImpl = stubFetch({ manifestStatus: 404 })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('manifest_missing')
    expect(err.message).toContain('拒绝更新')
  })

  it('清单不可达(网络异常)⇒ manifest_missing', async () => {
    const fetchImpl = stubFetch({ manifestThrows: true })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('manifest_missing')
  })

  it('清单 JSON 解析失败 ⇒ manifest_corrupt', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('update-files.json')) {
        return {
          ok: true,
          status: 200,
          json: async () => Promise.reject(new Error('bad json')),
        } as unknown as Response
      }
      return { ok: true, status: 200, arrayBuffer: async () => PKG.buffer } as unknown as Response
    }) as unknown as typeof fetch
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('manifest_corrupt')
  })

  it('schemaVersion 不符 ⇒ manifest_corrupt', async () => {
    const fetchImpl = stubFetch({
      manifest: { schemaVersion: 2, files: [entry('desktop/IHUI-0.3.0-win-x64.exe')] },
    })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('manifest_corrupt')
  })

  it('清单含非法路径(../ 穿越)⇒ manifest_corrupt', async () => {
    const fetchImpl = stubFetch({
      manifest: manifestOf([{ path: '../escape.exe', sha256: PKG_SHA, size: PKG.byteLength }]),
    })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('manifest_corrupt')
    expect(isSafeManifestPath('../escape.exe')).toBe(false)
  })

  it('清单缺项:即将安装的包不在清单 ⇒ package_entry_missing', async () => {
    const fetchImpl = stubFetch({ manifest: manifestOf([entry('extension/x.zip')]) })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('package_entry_missing')
    expect(err.message).toContain('清单缺项')
    expect(err.detail.path).toBe('IHUI-0.3.0-win-x64.exe')
  })

  it('无 assetUrl 时按平台挑包(win UA 命中 .exe)', async () => {
    const files = [
      entry('desktop/IHUI-0.3.0-win-x64.exe'),
      entry('desktop/IHUI-0.3.0-darwin-arm64.dmg'),
      entry('desktop/IHUI-0.3.0-linux-x64.AppImage'),
    ]
    const fetchImpl = stubFetch({ manifest: manifestOf(files) })
    const r = await verifyUpdatePackageBeforeInstall({
      manifestUrl: 'https://example.test/downloads/update-files.json',
      platformToken: 'win',
      fetchImpl,
    })
    expect(r.path).toBe('desktop/IHUI-0.3.0-win-x64.exe')
    expect(detectPlatformToken('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('win')
    expect(detectPlatformToken('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('darwin')
    expect(detectPlatformToken('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux')
  })

  it('清单里没有当前平台包 ⇒ package_entry_missing', async () => {
    const fetchImpl = stubFetch({ manifest: manifestOf([entry('desktop/IHUI-0.3.0-macos.dmg')]) })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        manifestUrl: 'https://example.test/downloads/update-files.json',
        platformToken: 'win',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('package_entry_missing')
  })

  it('包取不到(404)⇒ package_fetch_failed', async () => {
    const fetchImpl = stubFetch({
      manifest: manifestOf([entry('desktop/IHUI-0.3.0-win-x64.exe')]),
      pkgStatus: 404,
    })
    const err = await expectError(
      verifyUpdatePackageBeforeInstall({
        assetUrl: 'https://example.test/downloads/desktop/IHUI-0.3.0-win-x64.exe',
        manifestUrl: 'https://example.test/downloads/update-files.json',
        fetchImpl,
      }),
    )
    expect(err.code).toBe('package_fetch_failed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
