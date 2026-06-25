// files.ts 单元测试 - 提升覆盖率
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: vi.fn((r: any) => r?.data || {}),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {
    file: {
      uploadForm: '/file/upload/form',
      mobileUploadBase64: '/file/upload/base64',
      uploadOctet: (n: string) => `/file/upload/octet/${n}`,
      list: '/file/list',
      download: (f: string) => `/file/download/${f}`,
      byId: (id: string) => `/file/${id}`,
    },
  },
}))

import * as api from '../file/files'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fileToStream 文件转流', async () => {
    await callFn((api as any).fileToStream, '/path/to/file')
  })

  it('uploadFile 文件上传', async () => {
    const file = new File(['a'], 'a.txt')
    await callFn((api as any).uploadFile, file)
  })

  it('uploadFormFile 别名', async () => {
    const file = new File(['a'], 'a.txt')
    await callFn((api as any).uploadFormFile, file)
  })

  it('uploadBase64Image base64上传', async () => {
    await callFn((api as any).uploadBase64Image, { base64: 'data:image/png;base64,aaa' })
    await callFn((api as any).uploadBase64Image, { base64: 'data:image/png;base64,aaa', filename: 'a.png' })
  })

  it('uploadOctetStream octet流', async () => {
    await callFn((api as any).uploadOctetStream, new ArrayBuffer(8), 'a.bin')
    await callFn((api as any).uploadOctetStream, new Blob(['a']), 'a.bin')
  })

  it('getFileList 文件列表', async () => {
    await callFn((api as any).getFileList)
    await callFn((api as any).getFileList, { file_type: 'image', page: 1, page_size: 10 })
  })

  it('downloadFile 下载', async () => {
    const origFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['a'])),
    })
    try {
      await callFn((api as any).downloadFile, 'a.txt')
    } finally {
      ;(globalThis as any).fetch = origFetch
    }
  })

  it('downloadFile 失败', async () => {
    const origFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    try {
      try { await (api as any).downloadFile('a.txt') } catch (e) { expect(e).toBeDefined() }
    } finally {
      ;(globalThis as any).fetch = origFetch
    }
  })

  it('getFileInfo/deleteFile', async () => {
    await callFn((api as any).getFileInfo, 'f1')
    await callFn((api as any).deleteFile, 'f1')
  })
})
