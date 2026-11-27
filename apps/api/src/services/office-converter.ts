// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 允许送进 LibreOffice 的输入扩展名:只放 Office/OpenDocument/RTF,不收任意脚本。 */
const CONVERTIBLE_EXTS = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odt',
  'odp',
  'ods',
  'rtf',
  'txt',
])

export const OFFICE_CONVERT_MAX_BYTES = 50 * 1024 * 1024

const MAX_CONCURRENT = 2
const CACHE_MAX_ENTRIES = 8
const CACHE_MAX_BYTES = 64 * 1024 * 1024
const CACHE_MAX_ITEM_BYTES = 32 * 1024 * 1024

const cache = new Map<string, Buffer>()
let cacheBytes = 0

let running = 0
const waiters: Array<() => void> = []

export type OfficeConversionErrorCode =
  'unsupported' | 'too-large' | 'unavailable' | 'timeout' | 'failed'

export class OfficeConversionError extends Error {
  readonly code: OfficeConversionErrorCode

  constructor(code: OfficeConversionErrorCode, message: string) {
    super(message)
    this.name = 'OfficeConversionError'
    this.code = code
  }
}

function discoverSoffice(): string | null {
  const explicit = process.env.OFFICE_SOFFICE_PATH?.trim()
  const pathDirs = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')
  const commandNames =
    process.platform === 'win32'
      ? ['soffice.exe', 'soffice.com', 'soffice']
      : ['soffice', 'libreoffice']
  const pathCandidates = pathDirs.flatMap((dir) =>
    dir ? commandNames.map((name) => join(dir, name)) : [],
  )
  const candidates = [
    explicit,
    ...pathCandidates,
    process.platform === 'win32'
      ? join(
          process.env.PROGRAMFILES ?? 'C:\\Program Files',
          'LibreOffice',
          'program',
          'soffice.exe',
        )
      : null,
    process.platform === 'win32'
      ? join(
          process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
          'LibreOffice',
          'program',
          'soffice.exe',
        )
      : null,
    '/usr/bin/soffice',
    '/usr/lib/libreoffice/program/soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (existsSync(candidate)) return candidate
    // 兼容 OFFICE_SOFFICE_PATH 直接写命令名(如 soffice)的部署习惯。
    if (!candidate.includes('/') && !candidate.includes('\\')) {
      for (const dir of pathDirs) {
        const resolved = dir ? join(dir, candidate) : null
        if (resolved && existsSync(resolved)) return resolved
      }
    }
  }
  return null
}

function cacheKey(buffer: Buffer, ext: string): string {
  return `${ext}:${createHash('sha256').update(buffer).digest('hex')}`
}

function cacheGet(key: string): Buffer | null {
  const hit = cache.get(key)
  if (!hit) return null
  // Map 的插入顺序就是 LRU 顺序:命中后挪到队尾。
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

function cachePut(key: string, value: Buffer): void {
  if (value.length > CACHE_MAX_ITEM_BYTES) return
  const previous = cache.get(key)
  if (previous) {
    cache.delete(key)
    cacheBytes -= previous.length
  }
  cache.set(key, value)
  cacheBytes += value.length
  while (cache.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) {
    const oldest = cache.keys().next().value as string | undefined
    if (!oldest) break
    const removedValue = cache.get(oldest)
    if (cache.delete(oldest) && removedValue) cacheBytes -= removedValue.length
  }
}

async function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running += 1
    return
  }
  await new Promise<void>((resolve) => waiters.push(resolve))
  running += 1
}

function release(): void {
  running -= 1
  const next = waiters.shift()
  if (next) next()
}

/**
 * 用宿主机 LibreOffice 把 Office/OpenDocument 转成 PDF。
 *
 * 只走 `soffice --headless --convert-to pdf`,不接受调用方拼命令行;输入/输出/时长
 * 都有硬上限,产物在私有临时目录生成,转换结束立即删目录。相同字节 + 扩展名会命中
 * 进程内 LRU,避免文档中心重复打开同一文件时反复起 soffice。
 */
export async function convertOfficeToPdf(input: Buffer, fileName: string): Promise<Buffer> {
  const ext = extname(fileName).slice(1).toLowerCase()
  if (!CONVERTIBLE_EXTS.has(ext)) {
    throw new OfficeConversionError('unsupported', `不支持的转换格式:${ext || '未知'}`)
  }
  if (input.length > OFFICE_CONVERT_MAX_BYTES) {
    throw new OfficeConversionError('too-large', '文件超过 50MB,无法在线转换')
  }

  const key = cacheKey(input, ext)
  const cached = cacheGet(key)
  if (cached) return cached

  const soffice = discoverSoffice()
  if (!soffice) {
    throw new OfficeConversionError(
      'unavailable',
      '宿主机未安装 LibreOffice(soffice),无法转换旧版 Office 文档',
    )
  }

  await acquire()
  let workDir: string | null = null
  try {
    workDir = await mkdtemp(join(tmpdir(), 'ihui-office-convert-'))
    const inputPath = join(workDir, `input.${ext}`)
    const outputDir = join(workDir, 'out')
    const profileDir = join(workDir, 'profile')
    await writeFile(inputPath, input)
    // mkdtemp 只建目录;out/profile 必须显式建,soffice 不会替我们创建 --outdir。
    await mkdir(outputDir, { recursive: true })
    await mkdir(profileDir, { recursive: true })

    const args = [
      '--headless',
      '--norestore',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      '--nolockcheck',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      inputPath,
    ]

    await execFileAsync(soffice, args, {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      cwd: workDir,
    })

    const expected = join(outputDir, `${basename(inputPath, extname(inputPath))}.pdf`)
    let pdf: Buffer | null = null
    if (existsSync(expected)) pdf = await readFile(expected)
    if (!pdf) {
      const files = await readdir(outputDir)
      const outputName = files.find((name) => name.toLowerCase().endsWith('.pdf'))
      if (outputName) pdf = await readFile(join(outputDir, outputName))
    }
    if (!pdf) {
      throw new OfficeConversionError('failed', 'LibreOffice 未产出 PDF')
    }
    if (pdf.length > 100 * 1024 * 1024) {
      throw new OfficeConversionError('failed', '转换结果超过 100MB')
    }
    cachePut(key, pdf)
    return pdf
  } catch (error) {
    if (error instanceof OfficeConversionError) throw error
    const err = error as Error & { killed?: boolean }
    if (err.killed) {
      throw new OfficeConversionError('timeout', 'LibreOffice 转换超时')
    }
    throw new OfficeConversionError('failed', 'LibreOffice 转换失败')
  } finally {
    release()
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
