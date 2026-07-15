'use client'

import * as React from 'react'
import { type Editor } from '@tiptap/react'
import { useTranslations } from 'next-intl'
import { chunkUpload } from '@/lib/file-utils'
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
  Table as TableIcon,
  Minus,
  Trash2,
  Rows3,
  Columns3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

function handleSetLink(editor: Editor, promptText: string) {
  const url = window.prompt(promptText, 'https://')
  if (url === null) return
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

async function handleSetImage(editor: Editor, failedPromptText: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const result = await chunkUpload(file, '/api/upload/chunk')
      editor.chain().focus().setImage({ src: result.url }).run()
    } catch {
      const fallbackUrl = window.prompt(failedPromptText, 'https://')
      if (fallbackUrl) editor.chain().focus().setImage({ src: fallbackUrl }).run()
    }
  }
  input.click()
}

export function TiptapToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('editor.toolbar')
  const inTable = editor.isActive('table')
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2">
      <ToolbarBtn
        icon={Bold}
        title={t('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
      />
      <ToolbarBtn
        icon={Italic}
        title={t('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
      />
      <ToolbarBtn
        icon={UnderlineIcon}
        title={t('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
      />
      <ToolbarBtn
        icon={Strikethrough}
        title={t('strikethrough')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
      />
      <Sep />
      <ToolbarBtn
        icon={Heading1}
        title={t('heading1')}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
      />
      <ToolbarBtn
        icon={Heading2}
        title={t('heading2')}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
      />
      <ToolbarBtn
        icon={Heading3}
        title={t('heading3')}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
      />
      <Sep />
      <ToolbarBtn
        icon={List}
        title={t('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
      />
      <ToolbarBtn
        icon={ListOrdered}
        title={t('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
      />
      <Sep />
      <ToolbarBtn
        icon={Quote}
        title={t('quote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
      />
      <ToolbarBtn
        icon={Code}
        title={t('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
      />
      <Sep />
      <ToolbarBtn
        icon={LinkIcon}
        title={t('link')}
        onClick={() => handleSetLink(editor, t('linkPrompt'))}
        active={editor.isActive('link')}
      />
      <ToolbarBtn
        icon={ImageIcon}
        title={t('image')}
        onClick={() => handleSetImage(editor, t('imageUploadFailedPrompt'))}
      />
      <Sep />
      <ToolbarBtn
        icon={AlignLeft}
        title={t('alignLeft')}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
      />
      <ToolbarBtn
        icon={AlignCenter}
        title={t('alignCenter')}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
      />
      <ToolbarBtn
        icon={AlignRight}
        title={t('alignRight')}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
      />
      <Sep />
      <ToolbarBtn
        icon={TableIcon}
        title={t('insertTable')}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        active={inTable}
      />
      <ToolbarBtn
        icon={Rows3}
        title={t('addRow')}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!inTable}
      />
      <ToolbarBtn
        icon={Columns3}
        title={t('addColumn')}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!inTable}
      />
      <ToolbarBtn
        icon={Minus}
        title={t('deleteRow')}
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!inTable}
      />
      <ToolbarBtn
        icon={Minus}
        title={t('deleteColumn')}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!inTable}
      />
      <ToolbarBtn
        icon={Trash2}
        title={t('deleteTable')}
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!inTable}
      />
      <Sep />
      <ToolbarBtn
        icon={Undo}
        title={t('undo')}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      />
      <ToolbarBtn
        icon={Redo}
        title={t('redo')}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      />
    </div>
  )
}
