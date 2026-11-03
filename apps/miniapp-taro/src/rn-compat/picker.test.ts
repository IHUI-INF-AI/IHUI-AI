// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/platform.tsx 的 ImagePicker 验收。
 *
 * 迁移前选图结果只有 `{ uri }`,共享层(image-helpers / 上传链路)读 name/mimeType/size
 * 全是 undefined。本文件锁三件事:
 *  · 能从临时路径与 tempFiles 推出的(name/mimeType/size)必须推;
 *  · 推不出时给文件头写明的确定默认值(mime=image/jpeg、size=0、name=image.<ext>),不是缺席;
 *  · 取消/宿主抛错仍返回 `{ canceled: true, assets: [] }`,调用方拿不到 undefined。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => ({
  chooseImage: vi.fn(),
  getSystemInfoSync: vi.fn(() => ({
    windowWidth: 375,
    windowHeight: 667,
    pixelRatio: 2,
    screenHeight: 667,
    safeArea: { bottom: 667 },
  })),
}))

vi.mock('@tarojs/taro', () => ({ default: taro }))
vi.mock('@tarojs/components', () => ({
  View: () => null,
  Text: () => null,
  ScrollView: () => null,
  Image: () => null,
  Input: () => null,
  Switch: () => null,
  Textarea: () => null,
}))

import { ImagePicker } from './platform'

beforeEach(() => {
  taro.chooseImage.mockReset()
})

describe('ImagePicker 资产字段', () => {
  it('相册选图:name/mimeType/size 从临时文件推,并带 RN 同义键 fileName/fileSize', async () => {
    taro.chooseImage.mockResolvedValueOnce({
      tempFilePaths: ['http://tmp/wx_photo_001.png?x=1'],
      tempFiles: [{ path: 'http://tmp/wx_photo_001.png', size: 2048 }],
    })
    const res = await ImagePicker.launchImageLibraryAsync({ selectionLimit: 2 })
    expect(taro.chooseImage).toHaveBeenCalledWith({ count: 2 })
    expect(res.canceled).toBe(false)
    expect(res.assets).toEqual([
      {
        // uri 保持宿主原值(带 query 也能直接上传/预览),文件名与 mime 才剥 query
        uri: 'http://tmp/wx_photo_001.png?x=1',
        name: 'wx_photo_001.png',
        fileName: 'wx_photo_001.png',
        mimeType: 'image/png',
        size: 2048,
        fileSize: 2048,
      },
    ])
  })

  it('宿主不返回 tempFiles ⇒ size 落 0(未知),mimeType 仍按扩展名推', async () => {
    taro.chooseImage.mockResolvedValueOnce({
      tempFilePaths: ['wxfile://tmp/photo.jpg'],
    })
    const res = await ImagePicker.launchImageLibraryAsync()
    expect(res.canceled).toBe(false)
    expect(res.assets).toHaveLength(1)
    expect(res.assets[0]?.mimeType).toBe('image/jpeg')
    expect(res.assets[0]?.name).toBe('photo.jpg')
    expect(res.assets[0]?.size).toBe(0)
    expect(res.assets[0]?.fileSize).toBe(0)
  })

  it('mime 推不出 ⇒ image/jpeg;路径末段为空 ⇒ name 用 image.jpg 兜底', async () => {
    taro.chooseImage.mockResolvedValueOnce({
      tempFilePaths: ['http://tmp/'],
      tempFiles: [{ path: 'http://tmp/', size: -1 }],
    })
    const res = await ImagePicker.launchImageLibraryAsync()
    expect(res.assets).toHaveLength(1)
    expect(res.assets[0]?.mimeType).toBe('image/jpeg')
    expect(res.assets[0]?.name).toBe('image.jpg')
    // 负数是宿主异常值,按「未知」落 0,不把 -1 传给体积校验
    expect(res.assets[0]?.size).toBe(0)
  })

  it('拍照走 camera 通道并同样补齐字段;取消返回空资产', async () => {
    taro.chooseImage.mockResolvedValueOnce({
      tempFilePaths: ['http://tmp/camera_shot.jpg'],
      tempFiles: [{ path: 'http://tmp/camera_shot.jpg', size: 1024 }],
    })
    const shot = await ImagePicker.launchCameraAsync()
    expect(taro.chooseImage).toHaveBeenCalledWith({ count: 1, sourceType: ['camera'] })
    expect(shot.assets[0]).toMatchObject({
      name: 'camera_shot.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    })

    taro.chooseImage.mockResolvedValueOnce({ tempFilePaths: [] })
    const canceled = await ImagePicker.launchCameraAsync()
    expect(canceled).toEqual({ canceled: true, assets: [] })
  })

  it('宿主抛错 ⇒ 取消态,不抛给调用方', async () => {
    taro.chooseImage.mockRejectedValueOnce(new Error('permission denied'))
    const res = await ImagePicker.launchImageLibraryAsync()
    expect(res).toEqual({ canceled: true, assets: [] })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
