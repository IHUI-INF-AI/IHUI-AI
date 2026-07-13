import { describe, it, expect } from 'vitest'
import {
  detectMimeFromBytes,
  hasDangerousSignature,
  sanitizeFilename,
  extractExt,
  scanFileBuffer,
} from '../src/plugins/upload-scanner.js'

describe('upload-scanner — detectMimeFromBytes', () => {
  it('识别 JPEG', () => {
    expect(detectMimeFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })

  it('识别 PNG', () => {
    expect(detectMimeFromBytes(Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'))).toBe('image/png')
  })

  it('识别 GIF87a', () => {
    expect(detectMimeFromBytes(Buffer.from('GIF87a', 'latin1'))).toBe('image/gif')
  })

  it('识别 GIF89a', () => {
    expect(detectMimeFromBytes(Buffer.from('GIF89a', 'latin1'))).toBe('image/gif')
  })

  it('识别 PDF', () => {
    expect(detectMimeFromBytes(Buffer.from('%PDF-1.4', 'latin1'))).toBe('application/pdf')
  })

  it('识别 ZIP', () => {
    expect(detectMimeFromBytes(Buffer.from('PK\x03\x04', 'latin1'))).toBe('application/zip')
  })

  it('识别 GZIP', () => {
    expect(detectMimeFromBytes(Buffer.from([0x1f, 0x8b, 0x08]))).toBe('application/gzip')
  })

  it('识别 MP4 (ftyp 在偏移 4)', () => {
    // MP4: 4 字节 size + 'ftyp' 品牌
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70])
    expect(detectMimeFromBytes(buf)).toBe('video/mp4')
  })

  it('识别 BMP', () => {
    expect(detectMimeFromBytes(Buffer.from('BM', 'latin1'))).toBe('image/bmp')
  })

  it('未知魔数返回 null', () => {
    expect(detectMimeFromBytes(Buffer.from([0x01, 0x02, 0x03, 0x04]))).toBeNull()
  })

  it('空 buffer 返回 null', () => {
    expect(detectMimeFromBytes(Buffer.alloc(0))).toBeNull()
  })
})

describe('upload-scanner — hasDangerousSignature', () => {
  it('检测 <%', () => {
    expect(hasDangerousSignature(Buffer.from('<%response.write%>', 'latin1'))).toBe(true)
  })

  it('检测 <script', () => {
    expect(hasDangerousSignature(Buffer.from('<script>alert(1)</script>', 'latin1'))).toBe(true)
  })

  it('检测 <?php', () => {
    expect(hasDangerousSignature(Buffer.from('<?php echo 1;', 'latin1'))).toBe(true)
  })

  it('检测 <!DOCTYPE', () => {
    expect(hasDangerousSignature(Buffer.from('<!DOCTYPE html>', 'latin1'))).toBe(true)
  })

  it('检测 MZ (Windows PE)', () => {
    expect(hasDangerousSignature(Buffer.from('MZ\x90\x00', 'latin1'))).toBe(true)
  })

  it('检测 ELF', () => {
    expect(hasDangerousSignature(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))).toBe(true)
  })

  it('普通文件无危险特征', () => {
    expect(hasDangerousSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
  })

  it('仅检查前 4096+16 字节窗口（超出窗口返回 false）', () => {
    const buf = Buffer.alloc(8000)
    // 窗口 = 4096 + 16 = 4112，<script 7 字节，写在 4113 完全超出窗口
    buf.write('<script', 4113, 'latin1')
    expect(hasDangerousSignature(buf)).toBe(false)
  })

  it('危险特征在前 4096 字节内', () => {
    const buf = Buffer.alloc(8000)
    // <script 7 字节，从 4089 写入到 4095，刚好完全在前 4096 字节内
    buf.write('<script', 4089, 'latin1')
    expect(hasDangerousSignature(buf)).toBe(true)
  })

  it('空 buffer 返回 false', () => {
    expect(hasDangerousSignature(Buffer.alloc(0))).toBe(false)
  })
})

describe('upload-scanner — sanitizeFilename', () => {
  it('提取 basename (POSIX)', () => {
    expect(sanitizeFilename('a/b/c.txt')).toBe('c.txt')
  })

  it('提取 basename (Windows)', () => {
    expect(sanitizeFilename('a\\b\\c.txt')).toBe('c.txt')
  })

  it('移除 NULL 字符', () => {
    expect(sanitizeFilename('a\x00b.txt')).toBe('ab.txt')
  })

  it('移除路径穿越 ..', () => {
    const result = sanitizeFilename('../../etc/passwd')
    expect(result).not.toContain('..')
    expect(result).not.toContain('/')
  })

  it('替换特殊字符为下划线', () => {
    const result = sanitizeFilename('a b@c.txt')
    expect(result).not.toContain(' ')
    expect(result).not.toContain('@')
  })

  it('长度限制保留扩展名', () => {
    const longName = 'a'.repeat(200) + '.txt'
    const result = sanitizeFilename(longName, 50)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.endsWith('.txt')).toBe(true)
  })

  it('长度限制无扩展名', () => {
    const longName = 'a'.repeat(200)
    const result = sanitizeFilename(longName, 50)
    expect(result.length).toBe(50)
  })

  it('空字符串返回空', () => {
    expect(sanitizeFilename('')).toBe('')
  })

  it('默认 maxLen=128', () => {
    const longName = 'a'.repeat(200) + '.txt'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(128)
  })
})

describe('upload-scanner — extractExt', () => {
  it('正常提取扩展名', () => {
    expect(extractExt('file.txt')).toBe('txt')
  })

  it('大写转小写', () => {
    expect(extractExt('file.TXT')).toBe('txt')
  })

  it('无扩展名返回空', () => {
    expect(extractExt('file')).toBe('')
  })

  it('多个点取最后', () => {
    expect(extractExt('a.b.c')).toBe('c')
  })

  it('空字符串返回空', () => {
    expect(extractExt('')).toBe('')
  })
})

describe('upload-scanner — scanFileBuffer', () => {
  it('空 buffer 拒绝', () => {
    const result = scanFileBuffer(Buffer.alloc(0), 'file.jpg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('空')
  })

  it('超过大小限制拒绝', () => {
    const buf = Buffer.alloc(100)
    const result = scanFileBuffer(buf, 'file.jpg', { maxSize: 50 })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('超过')
  })

  it('非白名单扩展名拒绝', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
    const result = scanFileBuffer(buf, 'file.exe')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('白名单')
  })

  it('危险特征拒绝（即使扩展名合法）', () => {
    const buf = Buffer.from('<script>alert(1)</script>')
    const result = scanFileBuffer(buf, 'file.jpg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('可疑')
  })

  it('无法识别魔数拒绝', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04])
    const result = scanFileBuffer(buf, 'file.jpg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('无法识别')
  })

  it('扩展名与魔数不一致拒绝', () => {
    // PNG 魔数但扩展名是 jpg
    const buf = Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')
    const result = scanFileBuffer(buf, 'file.jpg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('不一致')
  })

  it('正常 JPEG 通过', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const result = scanFileBuffer(buf, 'file.jpg')
    expect(result.ok).toBe(true)
    expect(result.realMime).toBe('image/jpeg')
  })

  it('正常 PNG 通过', () => {
    const buf = Buffer.from('\x89PNG\r\n\x1a\n\x00\x00', 'latin1')
    const result = scanFileBuffer(buf, 'file.png')
    expect(result.ok).toBe(true)
    expect(result.realMime).toBe('image/png')
  })

  it('requireMagicCheck=false 跳过魔数校验', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04])
    const result = scanFileBuffer(buf, 'file.jpg', { requireMagicCheck: false })
    expect(result.ok).toBe(true)
  })
})
