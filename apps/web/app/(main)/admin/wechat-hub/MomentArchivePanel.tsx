// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈归档查询面板：读取数据库 / 桥本地 JSONL 留存的历史动态，只读。
 * 数据库来源按 50 条一页无限翻页，避免 715 条只能看到最新 50 条。
 */

'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatMomentArchiveView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import { formatMomentComments } from './moment-comment-format'
import MomentLocalMedia from './MomentLocalMedia'

const ARCHIVE_PAGE_SIZE = 50

const STORAGE_LABELS: Record<WechatMomentArchiveView['storage'], string> = {
  database: '数据库',
  bridge: '桥本地 JSONL',
  none: '不可用',
}

function formatArchiveTime(value: string | null): string {
  if (!value) return '时间未识别'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未识别' : date.toLocaleString('zh-CN')
}

export default function MomentArchivePanel({ accountId }: { accountId: string }) {
  const archiveQuery = useInfiniteQuery({
    queryKey: ['wechat-hub', 'moments-archive', accountId, 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      wechatHubApi.fetchMomentArchive(accountId, {
        limit: ARCHIVE_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.moments.length
      return next < lastPage.total ? next : undefined
    },
  })

  const pages = archiveQuery.data?.pages ?? []
  const archive = pages[0] ?? null
  const moments = pages.flatMap((page) => page.moments)
  const storageLabel = archive ? (STORAGE_LABELS[archive.storage] ?? '不可用') : null
  const canPage = archive?.storage === 'database'

  return (
    <div className="space-y-2 rounded-md border border-stroke-field p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">朋友圈归档</p>
          <p className="text-xs text-muted-foreground">
            读取已落库或桥本地留存的历史动态，只读不回写。
          </p>
        </div>
        {archive ? (
          <span className="text-xs text-muted-foreground">
            来源 {storageLabel} · 已显示 {moments.length} / 共 {archive.total} 条
            {archive.mediaStats
              ? ` · 媒体原件可读 ${archive.mediaStats.available} / 声明 ${archive.mediaStats.declared}（不可得 ${archive.mediaStats.missing}）`
              : ''}
          </span>
        ) : null}
      </div>

      {archiveQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载归档中…</span>
        </div>
      ) : null}

      {archiveQuery.isError ? (
        <Alert
          variant="danger"
          title="归档加载失败"
          description={
            archiveQuery.error instanceof Error ? archiveQuery.error.message : '未知错误'
          }
        />
      ) : null}

      {archive?.reason ? (
        <Alert variant="warning" title="归档来源降级" description={archive.reason} />
      ) : null}

      {archive && moments.length === 0 && !archiveQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">归档里还没有动态。</p>
      ) : null}

      {archive && moments.length > 0 ? (
        <div className="max-h-64 space-y-2 overflow-auto pr-1">
          {moments.map((moment) => {
            const commentView = formatMomentComments(moment.commentsData)
            const previewLines = commentView.lines.slice(0, 2)
            return (
              <div key={moment.id} className="rounded-md bg-muted/40 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {moment.authorName.trim() || '未命名'}
                  {moment.authorResolved ? null : (
                    <span className="ml-1 text-xs text-muted-foreground">（未映射身份）</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatArchiveTime(moment.lastSeenAt || moment.firstSeenAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {moment.content.trim() || '（无正文）'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                被抓到 {moment.seenCount} 次
                {moment.mediaUrls.length > 0
                  ? ` · ${moment.mediaCount ?? moment.mediaUrls.length} 个媒体`
                  : ''}
                {moment.mediaAvailableCount !== undefined
                  ? ` · 本地可读 ${moment.mediaAvailableCount}/${moment.mediaCount ?? moment.mediaUrls.length}`
                  : ''}
                {moment.likeUsers && moment.likeUsers.length > 0
                  ? ` · 点赞 ${moment.likeUsers.length} 人`
                  : ''}
                {commentView.total > 0
                  ? ` · 评论 ${commentView.total} 条`
                  : ''}
              </p>
              {commentView.total > 0 ? (
                <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                  {previewLines.map((line, index) => (
                    <p key={index} className="whitespace-pre-wrap break-words">{line}</p>
                  ))}
                  {commentView.total > previewLines.length ? (
                    <p className="whitespace-pre-wrap">等 {commentView.total} 条</p>
                  ) : null}
                </div>
              ) : null}
              {moment.mediaMissingCount && moment.mediaMissingCount > 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {moment.mediaMissingCount}{' '}
                  个媒体原件已过期，微信服务器不再提供；未使用占位图或伪造图片。
                </p>
              ) : null}
              {moment.mediaLocalDir ? (
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  本地媒体：{moment.mediaLocalDir}
                </p>
              ) : null}
              {moment.mediaLocalDir ? (
                <MomentLocalMedia accountId={accountId} momentId={moment.momentKey ?? moment.id} />
              ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {canPage && archiveQuery.hasNextPage ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            每页 {ARCHIVE_PAGE_SIZE} 条，可继续读取更早动态
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={archiveQuery.isFetchingNextPage}
            onClick={() => void archiveQuery.fetchNextPage()}
          >
            {archiveQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
          </Button>
        </div>
      ) : null}
      {canPage && !archiveQuery.hasNextPage && moments.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          已显示全部 {archive?.total ?? moments.length} 条。
        </p>
      ) : null}
    </div>
  )
}
