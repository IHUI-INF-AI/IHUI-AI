// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈发布卡：文本 + 最多 9 张图片 URL，仅 bridge 后端；含遍历结果语义展示与归档查询面板。
 */

'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatActionResult, WechatMomentFetchResult } from '@ihui/types'
import { wechatHubApi } from './wechat-hub-api'
import {
  describeMomentFetchStatus,
  formatMomentExtra,
  formatMomentFields,
  formatMomentMediaStats,
} from './moment-status'
import MomentArchivePanel from './MomentArchivePanel'
import MomentLocalMedia from './MomentLocalMedia'

function momentTime(value: number | null): string {
  if (!value) return '时间未识别'
  const ms = value < 1_000_000_000_000 ? value * 1000 : value
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? '时间未识别' : date.toLocaleString('zh-CN')
}

export default function MomentCard({
  accountId,
  readOnly = false,
}: {
  accountId: string
  readOnly?: boolean
}) {
  const queryClient = useQueryClient()
  const [text, setText] = React.useState('')
  const [media, setMedia] = React.useState('')
  const [result, setResult] = React.useState<WechatActionResult | null>(null)
  const [fetchResult, setFetchResult] = React.useState<WechatMomentFetchResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)
  const [fetchPages, setFetchPages] = React.useState('10')

  const mutation = useMutation({
    mutationFn: () =>
      wechatHubApi.publishMoment(accountId, {
        text: text.trim(),
        mediaUrls: media
          .split(/[\s,，]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: (data) => {
      setError(null)
      setResult(data)
    },
    onError: (e) => {
      setResult(null)
      setError(e instanceof Error ? e.message : '发布朋友圈失败')
    },
  })

  const fetchMutation = useMutation({
    mutationFn: () => {
      const maxPages = Math.min(Math.max(Number(fetchPages) || 3, 1), 30)
      return wechatHubApi.fetchMoments(accountId, { maxPages })
    },
    onSuccess: (data) => {
      setFetchError(null)
      setFetchResult(data)
      // 抓取成功后归档表已 upsert；让归档面板立即重读，而不是继续显示旧缓存。
      void queryClient.invalidateQueries({
        queryKey: ['wechat-hub', 'moments-archive', accountId],
      })
    },
    onError: (e) => {
      setFetchResult(null)
      setFetchError(e instanceof Error ? e.message : '遍历朋友圈失败')
    },
  })

  const fetchStatus = fetchResult
    ? describeMomentFetchStatus({
        stopReason: fetchResult.stopReason,
        limitReached: fetchResult.limitReached,
        occludedBy: fetchResult.occludedBy,
        fetched: fetchResult.fetched,
      })
    : null
  const mediaStats = fetchResult ? formatMomentMediaStats(fetchResult) : null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-body">朋友圈</CardTitle>
        <CardDescription>
          {readOnly
            ? '截图 OCR 只读接入：可遍历、归档和查看本地媒体，不支持发布朋友圈。'
            : '发布仅 bridge 后端；遍历由 OCR 后台多页滚屏或 wcfhttp /pyq 回调，只读不伪造。'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {readOnly ? null : (
          <>
            <div className="space-y-1">
              <Label htmlFor="wechat-moment-text">正文</Label>
              <textarea
                id="wechat-moment-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-stroke-field bg-transparent px-3 py-2 text-sm outline-none focus:border-stroke-focus"
                placeholder="这条会发到账号朋友圈。"
              />
              <p className="text-xs text-muted-foreground">{text.length} / 5000</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wechat-moment-media">图片 URL（逗号或换行分隔，可选）</Label>
              <Input
                id="wechat-moment-media"
                value={media}
                onChange={(e) => setMedia(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </>
        )}
        <div className="space-y-2 rounded-md border border-stroke-field p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">遍历朋友圈</p>
              <p className="text-xs text-muted-foreground">
                OCR 后台滚屏，默认 10 页，最多 30 页；wcfhttp 刷新最新页并等回调。
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor="wechat-moment-pages" className="text-xs text-muted-foreground">
                  页数
                </Label>
                <Input
                  id="wechat-moment-pages"
                  type="number"
                  min={1}
                  max={30}
                  value={fetchPages}
                  onChange={(e) => setFetchPages(e.target.value)}
                  className="h-7 w-16 px-2 text-xs"
                />
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setFetchResult(null)
                setFetchError(null)
                fetchMutation.mutate()
              }}
              disabled={fetchMutation.isPending}
            >
              {fetchMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span>遍历朋友圈</span>
            </Button>
          </div>
          {fetchError ? <Alert variant="danger" title="遍历失败" description={fetchError} /> : null}
          {fetchResult && fetchStatus ? (
            <Alert
              variant={fetchStatus.tone}
              title={fetchStatus.title}
              description={
                <>
                  {fetchStatus.description}
                  {fetchResult.archive ? ` · 归档 ${fetchResult.archive.total} 条` : ''}
                </>
              }
            />
          ) : null}
          {fetchResult && fetchResult.fields ? (
            <p className="text-xs text-muted-foreground">
              {formatMomentFields(fetchResult.fields)}
            </p>
          ) : null}
          {mediaStats ? <p className="text-xs text-muted-foreground">{mediaStats}</p> : null}
          {fetchResult && fetchResult.moments.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-auto pr-1">
              {fetchResult.moments.map((moment) => {
                const extra = formatMomentExtra(moment)
                return (
                  <div key={moment.id} className="rounded-md bg-muted/40 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{moment.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {momentTime(moment.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words">{moment.content}</p>
                    {moment.mediaUrls.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {moment.mediaUrls.length} 个媒体
                        {moment.imageCount ? ` · ${moment.imageCount} 张图片` : ''}
                        {moment.videoCount ? ` · ${moment.videoCount} 段视频` : ''}
                      </p>
                    ) : null}
                    {moment.mediaLocalDir ? (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        本地媒体：{moment.mediaLocalDir}
                      </p>
                    ) : null}
                    {moment.mediaLocalDir ? (
                      <MomentLocalMedia accountId={accountId} momentId={moment.id} />
                    ) : null}
                    {moment.mediaDownloadError ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        图片未落盘：{moment.mediaDownloadError}
                      </p>
                    ) : null}
                    {moment.likeUsers && moment.likeUsers.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        点赞：{moment.likeUsers.slice(0, 6).join('、')}
                        {moment.likeUsers.length > 6 ? ` 等 ${moment.likeUsers.length} 人` : ''}
                      </p>
                    ) : null}
                    {moment.commentsData && moment.commentsData.length > 0 ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                        评论：
                        {moment.commentsData
                          .slice(0, 4)
                          .map((item) => item.content)
                          .join(' / ')}
                        {moment.commentsData.length > 4
                          ? ` 等 ${moment.commentsData.length} 条`
                          : ''}
                      </p>
                    ) : null}
                    {extra ? <p className="mt-1 text-xs text-muted-foreground">{extra}</p> : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
        <MomentArchivePanel accountId={accountId} />
        {readOnly ? null : (
          <>
            {result ? (
              <Alert
                variant={
                  result.ok ? 'success' : result.status === 'unsupported' ? 'warning' : 'danger'
                }
                title={
                  result.ok
                    ? '桥已接受'
                    : result.status === 'unsupported'
                      ? '当前后端不支持'
                      : '发布失败'
                }
                description={result.reason ?? (result.ok ? '动作已交给桥执行。' : '桥未返回原因')}
              />
            ) : null}
            {error ? <Alert variant="danger" title="请求失败" description={error} /> : null}
            <Button
              onClick={() => {
                setResult(null)
                setError(null)
                mutation.mutate()
              }}
              disabled={mutation.isPending || text.trim().length === 0}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span>发布朋友圈</span>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
