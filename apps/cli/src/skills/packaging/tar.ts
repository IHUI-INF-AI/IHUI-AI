// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 极简 ustar 读写 — 技能包/专家包的唯一归档实现(不引入第三方压缩库)。
 *
 * 为什么是 tar 而不是 zip:
 *   - Node 标准库没有 zip 解压;引入第三方 zip 库意味着安装链多一个供应链面,
 *     而本任务的存在理由正是收紧安装期供应链;
 *   - ustar 头是 512 字节定长 + 八进制字段,读写都能在 ~150 行内看完、审干净;
 *   - 可重现性:写入端固定 mtime=0 / uid=gid=0 / uname=gname=''、按路径排序、
 *     文件模式固定 0644 ⇒ 同一输入两次生成的字节完全一致。
 *
 * 读端**不**做业务判定(路径安全/校验和在 verify.ts):
 * 这里只负责把归档拆成条目,并把"结构不可解析"编码成 SKILL_PKG_ARCHIVE_INVALID。
 * 路径安全放在校验顺序的第 4 步,正是为了在反向例里能给出"先完整性和签名,再路径安全"
 * 的逐阶段读数。
 */

import { SkillPackageError } from './errors.js'

const BLOCK = 512
const USTAR_MAGIC = 'ustar'

export type TarEntryType = 'file' | 'directory' | 'symlink'

export interface TarEntry {
  path: string
  content: Buffer
  /** 仅测试构造恶意包时使用;生产写入恒为 'file' */
  type?: TarEntryType
  /** 符号链接/硬链接目标(仅测试构造恶意包时使用) */
  linkname?: string
  /** 文件模式(八进制整数);生产写入恒为 0o644 */
  mode?: number
}

/** 读出的原始条目:保留 mode/type 供第 4 步路径安全逐条判定。 */
export interface TarReadEntry {
  path: string
  content: Buffer
  mode: number
  type: TarEntryType | 'unsupported'
  linkname: string
}

export interface TarReadResult {
  /** 路径 → 条目(首次出现为准,重复路径由 duplicates 单独点名) */
  entries: Map<string, TarReadEntry>
  /** 出现次数 > 1 的路径(顺序为首次重复出现的顺序) */
  duplicates: string[]
  /** 非文件条目(目录/链接等),用于路径安全阶段逐条点名 */
  rawOrder: TarReadEntry[]
}

function writeOctal(value: number, width: number): string {
  const digits = Math.max(0, value).toString(8).padStart(width - 1, '0')
  return `${digits}\0`
}

function makeHeader(entry: TarEntry): Buffer {
  const content = entry.content
  const mode = entry.mode ?? 0o644
  let name = entry.path
  let prefix = ''
  if (name.length > 100) {
    const slash = name.lastIndexOf('/', 100)
    if (slash <= 0) {
      throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', `tar 条目路径过长(>100 字节):${entry.path}`, {
        path: entry.path,
      })
    }
    prefix = name.slice(0, slash)
    name = name.slice(slash + 1)
    if (prefix.length > 155 || name.length > 100) {
      throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', `tar 条目路径过长(>255 字节):${entry.path}`, {
        path: entry.path,
      })
    }
  }

  const header = Buffer.alloc(BLOCK, 0)
  header.write(name.slice(0, 100), 0, 'utf8')
  header.write(writeOctal(mode, 8), 100, 'utf8')
  header.write(writeOctal(0, 8), 108, 'utf8')
  header.write(writeOctal(0, 8), 116, 'utf8')
  header.write(writeOctal(content.length, 12), 124, 'utf8')
  header.write(writeOctal(0, 12), 136, 'utf8')
  // chksum 先留 8 个空格,算完再回填
  header.write('        ', 148, 'utf8')
  const typeflag = entry.type === 'symlink' ? '2' : entry.type === 'directory' ? '5' : '0'
  header.write(typeflag, 156, 'utf8')
  header.write((entry.linkname ?? '').slice(0, 100), 157, 'utf8')
  header.write(USTAR_MAGIC, 257, 'utf8')
  header.write('00', 263, 'utf8')
  header.write('', 265, 'utf8')
  header.write('', 297, 'utf8')
  header.write(writeOctal(0, 8), 329, 'utf8')
  header.write(writeOctal(0, 8), 337, 'utf8')
  header.write(prefix.slice(0, 155), 345, 'utf8')

  let sum = 0
  for (let i = 0; i < BLOCK; i += 1) sum += header[i]!
  const checksum = sum.toString(8).padStart(6, '0')
  header.write(`${checksum}\0 `, 148, 'utf8')
  return header
}

/**
 * 确定性 tar 写入。
 *
 * 条目**按路径字典序**排列(调用方传入顺序不参与产物字节),时间戳/属主固定为 0,
 * 因此同一组文件两次调用得到逐字节相同的 Buffer —— 专家包可重现的底层保证之一。
 */
export function writeTar(entries: readonly TarEntry[]): Buffer {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const chunks: Buffer[] = []
  for (const entry of sorted) {
    if (entry.path.includes('\0')) {
      throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', 'tar 条目路径含 NUL', { path: entry.path })
    }
    chunks.push(makeHeader(entry))
    if (entry.type === 'symlink' || entry.type === 'directory') continue
    chunks.push(Buffer.from(entry.content))
    const padding = (BLOCK - (entry.content.length % BLOCK)) % BLOCK
    if (padding > 0) chunks.push(Buffer.alloc(padding, 0))
  }
  // ustar 结束标记:两块 512 字节零块
  chunks.push(Buffer.alloc(BLOCK * 2, 0))
  return Buffer.concat(chunks)
}

function readString(header: Buffer, offset: number, length: number): string {
  const slice = header.subarray(offset, offset + length)
  const nul = slice.indexOf(0)
  return slice.subarray(0, nul >= 0 ? nul : slice.length).toString('utf8')
}

function readOctal(header: Buffer, offset: number, length: number): number {
  const text = readString(header, offset, length).trim()
  if (text === '') return 0
  if (!/^[0-7]+$/.test(text)) {
    throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', `tar 头字段不是八进制:${text}`, {
      field: text,
    })
  }
  return parseInt(text, 8)
}

/**
 * 解析 tar。结构错误抛 `SKILL_PKG_ARCHIVE_INVALID`;业务安全判定留给 verify。
 *
 * 只接受 `ustar` magic:接受任意"看起来能解"的头会让安装链对归档格式的假设悄悄放宽。
 */
export function readTar(buffer: Buffer): TarReadResult {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', '包为空或不是 Buffer')
  }
  if (buffer.length % BLOCK !== 0) {
    throw new SkillPackageError(
      'SKILL_PKG_ARCHIVE_INVALID',
      `tar 长度 ${buffer.length} 不是 ${BLOCK} 的整数倍(归档被截断)`,
      { length: buffer.length },
    )
  }

  const entries = new Map<string, TarReadEntry>()
  const duplicates: string[] = []
  const rawOrder: TarReadEntry[] = []
  let offset = 0
  let sawEnd = false

  while (offset + BLOCK <= buffer.length) {
    const header = buffer.subarray(offset, offset + BLOCK)
    if (header.every((byte) => byte === 0)) {
      sawEnd = true
      break
    }
    const magic = header.subarray(257, 263).toString('utf8')
    if (!magic.startsWith(USTAR_MAGIC)) {
      throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', 'tar 头缺少 ustar magic', { offset })
    }

    const name = readString(header, 0, 100)
    const prefix = readString(header, 345, 155)
    const path = prefix ? `${prefix}/${name}` : name
    const size = readOctal(header, 124, 12)
    const mode = readOctal(header, 100, 8)
    const typeflag = readString(header, 156, 1) || '0'
    const linkname = readString(header, 157, 100)

    if (offset + BLOCK + size > buffer.length) {
      throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', `tar 条目内容越出归档末尾:${path}`, {
        path,
        size,
      })
    }
    const content = buffer.subarray(offset + BLOCK, offset + BLOCK + size)
    let type: TarReadEntry['type'] = 'unsupported'
    if (typeflag === '0' || typeflag === '\0') type = 'file'
    else if (typeflag === '5') type = 'directory'
    else if (typeflag === '2') type = 'symlink'

    const entry: TarReadEntry = { path, content: Buffer.from(content), mode, type, linkname }
    rawOrder.push(entry)
    if (entries.has(path)) {
      if (!duplicates.includes(path)) duplicates.push(path)
    } else {
      entries.set(path, entry)
    }

    // 目录/链接条目 size 应为 0;若携带内容,仍按 size 跳过,避免错位解析
    offset += BLOCK + size + ((BLOCK - (size % BLOCK)) % BLOCK)
  }

  if (!sawEnd && offset < buffer.length) {
    throw new SkillPackageError('SKILL_PKG_ARCHIVE_INVALID', 'tar 缺少结束零块', { offset })
  }
  return { entries, duplicates, rawOrder }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
