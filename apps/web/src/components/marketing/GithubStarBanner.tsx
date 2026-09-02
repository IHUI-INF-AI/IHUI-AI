// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Code, MessageCircle, Star } from 'lucide-react'

/**
 * GitHub Star 引导 banner
 * 紧凑横向条带,放在营销首页 Marquee 下方,引流到 GitHub 仓库 star / Discussions / PR 支持。
 */
export function GithubStarBanner(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
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
      <Link
        href="https://aizhs.top"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg animate-[pulse_2s_ease-in-out_infinite] dark:shadow-primary/20"
      >
        <Image
          src="/images/logo.png?v=20260719-unify"
          alt="IHUI AI"
          width={28}
          height={28}
          className="h-7 w-7 rounded-lg"
        />
        <div className="flex flex-col items-start">
          <span>在线体验 AI 助手</span>
          <span className="text-xs font-normal text-muted-foreground">
            aizhs.top · 无需部署，开箱即用
          </span>
        </div>
      </Link>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
