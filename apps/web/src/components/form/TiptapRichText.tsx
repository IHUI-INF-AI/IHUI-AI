'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TiptapEditorHandle {
  getHTML: () => string
  focus: () => void
}

export interface TiptapRichTextProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  editable?: boolean
  className?: string
}

const TOOL_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40'

function ToolbarBtn({
  icon: Icon,
  onClick,
  active,
  title,
  disabled,
}: {
  icon: React.FC<{ className?: string }>
  onClick: () => void
  active?: boolean
  title: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(TOOL_BTN, active && 'bg-primary/10 text-primary')}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

const Sep = () => <span className="mx-1 h-4 w-px bg-border" />

export const TiptapRichText = React.memo(
  React.forwardRef<TiptapEditorHandle, TiptapRichTextProps>(function TiptapRichText(
    { value, onChange, placeholder, editable = true, className },
    ref,
  ) {
    const onChangeRef = React.useRef(onChange)
    onChangeRef.current = onChange

    const editor = useEditor({
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
        Image,
        Placeholder.configure({ placeholder: placeholder || '请输入内容...' }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ],
      content: value || '',
      editable,
      onUpdate: ({ editor }) => {
        onChangeRef.current?.(editor.getHTML())
      },
    })

    React.useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() ?? '',
        focus: () => editor?.commands.focus(),
      }),
      [editor],
    )

    React.useEffect(() => {
      if (editor && value !== undefined && editor.getHTML() !== value) {
        editor.commands.setContent(value, false)
      }
    }, [value, editor])

    React.useEffect(() => {
      if (editor) editor.setEditable(editable)
    }, [editable, editor])

    const handleSetLink = () => {
      const url = window.prompt('输入链接地址', 'https://')
      if (url === null) return
      if (url === '') {
        editor?.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    const handleSetImage = () => {
      const url = window.prompt('输入图片地址', 'https://')
      if (!url) return
      editor?.chain().focus().setImage({ src: url }).run()
    }

    if (!editor) return <div className={cn('overflow-hidden rounded-lg border', className)} />

    return (
      <div className={cn('overflow-hidden rounded-lg border', className)}>
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
          <ToolbarBtn
            icon={Bold}
            title="加粗"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
          />
          <ToolbarBtn
            icon={Italic}
            title="斜体"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
          />
          <ToolbarBtn
            icon={UnderlineIcon}
            title="下划线"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
          />
          <ToolbarBtn
            icon={Strikethrough}
            title="删除线"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
          />
          <Sep />
          <ToolbarBtn
            icon={Heading1}
            title="标题1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
          />
          <ToolbarBtn
            icon={Heading2}
            title="标题2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
          />
          <ToolbarBtn
            icon={Heading3}
            title="标题3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
          />
          <Sep />
          <ToolbarBtn
            icon={List}
            title="无序列表"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
          />
          <ToolbarBtn
            icon={ListOrdered}
            title="有序列表"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
          />
          <Sep />
          <ToolbarBtn
            icon={Quote}
            title="引用"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
          />
          <ToolbarBtn
            icon={Code}
            title="代码块"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
          />
          <Sep />
          <ToolbarBtn
            icon={LinkIcon}
            title="链接"
            onClick={handleSetLink}
            active={editor.isActive('link')}
          />
          <ToolbarBtn icon={ImageIcon} title="图片" onClick={handleSetImage} />
          <Sep />
          <ToolbarBtn
            icon={AlignLeft}
            title="左对齐"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
          />
          <ToolbarBtn
            icon={AlignCenter}
            title="居中"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
          />
          <ToolbarBtn
            icon={AlignRight}
            title="右对齐"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
          />
          <Sep />
          <ToolbarBtn
            icon={Undo}
            title="撤销"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          />
          <ToolbarBtn
            icon={Redo}
            title="重做"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          />
        </div>
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:min-h-[200px] [&_.tiptap]:p-3 [&_.tiptap]:outline-none [&_img]:max-w-full [&_img]:rounded-md"
        />
      </div>
    )
  }),
)

export default TiptapRichText
