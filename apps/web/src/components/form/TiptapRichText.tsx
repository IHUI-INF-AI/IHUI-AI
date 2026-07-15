'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { TiptapToolbar } from './TiptapToolbar'
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
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
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

    if (!editor) return <div className={cn('overflow-hidden rounded-lg border', className)} />

    return (
      <div className={cn('overflow-hidden rounded-lg border', className)}>
        <TiptapToolbar editor={editor} />
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none [&_.tiptap]:min-h-[200px] [&_.tiptap]:p-3 [&_.tiptap]:outline-none [&_img]:max-w-full [&_img]:rounded-md [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:my-4 [&_table]:border-collapse [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_.column-resize-handle]:absolute [&_.column-resize-handle]:right-0 [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-primary/40 [&_.column-resize-handle]:pointer-events-none [&_.selectedCell]:relative [&_.selectedCell]:after:absolute [&_.selectedCell]:after:inset-0 [&_.selectedCell]:after:bg-primary/15 [&_.selectedCell]:after:content-['']"
        />
      </div>
    )
  }),
)

export default TiptapRichText
