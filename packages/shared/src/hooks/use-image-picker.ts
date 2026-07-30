/**
 * 跨端共享 useImagePicker hook(2026-07-30 立)
 *
 * 设计目标:消除 apps/mobile-rn/src/hooks/useChatInput.ts(launchImageLibraryAsync)
 * 与 apps/miniapp-taro/src/utils/upload-image.ts(Taro.chooseImage)中
 * "选图 + 错误兜底 + 类型推断 + 状态管理" 重复模式。
 *
 * 设计模式:与 use-clipboard 共享层模式对齐(工厂函数 + 平台 adapter 注入)。
 * - 调用方传 ImagePickerImpl 平台实现
 * - hook 负责 useState(useState busy/error/files) + useCallback(pick/pickFromCamera)
 *
 * 平台无关:不依赖 RN/Taro/DOM,只基于 React useState/useCallback + 共享 image-helpers。
 *
 * 各端接入:
 * ```ts
 * // mobile-rn
 * export const useImagePicker = createUseImagePicker({
 *   pickFromLibrary: async (opts) => {
 *     const result = await ImagePicker.launchImageLibraryAsync(opts)
 *     if (result.canceled) return []
 *     return result.assets ?? []
 *   },
 *   pickFromCamera: async (opts) => { ... },
 * })
 *
 * // miniapp-taro
 * export const useImagePicker = createUseImagePicker({
 *   pickFromLibrary: async (opts) => {
 *     const res = await Taro.chooseImage({ count: opts.maxCount, ... })
 *     return res.tempFilePaths.map(p => ({ uri: p }))
 *   },
 *   pickFromCamera: async (opts) => { ... },
 * })
 * ```
 */

import * as React from 'react'
import {
  buildFileFromAsset,
  type AssetLike,
  type FileLike,
  type FileType,
} from '../utils/image-helpers'

/** 平台 adapter 接口:各端注入 picker 实现 */
export interface ImagePickerImpl {
  /**
   * 从相册/图库选择
   * @param options 选择参数
   * @returns 资源列表(空数组表示用户取消)
   */
  pickFromLibrary: (options: PickOptions) => Promise<AssetLike[]>
  /**
   * 从相机拍摄(可选,平台不支持时可省略)
   */
  pickFromCamera?: (options: PickOptions) => Promise<AssetLike[]>
}

export interface PickOptions {
  /** 最多选择数量,默认 1 */
  maxCount?: number
  /** 仅图片(默认 true) */
  imagesOnly?: boolean
  /** 视频/图片混合(false 表示允许视频) */
  mediaType?: 'image' | 'video' | 'all'
  /** 压缩质量 0-1 */
  quality?: number
}

export interface UseImagePickerReturn {
  /** 当前已选文件列表(最新在前) */
  files: FileLike[]
  /** 是否正在选择/读取 */
  busy: boolean
  /** 最近一次错误 */
  error: string | null
  /** 是否已 hydrate(默认 true,本 hook 不需要异步初始化) */
  ready: boolean
  /** 从相册选择并追加到 files */
  pickFromLibrary: (options?: PickOptions) => Promise<FileLike[]>
  /** 从相机拍摄并追加到 files(平台不支持时降级为 pickFromLibrary) */
  pickFromCamera: (options?: PickOptions) => Promise<FileLike[]>
  /** 移除指定 id 的文件 */
  remove: (id: string) => void
  /** 清空所有文件 */
  clear: () => void
  /** 用外部文件列表替换(用于 deep link / paste 场景) */
  setFiles: (next: FileLike[]) => void
}

const DEFAULT_OPTIONS: Required<PickOptions> = {
  maxCount: 1,
  imagesOnly: true,
  mediaType: 'image',
  quality: 0.8,
}

function mergeOptions(opts?: PickOptions): Required<PickOptions> {
  return { ...DEFAULT_OPTIONS, ...(opts ?? {}) }
}

/**
 * 创建跨端 useImagePicker hook
 */
export function createUseImagePicker(impl: ImagePickerImpl) {
  return function useImagePicker(): UseImagePickerReturn {
    const [files, setFiles] = React.useState<FileLike[]>([])
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const fallbackType = (opts: Required<PickOptions>): FileType => {
      if (opts.mediaType === 'video') return 'video'
      if (opts.mediaType === 'all') return 'image'
      return 'image'
    }

    const pickInternal = React.useCallback(
      async (
        picker: (options: PickOptions) => Promise<AssetLike[]>,
        options?: PickOptions,
      ): Promise<FileLike[]> => {
        const merged = mergeOptions(options)
        setBusy(true)
        setError(null)
        try {
          const assets = await picker(merged)
          const newFiles: FileLike[] = assets
            .filter(
              (a): a is AssetLike =>
                !!a && (typeof a.uri === 'string' || typeof a.fileName === 'string'),
            )
            .map((a) => buildFileFromAsset(a, fallbackType(merged)))
          if (newFiles.length > 0) {
            setFiles((prev) => [...newFiles, ...prev])
          }
          return newFiles
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'unknown'
          setError(msg)
          return []
        } finally {
          setBusy(false)
        }
      },
      [],
    )

    const pickFromLibrary = React.useCallback(
      (options?: PickOptions): Promise<FileLike[]> => pickInternal(impl.pickFromLibrary, options),
      [impl, pickInternal],
    )

    const pickFromCamera = React.useCallback(
      (options?: PickOptions): Promise<FileLike[]> => {
        if (impl.pickFromCamera) {
          return pickInternal(impl.pickFromCamera, options)
        }
        // 平台不支持相机时降级为相册
        return pickInternal(impl.pickFromLibrary, options)
      },
      [impl, pickInternal],
    )

    const remove = React.useCallback((id: string): void => {
      setFiles((prev) => prev.filter((f) => f.id !== id))
    }, [])

    const clear = React.useCallback((): void => {
      setFiles([])
    }, [])

    return {
      files,
      busy,
      error,
      ready: true,
      pickFromLibrary,
      pickFromCamera,
      remove,
      clear,
      setFiles,
    }
  }
}
