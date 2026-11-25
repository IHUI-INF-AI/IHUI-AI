// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 桥本地媒体适配器契约：列表/单文件都走带 Bearer 的 GET，404 不伪造，
 * 二进制按 content-type 原样返回；用本地 HTTP 服务模拟桥，不碰真实微信。
 */
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BridgeAdapter } from '../wechat-hub/bridge-adapter'
import type { WechatAdapterContext, WechatRuntimeAccount } from '../wechat-hub/types'

const TOKEN = 'bridge-media-token'
const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

let server: ReturnType<typeof createServer> | null = null
let baseUrl = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, seq: 0, online: true }))
      return
    }
    if (url.pathname.startsWith('/moments/media')) {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }))
        return
      }
    }
    if (url.pathname === '/moments/media/list') {
      if (url.searchParams.get('momentId') !== 'm-1') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'not found' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          ok: true,
          files: [{ name: 'a.jpg', size: IMAGE.length, contentType: 'image/jpeg' }],
        }),
      )
      return
    }
    if (url.pathname === '/moments/media') {
      if (url.searchParams.get('momentId') !== 'm-1' || url.searchParams.get('name') !== 'a.jpg') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'not found' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': IMAGE.length })
      res.end(IMAGE)
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'not found' }))
  })
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()))
  const address = server?.address()
  if (!address || typeof address === 'string') throw new Error('测试服务未监听 TCP 端口')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (!server) return
  await new Promise<void>((resolve) => server?.close(() => resolve()))
})

function context(): WechatAdapterContext {
  const account = {
    id: 'account-1',
    userId: 'user-1',
    label: '测试桥',
    backend: 'bridge',
    status: 'connecting',
    credentials: { baseUrl, token: TOKEN },
    cursor: '',
    metadata: { mode: 'webhook' },
    allowlistEnabled: false,
  } as WechatRuntimeAccount
  const noop = async () => {}
  return {
    account,
    onEvent: noop,
    onStatus: noop,
    onCursor: noop,
    onCredentials: noop,
    onMetadata: noop,
    logger: { info: noop, warn: noop, error: noop, debug: noop },
  }
}

describe('BridgeAdapter 本地媒体', () => {
  it('读列表、读二进制，并区分 404', async () => {
    const adapter = new BridgeAdapter()
    await adapter.connect(context())
    const files = await adapter.listMomentMedia('m-1')
    expect(files).toEqual([{ name: 'a.jpg', size: 4, contentType: 'image/jpeg' }])
    expect(await adapter.listMomentMedia('missing')).toEqual([])
    const media = await adapter.readMomentMedia('m-1', 'a.jpg')
    expect(media?.contentType).toBe('image/jpeg')
    expect(media?.data.equals(IMAGE)).toBe(true)
    expect(await adapter.readMomentMedia('m-1', 'missing.jpg')).toBeNull()
  })
})
