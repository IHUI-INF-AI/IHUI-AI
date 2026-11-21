// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agnes 视频路由链钉子(2026-10-30 立)。
 *
 * 背景:vendor→path 链的**默认分支是 sora2 兜底**,于是一枚没登记的 vendor(agnes 曾经就是)
 * 不会报错,而是静默由另一家出片 —— 计费按 agnes、出片按 sora2,两头都对不上而账面全绿。
 * 链匿名写在 handler 里时任何一条分支都测不到;抽成导出纯函数后,本测试逐厂商钉 path,
 * 「加了内部端点却忘了登记公开面」会在 sora2 兜底那一条上直接红。
 */
import { describe, it, expect } from 'vitest'
import {
  resolveVideoVendorRoute,
  resolveImageVendorRoute,
  extractSyncImages,
} from '../src/routes/v1-multimodal.js'

const SEED = { prompt: 'p', model: 'm' }

describe('POST /v1/videos/generations 的 vendor → 内部路由链', () => {
  it.each([
    ['dashscope', '/api/ai/dashscope/video'],
    ['doubao', '/api/ai/doubao/video'],
    ['gemini', '/api/ai/gemini/video'],
    ['minimax', '/api/ai/minimax/video'],
    ['kling', '/api/ai/kling/generate'],
    ['vidu', '/api/ai/vidu/generate'],
    ['runway', '/api/ai/runway/generate'],
    ['luma', '/api/ai/luma/generate'],
    ['pixverse', '/api/ai/pixverse/generate'],
    ['zhipu', '/api/ai/zhipu/video'],
    ['agnes', '/api/ai/agnes/video'],
  ])('%s ⇒ %s', (vendor, path) => {
    expect(resolveVideoVendorRoute(vendor, SEED).path).toBe(path)
  })

  it('agnes 不再静默落 sora2(本票根治的缺陷形态反证)', () => {
    expect(resolveVideoVendorRoute('agnes', SEED).path).not.toBe('/api/ai/sora2/generate')
  })

  it('未登记 vendor 与缺省都落 sora2 兜底;vendor 大小写不敏感', () => {
    expect(resolveVideoVendorRoute('nobody', SEED).path).toBe('/api/ai/sora2/generate')
    expect(resolveVideoVendorRoute(undefined, SEED).path).toBe('/api/ai/sora2/generate')
    expect(resolveVideoVendorRoute('AGNES', SEED).path).toBe('/api/ai/agnes/video')
    expect(resolveVideoVendorRoute(' agnes ', SEED).path).toBe('/api/ai/agnes/video')
  })

  it('agnes 不透传 duration:上游 2.5 系列不收顶层 duration,按秒计价等于收上游不控制的量', () => {
    const r = resolveVideoVendorRoute('agnes', { ...SEED, duration: 8 })
    expect(r.body).not.toHaveProperty('duration')
    // 阳性对照(同一把尺子必须能打到别人):其余厂商的 duration 适配逐字不变
    expect(resolveVideoVendorRoute('kling', { ...SEED, duration: 5 }).body.duration).toBe('5')
    expect(resolveVideoVendorRoute('luma', { ...SEED, duration: 5 }).body.duration).toBe('5s')
    expect(resolveVideoVendorRoute('sora2', { ...SEED, duration: 5 }).body.duration).toBe(5)
  })

  it('三个厂商的 image 改名(既有适配不得被改坏)', () => {
    const s = { ...SEED, image: 'https://example.test/i.png' }
    const minimax = resolveVideoVendorRoute('minimax', s).body
    expect(minimax).not.toHaveProperty('image')
    expect(minimax.first_frame_image).toBe('https://example.test/i.png')
    const vidu = resolveVideoVendorRoute('vidu', s).body
    expect(vidu).not.toHaveProperty('image')
    expect(vidu.images).toEqual(['https://example.test/i.png'])
    const zhipu = resolveVideoVendorRoute('zhipu', s).body
    expect(zhipu).not.toHaveProperty('image')
    expect(zhipu.image_url).toBe('https://example.test/i.png')
    // 阳性对照:agnes 与 sora2 都保留原生 image 键(内部端点自己按有无 image 补 mode)
    expect(resolveVideoVendorRoute('agnes', s).body.image).toBe('https://example.test/i.png')
  })

  it('纯函数契约:不改写入参', () => {
    const input = { prompt: 'p', model: 'm', duration: 5, image: 'u' }
    const snapshot = { ...input }
    resolveVideoVendorRoute('minimax', input)
    resolveVideoVendorRoute('agnes', input)
    expect(input).toEqual(snapshot)
  })
})

/**
 * 图像侧与视频侧同型缺陷(vendor 未登记 ⇒ 静默落到默认厂商兜底),
 * 故同样逐厂商钉 path,并单独钉 agnes 的两条硬约束:n>1 拒绝、产出在 raw.data 里。
 */
describe('POST /v1/images/generations 的 vendor → 内部路由链', () => {
  const SEED = { prompt: 'p', model: 'm' }

  it.each([
    ['dashscope', '/api/ai/dashscope/image'],
    ['doubao', '/api/ai/doubao/image'],
    ['gemini', '/api/ai/gemini/image'],
    ['recraft', '/api/ai/recraft/generate'],
    ['agnes', '/api/ai/agnes/image'],
  ])('%s ⇒ %s', (vendor, path) => {
    expect(resolveImageVendorRoute(vendor, SEED).path).toBe(path)
  })

  it('agnes 不再静默落 tongyi(同型缺陷反证)', () => {
    expect(resolveImageVendorRoute('agnes', SEED).path).not.toBe(
      '/api/ai-image/tongyi/text-to-image',
    )
  })

  it('未登记 vendor 与缺省都落 tongyi 兜底;vendor 大小写与两侧空白不敏感', () => {
    expect(resolveImageVendorRoute('nobody', SEED).path).toBe('/api/ai-image/tongyi/text-to-image')
    expect(resolveImageVendorRoute(undefined, SEED).path).toBe('/api/ai-image/tongyi/text-to-image')
    expect(resolveImageVendorRoute('AGNES', SEED).path).toBe('/api/ai/agnes/image')
    expect(resolveImageVendorRoute(' agnes ', SEED).path).toBe('/api/ai/agnes/image')
  })

  it('agnes 的 n>1 必须显式拒绝:上游对本账号 n>1 直接 429,静默截断=按 n 计费只出 1 张', () => {
    const r = resolveImageVendorRoute('agnes', { ...SEED, n: 3 })
    expect(r.reject).toBeTruthy()
    expect(r.path).toBe('')
    // 阳性对照:其余厂商不受影响(n 原样透传)
    expect(resolveImageVendorRoute('tongyi', { ...SEED, n: 3 }).reject).toBeUndefined()
    expect(resolveImageVendorRoute('tongyi', { ...SEED, n: 3 }).body.n).toBe(3)
  })

  it('agnes 的 n=1 与缺省都按一张发;既有五家的 body 逐字不变', () => {
    expect(resolveImageVendorRoute('agnes', { ...SEED, n: 1 }).body.n).toBe(1)
    expect(resolveImageVendorRoute('agnes', SEED).body.n).toBe(1)
    expect(resolveImageVendorRoute('dashscope', { ...SEED, n: 2, size: '1024x1024' }).body).toEqual(
      {
        prompt: 'p',
        model: 'm',
        size: '1024x1024',
      },
    )
    expect(resolveImageVendorRoute('gemini', SEED).body).toEqual({ prompt: 'p', model: 'm' })
    expect(resolveImageVendorRoute('tongyi', { ...SEED, n: 2 }).body).toEqual({
      prompt: 'p',
      model: 'm',
      n: 2,
      size: undefined,
    })
  })
})

describe('extractSyncImages(同步出图取图数组)', () => {
  it('既有形态 images / data 原样取', () => {
    expect(extractSyncImages('tongyi', { images: [{ url: 'a' }] })).toEqual([{ url: 'a' }])
    expect(extractSyncImages('tongyi', { data: [{ url: 'b' }] })).toEqual([{ url: 'b' }])
  })

  it('agnes 形态:图在 raw.data 里,不取则「已出图但回不出地址」', () => {
    const payload = { taskId: 't1', status: 'succeeded', raw: { data: [{ url: 'c' }] } }
    expect(extractSyncImages('agnes', payload)).toEqual([{ url: 'c' }])
  })

  it('只对 agnes 认 raw 形态:别家的 {raw:…} 不许被当产出(否则会凭空多计张数)', () => {
    expect(extractSyncImages('tongyi', { raw: { data: [{ url: 'd' }] } })).toBeNull()
  })

  it('空 / 非数组 ⇒ null(交给异步路径,不误判已出图)', () => {
    expect(extractSyncImages('agnes', {})).toBeNull()
    expect(extractSyncImages('agnes', { raw: {} })).toBeNull()
    expect(extractSyncImages('agnes', null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
