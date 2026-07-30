/**
 * 跨端 image 辅助工具测试(2026-07-30 立)
 *
 * 覆盖范围:
 * 1. inferTypeFromMime:mime 前缀推断 + fallback
 * 2. buildFileFromAsset:AssetLike 归一化 + id 生成 + type 推断
 * 3. buildFileName:文件名模板 + 扩展名兜底
 * 4. toBase64DataUrl:mime 拼接 + 扩展名自动转 mime
 * 5. joinUrl:绝对 URL 原样 + 相对路径拼接 + 边界
 * 6. isLocalUrl:本地 scheme 识别
 * 7. fitThumbnailSize:等比缩放 + 边界值
 */
import { describe, it, expect } from 'vitest'
import {
  inferTypeFromMime,
  buildFileFromAsset,
  buildFileName,
  toBase64DataUrl,
  joinUrl,
  isLocalUrl,
  fitThumbnailSize,
  type AssetLike,
} from '../../src/utils/image-helpers'

describe('inferTypeFromMime', () => {
  it('image/* → image', () => {
    expect(inferTypeFromMime('image/jpeg', 'document')).toBe('image')
    expect(inferTypeFromMime('image/png', 'document')).toBe('image')
    expect(inferTypeFromMime('image/webp', 'document')).toBe('image')
    expect(inferTypeFromMime('IMAGE/GIF', 'document')).toBe('image') // 大小写不敏感
  })

  it('video/* → video', () => {
    expect(inferTypeFromMime('video/mp4', 'image')).toBe('video')
    expect(inferTypeFromMime('video/quicktime', 'image')).toBe('video')
  })

  it('audio/* → audio', () => {
    expect(inferTypeFromMime('audio/mpeg', 'image')).toBe('audio')
    expect(inferTypeFromMime('audio/wav', 'image')).toBe('audio')
  })

  it('application/* → fallback', () => {
    expect(inferTypeFromMime('application/pdf', 'document')).toBe('document')
    expect(inferTypeFromMime('application/json', 'image')).toBe('image')
  })

  it('null/undefined/空 → fallback', () => {
    expect(inferTypeFromMime(null, 'image')).toBe('image')
    expect(inferTypeFromMime(undefined, 'video')).toBe('video')
    expect(inferTypeFromMime('', 'document')).toBe('document')
  })

  it('fallback 只接受合法 FileType', () => {
    // 任何非已知类型都走 fallback,即使 fallback 不在标准列表
    expect(
      inferTypeFromMime('unknown/x', 'document' as 'image' | 'video' | 'document' | 'audio'),
    ).toBe('document')
  })
})

describe('buildFileFromAsset', () => {
  it('从 AssetLike 构造 FileLike:url/type/mimeType 正确', () => {
    const asset: AssetLike = {
      uri: 'file:///tmp/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    }
    const file = buildFileFromAsset(asset, 'image')
    expect(file.url).toBe('file:///tmp/photo.jpg')
    expect(file.filename).toBe('photo.jpg')
    expect(file.type).toBe('image')
    expect(file.mimeType).toBe('image/jpeg')
    expect(file.id).toMatch(/^file-\d+-\d+$/)
  })

  it('asset.type 优先于 mime 推断', () => {
    const asset: AssetLike = { uri: 'x', type: 'video', mimeType: 'image/jpeg' }
    expect(buildFileFromAsset(asset, 'image').type).toBe('video')
  })

  it('mimeType 优先于 fallback(当 type 缺失时)', () => {
    const asset: AssetLike = { uri: 'x', mimeType: 'video/mp4' }
    expect(buildFileFromAsset(asset, 'image').type).toBe('video')
  })

  it('无 mimeType 也无 type 时用 fallback', () => {
    const asset: AssetLike = { uri: 'x' }
    expect(buildFileFromAsset(asset, 'document').type).toBe('document')
  })

  it('asset 无 fileName 时 filename 字段为 undefined(可选字段)', () => {
    const file = buildFileFromAsset({ uri: 'x' }, 'image')
    expect(file.filename).toBeUndefined()
  })

  it('asset.fileSize 透传', () => {
    const file = buildFileFromAsset({ uri: 'x', fileSize: 1024 }, 'image')
    expect(file.size).toBe(1024)
  })

  it('id 全局递增(单测内连续调用)', async () => {
    const a = buildFileFromAsset({ uri: 'x' }, 'image')
    await new Promise((r) => setTimeout(r, 2))
    const b = buildFileFromAsset({ uri: 'y' }, 'image')
    expect(a.id).not.toBe(b.id)
  })
})

describe('buildFileName', () => {
  it('生成 img_时间戳_索引.扩展名 格式', () => {
    const name = buildFileName('img', '/tmp/photo.jpg', 0)
    expect(name).toMatch(/^img_\d+_0\.jpg$/)
  })

  it('无扩展名时 getExt 默认返回 jpg', () => {
    const name = buildFileName('img', 'unknown', 3)
    expect(name).toMatch(/^img_\d+_3\.jpg$/) // file-helpers 的 getExt 对无扩展名 fallback 'jpg'
  })

  it('空 prefix 时返回简版(无扩展名时)', () => {
    const name = buildFileName('', 'unknown', 0)
    expect(name).toMatch(/^img_\d+_0\.jpg$/)
  })

  it('带 ?query 的 URL 也能正确取扩展名', () => {
    const name = buildFileName('img', '/api/file.png?v=1', 0)
    expect(name).toMatch(/^img_\d+_0\.png$/)
  })
})

describe('toBase64DataUrl', () => {
  it('传入完整 mime,生成 data: URL', () => {
    expect(toBase64DataUrl('abc', 'image/jpeg')).toBe('data:image/jpeg;base64,abc')
    expect(toBase64DataUrl('xyz', 'image/png')).toBe('data:image/png;base64,xyz')
  })

  it('传入扩展名时自动转 mime(jpg→jpeg)', () => {
    expect(toBase64DataUrl('abc', 'jpg')).toBe('data:image/jpeg;base64,abc')
    expect(toBase64DataUrl('abc', 'png')).toBe('data:image/png;base64,abc')
    expect(toBase64DataUrl('abc', 'webp')).toBe('data:image/webp;base64,abc')
  })

  it('空 base64 也正确拼接', () => {
    expect(toBase64DataUrl('', 'image/jpeg')).toBe('data:image/jpeg;base64,')
  })
})

describe('joinUrl', () => {
  it('绝对 http URL 原样返回', () => {
    expect(joinUrl('https://api.example.com', 'https://cdn.example.com/img.png')).toBe(
      'https://cdn.example.com/img.png',
    )
  })

  it('https URL 原样返回', () => {
    expect(joinUrl('https://api.example.com', 'https://other.com/img.png')).toBe(
      'https://other.com/img.png',
    )
  })

  it('file: 本地路径原样返回', () => {
    expect(joinUrl('https://api.example.com', 'file:///tmp/photo.jpg')).toBe(
      'file:///tmp/photo.jpg',
    )
  })

  it('wxfile: 小程序本地路径原样返回', () => {
    expect(joinUrl('https://api.example.com', 'wxfile://tmp/photo.jpg')).toBe(
      'wxfile://tmp/photo.jpg',
    )
  })

  it('data: URL 原样返回', () => {
    expect(joinUrl('https://api.example.com', 'data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    )
  })

  it('相对路径(无 /)追加 baseUrl', () => {
    expect(joinUrl('https://api.example.com', 'img.png')).toBe('https://api.example.com/img.png')
  })

  it('相对路径(带 /)拼接 baseUrl + path', () => {
    expect(joinUrl('https://api.example.com', '/img.png')).toBe('https://api.example.com/img.png')
  })

  it('baseUrl 末尾 / 不会双斜杠', () => {
    expect(joinUrl('https://api.example.com/', 'img.png')).toBe('https://api.example.com/img.png')
    expect(joinUrl('https://api.example.com/', '/img.png')).toBe('https://api.example.com/img.png')
  })

  it('空 baseUrl + 相对路径 = 原路径', () => {
    expect(joinUrl('', 'img.png')).toBe('img.png')
  })

  it('空 path = baseUrl', () => {
    expect(joinUrl('https://api.example.com', '')).toBe('https://api.example.com')
  })
})

describe('isLocalUrl', () => {
  it('file: 是本地', () => {
    expect(isLocalUrl('file:///tmp/x')).toBe(true)
  })

  it('wxfile: 是本地', () => {
    expect(isLocalUrl('wxfile://tmp/x')).toBe(true)
  })

  it('ph: 是本地(RN 相册 scheme)', () => {
    expect(isLocalUrl('ph://tmp/x')).toBe(true)
  })

  it('blob: 是本地', () => {
    expect(isLocalUrl('blob:https://x/abc')).toBe(true)
  })

  it('http/https 不是本地', () => {
    expect(isLocalUrl('https://cdn.example.com/x.png')).toBe(false)
    expect(isLocalUrl('http://example.com/x')).toBe(false)
  })

  it('data: 不是本地', () => {
    expect(isLocalUrl('data:image/png;base64,abc')).toBe(false)
  })

  it('纯相对路径视为本地', () => {
    expect(isLocalUrl('img.png')).toBe(true)
    expect(isLocalUrl('/static/img.png')).toBe(true)
  })

  it('空字符串不是本地', () => {
    expect(isLocalUrl('')).toBe(false)
  })
})

describe('fitThumbnailSize', () => {
  it('原图已经够小时,返回原尺寸', () => {
    expect(fitThumbnailSize(100, 50, 200)).toEqual({ width: 100, height: 50 })
  })

  it('原图宽度超长时,等比缩放', () => {
    expect(fitThumbnailSize(400, 200, 200)).toEqual({ width: 200, height: 100 })
  })

  it('原图高度超长时,等比缩放', () => {
    expect(fitThumbnailSize(200, 400, 200)).toEqual({ width: 100, height: 200 })
  })

  it('原图等于 maxSide 时,不变', () => {
    expect(fitThumbnailSize(200, 100, 200)).toEqual({ width: 200, height: 100 })
  })

  it('maxSide 为 0 时返回原尺寸', () => {
    expect(fitThumbnailSize(400, 200, 0)).toEqual({ width: 400, height: 200 })
  })

  it('原图宽/高为 0 时返回 0', () => {
    expect(fitThumbnailSize(0, 100, 50)).toEqual({ width: 0, height: 0 })
    expect(fitThumbnailSize(100, 0, 50)).toEqual({ width: 0, height: 0 })
  })

  it('原图宽/高为负数时返回 0', () => {
    expect(fitThumbnailSize(-10, 100, 50)).toEqual({ width: 0, height: 0 })
  })

  it('正方形图片 1:1 缩放', () => {
    expect(fitThumbnailSize(500, 500, 100)).toEqual({ width: 100, height: 100 })
  })
})
