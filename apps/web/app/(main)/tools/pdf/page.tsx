'use client'

import * as React from 'react'
import Link from 'next/link'
import { FileText, GitMerge, Scissors, Stamp, FileOutput, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@ihui/ui-react'

interface PdfTool {
  href: string
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
}

const TOOLS: PdfTool[] = [
  {
    href: '/tools/pdf/merge',
    title: 'PDF 合并',
    description: '将多个 PDF 文件按顺序合并为一个文档',
    Icon: GitMerge,
  },
  {
    href: '/tools/pdf/split',
    title: 'PDF 拆分',
    description: '按页码范围、固定页数或书签拆分为多个文件',
    Icon: Scissors,
  },
  {
    href: '/tools/pdf/watermark',
    title: 'PDF 水印',
    description: '为 PDF 添加文字水印，自定义位置、颜色与角度',
    Icon: Stamp,
  },
  {
    href: '/tools/pdf/convert',
    title: 'PDF 转换',
    description: 'PDF 与 Word / Excel / 图片 互转',
    Icon: FileOutput,
  },
]

export default function PdfToolsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/tools" className="transition-colors hover:text-foreground">
          工具
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">PDF 工具</span>
      </nav>
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PDF 工具</h1>
          <p className="text-sm text-muted-foreground">在线处理 PDF：合并、拆分、水印与格式转换</p>
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map(({ href, title, description, Icon }) => (
          <Link key={href} href={href} className="group block">
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm">{title}</CardTitle>
                  <CardDescription className="text-xs">{description}</CardDescription>
                </div>
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                  进入
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
