'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

const SyntaxHighlighter = dynamic(
  () =>
    import('react-syntax-highlighter').then((mod) => mod.Prism as unknown as ComponentType<any>),
  { ssr: false },
)

export default SyntaxHighlighter
