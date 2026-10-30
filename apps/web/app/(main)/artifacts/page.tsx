// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

'use client'

/**
 * 产物中心(G3 Beyond-Coding 泛化 · 用户面 Web 入口,2026-10-30 立)
 *
 * 数据源:apps/api `GET /api/artifacts`(枚举,人 JWT,分页键 list/total/page/pageSize)
 * 与 `GET /api/artifacts/:id/download`(导出下载,auth_token cookie 同源自动附带)。
 * 预览:html_report 走 ai-service 既有签名预览链路
 * (`GET /api/artifacts/token?file=<payload_ref>` 换 30 分钟签名 token →
 *  iframe/新窗口直读 `/api/artifacts/f/<token>`,归属由 payload 同址 `.owner`
 *  sidecar 校验);非 html_report 无内联形态,不提供预览。
 * 结构照抄 settings/devices 页:Card/Table/Button + useTranslations +
 *  useAuthGate + BackButton。
 */

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Download, Eye, Loader2, MessageSquare, PackageOpen, RefreshCw } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { fetchAiServiceJson, fetchApi } from '@ihui/api-client'
import type { DeliverableKind } from '@ihui/shared/artifact'

import { BackButton, AuthGatePrompt } from '@/components/common'
import { Alert } from '@/components/feedback'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { cn } from '@/lib/utils'

/** 枚举端投影行(与 apps/api GET /api/artifacts 的 list 项逐字段对齐) */
interface ArtifactListItem {
  id: string
  kind: DeliverableKind
  name: string
  version: number
  created_at: string
  session_id: string
  /** 签名预览链指针(ai-service token 端点的 file 参数) */
  payload_ref: string
}

interface ArtifactListData {
  list: ArtifactListItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 50

/** kind → 徽标配色(报告紫、演示蓝、表格绿、文档灰、视频琥珀;与 devices 页 TASK_STATUS_CLASS 同法) */
const KIND_CLASS: Record<DeliverableKind, string> = {
  html_report: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  slides: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  sheet: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  doc: 'bg-muted text-muted-foreground',
  video_ref: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

/** created_at → 相对时间文案(阈值与 settings/devices 页 formatLastSeen 一致) */
function formatCreated(
  iso: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const diff = Date.now() - ms
  if (diff < 10_000) return t('justNow')
  if (diff < 60_000) return t('secondsAgo', { n: Math.floor(diff / 1000) })
  if (diff < 3_600_000) return t('minutesAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('hoursAgo', { n: Math.floor(diff / 3_600_000) })
  return t('daysAgo', { n: Math.floor(diff / 86_400_000) })
}

export default function ArtifactsPage() {
  const t = useTranslations('artifacts')
  // 登录态门(与 settings/devices 同型):未就绪不发注定 401 的请求
  const { ready, allow } = useAuthGate()

  const [items, setItems] = React.useState<ArtifactListItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState('')
  const [previewError, setPreviewError] = React.useState('')

  const load = React.useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const res = await fetchApi<ArtifactListData>(
          `/api/artifacts?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        )
        if (res.success && res.data) {
          const list = res.data.list ?? []
          setItems((prev) => (append ? [...prev, ...list] : list))
          setTotal(res.data.total ?? 0)
          setPage(targetPage)
        } else {
          setError(res.error || t('loadFailed'))
        }
      } catch {
        setError(t('loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [t],
  )

  React.useEffect(() => {
    if (!allow) return
    void load(1, false)
  }, [allow, load])

  /** html_report 预览:换签名 token 后新窗口直读(iframe 免 Authorization 的既有链路) */
  const handlePreview = React.useCallback(
    async (item: ArtifactListItem) => {
      setPreviewError('')
      try {
        const res = await fetchAiServiceJson<{ token: string; url: string; expires_in: number }>(
          '/api/artifacts/token',
          { params: { file: item.payload_ref } },
        )
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank', 'noopener')
        } else {
          setPreviewError(t('previewFailed'))
        }
      } catch {
        setPreviewError(t('previewFailed'))
      }
    },
    [t],
  )

  if (!ready) {
    return (
      <div className="px-4 space-y-4 py-4">
        <BackButton />
        <p className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }
  if (!allow) {
    return (
      <div className="px-4 space-y-4 py-4">
        <BackButton />
        <AuthGatePrompt message={t('loginRequired')} />
      </div>
    )
  }

  const hasMore = items.length < total

  return (
    <div className="px-4 space-y-4 py-4">
      <BackButton />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">{t('desc')}</p>
          {error && <Alert variant="danger" title={error} closable className="mb-3" />}
          {previewError && (
            <Alert variant="danger" title={previewError} closable className="mb-3" />
          )}
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('loading')}</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colKind')}</TableHead>
                      <TableHead>{t('colVersion')}</TableHead>
                      <TableHead>{t('colCreated')}</TableHead>
                      <TableHead>{t('colSession')}</TableHead>
                      <TableHead>{t('colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} data-testid={`artifact-row-${item.id}`}>
                        <TableCell className="max-w-[240px] truncate text-xs font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('border-transparent', KIND_CLASS[item.kind])}
                          >
                            {t(`kind_${item.kind}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">v{item.version}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatCreated(item.created_at, t)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/chat?conversationId=${encodeURIComponent(item.session_id)}`}
                            data-testid={`session-link-${item.id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t('viewSession')}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* video_ref 无导出形态(下载端点 400),按钮禁用 */}
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              disabled={item.kind === 'video_ref'}
                            >
                              <a
                                href={`/api/artifacts/${item.id}/download`}
                                data-testid={`download-artifact-${item.id}`}
                                rel="noopener"
                                className={cn(
                                  item.kind === 'video_ref' && 'pointer-events-none opacity-50',
                                )}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                {t('download')}
                              </a>
                            </Button>
                            {/* 签名预览链路只服务 .html 产物:仅 html_report 出预览按钮 */}
                            {item.kind === 'html_report' && (
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`preview-artifact-${item.id}`}
                                onClick={() => void handlePreview(item)}
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                {t('preview')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('countSummary', { loaded: items.length, total })}
                </span>
                <div className="flex items-center gap-2">
                  {hasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="artifacts-load-more"
                      disabled={loadingMore}
                      onClick={() => void load(page + 1, true)}
                    >
                      {loadingMore ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      {t('loadMore')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="artifacts-refresh"
                    disabled={loading}
                    onClick={() => void load(1, false)}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    {t('refresh')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
