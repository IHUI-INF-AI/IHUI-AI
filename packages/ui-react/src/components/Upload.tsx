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
  /** 占位文案 */
  placeholder?: string
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
  /** 界面文案注入(不传的键回退 DEFAULT_UPLOAD_LABELS 简体中文 — 不注入即不本地化) */
  labels?: Partial<UploadLabels>
}

/** Upload 界面文案(占位/状态/错误提示/无障碍标签),由消费端注入 */
export interface UploadLabels {
  placeholder: string
  done: string
  cancelUpload: string
  removeUploadedAriaLabel: string
  removeItemAriaLabel: string
  sizeLimitHint: string
  maxCountReached: string
  oversizeFiles: string
  uploadFailed: string
  uploadFailedWithStatus: string
  invalidJsonResponse: string
  noUrlField: string
  networkError: string
  uploadCancelled: string
  /** D192(2026-09-30 立):已上传图片的逐图 alt 模板,{index} 从 1 起;缺省中文兜底由消费端注入本地化 */
  imageAltText: string
}

/** i18n 默认值(不传 labels 时回退到简体中文) */
const DEFAULT_UPLOAD_LABELS: UploadLabels = {
  placeholder: '点击或拖拽文件到此处上传',
  done: '已完成',
  cancelUpload: '取消上传',
  removeUploadedAriaLabel: '删除已上传文件',
  removeItemAriaLabel: '移除上传项',
  sizeLimitHint: '单文件不超过 {size}',
  maxCountReached: '已达上限 {max} 个文件',
  oversizeFiles: '以下文件超过 {size}: {files}',
  uploadFailed: '上传失败',
  uploadFailedWithStatus: '上传失败:HTTP {status}',
  invalidJsonResponse: '响应不是合法 JSON',
  noUrlField: '响应中未找到可用的 URL 字段',
  networkError: '网络错误',
  uploadCancelled: '上传已取消',
  imageAltText: '反馈截图 {index}',
}

/** 轻量 {var} 占位插值(不引 i18n 框架):消费端 t() 返回的模板在此填值(与 data-table.tsx 同形态) */
function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    values[key] === undefined ? `{${key}}` : String(values[key]),
  )
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
    className,
    onError,
    onProgress,
    onRemove,
    resolveUrl = defaultResolveUrl,
    labels: labelsProp,
  },
  ref,
) {
  const labels = React.useMemo<UploadLabels>(
    () => ({ ...DEFAULT_UPLOAD_LABELS, ...labelsProp }),
    [labelsProp],
  )
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [items, setItems] = React.useState<FileItem[]>([])
  // BUG-33②:取消/逐项移除必须是**真**取消 —— 原实现只清 UI 列表,上传循环照旧跑完,
  // 末尾还把结果推给 onChange ⇒ 用户以为撤回了,文件却随提交发了出去。以下 ref 是
  // 所有并发批次共享的单一真相源,取代原先的单槽 xhrRef / 全局 cancelledRef 布尔。
  const committedRef = React.useRef<string[]>(value) // 本组件最后一次 onChange 推送的完整列表
  const inFlightRef = React.useRef(0) // 已接受、尚未结束的上传数(用于名额上限)
  const xhrByKeyRef = React.useRef<Map<string, XMLHttpRequest>>(new Map()) // 按 key 登记全部在途 XHR
  const cancelEpochRef = React.useRef(0) // 取消意图按 epoch 记账,新批次不撤销别的批次的取消
  const droppedKeysRef = React.useRef<Set<string>>(new Set()) // 逐项移除的 key 集合

  // 外部 value 变化(父级确认推送 / 移除 URL)时,以它为新基准,避免组件内乐观值漂移。
  React.useEffect(() => {
    const committed = committedRef.current
    const changed = committed.length !== value.length || committed.some((u, i) => u !== value[i])
    if (changed) committedRef.current = value
  }, [value])

  /** 上传单个文件(内部用 XHR 以支持 progress 事件) */
  const uploadOne = React.useCallback(
    (file: File, key: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        // BUG-33②:按 key 登记到全量 Map —— 取消全部能 abort 所有批次,逐项移除也能
        // 精确定位到单个请求,不再是"只 abort 最后一个"的单槽 xhrRef。
        xhrByKeyRef.current.set(key, xhr)
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
            reject(new Error(fillTemplate(labels.uploadFailedWithStatus, { status: xhr.status })))
            return
          }
          let parsed: unknown
          try {
            parsed = JSON.parse(xhr.responseText)
          } catch {
            reject(new Error(labels.invalidJsonResponse))
            return
          }
          const url = resolveUrl(parsed)
          if (!url) {
            reject(new Error(labels.noUrlField))
            return
          }
          resolve(url)
        }

        xhr.onerror = () => reject(new Error(labels.networkError))
        xhr.onabort = () => reject(new Error(labels.uploadCancelled))

        const formData = new FormData()
        formData.append(fieldName, file)
        xhr.send(formData)
      })
    },
    [endpoint, fieldName, headers, labels, onProgress, resolveUrl],
  )

  /** 处理待上传文件列表(校验 + 实际发起) */
  const handleFiles = React.useCallback(
    async (fileList: FileList | File[] | null) => {
      if (!fileList) return
      const incoming = Array.from(fileList)
      if (incoming.length === 0) return

      // BUG-33②④:名额上限在**批次启动时实时**算,扣掉"已推送 + 仍在途"的项。
      // 旧口径 maxCount - value.length 既不看上传中的项,又是渲染快照,并发批次会超上限。
      const remaining = Math.max(0, maxCount - committedRef.current.length - inFlightRef.current)
      const slots = remaining > 0 ? remaining : 0
      const accepted = incoming.slice(0, slots)
      if (accepted.length === 0) {
        onError?.(new Error(fillTemplate(labels.maxCountReached, { max: maxCount })))
        return
      }

      // 超限文件单独报错
      const oversize = accepted.filter((f) => f.size > maxSize)
      if (oversize.length > 0) {
        onError?.(
          new Error(
            fillTemplate(labels.oversizeFiles, {
              size: formatSize(maxSize),
              files: oversize.map((f) => f.name).join(', '),
            }),
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

      // BUG-33②③:取消意图按 epoch 记账。本批只认自己的 epoch;新批次不再把
      // 全局 cancelledRef 置 false(那会撤销别的批次已经作出的取消意图)。
      const epochAtStart = cancelEpochRef.current
      const isCancelled = () => cancelEpochRef.current !== epochAtStart
      // 每个被接受的文件立即占一个在途名额
      inFlightRef.current += valid.length

      // 逐个上传
      const newUrls: string[] = []
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i]!
        const item = newItems[i]!
        try {
          if (isCancelled() || droppedKeysRef.current.has(item.key)) continue
          const url = await uploadOne(file, item.key)
          // 成功回调可能落在用户取消/移除之后:此时不得再写入结果
          if (isCancelled() || droppedKeysRef.current.has(item.key)) continue
          newUrls.push(url)
          setItems((prev) =>
            prev.map((it) =>
              it.key === item.key ? { ...it, status: 'done', progress: 100, url } : it,
            ),
          )
        } catch (err) {
          // abort 走的是 onabort→reject 这条道:用户主动取消/移除不是"上传失败",
          // 报出去会让调用方弹一句莫名其妙的错误。
          if (isCancelled() || droppedKeysRef.current.has(item.key)) continue
          const msg = err instanceof Error ? err.message : labels.uploadFailed
          setItems((prev) =>
            prev.map((it) => (it.key === item.key ? { ...it, status: 'error', error: msg } : it)),
          )
          onError?.(err instanceof Error ? err : new Error(msg))
        } finally {
          // 无论成功/失败/取消,都释放这个文件的在途名额并摘掉 XHR 登记
          inFlightRef.current = Math.max(0, inFlightRef.current - 1)
          xhrByKeyRef.current.delete(item.key)
        }
      }
      if (isCancelled()) return

      // BUG-33②①:推送基于"本组件最后一次 emit 的完整列表"累加,而不是 handleFiles
      // 闭包里的 value 快照 —— 后完成的批次不会再覆盖前一批已推送的 URL。
      if (newUrls.length > 0) {
        const base = committedRef.current
        const next = multiple ? [...base, ...newUrls] : [newUrls[newUrls.length - 1]!]
        committedRef.current = next
        onChange?.(next)
      }
    },
    [labels, maxCount, maxSize, multiple, onChange, onError, uploadOne],
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
    // 逐项移除必须同时中止该请求:原实现只把行从列表里删掉,文件继续上传,
    // 传完后又出现在"已上传"缩略图里(用户的删除被静默撤回)。
    droppedKeysRef.current.add(key)
    // BUG-33②:按 key 从全量 Map 精确 abort 该文件的请求,不动其他并发批次。
    const xhr = xhrByKeyRef.current.get(key)
    if (xhr) {
      xhr.abort()
      xhrByKeyRef.current.delete(key)
    }
    setItems((prev) => prev.filter((it) => it.key !== key))
  }, [])

  const handleCancelAll = React.useCallback(() => {
    // BUG-33②③:推进 cancelEpoch 让**所有**在途批次都判定为已取消(单槽 xhrRef 时代
    // 只能 abort 最后一个),再 abort 全量 Map 里的每一个 XHR。新批次用新 epoch,
    // 既不会撤销这次取消,也仍能正常上传新选的文件。
    cancelEpochRef.current += 1
    for (const xhr of xhrByKeyRef.current.values()) xhr.abort()
    xhrByKeyRef.current.clear()
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
                  <img
                    src={url}
                    alt={fillTemplate(labels.imageAltText, { index: idx + 1 })}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <FileIcon className="h-7 w-7" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(idx)}
                  aria-label={labels.removeUploadedAriaLabel}
                  className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-sm bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
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
            'flex w-full flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition-colors',
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
          <p className="text-sm text-muted-foreground">{placeholder ?? labels.placeholder}</p>
          {maxSize !== DEFAULT_MAX_SIZE && (
            <p className="text-xs text-muted-foreground">
              {fillTemplate(labels.sizeLimitHint, { size: formatSize(maxSize) })}
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
                      labels.done
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
                aria-label={labels.removeItemAriaLabel}
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
                {labels.cancelUpload}
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
