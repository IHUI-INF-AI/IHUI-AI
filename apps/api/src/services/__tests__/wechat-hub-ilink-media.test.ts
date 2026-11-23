// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * iLink 媒体发送协议级回归（真实 HTTP 形状，mock 传输层）：
 * 下载 → getuploadurl → AES-128-ECB 加密上传 CDN → sendmessage item。
 * 真机发送仍需已登录 bot；本用例保证 token 就绪后的协议字段不漂移。
 */

import { createDecipheriv } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IlinkAdapter } from '../wechat-hub/ilink-adapter'

const MEDIA_BYTES = Buffer.from('fake-image-bytes-1234567890')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IlinkAdapter.sendMedia 协议', () => {
  it('按 AES-128-ECB 加密上传并组装 image_item', async () => {
    const calls: Array<{ url: string; body: string | null }> = []
    let aeskeyHex = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input)
        const body =
          init?.body instanceof Buffer
            ? init.body.toString('base64')
            : typeof init?.body === 'string'
              ? init.body
              : null
        calls.push({ url, body })
        if (url.endsWith('/a.png')) {
          return new Response(new Uint8Array(MEDIA_BYTES), { status: 200 })
        }
        if (url.includes('getuploadurl')) {
          const parsed = JSON.parse(String(init?.body)) as { aeskey: string }
          aeskeyHex = parsed.aeskey
          return new Response(JSON.stringify({ upload_param: 'upload-token' }), { status: 200 })
        }
        if (url.includes('/upload?')) {
          return new Response(null, {
            status: 200,
            headers: { 'x-encrypted-param': 'download-token' },
          })
        }
        if (url.includes('sendmessage')) {
          return new Response(JSON.stringify({ ret: 0, code: 0, message_id: 'm-media' }), {
            status: 200,
          })
        }
        throw new Error(`unexpected fetch ${url}`)
      }),
    )

    const adapter = new IlinkAdapter()
    ;(adapter as unknown as { token: string }).token = 'bot-token'
    const result = await adapter.sendMedia('wxid-target', {
      kind: 'image',
      url: 'https://example.com/a.png',
    })

    expect(result.ok).toBe(true)
    expect(result.platformMessageId).toBe('m-media')
    expect(aeskeyHex).toMatch(/^[0-9a-f]{32}$/)

    const upload = calls.find((item) => item.url.includes('/upload?'))
    expect(upload?.body).toBeTruthy()
    const ciphertext = Buffer.from(upload?.body ?? '', 'base64')
    const decipher = createDecipheriv('aes-128-ecb', Buffer.from(aeskeyHex, 'hex'), null)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    expect(plain.equals(MEDIA_BYTES)).toBe(true)

    const sendCall = calls.find((item) => item.url.includes('sendmessage'))
    const sendBody = JSON.parse(sendCall?.body ?? '{}') as {
      msg: {
        item_list: Array<{
          type: number
          image_item: { media: { aes_key: string; encrypt_type: number } }
        }>
      }
    }
    const item = sendBody.msg.item_list[0]
    expect(item?.type).toBe(2)
    expect(item?.image_item.media.encrypt_type).toBe(1)
    expect(item?.image_item.media.aes_key).toBe(Buffer.from(aeskeyHex, 'ascii').toString('base64'))
  })
})

describe('IlinkAdapter 扫码登录', () => {
  it('取码后持续轮询，确认即落 token 并转在线', async () => {
    vi.useFakeTimers()
    const credentials: Array<Record<string, string>> = []
    const statuses: string[] = []
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input)
      if (url.includes('get_bot_qrcode')) {
        return new Response(
          JSON.stringify({ qrcode: 'qr-login', qrcode_img_content: 'https://qr.test/1' }),
          { status: 200 },
        )
      }
      if (url.includes('get_qrcode_status')) {
        return new Response(JSON.stringify({ status: 'confirmed', bot_token: 'bot-token' }), {
          status: 200,
        })
      }
      if (url.includes('getupdates')) return new Promise<Response>(() => {})
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new IlinkAdapter()
    await adapter.connect({
      account: {
        id: 'acc-ilink',
        userId: 'user-1',
        label: 'iLink',
        backend: 'ilink',
        status: 'disconnected',
        credentials: {},
        cursor: null,
        metadata: {},
        allowlistEnabled: false,
      },
      onEvent: async () => {},
      onStatus: async (status) => {
        statuses.push(status)
      },
      onCursor: async () => {},
      onCredentials: async (patch) => {
        credentials.push(patch)
      },
      onMetadata: async () => {},
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    })

    expect(adapter.getQrCode()?.qrcode).toBe('qr-login')
    expect(adapter.getQrCode()?.imageUrl).toMatch(/^data:image\/png;base64,/)
    expect(statuses).toContain('awaiting_scan')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('get_qrcode_status'))).toBe(
      false,
    )

    await vi.advanceTimersByTimeAsync(2_500)
    expect(adapter.getStatus()).toBe('online')
    expect(credentials[0]).toEqual({ token: 'bot-token' })
    expect(adapter.getQrCode()).toBeNull()

    await adapter.disconnect()
    vi.useRealTimers()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
