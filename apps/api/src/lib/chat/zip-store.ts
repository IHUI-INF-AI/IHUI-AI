// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 零依赖 ZIP 容器(store 模式,不压缩)。
 *
 * 为什么手写而不是加依赖:
 * - 只用于会话导出(3 个文本条目,通常几十 KB),store 模式完全够用,且解压端零门槛;
 * - 引入 archiver/jszip 会给 API 增加一棵依赖树,而本仓对外部传递依赖有严格的供应链约束;
 * - 手写实现把边界(UTF-8 文件名、CRC、中央目录偏移)写进单测,比"相信库"更可核对。
 *
 * 格式要点:
 * - 每个条目本地头 + 数据 + 中央目录项 + EOCD;
 * - 通用标志位 bit 11 = 1(文件名 UTF-8),中文/emoji 文件名在 Windows 资源管理器与
 *   `unzip` / Python zipfile 下都不会乱码;
 * - method = 0(store),无 data descriptor(大小与 CRC 在本地头已知);
 * - 时间由调用方传入并按 UTC 计算,同一会话重复导出字节稳定。
 */

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const ZIP_VERSION = 20
const FLAG_UTF8 = 0x0800
const METHOD_STORE = 0

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index++) {
    let value = index
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export interface ZipStoreEntry {
  /** 条目名;目录分隔一律用 `/`。 */
  name: string
  data: string | Uint8Array
  /** 条目修改时间;缺省用 options.mtime,再缺省用 1980-01-01(归档器的"未知时间"惯例)。 */
  mtime?: Date
}

export interface ZipStoreOptions {
  /** 统一修改时间(按 UTC 计算 DOS 时间)。 */
  mtime?: Date
}

export interface DosDateTime {
  dosDate: number
  dosTime: number
}

/** 标准 CRC-32(IEEE 802.3,多项式 0xEDB88320)。 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < data.length; index++) {
    const tableValue = CRC32_TABLE[(crc ^ (data[index] ?? 0)) & 0xff] ?? 0
    crc = tableValue ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Date → DOS 日期/时间(UTC);年份夹到 1980–2107,秒按 2 秒精度。 */
export function dosDateTime(date: Date): DosDateTime {
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()))
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  const dosTime =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2)
  return { dosDate, dosTime }
}

/**
 * 条目名安全化:
 * - 反斜杠归一为 `/`;
 * - 去掉控制字符与盘符前缀(`C:`)与开头 `/`;
 * - 任一段为 `..` 直接拒绝(导出包不得写出目录穿越路径);
 * - 空名拒绝。
 */
export function sanitizeZipEntryName(name: string): string {
  const normalized = name.replace(/\\/g, '/').replace(/[\u0000-\u001f\u007f]/g, '')
  const withoutDrive = normalized.replace(/^[A-Za-z]:/, '')
  const segments = withoutDrive.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (segments.length === 0) {
    throw new Error('zip entry name is empty')
  }
  if (segments.some((segment) => segment === '..')) {
    throw new Error('zip entry name escapes archive root')
  }
  return segments.join('/')
}

function toBytes(data: string | Uint8Array): Buffer {
  return typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)
}

/**
 * 生成完整 ZIP 字节。条目顺序即写入顺序;不写压缩,不做 data descriptor。
 *
 * @throws 条目名为空/含 `..`、条目数超过 65535、总大小超过 4 GiB 时抛错(store 模式无 ZIP64)。
 */
export function buildZipStore(entries: ZipStoreEntry[], options: ZipStoreOptions = {}): Buffer {
  if (entries.length > 0xffff) {
    throw new Error('zip entry count exceeds 65535')
  }
  const defaultMtime = options.mtime ?? new Date(Date.UTC(1980, 0, 1, 0, 0, 0))

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = sanitizeZipEntryName(entry.name)
    const nameBytes = Buffer.from(name, 'utf8')
    const dataBytes = toBytes(entry.data)
    if (dataBytes.length > 0xffffffff) {
      throw new Error(`zip entry too large: ${name}`)
    }
    const { dosDate, dosTime } = dosDateTime(entry.mtime ?? defaultMtime)
    const checksum = crc32(dataBytes)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0)
    localHeader.writeUInt16LE(ZIP_VERSION, 4)
    localHeader.writeUInt16LE(FLAG_UTF8, 6)
    localHeader.writeUInt16LE(METHOD_STORE, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(dataBytes.length, 18)
    localHeader.writeUInt32LE(dataBytes.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0)
    centralHeader.writeUInt16LE(ZIP_VERSION, 4)
    centralHeader.writeUInt16LE(ZIP_VERSION, 6)
    centralHeader.writeUInt16LE(FLAG_UTF8, 8)
    centralHeader.writeUInt16LE(METHOD_STORE, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(dataBytes.length, 20)
    centralHeader.writeUInt32LE(dataBytes.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    localParts.push(localHeader, nameBytes, dataBytes)
    centralParts.push(centralHeader, nameBytes)

    offset += localHeader.length + nameBytes.length + dataBytes.length
    if (offset > 0xffffffff) {
      throw new Error('zip archive exceeds 4 GiB (ZIP64 not supported)')
    }
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(entries.length, 8)
  endOfCentralDirectory.writeUInt16LE(entries.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
