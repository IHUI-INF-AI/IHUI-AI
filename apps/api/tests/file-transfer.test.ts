// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// 2026-11-01 安全强化:出网闸的形替身(本仓已有 4 个测试文件用同一手法 mock 它)。
// 刻意保留**字面内网判定**的真实语义,而不是让它恒通过 —— 否则"接了守卫"这件事
// 在本文件里就只是装饰:摘掉 downloadFileFromUrl 里的调用,下面的反向牙必须翻红。
vi.mock('../src/utils/ssrf-guard.js', () => {
  const judged: string[] = []
  const isInternalLiteral = (raw: string): boolean => {
    let host = ''
    try {
      host = new URL(raw).hostname.toLowerCase().replace(/\.$/, '')
    } catch {
      return true // 解析不出来 ⇒ 不放过
    }
    if (host === 'localhost' || host === '::1') return true
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return true
    return /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  }
  return {
    ensureSafeFetchUrl: vi.fn(async (raw: string) => {
      judged.push(raw)
      if (isInternalLiteral(raw)) throw new Error('SSRF blocked: internal/reserved target')
      return raw
    }),
    __judged: judged,
  }
})

import {
  MAX_FILE_SIZE,
  guessContentType,
  getFileTransferConfig,
  downloadFileFromUrl,
  uploadFileToServer,
} from '../src/utils/file-transfer.js'

/**
 * 出网闸接线(2026-11-01 安全强化)。
 *
 * 本文件此前只测"怎么把字节搬回来",不测"该不该搬":`downloadFileFromUrl` 是裸 `fetch(url)`,
 * 而 `uploadFromNetworkUrl` 把 url **原样转发**给内部转存服务(= 下游替我出连)。
 * 现读它在 `apps/api/src` 内零调用方 ⇒ 今天不是活敞口,但它是**已导出的通用工具**:
 * 任何一个新路由接上它,就白拿一枚"服务端替调用者出连"的原语
 * (云元数据 169.254.169.254、只绑回环的管理端口都在射程)。闸住在工具自己这一侧。
 */
describe('file-transfer 出网闸', () => {
  async function judged(): Promise<string[]> {
    const mod = (await import('../src/utils/ssrf-guard.js')) as unknown as {
      __judged: string[]
    }
    return mod.__judged
  }

  it('内网/元数据字面落点:一次 fetch 都不发,直接返回 null', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as never
    const before = (await judged()).length
    for (const url of [
      'http://169.254.169.254/latest/meta-data/iam/',
      'http://127.0.0.1:8802/admin',
      'http://localhost:8803/api/mcp',
    ]) {
      expect(await downloadFileFromUrl(url), url).toBeNull()
    }
    expect(fetchSpy, '被拒的落点不该发出任何请求').not.toHaveBeenCalled()
    // 闸确实被问过(而不是靠别的分支偶然返回 null)
    expect((await judged()).length - before).toBe(3)
  })

  it('正向对照:公网落点照常工作(闸在 fetch 之前问,且不拦合法目标)', async () => {
    const fetchSpy = vi.fn(async () =>
      mockFetchResponse({ ok: true, status: 200, bodyChunks: [new Uint8Array([1, 2, 3])] }),
    )
    global.fetch = fetchSpy as never
    const r = await downloadFileFromUrl('https://public.example.com/a.bin')
    expect(r).not.toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(await judged()).toContain('https://public.example.com/a.bin')
  })

  it('转发面同样在入口判(它把 url 交出去让别人出连)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/utils/file-transfer.ts', 'utf-8')
    const guardAt = src.indexOf('await ensureSafeFetchUrl(url)')
    const postAt = src.indexOf("body: JSON.stringify({ filePath: url })")
    expect(guardAt, '两处出网都该过闸').toBeGreaterThan(0)
    expect(src.split('ensureSafeFetchUrl(').length - 1).toBeGreaterThanOrEqual(2)
    expect(guardAt, '闸必须排在把 url 转发出去之前').toBeLessThan(postAt)
  })
})

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
