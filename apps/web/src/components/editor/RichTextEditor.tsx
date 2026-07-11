'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface RichTextEditorHandle {
  getHTML: () => string
  focus: () => void
}

export interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  className?: string
}

interface UploadResult {
  url: string
}

const TOOL_BTN_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

/**
 * 基于 contentEditable 的轻量富文本编辑器（不依赖第三方编辑器库）。
 * 工具栏使用 document.execCommand 控制格式，图片插入走上传接口。
 */
export const RichTextEditor = React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor({ value, onChange, placeholder, className }, ref) {
    const t = useTranslations('richTextEditor')
    const editorRef = React.useRef<HTMLDivElement>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = React.useState(false)

    // 暴露给父组件的方法
    React.useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.innerHTML ?? '',
      focus: () => editorRef.current?.focus(),
    }))

    // 受控初始化：仅在外部 value 变化且与当前内容不一致时同步
    React.useEffect(() => {
      const el = editorRef.current
      if (el && value !== undefined && el.innerHTML !== value) {
        el.innerHTML = value
      }
    }, [value])

    const emitChange = React.useCallback(() => {
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML)
      }
    }, [onChange])

    const exec = React.useCallback(
      (command: string, val?: string) => {
        // execCommand 已废弃但主流浏览器仍支持，用于轻量富文本编辑
        editorRef.current?.focus()
        document.execCommand(command, false, val)
        emitChange()
      },
      [emitChange],
    )

    const handleBold = () => exec('bold')
    const handleItalic = () => exec('italic')
    const handleUnderline = () => exec('underline')
    const handleUnorderedList = () => exec('insertUnorderedList')
    const handleOrderedList = () => exec('insertOrderedList')

    const handleLink = () => {
      const url = window.prompt(t('linkPrompt'), 'https://')
      if (!url) return
      if (!/^https?:\/\//i.test(url)) {
        toast.error(t('linkError'))
        return
      }
      exec('createLink', url)
    }

    const handleImageClick = () => {
      fileInputRef.current?.click()
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // 重置 input 以便重复选择同一文件
      e.target.value = ''
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error(t('imageTypeError'))
        return
      }

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const r = await fetchApi<UploadResult>('/api/upload/image', {
          method: 'POST',
          body: formData,
        })
        if (!r.success) throw new Error(r.error)

        // 在光标处插入图片
        editorRef.current?.focus()
        document.execCommand('insertImage', false, r.data.url)
        emitChange()
        toast.success(t('imageSuccess'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('imageError'))
      } finally {
        setIsUploading(false)
      }
    }

    return (
      <div className={cn('overflow-hidden rounded-lg border', className)}>
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
          <button type="button" className={TOOL_BTN_CLASS} title={t('bold')} onClick={handleBold}>
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('italic')}
            onClick={handleItalic}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('underline')}
            onClick={handleUnderline}
          >
            <Underline className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('unorderedList')}
            onClick={handleUnorderedList}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('orderedList')}
            onClick={handleOrderedList}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('insertLink')}
            onClick={handleLink}
          >
            <LinkIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={TOOL_BTN_CLASS}
            title={t('insertImage')}
            onClick={handleImageClick}
            disabled={isUploading}
          >
            <ImageIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 编辑区 */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={emitChange}
          onBlur={emitChange}
          className="min-h-[300px] p-4 text-sm leading-relaxed outline-none [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&:empty]:before:text-muted-foreground [&:empty]:before:content-[attr(data-placeholder)]"
        />

        {/* 隐藏的图片选择 input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>
    )
  },
)

export default RichTextEditor
