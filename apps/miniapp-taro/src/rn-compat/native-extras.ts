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
 *     (主题偏好这种小文本语义等价)。二进制写入(音频临时文件)不落盘并告警一次 ——
 *     该场景的播放链在小程序端本来就走 Taro 自己的音频能力。
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
    warnOnce('fs-binary', '二进制写入在小程序端不落盘(媒体临时文件请走 Taro 播放/保存链)')
    fsWrite(this.uri, '')
  }

  create(): void {
    /* 懒创建:首次 write 即建 */
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
