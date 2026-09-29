// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { formatFileSize } from '@ihui/shared/utils/format'
import { fetchApi } from '@/lib/api'

/** 引用类型(2026-07-29 从 message-input.tsx 迁移至此) */
export type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'

/** 单条引用项(2026-07-29 从 message-input.tsx 迁移至此) */
export interface ReferenceItem {
  id: string
  type: ReferenceType
  label: string
  preview?: string
  /** 图片/视频缩略图 URL(objectURL),用于在引用面板中显示视觉缩略图 */
  thumbnail?: string
  /** 原始文件大小(字节),用于在 label 中显示尺寸信息 */
  size?: number
  /** 自定义图标(覆盖 type 默认图标) */
  icon?: React.ComponentType<{ className?: string }>
  /** 自定义图标颜色 class */
  iconColor?: string
  /** 服务端文件 id(矩阵 A #19:/api/files/upload/form 上传成功后回写) */
  fileId?: string
  /** 服务端公开 URL(矩阵 A #19:响应 data.file.path,发送时替代仅本会话有效的 blob: objectURL) */
  serverUrl?: string
  /** 上传状态(矩阵 A #19):uploading 进行中 / ready 成功 / error 失败 */
  uploadState?: 'uploading' | 'ready' | 'error'
}

const MAX_LABEL_LENGTH = 30

/**
 * 可上传扩展名集合(矩阵 A #19)。
 * 与 apps/api/src/utils/file-type-validator.ts 的 EXT_MIME_MAP 白名单对齐:
 * 图片/视频之外放开文档与纯文本类型,其余扩展名仍静默忽略。
 * 服务端以 EXT_MIME_MAP + magic number 为准,此处仅做前端预筛。
 */
const UPLOADABLE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'md',
  'json',
  'zip',
  'odt',
  'rtf',
  'epub',
  'mp4',
  'webm',
  'mov',
])

/** 上传端点(与 AttachmentsUpload 默认端点一致) */
const UPLOAD_ENDPOINT = '/api/files/upload/form'

/* ── G-833 聊天附件三档上限唯一声明处(选/拖/贴三入口一律由此取值,禁止他处再写数字) ──
 * 落点说明:任务书要求优先复用 packages/shared/src/constants/,但该面现无聊天附件档,
 * 且本票文件清单不含 packages/ —— 故单点声明在本 hook 顶部(聊天附件链的入口),
 * 由 use-message-send.ts / message-input.tsx import 取用,不产生第二份。 */
/** 单文件大小上限:50MB —— 与 workspace/upload-zone.tsx DEFAULT_MAX_SIZE、
 *  apps/api/src/plugins/ws-ai.ts 音频 50MB 同口径 */
export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024
/** 单条消息附件数量上限:30 —— G-833 票验收口径("31 个附件 ⇒ 收到前 30 个并回报被拒 1 个") */
export const CHAT_ATTACHMENT_MAX_FILES = 30
/** 媒体类扩展名(accept 侧由 image 与 video 的 MIME 通配前缀覆盖,不再逐列) */
const MEDIA_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'])
/** DOM input accept 派生值 —— 与 UPLOADABLE_EXTENSIONS 单一白名单同源
 *  (message-input.tsx 原写死串已改为引用本派生值,两处漂移即由它消除) */
export const CHAT_ATTACHMENT_ACCEPT = [
  'image/*',
  'video/*',
  ...Array.from(UPLOADABLE_EXTENSIONS)
    .filter((ext) => !MEDIA_EXTENSIONS.has(ext))
    .map((ext) => `.${ext}`),
].join(',')

/**
 * G-833:附件三档拒绝码 —— 对齐上游 prompt-input.tsx `onError` 的三档字面联合
 * (accept / max_file_size / max_files)。超额(数量)时 slice(0, capacity) **仍收部分**,
 * 并把被拒项以结构化 code+名单回报给调用方聚合提示,禁止静默丢弃。
 */
export type AttachmentRejectCode = 'accept' | 'max_file_size' | 'max_files'
export interface AttachmentRejection {
  code: AttachmentRejectCode
  /** 被拒文件名(同 code 聚合为一个条目,禁止逐文件各报一条) */
  fileNames: string[]
}

function isAttachmentTypeAllowed(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true
  const dotIndex = file.name.lastIndexOf('.')
  const ext = dotIndex >= 0 ? file.name.slice(dotIndex + 1).toLowerCase() : ''
  return UPLOADABLE_EXTENSIONS.has(ext)
}

function pushRejection(rejections: AttachmentRejection[], code: AttachmentRejectCode, name: string) {
  const hit = rejections.find((r) => r.code === code)
  if (hit) hit.fileNames.push(name)
  else rejections.push({ code, fileNames: [name] })
}

/**
 * G-833 纯判据(可脱离 React 单测):按 类型 → 单文件大小 → 数量容量 三档依次筛一批文件。
 * 与上游 addLocal 同序:先 accept、再 size、最后 capacity slice(0, capacity)。
 * @param currentCount 当前已有引用数(容量 = CHAT_ATTACHMENT_MAX_FILES - currentCount)
 */
export function screenAttachmentFiles(
  files: readonly File[],
  currentCount: number,
): { accepted: File[]; rejections: AttachmentRejection[] } {
  const rejections: AttachmentRejection[] = []
  const typed = files.filter((f) => {
    if (isAttachmentTypeAllowed(f)) return true
    pushRejection(rejections, 'accept', f.name)
    return false
  })
  const sized = typed.filter((f) => {
    if (f.size <= CHAT_ATTACHMENT_MAX_SIZE_BYTES) return true
    pushRejection(rejections, 'max_file_size', f.name)
    return false
  })
  const capacity = Math.max(0, CHAT_ATTACHMENT_MAX_FILES - currentCount)
  const accepted = sized.slice(0, capacity)
  if (sized.length > capacity) {
    for (const f of sized.slice(capacity)) pushRejection(rejections, 'max_files', f.name)
  }
  return { accepted, rejections }
}

/** /api/files/upload/form 响应 data 形状。
 * 标准 code=0 包装经 fetchApi 解包后为 { file };
 * 裸 success 包装(无 code 字段)时 fetchApi 把整个响应体作为 data 返回(即 data.data.file)。 */
interface UploadFormPayload {
  file?: { id?: string; path?: string; name?: string; size?: number; mimeType?: string }
  data?: { file?: { id?: string; path?: string; name?: string; size?: number; mimeType?: string } }
}

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 消息输入区 references 状态管理 hook(2026-07-29 提取自 message-input.tsx)
 *
 * 职责:
 * - 维护当前消息引用的列表(reference 列表)
 * - 提供 file / text / code 三种类型的添加、移除、重置方法
 * - 自动管理 objectURL 的释放(避免内存泄漏)
 *
 * 关键边界:
 * - 附件准入(2026-09-29 G-833 收口):三档校验(类型/单文件大小/数量)集中在
 *   screenAttachmentFiles 纯判据,数量超额时 slice(0, capacity) **仍收部分并结构化回报**,
 *   原"类型不符静默 return"已废除;调用方(use-message-send 选/拖/贴三入口)据
 *   AttachmentRejection[] 聚合出**一条**提示,禁止逐文件 toast 风暴。
 * - commitFileReference 假定调用方已完成三档校验(如"先压缩图片再提交"的入口路径),
 *   直接创建 ref(uploadState:'uploading')+ 异步上传 /api/files/upload/form,
 *   按 ref.id 回写 fileId/serverUrl/uploadState(矩阵 A #19 断链修复语义不变)
 * - addTextReference 自动 trim,空文本直接返回不创建 ref
 * - addCodeReference 接受代码 + 语言标签,沿用 'text' 类型存储(code 类型在
 *   ReferenceType 联合中未声明,后续若需要独立展示可扩展)
 * - removeReference 自动 revoke 被移除项的 objectURL
 * - resetReferences 不主动 revoke objectURL(doSend 中发送后已显式遍历 revoke)
 */
export function useMessageReferences(): {
  references: ReferenceItem[]
  /** 单文件入口(G-833:静默丢弃已废除,返回结构化 reject 名单,空数组 = 已接收)。
   *  多文件场景请用 addFileReferences 一次性校验以便聚合提示。 */
  addFileReference: (file: File) => AttachmentRejection[]
  /** G-833:批量入口 —— 三档校验一次过,数量超额仍收前 capacity 个,返回被拒结构化名单 */
  addFileReferences: (files: readonly File[]) => AttachmentRejection[]
  /** G-833:入口预筛(供"先做图片压缩再提交"的路径;容量按当前 references 数计) */
  screenAttachments: (files: readonly File[]) => {
    accepted: File[]
    rejections: AttachmentRejection[]
  }
  /** G-833:提交已过三档校验的文件(不再校验,仅创建 ref + 异步上传) */
  commitFileReference: (file: File) => void
  addTextReference: (text: string) => void
  addCodeReference: (code: string, language: string) => void
  removeReference: (id: string) => void
  resetReferences: () => void
} {
  const [references, setReferences] = React.useState<ReferenceItem[]>([])
  // 2026-08-02 修复 P1 内存泄露:用 ref 引用最新 references,
  // 供组件卸载时 cleanup 释放所有 objectURL。
  const refsRef = React.useRef(references)
  refsRef.current = references

  /** G-833:提交已过三档校验的文件 —— 原 addFileReference 主体,类型/大小/数量判据
   *  已上移到 screenAttachmentFiles,此处不再静默 return */
  const commitFileReference = React.useCallback((file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    const objectUrl = URL.createObjectURL(file)
    const ref: ReferenceItem = {
      id: generateId(),
      type: isImage ? 'image' : isVideo ? 'video' : 'file',
      label: file.name,
      preview: `${file.name} · ${formatFileSize(file.size)}`,
      // 图片/视频仍用本地 objectURL 缩略图做即时预览;其他文件无缩略图
      thumbnail: isImage || isVideo ? objectUrl : undefined,
      size: file.size,
      uploadState: 'uploading',
    }
    setReferences((prev) => [...prev, ref])
    // 矩阵 A #19 断链修复:异步上传到服务端,成功后回写 serverUrl(公开 URL),
    // 发送时以 serverUrl 替代 blob: objectURL。fetchApi 统一承担鉴权/credentials。
    void (async () => {
      try {
        const formData = new FormData()
        formData.append('file', file, file.name)
        const res = await fetchApi<UploadFormPayload>(UPLOAD_ENDPOINT, {
          method: 'POST',
          body: formData,
          // 对齐 AttachmentsUpload:默认 30s 超时对大文件偏紧,放宽到 120s
          timeoutMs: 120_000,
        })
        if (!res.success) throw new Error(res.error ?? '附件上传失败')
        const f = res.data.file ?? res.data.data?.file
        // path 为服务端公开 URL(如 /api/files/<uuid>),以响应为准直接透传
        if (!f?.id || !f.path) throw new Error('上传响应缺少 file.id/file.path')
        setReferences((prev) =>
          prev.map((r) =>
            r.id === ref.id
              ? { ...r, fileId: f.id, serverUrl: f.path, uploadState: 'ready' as const }
              : r,
          ),
        )
      } catch {
        setReferences((prev) =>
          prev.map((r) => (r.id === ref.id ? { ...r, uploadState: 'error' as const } : r)),
        )
      }
    })()
  }, [])

  /** G-833:入口预筛 —— 容量按当前 references 数(refsRef 恒为最新渲染值) */
  const screenAttachments = React.useCallback(
    (files: readonly File[]) => screenAttachmentFiles(files, refsRef.current.length),
    [],
  )

  /** G-833:批量添加 —— 三档校验一次过;数量超额时仍收前 capacity 个并回报被拒名单。
   *  同帧多次调用以本地累计计数兜容量,避免 setState 异步导致超额文件钻空。 */
  const countedBatchRef = React.useRef(0)
  const addFileReferences = React.useCallback(
    (files: readonly File[]): AttachmentRejection[] => {
      const { accepted, rejections } = screenAttachmentFiles(
        files,
        refsRef.current.length + countedBatchRef.current,
      )
      countedBatchRef.current += accepted.length
      accepted.forEach((f) => commitFileReference(f))
      // 微任务后归零:refsRef 将在下一渲染同步为真实计数,跨帧调用不重复占容
      queueMicrotask(() => {
        countedBatchRef.current = 0
      })
      return rejections
    },
    [commitFileReference],
  )

  /** G-833:单文件入口 = 批量为 1 的特例;返回值给忽略它的旧调用方(void 兼容)无影响 */
  const addFileReference = React.useCallback(
    (file: File): AttachmentRejection[] => addFileReferences([file]),
    [addFileReferences],
  )

  const addTextReference = React.useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const ref: ReferenceItem = {
      id: generateId(),
      type: 'text',
      label:
        trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed,
      preview: trimmed,
    }
    setReferences((prev) => [...prev, ref])
  }, [])

  const addCodeReference = React.useCallback((code: string, language: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    const summary =
      trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH)}...` : trimmed
    const ref: ReferenceItem = {
      id: generateId(),
      type: 'text',
      label: language ? `${language} · ${summary}` : summary,
      preview: trimmed,
    }
    setReferences((prev) => [...prev, ref])
  }, [])

  const removeReference = React.useCallback((id: string) => {
    setReferences((prev) => {
      const removed = prev.find((r) => r.id === id)
      if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail)
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  // 2026-08-02 修复 P1 内存泄露:resetReferences 中释放所有 objectURL,
  // 原实现只清空数组不释放,用户添加图片后关闭对话框不发送会泄露 objectURL。
  // 仅对 thumbnail 以 'blob:' 开头的释放,避免误 revoke 非 blob URL。
  const resetReferences = React.useCallback(() => {
    setReferences((prev) => {
      prev.forEach((r) => {
        if (r.thumbnail && r.thumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(r.thumbnail)
        }
      })
      return []
    })
  }, [])

  // 2026-08-02 修复 P1 内存泄露:组件卸载时释放 references 中所有 objectURL。
  React.useEffect(() => {
    return () => {
      refsRef.current.forEach((r) => {
        if (r.thumbnail && r.thumbnail.startsWith('blob:')) {
          URL.revokeObjectURL(r.thumbnail)
        }
      })
    }
  }, [])

  return {
    references,
    addFileReference,
    addFileReferences,
    screenAttachments,
    commitFileReference,
    addTextReference,
    addCodeReference,
    removeReference,
    resetReferences,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
