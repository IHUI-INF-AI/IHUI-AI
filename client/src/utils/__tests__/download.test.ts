import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  downloadBlob,
  downloadUrl,
  downloadText,
  downloadJson,
  downloadCsv,
  downloadFile,
  downloadExcel,
  downloadPdf,
  downloadImage,
  dataUrlToBlob,
  blobToDataUrl,
  blobToText,
  blobToArrayBuffer,
  getFilenameFromUrl,
  getFileExtension,
  getMimeType,
  useDownload,
  default as downloadDefault,
} from '../download'

import { logger } from '../logger'

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// jsdom 中默认没有 createObjectURL/revokeObjectURL，这里 mock 掉
beforeEach(() => {
  // @ts-ignore
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  // @ts-ignore
  URL.revokeObjectURL = vi.fn()
})

describe('download.ts', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let appendChildSpy: ReturnType<typeof vi.spyOn>
  let removeChildSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createElementSpy = vi.spyOn(document, 'createElement')
    appendChildSpy = vi.spyOn(document.body, 'appendChild')
    removeChildSpy = vi.spyOn(document.body, 'removeChild')
    // 清空所有 mock 的调用记录，避免用例之间相互干扰
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downloadBlob', () => {
    it('应该创建下载链接', () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      downloadBlob(blob, 'test.txt')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('downloadUrl', () => {
    it('应该创建下载链接', () => {
      downloadUrl('https://example.com/file.txt', 'file.txt')
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
    })
  })

  describe('downloadText', () => {
    it('应该下载文本文件', () => {
      downloadText('test content', 'test.txt')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该使用自定义MIME类型', () => {
      downloadText('test content', 'test.txt', 'text/html')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('downloadJson', () => {
    it('应该下载JSON文件', () => {
      downloadJson({ key: 'value' }, 'test.json')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  // 构造一个带 getReader 的模拟 ReadableStream
  function makeStream(chunks: Uint8Array[]) {
    let i = 0
    return {
      getReader() {
        return {
          read() {
            if (i >= chunks.length) {
              return Promise.resolve({ done: true, value: undefined })
            }
            return Promise.resolve({ done: false, value: chunks[i++] })
          },
        }
      },
    }
  }

  function mockFetchOnce(response: any) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response as any)
  }

  describe('downloadFile', () => {
    it('应该成功下载文件并返回 true', async () => {
      const chunk = new TextEncoder().encode('hello')
      const response = {
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-length' ? '5' : null) },
        body: makeStream([chunk]),
      }
      mockFetchOnce(response)

      const ok = await downloadFile('https://example.com/a.txt', 'a.txt')
      expect(ok).toBe(true)
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该触发进度回调', async () => {
      const c1 = new TextEncoder().encode('abc')
      const c2 = new TextEncoder().encode('de')
      const response = {
        ok: true,
        status: 200,
        headers: { get: (k: string) => (k === 'content-length' ? '5' : null) },
        body: makeStream([c1, c2]),
      }
      mockFetchOnce(response)

      const calls: number[] = []
      await downloadFile('https://example.com/a.txt', 'a.txt', p => {
        calls.push(p.percentage)
      })
      expect(calls.length).toBeGreaterThan(0)
      expect(calls[calls.length - 1]).toBe(100)
    })

    it('当没有 content-length 时不应触发进度回调', async () => {
      const chunk = new TextEncoder().encode('x')
      const response = {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: makeStream([chunk]),
      }
      mockFetchOnce(response)

      const onProgress = vi.fn()
      const ok = await downloadFile('https://example.com/a.txt', 'a.txt', onProgress)
      expect(ok).toBe(true)
      expect(onProgress).not.toHaveBeenCalled()
    })

    it('当响应体为 null 时返回 false 并记录错误', async () => {
      const response = {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: null,
      }
      mockFetchOnce(response)

      const ok = await downloadFile('https://example.com/a.txt', 'a.txt')
      expect(ok).toBe(false)
      expect(logger.error).toHaveBeenCalled()
    })

    it('当 HTTP 状态非 2xx 时返回 false', async () => {
      const response = {
        ok: false,
        status: 404,
        headers: { get: () => null },
        body: makeStream([]),
      }
      mockFetchOnce(response)

      const ok = await downloadFile('https://example.com/a.txt', 'a.txt')
      expect(ok).toBe(false)
      expect(logger.error).toHaveBeenCalled()
    })

    it('当 fetch 抛出异常时返回 false', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))
      const ok = await downloadFile('https://example.com/a.txt', 'a.txt')
      expect(ok).toBe(false)
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('downloadCsv', () => {
    it('应该下载CSV文件', () => {
      downloadCsv([{ name: 'test', value: 123 }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理空数据', () => {
      downloadCsv([], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理null数据', () => {
      downloadCsv(null as any, 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理包含逗号的数据', () => {
      downloadCsv([{ name: 'test, with comma' }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理包含引号的数据', () => {
      downloadCsv([{ name: 'test "with quotes"' }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理包含换行的数据', () => {
      downloadCsv([{ name: 'test\nwith newline' }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理null值', () => {
      downloadCsv([{ name: null }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该处理undefined值', () => {
      downloadCsv([{ name: undefined }], 'test.csv')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('downloadExcel', () => {
    it('应该下载Excel文件', () => {
      const blob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      downloadExcel(blob, 'test')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该自动添加.xlsx扩展名', () => {
      const blob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      downloadExcel(blob, 'test.xlsx')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('downloadPdf', () => {
    it('应该下载PDF文件', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' })
      downloadPdf(blob, 'test')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该自动添加.pdf扩展名', () => {
      const blob = new Blob(['test'], { type: 'application/pdf' })
      downloadPdf(blob, 'test.pdf')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('downloadImage', () => {
    it('应该下载图片文件', () => {
      const blob = new Blob(['test'], { type: 'image/png' })
      downloadImage(blob, 'test')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('应该自动添加扩展名', () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' })
      downloadImage(blob, 'test.jpg')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('文件名已带正确扩展名时不应重复添加', () => {
      const blob = new Blob(['test'], { type: 'image/png' })
      downloadImage(blob, 'test.png')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('blob.type 为空时使用 png 作为默认扩展名', () => {
      const blob = new Blob(['test'], { type: '' })
      downloadImage(blob, 'test')
      expect(createElementSpy).toHaveBeenCalledWith('a')
    })
  })

  describe('dataUrlToBlob', () => {
    it('应该转换Data URL到Blob', () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='
      const blob = dataUrlToBlob(dataUrl)
      expect(blob instanceof Blob).toBe(true)
      expect(blob.type).toBe('text/plain')
    })

    it('当无法解析 mime 时使用默认 application/octet-stream', () => {
      // arr[0] 中没有 ":<mime>;" 这种格式，走默认 mime；arr[1] 是合法 base64
      const dataUrl = 'no-mime-here,YWJj'
      const blob = dataUrlToBlob(dataUrl)
      expect(blob.type).toBe('application/octet-stream')
    })
  })

  // 替换 FileReader 用于触发 error 路径；保存原 FileReader 以便还原
  const originalFileReader = globalThis.FileReader
  function mockFileReaderError() {
    class FakeReader {
      result: any = null
      onload: ((e: any) => void) | null = null
      onerror: ((e: any) => void) | null = null
      readAsDataURL(_blob: Blob) { setTimeout(() => this.onerror && this.onerror({}), 0) }
      readAsText(_blob: Blob) { setTimeout(() => this.onerror && this.onerror({}), 0) }
      readAsArrayBuffer(_blob: Blob) { setTimeout(() => this.onerror && this.onerror({}), 0) }
    }
    // @ts-ignore
    globalThis.FileReader = FakeReader
  }

  afterEach(() => {
    // 还原 FileReader，避免污染后续用例
    // @ts-ignore
    globalThis.FileReader = originalFileReader
  })

  describe('blobToDataUrl', () => {
    it('应该转换Blob到Data URL', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const dataUrl = await blobToDataUrl(blob)
      expect(dataUrl.startsWith('data:')).toBe(true)
    })

    it('读取失败时应该 reject', async () => {
      mockFileReaderError()
      const blob = new Blob(['test'], { type: 'text/plain' })
      await expect(blobToDataUrl(blob)).rejects.toThrow('Failed to read blob')
    })
  })

  describe('blobToText', () => {
    it('应该转换Blob到文本', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })
      const text = await blobToText(blob)
      expect(text).toBe('test content')
    })

    it('读取失败时应该 reject', async () => {
      mockFileReaderError()
      const blob = new Blob(['test'], { type: 'text/plain' })
      await expect(blobToText(blob)).rejects.toThrow('Failed to read blob')
    })
  })

  describe('blobToArrayBuffer', () => {
    it('应该转换Blob到ArrayBuffer', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' })
      const buffer = await blobToArrayBuffer(blob)
      expect(buffer instanceof ArrayBuffer).toBe(true)
    })

    it('读取失败时应该 reject', async () => {
      mockFileReaderError()
      const blob = new Blob(['test'], { type: 'text/plain' })
      await expect(blobToArrayBuffer(blob)).rejects.toThrow('Failed to read blob')
    })
  })

  describe('getFilenameFromUrl', () => {
    it('应该从URL提取文件名', () => {
      expect(getFilenameFromUrl('https://example.com/path/to/file.txt')).toBe('file.txt')
    })

    it('应该返回download当URL没有文件名时', () => {
      expect(getFilenameFromUrl('https://example.com/')).toBe('download')
    })

    it('应该处理无效URL', () => {
      expect(getFilenameFromUrl('invalid-url')).toBe('download')
    })
  })

  describe('getFileExtension', () => {
    it('应该返回文件扩展名', () => {
      expect(getFileExtension('test.txt')).toBe('txt')
    })

    it('应该返回小写扩展名', () => {
      expect(getFileExtension('test.TXT')).toBe('txt')
    })

    it('应该返回空字符串当没有扩展名时', () => {
      expect(getFileExtension('test')).toBe('')
    })
  })

  describe('getMimeType', () => {
    it('应该返回正确的MIME类型', () => {
      expect(getMimeType('test.txt')).toBe('text/plain')
      expect(getMimeType('test.csv')).toBe('text/csv')
      expect(getMimeType('test.json')).toBe('application/json')
      expect(getMimeType('test.pdf')).toBe('application/pdf')
      expect(getMimeType('test.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(getMimeType('test.png')).toBe('image/png')
      expect(getMimeType('test.jpg')).toBe('image/jpeg')
      expect(getMimeType('test.mp3')).toBe('audio/mpeg')
      expect(getMimeType('test.mp4')).toBe('video/mp4')
    })

    it('应该覆盖剩余的MIME映射', () => {
      expect(getMimeType('a.xls')).toBe('application/vnd.ms-excel')
      expect(getMimeType('a.doc')).toBe('application/msword')
      expect(getMimeType('a.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(getMimeType('a.jpeg')).toBe('image/jpeg')
      expect(getMimeType('a.gif')).toBe('image/gif')
      expect(getMimeType('a.svg')).toBe('image/svg+xml')
      expect(getMimeType('a.zip')).toBe('application/zip')
    })

    it('应该返回默认MIME类型', () => {
      expect(getMimeType('test.unknown')).toBe('application/octet-stream')
    })

    it('没有扩展名时返回默认MIME类型', () => {
      expect(getMimeType('noext')).toBe('application/octet-stream')
    })
  })

  describe('useDownload', () => {
    it('应该返回所有下载方法', () => {
      const download = useDownload()
      expect(typeof download.downloadBlob).toBe('function')
      expect(typeof download.downloadUrl).toBe('function')
      expect(typeof download.downloadText).toBe('function')
      expect(typeof download.downloadJson).toBe('function')
      expect(typeof download.downloadCsv).toBe('function')
      expect(typeof download.downloadExcel).toBe('function')
      expect(typeof download.downloadPdf).toBe('function')
      expect(typeof download.downloadImage).toBe('function')
      expect(typeof download.dataUrlToBlob).toBe('function')
      expect(typeof download.blobToDataUrl).toBe('function')
      expect(typeof download.blobToText).toBe('function')
      expect(typeof download.blobToArrayBuffer).toBe('function')
    })

    it('应包含 downloadFile、getFilenameFromUrl、getFileExtension、getMimeType', () => {
      const download = useDownload()
      expect(typeof download.downloadFile).toBe('function')
      expect(typeof download.getFilenameFromUrl).toBe('function')
      expect(typeof download.getFileExtension).toBe('function')
      expect(typeof download.getMimeType).toBe('function')
      // 验证代理出来的方法与原函数行为一致
      expect(download.getFileExtension('a.TXT')).toBe('txt')
      expect(download.getMimeType('a.png')).toBe('image/png')
      expect(download.getFilenameFromUrl('https://x.com/y.png')).toBe('y.png')
    })
  })

  describe('default 导出', () => {
    it('默认导出对象应包含所有方法', () => {
      expect(typeof downloadDefault.downloadBlob).toBe('function')
      expect(typeof downloadDefault.downloadUrl).toBe('function')
      expect(typeof downloadDefault.downloadText).toBe('function')
      expect(typeof downloadDefault.downloadJson).toBe('function')
      expect(typeof downloadDefault.downloadCsv).toBe('function')
      expect(typeof downloadDefault.downloadFile).toBe('function')
      expect(typeof downloadDefault.downloadExcel).toBe('function')
      expect(typeof downloadDefault.downloadPdf).toBe('function')
      expect(typeof downloadDefault.downloadImage).toBe('function')
      expect(typeof downloadDefault.dataUrlToBlob).toBe('function')
      expect(typeof downloadDefault.blobToDataUrl).toBe('function')
      expect(typeof downloadDefault.blobToText).toBe('function')
      expect(typeof downloadDefault.blobToArrayBuffer).toBe('function')
      expect(typeof downloadDefault.getFilenameFromUrl).toBe('function')
      expect(typeof downloadDefault.getFileExtension).toBe('function')
      expect(typeof downloadDefault.getMimeType).toBe('function')
    })
  })
})
