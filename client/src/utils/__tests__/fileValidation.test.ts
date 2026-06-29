import { describe, it, expect } from 'vitest'
import {
  validateFile,
  validateFileSignature,
  validateFileAsync,
  formatFileSize,
  getFileExtension,
  getMimeTypeFromExtension,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDocumentFile,
  isArchiveFile,
  generateSafeFilename,
} from '../fileValidation'

// 创建一个普通文件
function createFile(name: string, size: number, type: string = ''): File {
  return new File([new ArrayBuffer(size)], name, { type })
}

// 创建一个带指定字节签名的文件
function createFileWithBytes(name: string, bytes: number[], type: string = ''): File {
  const arr = new Uint8Array(bytes)
  return new File([arr], name, { type })
}

describe('fileValidation', () => {
  describe('validateFile', () => {
    it('应该通过有效文件', () => {
      const file = createFile('test.jpg', 1024, 'image/jpeg')
      const result = validateFile(file)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该拒绝超过大小限制的文件', () => {
      const file = createFile('test.jpg', 200 * 1024 * 1024, 'image/jpeg')
      const result = validateFile(file, { maxSize: 100 * 1024 * 1024 })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('文件大小超过限制')
    })

    it('应该拒绝危险扩展名', () => {
      const file = createFile('malware.exe', 1024, 'application/octet-stream')
      const result = validateFile(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('不允许上传可执行文件')
    })

    it('应该拒绝各种危险脚本扩展名', () => {
      const exts = ['.bat', '.cmd', '.vbs', '.ps1', '.jar', '.scr']
      for (const ext of exts) {
        const file = createFile(`test${ext}`, 1024, 'application/octet-stream')
        const result = validateFile(file)
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain('不允许上传可执行文件')
      }
    })

    it('应该允许危险扩展名当allowDangerousExtensions为true', () => {
      const file = createFile('script.sh', 1024, 'text/x-sh')
      const result = validateFile(file, { allowDangerousExtensions: true })
      expect(result.valid).toBe(true)
    })

    it('应该检查允许的扩展名', () => {
      const file = createFile('test.txt', 1024, 'text/plain')
      const result = validateFile(file, { allowedExtensions: ['.jpg', '.png'] })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('不支持的文件扩展名')
    })

    it('应该支持扩展名大小写不敏感', () => {
      const file = createFile('test.JPG', 1024, 'image/jpeg')
      const result = validateFile(file, { allowedExtensions: ['.jpg'] })
      expect(result.valid).toBe(true)
    })

    it('应该检查允许的MIME类型', () => {
      const file = createFile('test.txt', 1024, 'text/plain')
      const result = validateFile(file, { allowedTypes: ['image/*'] })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('不支持的文件类型')
    })

    it('应该支持通配符MIME类型', () => {
      const file = createFile('test.jpg', 1024, 'image/jpeg')
      const result = validateFile(file, { allowedTypes: ['image/*'] })
      expect(result.valid).toBe(true)
    })

    it('应该支持精确MIME类型匹配', () => {
      const file = createFile('test.jpg', 1024, 'image/jpeg')
      const result = validateFile(file, { allowedTypes: ['image/jpeg'] })
      expect(result.valid).toBe(true)
    })

    it('应该处理file.type为空的未知类型', () => {
      const file = createFile('test.unknown', 1024, '')
      const result = validateFile(file, { allowedTypes: ['image/jpeg'] })
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('未知')
    })

    it('应该警告扩展名与MIME类型不匹配', () => {
      const file = createFile('test.jpg', 1024, 'image/png')
      const result = validateFile(file)
      expect(result.extensionMatch).toBe(false)
      expect(result.warnings).toContain('文件扩展名与内容类型不匹配')
    })

    it('应该处理无扩展名的文件', () => {
      const file = createFile('README', 1024, 'text/plain')
      const result = validateFile(file)
      // 无扩展名时不会进入危险扩展名检查
      expect(result.valid).toBe(true)
    })
  })

  describe('validateFileSignature', () => {
    it('应该识别JPEG文件签名', async () => {
      const file = createFileWithBytes('test.jpg', [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('image/jpeg')
    })

    it('应该识别PNG文件签名', async () => {
      const file = createFileWithBytes('test.png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('image/png')
    })

    it('应该识别GIF文件签名', async () => {
      const file = createFileWithBytes('test.gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('image/gif')
    })

    it('应该识别PDF文件签名', async () => {
      const file = createFileWithBytes('test.pdf', [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('application/pdf')
    })

    it('应该识别ZIP/DOCX文件签名', async () => {
      const file = createFileWithBytes('test.zip', [0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('application/zip')
    })

    it('应该识别WebP文件签名', async () => {
      const file = createFileWithBytes('test.webp', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('image/webp')
    })

    it('应该识别RAR文件签名', async () => {
      const file = createFileWithBytes('test.rar', [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('application/x-rar-compressed')
    })

    it('应该识别BMP文件签名', async () => {
      const file = createFileWithBytes('test.bmp', [0x42, 0x4D, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('image/bmp')
    })

    it('应该识别WebM文件签名', async () => {
      const file = createFileWithBytes('test.webm', [0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      const type = await validateFileSignature(file)
      expect(type).toBe('video/webm')
    })

    it('应该对未知签名返回null', async () => {
      // 使用不易匹配现有签名的字节
      const file = createFileWithBytes('test.xyz', [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0x00])
      const type = await validateFileSignature(file)
      expect(type).toBeNull()
    })

    it('当FileReader结果为空时返回null', async () => {
      // 模拟FileReader触发onload但result为空
      const originalFileReader = globalThis.FileReader
      class MockFileReader {
        onload: ((e: unknown) => void) | null = null
        onerror: (() => void) | null = null
        readAsArrayBuffer(_file: Blob) {
          // 模拟onload触发，但result为空
          setTimeout(() => {
            this.onload?.({ target: { result: null } })
          }, 0)
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader
      try {
        const file = createFile('test.jpg', 1024, 'image/jpeg')
        const type = await validateFileSignature(file)
        expect(type).toBeNull()
      } finally {
        globalThis.FileReader = originalFileReader
      }
    })
  })

  describe('validateFileAsync', () => {
    it('应该执行基本验证', async () => {
      const file = createFile('test.jpg', 1024, 'image/jpeg')
      const result = await validateFileAsync(file)
      expect(result.valid).toBe(true)
    })

    it('应该检测到与声明类型不符的实际类型', async () => {
      // 文件签名是PNG，但声明类型是JPEG
      const file = createFileWithBytes('fake.jpg', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg')
      const result = await validateFileAsync(file)
      expect(result.warnings).toContain('文件实际类型与声明类型不符')
      expect(result.detectedType).toBe('image/png')
    })

    it('当声明类型与实际类型一致时不报警告', async () => {
      const file = createFileWithBytes('test.png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0], 'image/png')
      const result = await validateFileAsync(file)
      expect(result.warnings).not.toContain('文件实际类型与声明类型不符')
      expect(result.detectedType).toBe('image/png')
    })

    it('当checkSignature为false时跳过签名检查', async () => {
      const file = createFileWithBytes('test.png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg')
      const result = await validateFileAsync(file, { checkSignature: false })
      expect(result.detectedType).toBeUndefined()
    })

    it('当文件大小为0时跳过签名检查', async () => {
      const file = createFile('empty.jpg', 0, 'image/jpeg')
      const result = await validateFileAsync(file)
      expect(result.detectedType).toBeUndefined()
    })

    it('当无法识别实际类型时detectedType为undefined', async () => {
      const file = createFileWithBytes('test.xyz', [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0x00], 'image/jpeg')
      const result = await validateFileAsync(file)
      expect(result.detectedType).toBeUndefined()
    })

    it('应该保留同步验证的错误', async () => {
      const file = createFile('malware.exe', 1024, 'application/octet-stream')
      const result = await validateFileAsync(file)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('不允许上传可执行文件')
    })
  })

  describe('formatFileSize', () => {
    it('应该格式化字节数', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(1024)).toBe('1 KB')
      expect(formatFileSize(1048576)).toBe('1 MB')
      expect(formatFileSize(1073741824)).toBe('1 GB')
    })

    it('应该保留两位小数', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB')
      expect(formatFileSize(1500)).toBe('1.46 KB')
    })

    it('应该处理TB级别', () => {
      expect(formatFileSize(1099511627776)).toBe('1 TB')
    })
  })

  describe('getFileExtension', () => {
    it('应该返回小写扩展名', () => {
      expect(getFileExtension('test.JPG')).toBe('jpg')
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('应该处理无扩展名文件', () => {
      expect(getFileExtension('README')).toBe('readme')
    })

    it('应该处理空字符串', () => {
      expect(getFileExtension('')).toBe('')
    })

    it('应该处理以点开头的文件', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore')
    })
  })

  describe('getMimeTypeFromExtension', () => {
    it('应该根据扩展名返回MIME类型', () => {
      expect(getMimeTypeFromExtension('.jpg')).toBe('image/jpeg')
      expect(getMimeTypeFromExtension('png')).toBe('image/png')
      expect(getMimeTypeFromExtension('.pdf')).toBe('application/pdf')
    })

    it('应该对未知扩展名返回octet-stream', () => {
      expect(getMimeTypeFromExtension('.unknown')).toBe('application/octet-stream')
      expect(getMimeTypeFromExtension('')).toBe('application/octet-stream')
    })

    it('应该处理docx等Office扩展名', () => {
      expect(getMimeTypeFromExtension('.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(getMimeTypeFromExtension('.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(getMimeTypeFromExtension('.pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    })
  })

  describe('文件类型判断函数', () => {
    it('isImageFile', () => {
      expect(isImageFile(createFile('test.jpg', 0, 'image/jpeg'))).toBe(true)
      expect(isImageFile(createFile('test.txt', 0, 'text/plain'))).toBe(false)
    })

    it('isVideoFile', () => {
      expect(isVideoFile(createFile('test.mp4', 0, 'video/mp4'))).toBe(true)
      expect(isVideoFile(createFile('test.jpg', 0, 'image/jpeg'))).toBe(false)
    })

    it('isAudioFile', () => {
      expect(isAudioFile(createFile('test.mp3', 0, 'audio/mpeg'))).toBe(true)
      expect(isAudioFile(createFile('test.mp4', 0, 'video/mp4'))).toBe(false)
    })

    it('isDocumentFile', () => {
      expect(isDocumentFile(createFile('test.pdf', 0, 'application/pdf'))).toBe(true)
      expect(isDocumentFile(createFile('test.doc', 0, 'application/msword'))).toBe(true)
      expect(isDocumentFile(createFile('test.docx', 0, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(true)
      expect(isDocumentFile(createFile('test.xls', 0, 'application/vnd.ms-excel'))).toBe(true)
      expect(isDocumentFile(createFile('test.xlsx', 0, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))).toBe(true)
      expect(isDocumentFile(createFile('test.ppt', 0, 'application/vnd.ms-powerpoint'))).toBe(true)
      expect(isDocumentFile(createFile('test.pptx', 0, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'))).toBe(true)
      expect(isDocumentFile(createFile('test.txt', 0, 'text/plain'))).toBe(true)
      expect(isDocumentFile(createFile('test.rtf', 0, 'text/rtf'))).toBe(true)
      expect(isDocumentFile(createFile('test.jpg', 0, 'image/jpeg'))).toBe(false)
    })

    it('isArchiveFile', () => {
      expect(isArchiveFile(createFile('test.zip', 0, 'application/zip'))).toBe(true)
      expect(isArchiveFile(createFile('test.rar', 0, 'application/x-rar-compressed'))).toBe(true)
      expect(isArchiveFile(createFile('test.7z', 0, 'application/x-7z-compressed'))).toBe(true)
      expect(isArchiveFile(createFile('test.tar', 0, 'application/x-tar'))).toBe(true)
      expect(isArchiveFile(createFile('test.gz', 0, 'application/gzip'))).toBe(true)
      expect(isArchiveFile(createFile('test.jpg', 0, 'image/jpeg'))).toBe(false)
    })
  })

  describe('generateSafeFilename', () => {
    it('应该替换特殊字符', () => {
      const result = generateSafeFilename('file<name>.txt')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
      expect(result).toContain('.txt')
    })

    it('应该替换空格为下划线', () => {
      const result = generateSafeFilename('my file name.txt')
      expect(result).not.toContain(' ')
      expect(result).toContain('_')
    })

    it('应该添加时间戳', () => {
      const result = generateSafeFilename('test.txt')
      expect(result).toMatch(/_\d+\.txt$/)
    })

    it('应该合并多个下划线', () => {
      const result = generateSafeFilename('file   name.txt')
      expect(result).not.toMatch(/_{2,}/)
    })

    it('应该处理多种特殊字符', () => {
      const result = generateSafeFilename('a:b/c\\d|e?f*g"h<i>j.txt')
      expect(result).not.toMatch(/[<>:"|?*\\/]/)
    })

    it('应该限制sanitized部分长度不超过255', () => {
      const longName = 'a'.repeat(300) + '.txt'
      const result = generateSafeFilename(longName)
      // 拆分文件名主体（不含时间戳和扩展名）
      const lastUnderscore = result.lastIndexOf('_')
      const dotAfter = result.indexOf('.', lastUnderscore)
      const namePart = result.substring(0, lastUnderscore)
      // sanitized部分应该不超过255字符
      expect(namePart.length).toBeLessThanOrEqual(255)
      // 结果仍包含时间戳和扩展名
      expect(result).toMatch(/_\d+\.txt$/)
      // dotAfter 应该存在
      expect(dotAfter).toBeGreaterThan(lastUnderscore)
    })
  })
})
