// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BarChart3, PenLine } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  formatSuccessRate,
  pickTopPlatform,
  type PlatformSlice,
} from './start-review-helpers'

interface ReviewOverview {
  totalPublished?: number
  successRate?: number
  platformDistribution?: ReadonlyArray<PlatformSlice>
}

const PLATFORM_LABEL: Record<string, string> = {
  wechat: '公众号',
  weibo: '微博',
  xiaohongshu: '小红书',
  douyin: '抖音',
  bilibili: 'B站',
  zhihu: '知乎',
  toutiao: '头条',
  kuaishou: '快手',
  shipinhao: '视频号',
  csdn: 'CSDN',
  juejin: '掘金',
  wordpress: 'WordPress',
  medium: 'Medium',
  youtube: 'YouTube',
}

/**
 * 首页 7 天复盘:把“发完之后呢”接回生产动作。
 *
 * 只读 /api/publish/analytics/overview?period=7d,不新增后端口径。
 * 没有发布记录时给第一条内容的入口,不渲染空图表。
 */
export function StartReview() {
  const [data, setData] = React.useState<ReviewOverview | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void fetchApi<ReviewOverview>('/api/publish/analytics/overview?period=7d')
      .then((r) => {
        if (!cancelled && r.success && r.data) setData(r.data)
      })
      .catch(() => {
        // 复盘只是增强入口;接口不可用时不抢首页八卡的注意力。
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const published = Math.max(0, data.totalPublished ?? 0)
  const top = pickTopPlatform(data.platformDistribution ?? [])
  const successRate = formatSuccessRate(data.successRate ?? 0)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-body font-medium">
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
              最近 7 天复盘
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {published > 0
                ? '发布结果已经回来，下一步是照着有效的主阵地继续写。'
                : '这周还没有发布记录。先出一篇草稿，发完再回来复盘。'}
            </p>
          </div>
          <Link href="/publish/analytics" className="text-caption text-primary hover:underline">
            看完整数据
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-caption text-muted-foreground">发布</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{published} 篇</div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-caption text-muted-foreground">成功率</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{successRate}</div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-caption text-muted-foreground">主阵地</div>
            <div className="mt-1 truncate text-lg font-semibold">
              {top ? (PLATFORM_LABEL[top.platform] ?? top.platform) : '还没有'}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/publish/ai-draft">
            <Button size="sm" variant={published > 0 ? 'default' : 'outline'} className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              {top ? `再写一篇${PLATFORM_LABEL[top.platform] ?? top.platform}` : '写第一篇'}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
          {published > 0 && top && (
            <span className="text-caption text-muted-foreground">
              主阵地来自最近 7 天发布分布，不代表流量承诺。
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
