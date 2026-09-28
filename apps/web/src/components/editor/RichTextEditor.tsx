// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
