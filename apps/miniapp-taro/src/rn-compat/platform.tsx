// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/platform.tsx —— RN 第三方原生模块在小程序端的等价实现(剪贴板/选图/存图/安全区)。
 *
 * 这些都是"能力名不同、语义相同"的一对一映射,不引入任何新机制:
 *  Clipboard → Taro.setClipboardData;expo-image-picker → Taro.chooseImage/chooseMedia;
 *  expo-media-library → Taro.saveImageToPhotosAlbum/saveVideoToPhotosAlbum;
 *  react-native-safe-area-context → 端内导航栏已让位,直接透传容器;
 *  expo-blur → 小程序无原生高斯模糊:BlurTargetView 透传容器,BlurView 用 opacity 承载「变淡」这一可见语义。
 */
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { View } from './primitives'
import { flattenStyle } from './style'

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

/**
 * 临时文件 → expo-image-picker 资产形态。
 *
 * RN 调用方拿到的 asset 不只有 `uri`:共享层 packages/shared/src/utils/image-helpers.ts
 * 直接读 `mimeType` / `fileName` / `fileSize`,上传链路还要 `name` / `size` 做兜底。
 * 小程序侧能推的只有「临时路径末段 + tempFiles[i].size」这两项,逐项口径如下:
 *  · `name` / `fileName`:临时路径末段(微信 tempFilePath 形如 `http://tmp/wx_photo_001.jpg`,
 *    末段就是宿主给的临时文件名)。末段为空时按 mime 拼 `image.<ext>` 兜底;两者同值,
 *    `fileName` 是 RN expo 的同义键 —— 只补 name 会让共享层继续拿 undefined。
 *  · `mimeType`:h5 的 `tempFiles[i].type` 优先(微信小程序端该字段不返回),然后按扩展名映射;
 *    都推不出时按 `image/jpeg` —— 微信 chooseImage 压缩档统一产 jpg,这是唯一确定默认值。
 *  · `size` / `fileSize`:`tempFiles[i].size` 是字节数;宿主不返回时给 0 表示「未知」,
 *    不猜一个非零值(猜大猜小都会让上传前的体积校验误判)。同样两键同值。
 */
interface TempFileMeta {
  path?: string
  size?: number
  type?: string
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
}

const DEFAULT_IMAGE_MIME = 'image/jpeg'

/** 去掉 query/hash 后取路径末段(临时路径可能带 `?` 参数,不先剥会把参数算进文件名) */
function baseNameOf(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? ''
  const segments = clean.split(/[\\/]/)
  return segments[segments.length - 1] ?? ''
}

function mimeTypeOf(path: string, declared: string | undefined): string {
  if (declared && declared.includes('/')) return declared
  const ext = (/\.([a-z0-9]+)$/i.exec(path.split(/[?#]/)[0] ?? '')?.[1] ?? '').toLowerCase()
  return MIME_BY_EXT[ext] ?? DEFAULT_IMAGE_MIME
}

function toPickerAsset(uri: string, tempFiles: readonly TempFileMeta[], index: number) {
  const meta = tempFiles[index]
  const mimeType = mimeTypeOf(uri, typeof meta?.type === 'string' ? meta.type : undefined)
  const rawName = baseNameOf(uri)
  const name = rawName || `image${EXT_BY_MIME[mimeType] ?? '.jpg'}`
  const rawSize = meta?.size
  const size = typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : 0
  return { uri, name, fileName: name, mimeType, size, fileSize: size }
}

export const ImagePicker = {
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  requestCameraPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  launchImageLibraryAsync: async (options: Record<string, unknown> = {}) => {
    const count = Number(options.selectionLimit ?? 1)
    try {
      const res = await Taro.chooseImage({ count })
      const uris = (res.tempFilePaths ?? []) as string[]
      const tempFiles = Array.isArray(res.tempFiles) ? (res.tempFiles as TempFileMeta[]) : []
      return {
        canceled: uris.length === 0,
        assets: uris.map((uri, index) => toPickerAsset(uri, tempFiles, index)),
      }
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
      const tempFiles = Array.isArray(res.tempFiles) ? (res.tempFiles as TempFileMeta[]) : []
      return {
        canceled: uris.length === 0,
        assets: uris.map((uri, index) => toPickerAsset(uri, tempFiles, index)),
      }
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

export interface SafeAreaInsets {
  top: number
  bottom: number
  left: number
  right: number
}

export type SafeAreaEdge = 'top' | 'right' | 'bottom' | 'left'

interface SafeAreaSystemInfo {
  screenHeight?: number
  /** 支付宝基础库在 Android 上 screenHeight 取值有误,官方要求优先读 screen.height */
  screen?: { height?: number }
  windowHeight?: number
  safeArea?: { top?: number; bottom?: number; left?: number; right?: number }
}

/**
 * 取不到底部安全区时的**显式**回落值(不是"顺手写 0")。
 *
 * 语义:0 =「本宿主没有给出底部缺口」,不是「缺口一定为零」。小程序侧没有第二个可推的底部
 * 口径(顶部有胶囊按钮/statusBarHeight 可量,底部没有对应 API),猜 34 会在无 Home Indicator
 * 的安卓机上凭空多出一条留白,所以唯一可辩护的常量是 0。该值只在系统信息缺失/旧基础库命中,
 * 正常路径走 screen.height - safeArea.bottom。
 */
const SAFE_AREA_BOTTOM_FALLBACK_PX = 0

/**
 * 系统信息 → 安全区。
 * 只把 **bottom** 当真实缺口:小程序页内容区从原生导航栏下方开始,顶部/左右再补一次就是双份
 * (顶距唯一挂点仍是端内 ThemeRoot/自定义导航,AGENTS §4)。`safeArea.bottom` 是「安全区下沿到
 * 屏幕顶」的距离,缺口 = 屏幕高 - safeArea.bottom。
 * 屏幕高优先取 `screen.height`(支付宝 Android 明确说 screenHeight 有误,见类型注释),
 * 其次 `screenHeight`(微信/旧基础库的既有字段),两者都没有才落显式回落常量。
 * 这条边界登记为允许差异(top/left/right 恒 0)。
 */
export function computeSafeAreaInsets(info: SafeAreaSystemInfo | null | undefined): SafeAreaInsets {
  const screenHeight =
    typeof info?.screen?.height === 'number'
      ? info.screen.height
      : typeof info?.screenHeight === 'number'
        ? info.screenHeight
        : 0
  const safeBottom = info?.safeArea?.bottom
  const bottom =
    screenHeight > 0 && typeof safeBottom === 'number' && Number.isFinite(safeBottom)
      ? Math.max(0, screenHeight - safeBottom)
      : SAFE_AREA_BOTTOM_FALLBACK_PX
  return { top: 0, bottom, left: 0, right: 0 }
}

let cachedInsets: SafeAreaInsets | null = null

/**
 * 读系统信息:优先 `getWindowInfo`(微信 2.20+ 的新口径,只返回窗口/安全区,字段更稳),
 * 宿主没有该 API(支付宝/旧基础库)时退回 `getSystemInfoSync`。两者都抛才判「读不到」。
 */
function readSystemInfo(): SafeAreaSystemInfo | null {
  try {
    if (typeof Taro.getWindowInfo === 'function') {
      const info = Taro.getWindowInfo()
      if (info) return info as SafeAreaSystemInfo
    }
    return Taro.getSystemInfoSync() as SafeAreaSystemInfo
  } catch {
    return null
  }
}

function readSafeAreaInsets(): SafeAreaInsets {
  if (cachedInsets) return cachedInsets
  cachedInsets = computeSafeAreaInsets(readSystemInfo())
  return cachedInsets
}

const insetsListeners = new Set<() => void>()
let windowResizeBound = false

function handleWindowResize(): void {
  // 旋转/分屏会改 screenHeight:丢掉快照再重算,值没变就不惊动订阅者
  const previous = cachedInsets
  cachedInsets = null
  const next = readSafeAreaInsets()
  if (previous && previous.bottom === next.bottom && previous.top === next.top) return
  insetsListeners.forEach((listener) => listener())
}

const PADDING_BLOCKERS: Record<SafeAreaEdge, readonly string[]> = {
  top: ['paddingTop', 'paddingVertical', 'padding'],
  right: ['paddingRight', 'paddingHorizontal', 'padding'],
  bottom: ['paddingBottom', 'paddingVertical', 'padding'],
  left: ['paddingLeft', 'paddingHorizontal', 'padding'],
}

const PADDING_KEYS: Record<SafeAreaEdge, string> = {
  top: 'paddingTop',
  right: 'paddingRight',
  bottom: 'paddingBottom',
  left: 'paddingLeft',
}

/**
 * 给样式补安全区 padding:调用方**显式**给过该方向的 padding 就不动它(否则双份留白)。
 * 值为 0 的边不落键,避免把 `paddingBottom: 0` 写进内联样式盖掉调用方的 class。
 */
export function applySafeAreaPadding(
  style: unknown,
  edges: readonly SafeAreaEdge[],
  insets: SafeAreaInsets,
): Record<string, unknown> {
  const flat = flattenStyle(style)
  const out: Record<string, unknown> = { ...flat }
  for (const edge of edges) {
    const value = insets[edge]
    if (!value || value <= 0) continue
    const blocked = PADDING_BLOCKERS[edge].some(
      (key) => flat[key] !== undefined && flat[key] !== null,
    )
    if (blocked) continue
    out[PADDING_KEYS[edge]] = value
  }
  return out
}

export function SafeAreaView({
  children,
  style,
  edges = ['bottom'],
}: {
  children?: ReactNode
  style?: Record<string, unknown>
  /** 默认只补 bottom:小程序页内容区已避开状态栏,补 top 会双份 */
  edges?: readonly SafeAreaEdge[]
}) {
  const insets = useSafeAreaInsets()
  return <View style={applySafeAreaPadding(style, edges, insets)}>{children}</View>
}

export function KeyboardAvoidingViewCompat({ children }: { children?: ReactNode }) {
  return <View>{children}</View>
}

/**
 * `expo-blur` 的小程序等价实现(2026-10-30 立,现读构建红根因)。
 *
 * 为什么必须有这组出口:壳复用腿把 `apps/mobile-rn/src/screens/*` 纳入小程序编译面,其中
 * Home/Course/Live/News/Plaza 五屏 `import { BlurTargetView } from 'expo-blur'`。端内没有替身时
 * webpack 去解析 expo-blur 真身 ⇒ 它经 `expo-modules-core` 拿到 SDK 57 的未编译 TS 源
 * (`main: src/index.ts`)⇒ 落进"无 loader"当场 `ModuleParseError: Unexpected token (5:7)`,整轮产物出不来。
 *
 * 语义降级如实登记(不是空壳糊弄):
 *  · BlurTargetView 在 RN 侧是"被 TabBar 采样做动态模糊的目标区",本身无视觉 ⇒ 这里透传容器,
 *    ref 收下不使用(小程序没有可采样的原生模糊层,拿不到也无需拿)。
 *  · BlurView 的 `intensity` 是无高斯模糊原语时唯一可折算的量:强度越大越不透明,与 RN 观感同向;
 *    用 opacity 而不是硬编 rgba,避免在端内自立一档颜色(AGENTS §4 色档单一源头)。
 *
 * 2026-11-02 复核「能否用真实模糊」——结论是**不能**,因此保持 opacity 替身,不假装支持:
 *  · `backdrop-filter: blur()` 微信小程序端只在部分 iOS 客户端生效,Android 宿主(X5/系统 WebView)
 *    普遍不支持;一旦宿主不支持,样式被静默忽略 ⇒ 玻璃层变成全透明(比替身更糟,且无法探测)。
 *  · `filter: blur()` 模糊的是元素自身及其子内容,不是背后内容 —— 语义与 BlurView 相反,
 *    会把子级文字一起糊掉,不能拿来替代。
 *  · RN 侧的 `tint` / `blurMethod` / `blurTarget`(动态采样)在小程序没有对应原语,本层只收不用。
 *  · 替换后的可见语义只有「变淡」:不能模糊背后内容、不能跟随背景变化、tint 无效。
 *    依赖真实玻璃质感的屏(首页/课程/直播/资讯/广场 TabBar)在小程序端是**登记差异**,不是等价实现。
 */
export function BlurTargetView({
  children,
  style,
  ref: _ref,
}: {
  children?: ReactNode
  style?: Record<string, unknown>
  ref?: unknown
}) {
  return <View style={style}>{children}</View>
}

export function BlurView({
  children,
  style,
  intensity = 80,
  tint: _tint = 'light',
}: {
  children?: ReactNode
  style?: Record<string, unknown>
  intensity?: number
  tint?: 'light' | 'dark' | 'extra-light' | 'default' | 'systemChromeMaterial'
}) {
  const alpha = Math.min(1, Math.max(0, intensity / 100))
  // 展平后再叠 opacity:style 可能是 RN 的数组/嵌套数组形态,直接展开会把 0/1 数字键写进样式
  return <View style={{ ...flattenStyle(style), opacity: alpha }}>{children}</View>
}

export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(readSafeAreaInsets)

  useEffect(() => {
    const listener = () => setInsets(readSafeAreaInsets())
    insetsListeners.add(listener)
    if (!windowResizeBound && typeof Taro.onWindowResize === 'function') {
      windowResizeBound = true
      Taro.onWindowResize(handleWindowResize)
    }
    return () => {
      insetsListeners.delete(listener)
      if (insetsListeners.size === 0 && windowResizeBound) {
        windowResizeBound = false
        if (typeof Taro.offWindowResize === 'function') Taro.offWindowResize(handleWindowResize)
      }
    }
  }, [])

  return insets
}
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
