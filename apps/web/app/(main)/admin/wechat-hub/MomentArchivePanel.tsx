// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈归档查询面板：读取数据库 / 桥本地 JSONL 留存的历史动态，只读。
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Alert } from '@/components/feedback'
import type { WechatMomentArchiveView } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import MomentLocalMedia from './MomentLocalMedia'

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
  const archiveQuery = useQuery({
    queryKey: ['wechat-hub', 'moments-archive', accountId],
    queryFn: () => wechatHubApi.fetchMomentArchive(accountId, { limit: 50 }),
  })

  const archive = archiveQuery.data ?? null
  const storageLabel = archive ? (STORAGE_LABELS[archive.storage] ?? '不可用') : null

  return (
    <div className="space-y-2 rounded-sm border border-stroke-field p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">朋友圈归档</p>
          <p className="text-xs text-muted-foreground">
            读取已落库或桥本地留存的历史动态，只读不回写。
          </p>
        </div>
        {archive ? (
          <span className="text-xs text-muted-foreground">
            来源 {storageLabel} · 共 {archive.total} 条 · 上限 {archive.limit} 条
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

      {archive && archive.moments.length === 0 && !archiveQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">归档里还没有动态。</p>
      ) : null}

      {archive && archive.moments.length > 0 ? (
        <div className="max-h-64 space-y-2 overflow-auto pr-1">
          {archive.moments.map((moment) => (
            <div key={moment.id} className="rounded-sm bg-muted/40 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {moment.authorName.trim() || '未命名'}
                  {moment.authorResolved ? null : (
                    <span className="ml-1 text-xs text-muted-foreground">（未映射身份）</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatArchiveTime(moment.lastSeenAt || moment.firstSeenAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {moment.content.trim() || '（无正文）'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                被抓到 {moment.seenCount} 次
                {moment.mediaUrls.length > 0 ? ` · ${moment.mediaUrls.length} 个媒体` : ''}
                {moment.likeUsers && moment.likeUsers.length > 0
                  ? ` · 点赞 ${moment.likeUsers.length} 人`
                  : ''}
                {moment.commentsData && moment.commentsData.length > 0
                  ? ` · 评论 ${moment.commentsData.length} 条`
                  : ''}
              </p>
              {moment.mediaLocalDir ? (
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  本地媒体：{moment.mediaLocalDir}
                </p>
              ) : null}
              {moment.mediaLocalDir ? (
                <MomentLocalMedia accountId={accountId} momentId={moment.id} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
