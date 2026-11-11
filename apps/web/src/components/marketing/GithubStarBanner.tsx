// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Code, MessageCircle, Star } from 'lucide-react'
import { withBasePath } from '@/config/base-path'

/** 星标数按千分位展示真实数字,不缩写(缩写会让"真实数字"失真)。 */
const STAR_FORMATTER = new Intl.NumberFormat('zh-CN')

/** 客户端刷新间隔:与服务端 /github-stars.json 的 5 分钟缓存同档。 */
const STAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * 读取仓库当前星标数(经本站代理,见 src/config/github-stars.ts)。
 * 取不到时返回 null,按钮保持原样、不显示数字,不用写死值兜底。
 * 页面常开时每 5 分钟刷新一次,保证展示的是最新值。
 */
function useGithubStars(): number | null {
  const [stars, setStars] = React.useState<number | null>(null)

  React.useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(withBasePath('/github-stars.json'), { cache: 'no-store' })
        if (!res.ok) return
        const data: unknown = await res.json()
        const value = (data as { stars?: unknown } | null)?.stars
        if (alive && typeof value === 'number' && Number.isFinite(value)) setStars(value)
      } catch {
        /* 网络抖动/上游不可达:保持当前展示,不影响页面其它内容 */
      }
    }
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, STAR_REFRESH_INTERVAL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return stars
}

/**
 * GitHub Star 引导 banner
 * 紧凑横向条带,放在营销首页 Marquee 下方,引流到 GitHub 仓库 star / Discussions / PR 支持。
 */
export function GithubStarBanner(): React.JSX.Element {
  const stars = useGithubStars()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="https://github.com/IHUI-INF-AI/IHUI-AI"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 ui-control rounded-sm border bg-card px-2.5 py-1 text-label font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Code className="h-3.5 w-3.5" />
          <span>Star on GitHub</span>
          <span
            className="inline-flex items-center gap-1 tabular-nums"
            data-testid="github-star-count"
          >
            <Star className="h-3 w-3 text-amber-500" />
            {stars !== null && <span>{STAR_FORMATTER.format(stars)}</span>}
          </span>
        </Link>
        <Link
          href="https://github.com/IHUI-INF-AI/IHUI-AI/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 ui-control rounded-sm border bg-card px-2.5 py-1 text-label text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>社区讨论</span>
        </Link>
        <Link
          href="https://github.com/e2b-dev/awesome-ai-agents/pull/1313"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 ui-control rounded-sm border bg-card px-2.5 py-1 text-label text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Star className="h-3.5 w-3.5" />
          <span>支持 awesome PR</span>
        </Link>
      </div>
      <Link
        href="https://aizhs.top"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center justify-center gap-2 rounded-lg border-2 border-brand-accent-deep bg-card px-5 py-2.5 text-body font-semibold shadow-elevation-sm transition-all animate-[pulse_2s_ease-in-out_infinite] dark:shadow-primary/20"
      >
        <Image
          src="/images/logo.png?v=20261021"
          alt="IHUI AI"
          width={28}
          height={28}
          className="h-7 w-7 rounded-lg"
        />
        <div className="flex flex-col items-start">
          <span>在线体验 AI 助手</span>
          <span className="text-label font-normal text-muted-foreground">
            aizhs.top · 无需部署，开箱即用
          </span>
        </div>
      </Link>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
