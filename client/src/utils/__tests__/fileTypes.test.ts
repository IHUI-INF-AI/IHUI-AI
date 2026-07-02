import { describe, it, expect } from 'vitest'
import {
  getFileType,
  getCodeLanguage,
  FILE_TYPE_CONFIGS,
} from '../fileTypes'

describe('fileTypes', () => {
  describe('getFileType', () => {
    it('应该根据扩展名返回正确的文件类型配置', () => {
      const result = getFileType('test.pdf')
      expect(result.category).toBe('pdf')
      expect(result.mimeType).toBe('application/pdf')
      expect(result.previewable).toBe(true)
    })

    it('应该处理大写扩展名', () => {
      const result = getFileType('IMAGE.PNG')
      expect(result.category).toBe('image')
      expect(result.extension).toBe('png')
    })

    it('应该处理空字符串', () => {
      const result = getFileType('')
      expect(result.category).toBe('unknown')
      expect(result.previewable).toBe(false)
    })

    it('应该处理null和undefined', () => {
      expect(getFileType(null).category).toBe('unknown')
      expect(getFileType(undefined).category).toBe('unknown')
    })

    it('应该处理未知扩展名', () => {
      const result = getFileType('file.unknownext')
      expect(result.category).toBe('unknown')
      expect(result.extension).toBe('unknownext')
    })

    it('应该处理无扩展名的文件', () => {
      const result = getFileType('README')
      expect(result.category).toBe('unknown')
    })

    it('应该处理多点文件名', () => {
      const result = getFileType('archive.tar.gz')
      expect(result.category).toBe('archive')
      expect(result.extension).toBe('gz')
    })
  })

  describe('getCodeLanguage', () => {
    it('应该返回正确的代码语言', () => {
      expect(getCodeLanguage('script.js')).toBe('javascript')
      expect(getCodeLanguage('app.tsx')).toBe('typescript')
      expect(getCodeLanguage('Main.java')).toBe('java')
      expect(getCodeLanguage('main.py')).toBe('python')
    })

    it('应该处理未知扩展名返回plaintext', () => {
      expect(getCodeLanguage('file.unknown')).toBe('plaintext')
    })

    it('应该处理无扩展名文件', () => {
      expect(getCodeLanguage('README')).toBe('plaintext')
    })
  })

  describe('FILE_TYPE_CONFIGS', () => {
    it('应该包含所有主要文件类型', () => {
      const extensions = FILE_TYPE_CONFIGS.map(c => c.extension)
      expect(extensions).toContain('pdf')
      expect(extensions).toContain('docx')
      expect(extensions).toContain('xlsx')
      expect(extensions).toContain('mp4')
      expect(extensions).toContain('mp3')
      expect(extensions).toContain('js')
      expect(extensions).toContain('md')
      expect(extensions).toContain('zip')
    })

    it('所有配置都应该是可下载的', () => {
      FILE_TYPE_CONFIGS.forEach(config => {
        expect(config.downloadable).toBe(true)
      })
    })
  })
})
