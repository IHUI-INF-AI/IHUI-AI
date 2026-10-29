// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/platform.tsx —— RN 第三方原生模块在小程序端的等价实现(剪贴板/选图/存图/安全区)。
 *
 * 这些都是"能力名不同、语义相同"的一对一映射,不引入任何新机制:
 *  Clipboard → Taro.setClipboardData;expo-image-picker → Taro.chooseImage/chooseMedia;
 *  expo-media-library → Taro.saveImageToPhotosAlbum/saveVideoToPhotosAlbum;
 *  react-native-safe-area-context → 端内导航栏已让位,直接透传容器。
 */
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'

import { View } from './primitives'

export const Clipboard = {
  getString: async (): Promise<string> => {
    try {
      const res = await Taro.getClipboardData()
      return String(res.data ?? '')
    } catch {
      return ''
    }
  },
  setString: async (value: string): Promise<void> => {
    await Taro.setClipboardData({ data: String(value) })
  },
  /** RN 新版本才有的异步档:与同步档同实现(小程序剪贴板只有一条通道) */
  copy: async (value: string): Promise<void> => Clipboard.setString(value),
  peek: async (): Promise<boolean> => false,
}

export const ImagePicker = {
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestCameraPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  launchImageLibraryAsync: async (options: Record<string, unknown> = {}) => {
    const count = Number(options.selectionLimit ?? 1)
    try {
      const res = await Taro.chooseImage({ count })
      const uris = (res.tempFilePaths ?? []) as string[]
      return { canceled: uris.length === 0, assets: uris.map((uri) => ({ uri })) }
    } catch {
      return { canceled: true, assets: [] }
    }
  },
  launchCameraAsync: async (options: Record<string, unknown> = {}) => {
    try {
      const res = await Taro.chooseImage({
        count: Number(options.selectionLimit ?? 1),
        sourceType: ['camera'],
      })
      const uris = (res.tempFilePaths ?? []) as string[]
      return { canceled: uris.length === 0, assets: uris.map((uri) => ({ uri })) }
    } catch {
      return { canceled: true, assets: [] }
    }
  },
  MediaType: { Images: 'images', Videos: 'videos', Unknown: 'unknown' },
  ImageQuality: { Lowest: 0.3, Low: 0.5, Medium: 0.7, High: 0.8, Max: 1 },
}

export const MediaLibrary = {
  requestPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  getAsync: async () => ({ totalCount: 0, assets: [] }),
  createAssetAsync: async (uri: string): Promise<void> => {
    if (/\.(mp4|mov|m4v)$/i.test(uri)) await Taro.saveVideoToPhotosAlbum({ filePath: uri })
    else await Taro.saveImageToPhotosAlbum({ filePath: uri })
  },
  saveToPhotosAsync: async (uris: string[]): Promise<void> => {
    for (const uri of uris) await MediaLibrary.createAssetAsync(uri)
  },
  deleteAssetsAsync: async (_ids: string[]): Promise<void> => {},
}

export function SafeAreaView({
  children,
  style,
}: {
  children?: ReactNode
  style?: Record<string, unknown>
}) {
  // 顶距唯一挂点仍是端内 ThemeRoot/自定义导航(AGENTS §4 状态栏避让单一源头),这里只做容器透传
  return <View style={style}>{children}</View>
}

export function KeyboardAvoidingViewCompat({ children }: { children?: ReactNode }) {
  return <View>{children}</View>
}

export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 })
export const SafeAreaProvider = ({ children }: { children?: ReactNode }) => <>{children}</>
export const useSafeAreaFrame = () => {
  const info = Taro.getSystemInfoSync()
  return { x: 0, y: 0, width: info.windowWidth, height: info.windowHeight }
}

/**
 * 下面这段是**包级出口**:`import * as ImagePicker from 'expo-image-picker'` 这类命名空间导入
 * 拿到的是"这个模块本身",而不是名为 ImagePicker 的那个导出 —— 所以四个能力包共用一个文件时,
 * 每个包的 API 必须同时以顶层名字存在一份(缺了就是运行期 undefined,而构建照样绿)。
 */
export const setString = Clipboard.setString
export const getString = Clipboard.getString
export const copy = Clipboard.copy
export const peek = Clipboard.peek

export const launchImageLibraryAsync = ImagePicker.launchImageLibraryAsync
export const launchCameraAsync = ImagePicker.launchCameraAsync
export const requestMediaLibraryPermissionsAsync = ImagePicker.requestMediaLibraryPermissionsAsync
export const requestCameraPermissionsAsync = ImagePicker.requestCameraPermissionsAsync
export const MediaType = ImagePicker.MediaType
export const ImageQuality = ImagePicker.ImageQuality

export const requestPermissionsAsync = MediaLibrary.requestPermissionsAsync
export const getAsync = MediaLibrary.getAsync
export const createAssetAsync = MediaLibrary.createAssetAsync
export const saveToPhotosAsync = MediaLibrary.saveToPhotosAsync
export const deleteAssetsAsync = MediaLibrary.deleteAssetsAsync

export default {
  Clipboard,
  ImagePicker,
  MediaLibrary,
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
  useSafeAreaFrame,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
