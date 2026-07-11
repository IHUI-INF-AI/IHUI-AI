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
