import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import {
  MAX_FILE_SIZE,
  guessContentType,
  getFileTransferConfig,
  downloadFileFromUrl,
  uploadFileToServer,
} from '../src/utils/file-transfer.js'

/** 构造 mock fetch 响应 */
function mockFetchResponse(opts: {
  ok?: boolean
  status?: number
  headers?: Record<string, string>
  bodyChunks?: Uint8Array[]
  jsonData?: unknown
  nullBody?: boolean
}) {
  const chunks = opts.bodyChunks ?? []
  let idx = 0
  const reader = {
    read: vi.fn(async () => {
      if (idx >= chunks.length) return { done: true, value: undefined }
      return { done: false, value: chunks[idx++] }
    }),
    cancel: vi.fn(async () => undefined),
    releaseLock: vi.fn(),
  }
  const headerMap = new Map(
    Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (name: string) => headerMap.get(name.toLowerCase()) ?? null },
    body: opts.nullBody ? null : { getReader: () => reader },
    json: async () => opts.jsonData ?? {},
  }
}

describe('file-transfer — 文件传输工具', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.FILE_UPLOAD_URL
    delete process.env.FILE_UPLOAD_NETWORK_URL
  })

  describe('MAX_FILE_SIZE', () => {
    it('为 100MB', () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024)
    })
  })

  describe('guessContentType', () => {
    it('已知扩展名返回对应 MIME', () => {
      expect(guessContentType('a.png')).toBe('image/png')
      expect(guessContentType('a.jpg')).toBe('image/jpeg')
      expect(guessContentType('a.jpeg')).toBe('image/jpeg')
      expect(guessContentType('a.gif')).toBe('image/gif')
      expect(guessContentType('a.webp')).toBe('image/webp')
      expect(guessContentType('a.pdf')).toBe('application/pdf')
      expect(guessContentType('a.json')).toBe('application/json')
      expect(guessContentType('a.csv')).toBe('text/csv')
      expect(guessContentType('a.txt')).toBe('text/plain')
      expect(guessContentType('a.html')).toBe('text/html')
      expect(guessContentType('a.mp4')).toBe('video/mp4')
      expect(guessContentType('a.zip')).toBe('application/zip')
      expect(guessContentType('a.glb')).toBe('model/gltf-binary')
      expect(guessContentType('a.obj')).toBe('application/octet-stream')
      expect(guessContentType('a.stl')).toBe('application/octet-stream')
    })
    it('未知扩展名返回 application/octet-stream', () => {
      expect(guessContentType('a.xyz')).toBe('application/octet-stream')
      expect(guessContentType('noext')).toBe('application/octet-stream')
    })
    it('大小写不敏感', () => {
      expect(guessContentType('a.PNG')).toBe('image/png')
      expect(guessContentType('a.Jpg')).toBe('image/jpeg')
    })
  })

  describe('getFileTransferConfig', () => {
    it('读取环境变量', () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      const cfg = getFileTransferConfig()
      expect(cfg.uploadUrl).toBe('https://upload.example.com')
      expect(cfg.networkUploadUrl).toBe('https://net.example.com')
    })
    it('未设置时返回 undefined', () => {
      const cfg = getFileTransferConfig()
      expect(cfg.uploadUrl).toBeUndefined()
      expect(cfg.networkUploadUrl).toBeUndefined()
    })
  })

  describe('downloadFileFromUrl', () => {
    it('成功下载返回 content/size/contentType', async () => {
      const data = new TextEncoder().encode('hello world')
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          headers: { 'content-type': 'text/plain', 'content-length': String(data.length) },
          bodyChunks: [data],
        }),
      ) as never
      const r = await downloadFileFromUrl('https://example.com/file.txt')
      expect(r).not.toBeNull()
      expect(r!.size).toBe(data.length)
      expect(r!.contentType).toBe('text/plain')
      expect(r!.content.toString()).toBe('hello world')
    })

    it('多 chunk 拼接', async () => {
      const c1 = new TextEncoder().encode('hello ')
      const c2 = new TextEncoder().encode('world')
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          headers: { 'content-type': 'text/plain' },
          bodyChunks: [c1, c2],
        }),
      ) as never
      const r = await downloadFileFromUrl('https://example.com/file.txt')
      expect(r!.content.toString()).toBe('hello world')
      expect(r!.size).toBe(11)
    })

    it('无 content-type 时默认 application/octet-stream', async () => {
      global.fetch = vi.fn(async () =>
        mockFetchResponse({ bodyChunks: [new Uint8Array([1, 2])] }),
      ) as never
      const r = await downloadFileFromUrl('https://example.com/raw')
      expect(r!.contentType).toBe('application/octet-stream')
    })

    it('HTTP 错误返回 null', async () => {
      global.fetch = vi.fn(async () => mockFetchResponse({ ok: false, status: 404 })) as never
      expect(await downloadFileFromUrl('https://example.com/notfound')).toBeNull()
    })

    it('Content-Length 超过 MAX_FILE_SIZE 返回 null', async () => {
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          headers: { 'content-length': String(MAX_FILE_SIZE + 1) },
        }),
      ) as never
      expect(await downloadFileFromUrl('https://example.com/big')).toBeNull()
    })

    it('流式读取超过 MAX_FILE_SIZE 返回 null', async () => {
      const bigChunk = new Uint8Array(MAX_FILE_SIZE + 1)
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          headers: { 'content-type': 'application/octet-stream' },
          bodyChunks: [bigChunk],
        }),
      ) as never
      expect(await downloadFileFromUrl('https://example.com/big')).toBeNull()
    })

    it('空 body 返回 null', async () => {
      global.fetch = vi.fn(async () => mockFetchResponse({ nullBody: true })) as never
      expect(await downloadFileFromUrl('https://example.com/empty')).toBeNull()
    })

    it('fetch 抛错返回 null', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('network error')
      }) as never
      expect(await downloadFileFromUrl('https://example.com/fail')).toBeNull()
    })
  })

  describe('uploadFileToServer — URL 模式', () => {
    it('成功网络转存返回 URL', async () => {
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          jsonData: { code: '200', data: { url: 'https://cdn.example.com/file.png' } },
        }),
      ) as never
      const url = await uploadFileToServer('https://source.example.com/file.png', 'file.png')
      expect(url).toBe('https://cdn.example.com/file.png')
    })

    it('data 为字符串时直接使用', async () => {
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          jsonData: { code: '200', data: 'https://cdn.example.com/str' },
        }),
      ) as never
      const url = await uploadFileToServer('https://source.example.com/file.png', 'file.png')
      expect(url).toBe('https://cdn.example.com/str')
    })

    it('未配置 networkUploadUrl 返回 null', async () => {
      const url = await uploadFileToServer('https://source.example.com/file.png', 'file.png')
      expect(url).toBeNull()
    })

    it('HTTP 错误返回 null', async () => {
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      global.fetch = vi.fn(async () => mockFetchResponse({ ok: false, status: 502 })) as never
      expect(await uploadFileToServer('https://source.example.com/file.png', 'file.png')).toBeNull()
    })

    it('响应格式不符返回 null', async () => {
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({ jsonData: { code: '500', msg: 'fail' } }),
      ) as never
      expect(await uploadFileToServer('https://source.example.com/file.png', 'file.png')).toBeNull()
    })

    it('fetch 抛错返回 null', async () => {
      process.env.FILE_UPLOAD_NETWORK_URL = 'https://net.example.com'
      global.fetch = vi.fn(async () => {
        throw new Error('network error')
      }) as never
      expect(await uploadFileToServer('https://source.example.com/file.png', 'file.png')).toBeNull()
    })
  })

  describe('uploadFileToServer — Buffer 模式', () => {
    it('成功上传返回 URL', async () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          jsonData: { code: '200', data: { url: 'https://cdn.example.com/uploaded.txt' } },
        }),
      ) as never
      const url = await uploadFileToServer(Buffer.from('test content'), 'test.txt')
      expect(url).toBe('https://cdn.example.com/uploaded.txt')
    })

    it('Uint8Array 也可上传', async () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({
          jsonData: { code: '200', data: 'https://cdn.example.com/raw' },
        }),
      ) as never
      const url = await uploadFileToServer(new Uint8Array([1, 2, 3]), 'raw.bin')
      expect(url).toBe('https://cdn.example.com/raw')
    })

    it('未配置 uploadUrl 返回 null', async () => {
      expect(await uploadFileToServer(Buffer.from('test'), 'test.txt')).toBeNull()
    })

    it('超过 MAX_FILE_SIZE 返回 null', async () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      const bigBuffer = Buffer.alloc(MAX_FILE_SIZE + 1)
      expect(await uploadFileToServer(bigBuffer, 'big.bin')).toBeNull()
    })

    it('HTTP 错误返回 null', async () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      global.fetch = vi.fn(async () => mockFetchResponse({ ok: false, status: 500 })) as never
      expect(await uploadFileToServer(Buffer.from('test'), 'test.txt')).toBeNull()
    })

    it('响应格式不符返回 null', async () => {
      process.env.FILE_UPLOAD_URL = 'https://upload.example.com'
      global.fetch = vi.fn(async () =>
        mockFetchResponse({ jsonData: { code: '500', msg: 'fail' } }),
      ) as never
      expect(await uploadFileToServer(Buffer.from('test'), 'test.txt')).toBeNull()
    })
  })

  describe('uploadFileToServer — 无效输入', () => {
    it('传入数字返回 null', async () => {
      expect(await uploadFileToServer(123 as never, 'test.txt')).toBeNull()
    })
    it('传入 null 返回 null', async () => {
      expect(await uploadFileToServer(null as never, 'test.txt')).toBeNull()
    })
  })
})
