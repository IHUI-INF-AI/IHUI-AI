// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import dynamic from 'next/dynamic'
import type { ComponentType, CSSProperties } from 'react'

interface PrismProps {
  language?: string
  children?: string
  style?: Record<string, CSSProperties>
  customStyle?: CSSProperties
  [key: string]: unknown
}

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then((mod) => mod.Prism as ComponentType<PrismProps>),
  { ssr: false },
)

export default SyntaxHighlighter
