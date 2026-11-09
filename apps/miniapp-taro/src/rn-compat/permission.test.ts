// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-050:图片/相机权限不得硬编码 granted。
 * 旧实现恒返回 `{ granted: true, status: 'granted' }`,权限被拒也当成已授权,
 * 调用方随后静默失败。改后:相机权限读 Taro.getSetting().authSetting['scope.camera'];
 * 相册读取在小程序没有独立 scope,如实返回 undetermined,不冒充 granted。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const taro = vi.hoisted(() => ({
  chooseImage: vi.fn(),
  getSetting: vi.fn(),
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
  taro.getSetting.mockReset()
})

describe('XUI-050 权限状态如实反映 authSetting', () => {
  it('scope.camera=true → granted / granted', async () => {
    taro.getSetting.mockResolvedValueOnce({ authSetting: { 'scope.camera': true } })
    await expect(ImagePicker.requestCameraPermissionsAsync()).resolves.toEqual({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    })
  })

  it('scope.camera=false → denied,不得再回 granted', async () => {
    taro.getSetting.mockResolvedValueOnce({ authSetting: { 'scope.camera': false } })
    const res = await ImagePicker.requestCameraPermissionsAsync()
    expect(res.granted).toBe(false)
    expect(res.status).toBe('denied')
    expect(res.canAskAgain).toBe(false)
  })

  it('未询问过 → undetermined,不得冒充已授权', async () => {
    taro.getSetting.mockResolvedValueOnce({ authSetting: {} })
    const res = await ImagePicker.requestCameraPermissionsAsync()
    expect(res.granted).toBe(false)
    expect(res.status).toBe('undetermined')
  })

  it('相册读取无独立 scope → undetermined(不再恒 granted:true)', async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync()
    expect(res.granted).toBe(false)
    expect(res.status).toBe('undetermined')
    expect(res.canAskAgain).toBe(true)
  })

  it('getSetting 抛错时按未判定处理,不假装成功', async () => {
    taro.getSetting.mockRejectedValueOnce(new Error('boom'))
    const res = await ImagePicker.requestCameraPermissionsAsync()
    expect(res.granted).toBe(false)
    expect(res.status).toBe('undetermined')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
