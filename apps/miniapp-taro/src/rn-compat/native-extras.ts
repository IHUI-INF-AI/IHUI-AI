// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-extras.ts —— RN 壳依赖的三件"非 UI 原生件"在小程序端的等价实现。
 *
 * 为什么必须补这三件(2026-10-26 就绪尺现读):
 *   279 屏的 import 闭包里,`react-native-restart` + `expo-file-system` 由
 *   `theme/active-tokens.ts` **一处**带入全部 279 屏,`nativewind` 由
 *   `theme/color-scheme-sync.ts` **一处**带入 267 屏。三枚缺一,共享屏/RN 壳在 mini
 *   构建期就解析失败 —— 于是"一份共享源两端渲染"退化成逐屏重写。
 *
 * 降级口径(每一处都显式点名,不静默):
 *   · react-native-restart:小程序不能重启 JS 运行时 ⇒ 空实现。主题偏好已落盘,_下次冷启动_
 *     即生效;调用方本来就把重启失败当"下轮生效"处理。
 *   · expo-file-system:小程序无同步文件 API ⇒ 用本地 Storage 承载 `File.textSync/write`
 *     (主题偏好这种小文本语义等价)。**不支持的 API 一律显式抛 `NotSupportedError`**
 *     (`code = ERR_NOT_SUPPORTED`)或显式 `null` 常量,绝不返回空值假装成功(XUI-054)。
 *   · nativewind:`colorScheme` store 只是"把 App 主题同步给 dark: 变体";小程序端主题由
 *     端内 store + Taro 导航栏负责,这里保留读回语义,不做窗口级副作用。
 *
 * 单源纪律:本文件是**唯一**出口,别名表(config/index.ts)三处都指向它。
 */
import Taro from '@tarojs/taro'

const MEM = new Map<string, string>()
const warned = new Set<string>()
const KEY = (uri: string) => `ihui-compat-fs:${uri}`

function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

function fsRead(uri: string): string | null {
  if (MEM.has(uri)) return MEM.get(uri) ?? null
  try {
    const v = Taro.getStorageSync(KEY(uri))
    return typeof v === 'string' && v !== '' ? v : null
  } catch {
    return null
  }
}

function fsWrite(uri: string, text: string): void {
  MEM.set(uri, text)
  try {
    Taro.setStorageSync(KEY(uri), text)
  } catch {
    warnOnce('fs-write', '本地存储不可用,本次写入仅存于内存(冷启动后丢失)')
  }
}

/** expo-file-system 的两个根目录常量(与 RN 侧同名,值是小程序内的语义前缀) */
export const Paths = {
  document: 'wxfile://usr',
  cache: 'wxfile://usr/cache',
} as const

/** `new File(dir, name)` 的等价物:同步读写 + exists/size/uri */
export class File {
  readonly uri: string
  constructor(...parts: Array<string | undefined>) {
    this.uri = parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('/')
  }

  get exists(): boolean {
    return fsRead(this.uri) !== null
  }

  get size(): number {
    return fsRead(this.uri)?.length ?? 0
  }

  textSync(): string {
    return fsRead(this.uri) ?? ''
  }

  async text(): Promise<string> {
    return this.textSync()
  }

  write(content: string | Uint8Array): void {
    if (typeof content === 'string') {
      fsWrite(this.uri, content)
      return
    }
    // 二进制落盘在小程序端没有等价能力:显式不支持,不让调用方以为写成功了。
    unsupported('File.write(binary)')
  }

  create(): void {
    /* 懒创建:首次 write 即建 */
  }

  /** 分片/流式文件句柄在小程序端没有等价能力(多分片下载/续传只走 RN)。 */
  open(..._args: unknown[]): never {
    return unsupported('File.open')
  }

  /** 上传任务(createUploadTask)同样无等价能力;调用方应按 `code` 降级。 */
  createUploadTask(..._args: unknown[]): never {
    return unsupported('File.createUploadTask')
  }

  delete(): void {
    MEM.delete(this.uri)
    try {
      Taro.removeStorageSync(KEY(this.uri))
    } catch {
      /* 未落盘过即无需删 */
    }
  }
}

/** `new Directory(...)` 的等价物(闭包里只出现构造与 create) */
export class Directory {
  readonly uri: string
  constructor(...parts: Array<string | undefined>) {
    this.uri = parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('/')
  }

  get exists(): boolean {
    return true
  }

  create(): void {
    /* 小程序无显式目录概念 */
  }
}

/** 能力探测出口:调用方先判 `supported`,不要拿"没抛错"当能力存在。 */
export const fileSystemSupport = {
  supported: false,
  reason: '小程序无原生文件系统:下载/上传/断点续传/内容 URI 均不支持',
} as const

export const NOT_SUPPORTED_CODE = 'ERR_NOT_SUPPORTED'

/** 显式 not-supported:错误码固定,调用方按 `code` 判,不要匹配 message。 */
export class NotSupportedError extends Error {
  readonly code = NOT_SUPPORTED_CODE
  constructor(api: string) {
    super(`[rn-compat] expo-file-system.${api} 在小程序端不支持(无原生文件系统)`)
    this.name = 'NotSupportedError'
  }
}

function unsupported(api: string): never {
  throw new NotSupportedError(api)
}

/**
 * 枚举常量取值即抛:旧垫片缺这两个导出 ⇒ 调用方拿到 `undefined` 当参数传下去,
 * 失败点被推到很远的地方;现在误用当场暴露。
 */
export const FileMode = new Proxy({} as Record<string, never>, {
  get(_target, prop): never {
    return unsupported(`FileMode.${String(prop)}`)
  },
}) as unknown as Record<string, never>

export const UploadType = new Proxy({} as Record<string, never>, {
  get(_target, prop): never {
    return unsupported(`UploadType.${String(prop)}`)
  },
}) as unknown as Record<string, never>

/**
 * 目录常量:小程序没有这两个目录,显式 `null`(不是空串),调用方必须判空后降级。
 */
export const cacheDirectory: string | null = null
export const documentDirectory: string | null = null

export function createDownloadResumable(..._args: unknown[]): never {
  return unsupported('createDownloadResumable')
}

export async function getContentUriAsync(..._args: unknown[]): Promise<never> {
  return unsupported('getContentUriAsync')
}

/** nativewind 的 colorScheme store:保留读回语义,不做窗口级副作用 */
let scheme: 'light' | 'dark' | null = null

export const colorScheme = {
  get: (): 'light' | 'dark' | null => scheme,
  set: (value: 'light' | 'dark' | 'system'): void => {
    // 'system' 表示把控制权交还系统;小程序端跟随系统由 Taro 主题事件负责
    scheme = value === 'system' ? scheme : value
  },
}

export function useColorScheme(): 'light' | 'dark' | null {
  return scheme
}

/** nativewind 的其余导出口(闭包里未用到,给出同形空实现防"缺导出即编译失败") */
export function cssInterop<C>(component: C): C {
  return component
}

export function remapProps<C>(component: C): C {
  return component
}

export function vars(values: Record<string, string>): Record<string, string> {
  return values
}

export function styled<C>(component: C): C {
  return component
}

/**
 * react-native-restart 的默认导出:`restart()` 在小程序端无对应能力。
 * 主题偏好已在 commitRnTheme 里落盘,空实现 = "本次不重载、下次冷启动生效"。
 */
const Restart = {
  restart(reason?: string): void {
    warnOnce(
      'restart',
      `运行时重载在小程序端不支持(${reason ?? 'restart'})⇒ 按"下次冷启动生效"降级,偏好已落盘`,
    )
  },
}

export default Restart
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** expo-device:闭包只取 modelId(设备指纹的输入);取不到系统信息时给常量 unknown,绝不抛 */
function systemInfo(): Record<string, unknown> {
  try {
    return Taro.getSystemInfoSync() as unknown as Record<string, unknown>
  } catch {
    return {}
  }
}

export const modelId: string = String(systemInfo().model ?? 'unknown')
export const modelName: string = String(systemInfo().model ?? 'unknown')
export const osName: string = String(systemInfo().system ?? 'unknown')
export const osVersion: string = String(systemInfo().system ?? '')
/** expo 的 DeviceType.PHONE = 1;小程序只运行在手机/平板,不做设备类型细分 */
export async function getDeviceTypeAsync(): Promise<number> {
  return 1
}

/**
 * expo-web-browser:小程序没有"应用内浏览器会话",deep link 回跳这条链在小程序端不可用。
 *   · openBrowserAsync:打开普通网页 ⇒ 走端内 web-view 页(与「关于我们」的外链同一出口);
 *   · openAuthSessionAsync:**显式按取消返回**,绝不假装 success —— 假装成功会让调用方
 *     等一个永远不会到的回跳,卡在 loading(错比慢更难查)。
 */
export async function openBrowserAsync(url: string): Promise<{ type: 'opened' | 'cancel' }> {
  try {
    await Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
    return { type: 'opened' }
  } catch {
    return { type: 'cancel' }
  }
}

export async function openAuthSessionAsync(
  _url: string,
  _redirectUrl?: string,
): Promise<{ type: 'cancel' }> {
  warnOnce(
    'auth-session',
    '小程序端无应用内认证会话(deep link 回跳不可用)⇒ 本流程按取消处理,请走端内登录',
  )
  return { type: 'cancel' }
}

export function maybeCompleteAuthSession(): void {
  /* 无弹出窗口需要收尾 */
}

export async function dismissBrowser(): Promise<void> {
  /* 无浏览器会话可收尾 */
}

export async function dismissAuthSession(): Promise<void> {
  /* 无认证会话可收尾 */
}

/**
 * expo-linking:小程序的自定义 scheme 深链由平台托管。
 * 初始 URL 用启动参数合成(路径 + query),不猜 scheme 的主机段;监听为空实现并返回可 remove 的句柄。
 */
export function createURL(path: string): string {
  return `ihui-miniapp://${String(path ?? '').replace(/^\/+/, '')}`
}

export async function getInitialURL(): Promise<string | null> {
  try {
    const opts = Taro.getLaunchOptionsSync()
    const query = (opts?.query ?? {}) as Record<string, string>
    const qs = Object.keys(query)
      .map((k) => `${k}=${encodeURIComponent(String(query[k]))}`)
      .join('&')
    return `ihui-miniapp://${opts?.path ?? ''}${qs ? `?${qs}` : ''}`
  } catch {
    return null
  }
}

export function addEventListener(
  _type: 'url',
  _handler: (event: { url: string }) => void,
): { remove: () => void } {
  return {
    remove(): void {
      /* 小程序没有运行中深链回调 */
    },
  }
}

export function parse(url: string): {
  scheme?: string
  path?: string
  queryParams: Record<string, string>
} {
  const m = /^([a-z][\w+.-]*):\/\/([^?#]*)(?:\?([^#]*))?/i.exec(String(url ?? ''))
  const queryParams: Record<string, string> = {}
  if (m?.[3]) {
    for (const kv of m[3].split('&')) {
      const [k, v] = kv.split('=')
      // 深链 query 里可能出现非合法百分号编码(如 `?discount=100%`)⇒ 解码失败按原样回落
      // (与 native-asset.ts decodeName 同型防御,炸整页不炸一个参数)
      if (k) {
        let decoded = v ?? ''
        try {
          decoded = decodeURIComponent(v ?? '')
        } catch {
          decoded = v ?? ''
        }
        queryParams[k] = decoded
      }
    }
  }
  return { scheme: m?.[1], path: m?.[2] ?? '', queryParams }
}

export async function canOpenURL(): Promise<boolean> {
  return false
}

export async function openURL(url: string): Promise<void> {
  await Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
}
