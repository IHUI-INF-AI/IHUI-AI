// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { UploadCloud, X, Loader2, FileIcon, ImageIcon } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * Upload 组件 — 统一文件上传 UI(支持拖拽 + 点击 + 进度条 + 多文件)
 *
 * 设计要点:
 *  - 拖拽区:rounded-lg + border-2 border-dashed(遵守 §4 圆角规范,非纯圆形)
 *  - 进度条:内置简易 Progress 组件(XHR 进度事件驱动,fetch 不支持上传进度)
 *  - 文件图标:FileIcon(通用) / ImageIcon(图片自动识别) — rounded-md 缩略图
 *  - icon + 中文 span 同行布局:依赖 globals.css 第 170 行全局 translateY 规则,
 *    父级 button + svg 子 + span 子时自动应用 0.3px 垂直对齐偏移
 *  - 上传方式:XMLHttpRequest(支持 upload.onprogress),fetch API 不支持上传进度
 *  - 响应兼容:支持三种常见响应格式(data.url / data.file.path / data.url 直接)
 *
 * 跨端范围(2026-07-21 标注):本组件共享包(workspace @ihui/ui),消费端仅 web
 * desktop / extension / mobile-rn / miniapp-taro / ai-service / api / cli 当前未
 * 引用此组件,本任务豁免同步(仅 web + packages/ui,见 PROJECT_PLAN.md 同步标注)。
 */
/**
 * Upload 组件文案契约(2026-09-30 补齐):`@ihui/ui-react` 不引 next-intl(被多端共用),
 * 组件内只留 DEFAULT_UPLOAD_LABELS 中文兜底;非中文界面由消费端经
 * `useUploadLabels()`(apps/web/src/hooks/use-upload-labels.ts)注入 labels,
 * 键集合与该 hook 逐键对齐 —— 两边必须同步增删,否则类型层即红。
 */
export interface UploadLabels {
  /** 拖拽区占位文案 */
  placeholder: string
  /** 单条上传完成状态文案 */
  done: string
  /** 取消全部在途上传按钮文案 */
  cancelUpload: string
  /** 删除已上传 URL 按钮的 aria-label */
  removeUploadedAriaLabel: string
  /** 移除在途上传条目的 aria-label */
  removeItemAriaLabel: string
  /** 单文件大小上限提示(完整文案,尺寸已由调用方插值) */
  sizeLimitHint: string
  /** 达到文件数上限的错误文案 */
  maxCountReached: string
  /** 文件超限的错误文案(文件名清单已由调用方拼好) */
  oversizeFiles: string
  /** 通用上传失败文案 */
  uploadFailed: string
  /** 带 HTTP 状态码的上传失败文案(状态码已由调用方插值) */
  uploadFailedWithStatus: string
  /** 响应非合法 JSON 的错误文案 */
  invalidJsonResponse: string
  /** 响应中无 URL 字段的错误文案 */
  noUrlField: string
  /** 网络错误文案 */
  networkError: string
  /** 上传被取消文案 */
  uploadCancelled: string
}

/** 中文兜底文案(组件默认档;消费端本地化时整体覆盖)。
 *  注:带运行时插值的四条(sizeLimitHint/maxCountReached/oversizeFiles/
 *  uploadFailedWithStatus)默认值由使用点内联拼接 —— labels 注入的是**已插值的完整文案**。 */
export const DEFAULT_UPLOAD_LABELS: UploadLabels = {
  placeholder: '点击或拖拽文件到此处上传',
  done: '已完成',
  cancelUpload: '取消上传',
  removeUploadedAriaLabel: '删除已上传文件',
  removeItemAriaLabel: '移除上传项',
  sizeLimitHint: '单文件大小超限',
  maxCountReached: '已达文件数上限',
  oversizeFiles: '部分文件超过大小上限',
  uploadFailed: '上传失败',
  uploadFailedWithStatus: '上传失败',
  invalidJsonResponse: '响应不是合法 JSON',
  noUrlField: '响应中未找到可用的 URL 字段',
  networkError: '网络错误',
  uploadCancelled: '上传已取消',
}

/** 把 Partial labels 合并到中文兜底档(未覆盖的键回退默认)。 */
function mergeLabels(labels?: Partial<UploadLabels>): UploadLabels {
  return { ...DEFAULT_UPLOAD_LABELS, ...labels }
}

export interface UploadProps {
  /** 已上传的 URL 列表(受控) */
  value?: string[]
  /** 选中文件上传完成后回调(增量推送新 URL) */
  onChange?: (urls: string[]) => void
  /** 上传目标 URL(POST FormData) */
  endpoint: string
  /** 是否支持多选(默认 false) */
  multiple?: boolean
  /** 最多允许的文件数(默认 5) */
  maxCount?: number
  /** 单文件大小上限(字节,默认 10MB) */
  maxSize?: number
  /** 接受的文件类型(HTML accept 字符串,如 'image/*'、'.pdf,.doc') */
  accept?: string
  /** FormData 字段名(默认 'file') */
  fieldName?: string
  /** 自定义请求头(用于携带 token 等) */
  headers?: Record<string, string>
  /** 占位文案(单实例覆盖;多语言走 labels.placeholder) */
  placeholder?: string
  /** 界面文案注入(消费端本地化用;未传的键回退中文兜底档) */
  labels?: Partial<UploadLabels>
  /** 自定义类 */
  className?: string
  /** 错误回调(上传失败 / 文件超限) */
  onError?: (err: Error) => void
  /** 进度回调(单个文件维度,loaded/total) */
  onProgress?: (loaded: number, total: number) => void
  /** 移除已上传 URL 时回调(用于孤儿文件清理) */
  onRemove?: (url: string, idx: number) => void
  /**
   * 响应转 URL 函数(默认尝试多种格式):
   * - 优先 data.data?.url
   * - 其次 data.url
   * - 其次 data.data?.file?.path
   * - 其次 data.file?.path
   * 无法匹配时返回 null,该文件上传视为失败
   */
  resolveUrl?: (response: unknown) => string | null
}

const DEFAULT_MAX_COUNT = 5
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024

/** 默认响应转 URL 解析器(宽松匹配多种后端响应结构) */
function defaultResolveUrl(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null
  const r = response as Record<string, unknown>
  // 形态 1:{ data: { url } }
  if (r.data && typeof r.data === 'object') {
    const d = r.data as Record<string, unknown>
    if (typeof d.url === 'string') return d.url
    if (d.file && typeof d.file === 'object') {
      const f = d.file as Record<string, unknown>
      if (typeof f.path === 'string') return f.path
      if (typeof f.url === 'string') return f.url
    }
  }
  // 形态 2:{ url }
  if (typeof r.url === 'string') return r.url
  // 形态 3:{ file: { path } }
  if (r.file && typeof r.file === 'object') {
    const f = r.file as Record<string, unknown>
    if (typeof f.path === 'string') return f.path
    if (typeof f.url === 'string') return f.url
  }
  return null
}

/** 单个文件上传状态(用于 UI 渲染) */
interface FileItem {
  /** 临时 ID(用于 React key) */
  key: string
  /** 文件名 */
  name: string
  /** 文件大小(字节) */
  size: number
  /** 上传进度 0-100 */
  progress: number
  /** 上传状态 */
  status: 'uploading' | 'done' | 'error'
  /** 错误信息 */
  error?: string
  /** 上传成功后的 URL */
  url?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

/** 根据文件名扩展名判断是否为图片(用于 FileItem 渲染图标) */
function isImageFilename(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name)
}

export const Upload = React.forwardRef<HTMLDivElement, UploadProps>(function Upload(
  {
    value = [],
    onChange,
    endpoint,
    multiple = false,
    maxCount = DEFAULT_MAX_COUNT,
    maxSize = DEFAULT_MAX_SIZE,
    accept,
    fieldName = 'file',
    headers,
    placeholder,
    labels,
    className,
    onError,
    onProgress,
    onRemove,
    resolveUrl = defaultResolveUrl,
  },
  ref,
) {
  // 文案档:与 labels 引用稳定绑定,避免回调依赖每渲染变化
  const t = React.useMemo(() => mergeLabels(labels), [labels])
  const effectivePlaceholder = placeholder ?? t.placeholder
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [items, setItems] = React.useState<FileItem[]>([])
  const xhrRef = React.useRef<XMLHttpRequest | null>(null)

  const remaining = Math.max(0, maxCount - value.length)

  /** 上传单个文件(内部用 XHR 以支持 progress 事件) */
  const uploadOne = React.useCallback(
    (file: File, key: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open('POST', endpoint, true)

        // 设置自定义头
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            xhr.setRequestHeader(k, v)
          }
        }

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return
          const pct = Math.round((e.loaded / e.total) * 100)
          setItems((prev) => prev.map((it) => (it.key === key ? { ...it, progress: pct } : it)))
          onProgress?.(e.loaded, e.total)
        }

        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(t.uploadFailedWithStatus.replace('{status}', String(xhr.status))))
            return
          }
          let parsed: unknown
          try {
            parsed = JSON.parse(xhr.responseText)
          } catch {
            reject(new Error(t.invalidJsonResponse))
            return
          }
          const url = resolveUrl(parsed)
          if (!url) {
            reject(new Error(t.noUrlField))
            return
          }
          resolve(url)
        }

        xhr.onerror = () => reject(new Error(t.networkError))
        xhr.onabort = () => reject(new Error(t.uploadCancelled))

        const formData = new FormData()
        formData.append(fieldName, file)
        xhr.send(formData)
      })
    },
    [endpoint, fieldName, headers, onProgress, resolveUrl, t],
  )

  /** 处理待上传文件列表(校验 + 实际发起) */
  const handleFiles = React.useCallback(
    async (fileList: FileList | File[] | null) => {
      if (!fileList) return
      const incoming = Array.from(fileList)
      if (incoming.length === 0) return

      const slots = remaining > 0 ? remaining : 0
      const accepted = incoming.slice(0, slots)
      if (accepted.length === 0) {
        onError?.(new Error(t.maxCountReached.replace('{maxCount}', String(maxCount))))
        return
      }

      // 超限文件单独报错
      const oversize = accepted.filter((f) => f.size > maxSize)
      if (oversize.length > 0) {
        onError?.(
          new Error(
            t.oversizeFiles
              .replace('{maxSize}', formatSize(maxSize))
              .replace('{names}', oversize.map((f) => f.name).join(', ')),
          ),
        )
      }
      const valid = accepted.filter((f) => f.size <= maxSize)
      if (valid.length === 0) return

      // 初始化文件条目(全置 uploading)
      const newItems: FileItem[] = valid.map((f) => ({
        key: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: f.name,
        size: f.size,
        progress: 0,
        status: 'uploading',
      }))
      setItems((prev) => [...prev, ...newItems])

      // 逐个上传
      const newUrls: string[] = []
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i]!
        const item = newItems[i]!
        try {
          const url = await uploadOne(file, item.key)
          newUrls.push(url)
          setItems((prev) =>
            prev.map((it) =>
              it.key === item.key ? { ...it, status: 'done', progress: 100, url } : it,
            ),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : t.uploadFailed
          setItems((prev) =>
            prev.map((it) => (it.key === item.key ? { ...it, status: 'error', error: msg } : it)),
          )
          onError?.(err instanceof Error ? err : new Error(msg))
        }
      }

      // 推送新增 URL(单选模式只保留最后一个,多选模式追加)
      if (newUrls.length > 0) {
        if (multiple) {
          onChange?.([...value, ...newUrls])
        } else {
          onChange?.([newUrls[newUrls.length - 1]!])
        }
      }
    },
    [maxCount, maxSize, multiple, onChange, onError, remaining, t, uploadOne, value],
  )

  // 已上传 URL 列表(去重保序)
  const safeValue = Array.isArray(value) ? value : []

  const handleRemoveUrl = React.useCallback(
    (idx: number) => {
      const removedUrl = safeValue[idx]
      const newUrls = safeValue.filter((_, i) => i !== idx)
      onChange?.(newUrls)
      if (removedUrl && onRemove) {
        onRemove(removedUrl, idx)
      }
    },
    [onChange, onRemove, safeValue],
  )

  const handleRemoveItem = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }, [])

  const handleCancelAll = React.useCallback(() => {
    xhrRef.current?.abort()
    xhrRef.current = null
    setItems([])
  }, [])

  const canAddMore = safeValue.length + items.filter((i) => i.status !== 'error').length < maxCount
  const hasUploading = items.some((i) => i.status === 'uploading')

  return (
    <div ref={ref} className={cn('flex flex-col gap-3', className)}>
      {/* 已上传列表(图片缩略图 + 通用文件图标) */}
      {safeValue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {safeValue.map((url, idx) => {
            const isImg =
              /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(url) || isImageMime(accept ?? '')
            return (
              <div
                key={`${url}-${idx}`}
                className="group relative h-20 w-20 overflow-hidden rounded-md border bg-muted"
              >
                {isImg ? (
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <FileIcon className="h-7 w-7" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(idx)}
                  aria-label={t.removeUploadedAriaLabel}
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 拖拽 / 点击区 */}
      {canAddMore && (
        <button
          type="button"
          disabled={hasUploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragging) setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragging
              ? 'border-brand-accent-deep bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-accent/30',
            hasUploading && 'pointer-events-none opacity-60',
          )}
        >
          {hasUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">{effectivePlaceholder}</p>
          {maxSize !== DEFAULT_MAX_SIZE && (
            <p className="text-xs text-muted-foreground">
              {t.sizeLimitHint.replace('{size}', formatSize(maxSize))}
            </p>
          )}
        </button>
      )}

      {/* 上传进度列表 */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
            >
              {isImageFilename(item.name) ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.status === 'error' ? (
                      <span className="text-destructive">{item.error}</span>
                    ) : item.status === 'done' ? (
                      t.done
                    ) : (
                      `${item.progress}%`
                    )}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div
                    role="progressbar"
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-muted"
                  >
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                <div className="mt-0.5 text-muted-foreground">{formatSize(item.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveItem(item.key)}
                aria-label={t.removeItemAriaLabel}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {hasUploading && (
            <li>
              <button
                type="button"
                onClick={handleCancelAll}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                {t.cancelUpload}
              </button>
            </li>
          )}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          // 允许重复选择同名文件
          e.target.value = ''
        }}
      />
    </div>
  )
})

export default Upload
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
