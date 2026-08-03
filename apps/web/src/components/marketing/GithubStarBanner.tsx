'use client'

import * as React from 'react'
import Link from 'next/link'
import { Code, MessageCircle, Star } from 'lucide-react'

/**
 * GitHub Star 引导 banner
 * 紧凑横向条带,放在营销首页 Marquee 下方,引流到 GitHub 仓库 star / Discussions / PR 支持。
 */
export function GithubStarBanner(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
      <Link
        href="https://github.com/IHUI-INF-AI/IHUI-AI"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <Code className="h-3.5 w-3.5" />
        <span>Star on GitHub</span>
        <Star className="h-3 w-3 text-amber-500" />
      </Link>
      <Link
        href="https://github.com/IHUI-INF-AI/IHUI-AI/discussions"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>社区讨论</span>
      </Link>
      <Link
        href="https://github.com/e2b-dev/awesome-ai-agents/pull/1313"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
      >
        <Star className="h-3.5 w-3.5" />
        <span>支持 awesome PR</span>
      </Link>
    </div>
  )
}
