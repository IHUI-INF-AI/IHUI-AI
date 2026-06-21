import { describe, it, expect } from 'vitest'
import {
  getFileType,
  getFileTypeFromUrl,
  getFileTypeFromMime,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isCodeFile,
  isMarkdownFile,
  isDocumentFile,
  isArchiveFile,
  isPreviewable,
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

  describe('getFileTypeFromUrl', () => {
    it('应该从URL提取文件类型', () => {
      const result = getFileTypeFromUrl('https://example.com/path/to/file.pdf')
      expect(result.category).toBe('pdf')
    })

    it('应该处理带查询参数的URL', () => {
      const result = getFileTypeFromUrl('https://example.com/image.png?width=100&height=100')
      expect(result.category).toBe('image')
    })

    it('应该处理带锚点的URL', () => {
      const result = getFileTypeFromUrl('https://example.com/doc.pdf#page=1')
      expect(result.category).toBe('pdf')
    })

    it('应该处理无扩展名的URL', () => {
      const result = getFileTypeFromUrl('https://example.com/path/')
      expect(result.category).toBe('unknown')
    })
  })

  describe('getFileTypeFromMime', () => {
    it('应该根据MIME类型返回配置', () => {
      const result = getFileTypeFromMime('application/pdf')
      expect(result.category).toBe('pdf')
    })

    it('应该处理image/*类型', () => {
      const result = getFileTypeFromMime('image/custom')
      expect(result.category).toBe('image')
    })

    it('应该处理video/*类型', () => {
      const result = getFileTypeFromMime('video/custom')
      expect(result.category).toBe('video')
    })

    it('应该处理audio/*类型', () => {
      const result = getFileTypeFromMime('audio/custom')
      expect(result.category).toBe('audio')
    })

    it('应该处理text/*类型', () => {
      const result = getFileTypeFromMime('text/custom')
      expect(result.category).toBe('text')
    })

    it('应该处理未知类型', () => {
      const result = getFileTypeFromMime('application/custom')
      expect(result.category).toBe('unknown')
    })
  })

  describe('文件类型判断函数', () => {
    it('isImageFile', () => {
      expect(isImageFile('photo.jpg')).toBe(true)
      expect(isImageFile('doc.pdf')).toBe(false)
    })

    it('isVideoFile', () => {
      expect(isVideoFile('movie.mp4')).toBe(true)
      expect(isVideoFile('photo.jpg')).toBe(false)
    })

    it('isAudioFile', () => {
      expect(isAudioFile('song.mp3')).toBe(true)
      expect(isAudioFile('movie.mp4')).toBe(false)
    })

    it('isCodeFile', () => {
      expect(isCodeFile('script.js')).toBe(true)
      expect(isCodeFile('doc.pdf')).toBe(false)
    })

    it('isMarkdownFile', () => {
      expect(isMarkdownFile('readme.md')).toBe(true)
      expect(isMarkdownFile('readme.txt')).toBe(false)
    })

    it('isDocumentFile', () => {
      expect(isDocumentFile('doc.docx')).toBe(true)
      expect(isDocumentFile('sheet.xlsx')).toBe(true)
      expect(isDocumentFile('slide.pptx')).toBe(true)
      expect(isDocumentFile('photo.jpg')).toBe(false)
    })

    it('isArchiveFile', () => {
      expect(isArchiveFile('archive.zip')).toBe(true)
      expect(isArchiveFile('archive.rar')).toBe(true)
      expect(isArchiveFile('doc.pdf')).toBe(false)
    })

    it('isPreviewable', () => {
      expect(isPreviewable('photo.jpg')).toBe(true)
      expect(isPreviewable('file.unknownext')).toBe(false)
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
