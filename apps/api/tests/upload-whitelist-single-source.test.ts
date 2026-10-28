// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 上传白名单"单一真源"回归锁(2026-10-28 立)。
 *
 * 背景:本仓存在两套上传白名单 ——
 *   - `utils/file-type-validator.ts` 的 EXT_MIME_MAP(工具函数 validateUploadFile,
 *     files / file-version / users / v1-public / workspace 五个路由在用)
 *   - `plugins/upload-scanner.ts` 的 DEFAULT_ALLOWED_EXTS(preHandler,
 *     routes/oss.ts 在用)
 * 两者长期漂移(scanner 独有 bmp/ogg/mp4/webm/mov,validator 独有 zip/aac),
 * 违反 AGENTS.md §0.6「同类判据/清单全仓只许一份」。现收敛为 validator 单源、
 * scanner 派生。本文件守四件事:
 *   1) 两套集合必须逐项相等(scanner 只能是 validator 的派生);
 *   2) 并集里每个扩展名都必须有 canonical MIME + 真实魔数判据,
 *      无魔数的纯文本类型必须在 EXEMPT 表里显式列出(不许静默漏);
 *   3) 既有 5 个路由实际在用的扩展名一个都不能少(缩了就是线上回退);
 *   4) 危险类型(svg/html/js/exe)不得被顺手加进白名单。
 */
import { describe, expect, it } from 'vitest'

import {
  ALLOWED_EXTENSIONS,
  checkMagicNumber,
  getCanonicalMime,
  validateUploadFile,
} from '../src/utils/file-type-validator.js'
import { DEFAULT_ALLOWED_EXTS, scanFileBuffer } from '../src/plugins/upload-scanner.js'

/** 构造 MP4 系容器头:4 字节 box size + 'ftyp' + 4 字节 brand + 4 字节 minor version。 */
function ftypBox(brand: string): Buffer {
  const buf = Buffer.alloc(16)
  buf.writeUInt32BE(16, 0)
  buf.write('ftyp', 4, 'latin1')
  buf.write(brand, 8, 'latin1')
  return buf
}

/**
 * 无固定魔数的纯文本类型 —— 必须显式豁免,不许靠"忘了写 case 就返回 false/true"蒙混。
 * txt/csv 的 checkMagicNumber 语义是"无需校验,直接放行"(见实现注释)。
 */
const MAGIC_EXEMPT: readonly string[] = ['txt', 'csv']

/** 每个需要魔数判据的扩展名的正样本(必须与"并集 - MAGIC_EXEMPT"逐项对齐)。 */
const MAGIC_FIXTURES: Record<string, Buffer> = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  gif: Buffer.from('GIF89a', 'latin1'),
  webp: Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'latin1'),
  ]),
  bmp: Buffer.concat([Buffer.from('BM', 'latin1'), Buffer.alloc(14)]),
  pdf: Buffer.from('%PDF-1.7\n', 'latin1'),
  zip: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  docx: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  xlsx: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  pptx: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  odt: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  epub: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  doc: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  xls: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  ppt: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  rtf: Buffer.from('{\\rtf1\\ansi', 'latin1'),
  m4a: ftypBox('M4A '),
  mp4: ftypBox('isom'),
  mov: ftypBox('qt  '),
  mp3: Buffer.from('ID3\x03\x00', 'latin1'),
  wav: Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WAVE', 'latin1'),
  ]),
  aac: Buffer.from([0xff, 0xf1, 0x50, 0x80]),
  ogg: Buffer.from('OggS\x00\x02', 'latin1'),
  webm: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00]),
}

/** 任意二进制垃圾:除豁免类型外,任何扩展名都不许让它通过魔数闸。 */
const JUNK = Buffer.from('this is definitely not a real media or document file', 'utf8')

/** 既有 5 个路由(files/file-version/users/v1-public/workspace)实际在用的扩展名。 */
const LEGACY_ROUTE_EXTS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'doc',
  'xls',
  'ppt',
  'odt',
  'rtf',
  'epub',
  'm4a',
  'mp3',
  'wav',
] as const

describe('单一真源:scanner 白名单必须派生自 validator', () => {
  it('两套集合逐项相等', () => {
    expect([...DEFAULT_ALLOWED_EXTS].sort()).toEqual([...ALLOWED_EXTENSIONS].sort())
  })

  it('scanner 集合的每一项都来自 ALLOWED_EXTENSIONS(无本地私货)', () => {
    const orphans = [...DEFAULT_ALLOWED_EXTS].filter((ext) => !ALLOWED_EXTENSIONS.includes(ext))
    expect(orphans).toEqual([])
  })

  it('ALLOWED_EXTENSIONS 的每一项都进了 scanner 集合(派生不漏)', () => {
    const missing = ALLOWED_EXTENSIONS.filter((ext) => !DEFAULT_ALLOWED_EXTS.has(ext))
    expect(missing).toEqual([])
    expect(DEFAULT_ALLOWED_EXTS.size).toBe(ALLOWED_EXTENSIONS.length)
  })

  it('并集包含 scanner 原有的 bmp/ogg/mp4/webm/mov 与 validator 原有的 zip/aac', () => {
    for (const ext of ['bmp', 'ogg', 'mp4', 'webm', 'mov', 'zip', 'aac']) {
      expect(ALLOWED_EXTENSIONS, `并集缺 ${ext}`).toContain(ext)
    }
  })
})

describe('每个扩展名都有 MIME 与魔数判据', () => {
  it('每个扩展名都有 canonical MIME', () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      expect(getCanonicalMime(ext), `${ext} 缺 canonical MIME`).toBeTruthy()
    }
  })

  it('需要魔数判据的扩展名清单与正样本表逐项对齐(不许静默漏)', () => {
    const needMagic = ALLOWED_EXTENSIONS.filter((ext) => !MAGIC_EXEMPT.includes(ext)).sort()
    expect(Object.keys(MAGIC_FIXTURES).sort()).toEqual(needMagic)
  })

  it.each(ALLOWED_EXTENSIONS.filter((ext) => !MAGIC_EXEMPT.includes(ext)))(
    '%s 的正样本能通过魔数校验',
    (ext) => {
      expect(checkMagicNumber(ext, MAGIC_FIXTURES[ext]!)).toBe(true)
    },
  )

  it.each(ALLOWED_EXTENSIONS.filter((ext) => !MAGIC_EXEMPT.includes(ext)))(
    '%s 的垃圾内容被魔数闸拒绝(防改名绕过)',
    (ext) => {
      expect(checkMagicNumber(ext, JUNK)).toBe(false)
    },
  )

  it.each(MAGIC_EXEMPT)('%s 是显式豁免的纯文本类型(无需魔数)', (ext) => {
    expect(ALLOWED_EXTENSIONS).toContain(ext)
    expect(checkMagicNumber(ext, JUNK)).toBe(true)
  })
})

describe('既有路由接受面不缩小', () => {
  it.each(LEGACY_ROUTE_EXTS)('%s 仍在白名单且有 MIME', (ext) => {
    expect(ALLOWED_EXTENSIONS, `${ext} 被移出白名单 = 线上回退`).toContain(ext)
    expect(DEFAULT_ALLOWED_EXTS.has(ext)).toBe(true)
    expect(getCanonicalMime(ext)).toBeTruthy()
  })

  it.each(LEGACY_ROUTE_EXTS.filter((ext) => !MAGIC_EXEMPT.includes(ext as string)))(
    'validator 端到端放行 %s(canonical MIME + 正样本)',
    (ext) => {
      const result = validateUploadFile(
        MAGIC_FIXTURES[ext]!,
        `sample.${ext}`,
        getCanonicalMime(ext)!,
      )
      expect(result.ok).toBe(true)
    },
  )

  it('validator 端到端放行 txt(声明 text/plain)', () => {
    const result = validateUploadFile(Buffer.from('hello\n', 'utf8'), 'a.txt', 'text/plain')
    expect(result.ok).toBe(true)
  })
})

describe('新增到 validator 的 5 个扩展名端到端可用', () => {
  it.each([
    ['bmp', 'image/bmp'],
    ['ogg', 'audio/ogg'],
    ['mp4', 'video/mp4'],
    ['webm', 'video/webm'],
    ['mov', 'video/quicktime'],
  ])('%s 声明 %s 时放行', (ext, mime) => {
    const result = validateUploadFile(MAGIC_FIXTURES[ext]!, `sample.${ext}`, mime)
    expect(result.ok).toBe(true)
  })

  it('mov 伪装成垃圾内容 ⇒ 拒', () => {
    const result = validateUploadFile(JUNK, 'fake.mov', 'video/quicktime')
    expect(result.ok).toBe(false)
  })

  it('mp4 声明成 image/png ⇒ 拒(MIME 与扩展名不一致)', () => {
    const result = validateUploadFile(MAGIC_FIXTURES.mp4!, 'x.mp4', 'image/png')
    expect(result.ok).toBe(false)
  })
})

describe('scanner 侧行为不回归', () => {
  it('派生后 mp4 仍按签名严格校验(正样本放行 / 垃圾拒绝)', () => {
    expect(scanFileBuffer(MAGIC_FIXTURES.mp4!, 'a.mp4').ok).toBe(true)
    expect(scanFileBuffer(JUNK, 'a.mp4').ok).toBe(false)
  })

  it('派生后 bmp 仍按签名严格校验', () => {
    expect(scanFileBuffer(MAGIC_FIXTURES.bmp!, 'a.bmp').ok).toBe(true)
    expect(scanFileBuffer(JUNK, 'a.bmp').ok).toBe(false)
  })

  it('无签名条目的类型(ogg/webm/mov/txt)仍放行,不因收敛被误杀', () => {
    for (const [name, buf] of [
      ['a.ogg', MAGIC_FIXTURES.ogg!],
      ['a.webm', MAGIC_FIXTURES.webm!],
      ['a.mov', MAGIC_FIXTURES.mov!],
      ['a.txt', Buffer.from('hello', 'utf8')],
    ] as const) {
      expect(scanFileBuffer(buf, name).ok, `${name} 被误杀`).toBe(true)
    }
  })

  it('调用方仍可覆盖白名单(allowedExts 语义不变)', () => {
    expect(scanFileBuffer(MAGIC_FIXTURES.png!, 'a.png', { allowedExts: new Set(['png']) }).ok).toBe(
      true,
    )
    expect(scanFileBuffer(MAGIC_FIXTURES.png!, 'a.png', { allowedExts: new Set(['jpg']) }).ok).toBe(
      false,
    )
  })
})

describe('危险类型不得混入白名单', () => {
  it.each(['svg', 'html', 'htm', 'js', 'exe', 'sh', 'php'])('%s 不在白名单', (ext) => {
    expect(ALLOWED_EXTENSIONS).not.toContain(ext)
    expect(DEFAULT_ALLOWED_EXTS.has(ext)).toBe(false)
  })
})
