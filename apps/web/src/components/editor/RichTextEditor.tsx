'use client'

import * as React from 'react'
import { TiptapRichText, type TiptapEditorHandle } from '@/components/form/TiptapRichText'

export type RichTextEditorHandle = TiptapEditorHandle

export interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  className?: string
}

export const RichTextEditor = React.memo(
  React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
    { value, onChange, placeholder, className },
    ref,
  ) {
    return (
      <TiptapRichText
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        editable
        className={className}
      />
    )
  }),
)

export default RichTextEditor
