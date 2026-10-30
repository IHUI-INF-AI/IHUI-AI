// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Check, Copy, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useClipboard } from '@/hooks/use-clipboard'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'

/** 详情面读数(与 GET /api/admin/relay/logs/:id 的 data 同形) */
interface RawTextReadout {
  state: 'present' | 'absent' | 'empty' | 'purged' | 'never-written' | 'unjudged'
  storedChars: number | null
  returnedChars: number | null
  text: string | null
  readSideCapped: boolean
  writerTruncated: boolean
  readerCap: number
}

interface LogDetail {
  id: string
  createdAt: string
  userId: string
  username: string | null
  email: string | null
  model: string
  callType: string
  providerCode: string | null
  status: string
  httpStatus: number | null
  latencyMs: number
  ttftMs: number | null
  costCents: number | null
  refunded: boolean
  retryable: number
  errorMessage: string | null
  conversationId: string | null
  traceId: string | null
  callerKeyId: string | null
  configId: number | null
  accountKeyPoolId: string | null
  clientIp: string | null
  usage: {
    prompt: number
    completion: number
    total: number
    cacheRead: number
    cacheCreation: number
  }
  rawRetention: { retained: boolean; retentionDays: number | null; purgedAt: string | null }
  prompt: RawTextReadout
  response: RawTextReadout
  metadata: Record<string, unknown> | null
  metadataState: 'read' | 'unjudged'
  sanitized: boolean
}

/** 正文列状态的如实文案:六种状态互斥,尤其不得把「未判定」与「无正文」混成一句话 */
const RAW_STATE_LABEL: Record<RawTextReadout['state'], string> = {
  present: '正文可读',
  empty: '正文为空串',
  absent: '无正文(本次调用未产出文本)',
  purged: '原文已按留存策略到期清除',
  'never-written': '本行未落原文(写入侧已关闭留存)',
  unjudged: '未判定:后端未取到该列',
}

const RAW_STATE_CLASS: Record<RawTextReadout['state'], string> = {
  present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  empty: 'bg-muted text-muted-foreground',
  absent: 'bg-muted text-muted-foreground',
  purged: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'never-written': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  unjudged: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

/** 一格一读数:标签在上、读数在下,读数整条单行(守门 240 R8) */
function Readout({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="whitespace-nowrap text-xs tabular-nums">{value}</div>
    </div>
  )
}

function RawTextBlock({ title, readout }: { title: string; readout: RawTextReadout }) {
  const { copy, copied } = useClipboard()
  const locale = useLocale()
  const numFmt = new Intl.NumberFormat(locale)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{title}</span>
        <span
          className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] ${RAW_STATE_CLASS[readout.state]}`}
        >
          {RAW_STATE_LABEL[readout.state]}
        </span>
        {readout.storedChars !== null && (
          <span className="whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
            库中 {numFmt.format(readout.storedChars)} 字符
            {readout.returnedChars !== null
              ? ` / 回显 ${numFmt.format(readout.returnedChars)}`
              : ''}
          </span>
        )}
        {readout.text !== null && (
          <Tooltip content={copied ? '已复制' : '复制正文'}>
            <span className="inline-flex">
              <Button size="icon-2xs" variant="ghost" onClick={() => void copy(readout.text ?? '')}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">复制 {title}</span>
              </Button>
            </span>
          </Tooltip>
        )}
      </div>
      {/* 两处截断是两件不同的事,必须分开说:库里的正文本身就不是全文 / 面板这一屏没显示全 */}
      {readout.writerTruncated && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          写入侧已截断:库中原文尾部带截断标记,这份正文入库时就不是全文。
        </p>
      )}
      {readout.readSideCapped && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          读取侧已截断:脱敏出口单次封顶 {numFmt.format(readout.readerCap)} 字符,超出部分不显示。
        </p>
      )}
      {readout.text !== null ? (
        <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs">
          {readout.text}
        </pre>
      ) : (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          无可显示正文
        </p>
      )}
    </div>
  )
}

export function LogDetailDialog({
  logId,
  onOpenChange,
}: {
  logId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const locale = useLocale()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'relay', 'logs', 'detail', logId],
    enabled: !!logId,
    queryFn: async () => {
      const r = await fetchApi<LogDetail>(`/api/admin/relay/logs/${logId}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })
  const numFmt = new Intl.NumberFormat(locale)

  return (
    <Dialog open={!!logId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>单条请求详情</DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {logId ?? ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取详情…
          </div>
        ) : isError ? (
          // 取不到输入就明说"未判定",不渲染一份看起来完整的空详情
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            详情未判定:读取失败 —— {error instanceof Error ? error.message : '未知错误'}
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 min-[520px]:grid-cols-3">
              <Readout label="时间" value={fmt.format(new Date(data.createdAt))} />
              <Readout label="用户" value={data.username ?? data.userId.slice(0, 8)} />
              <Readout label="模型" value={data.model} />
              <Readout label="状态" value={data.status} />
              <Readout
                label="HTTP"
                value={data.httpStatus === null ? '未记录' : numFmt.format(data.httpStatus)}
              />
              <Readout label="厂商" value={data.providerCode ?? '未记录'} />
              <Readout label="延迟(ms)" value={numFmt.format(data.latencyMs)} />
              <Readout
                label="首字(ms)"
                value={data.ttftMs === null ? '无' : numFmt.format(data.ttftMs)}
              />
              <Readout
                label="成本(¥)"
                value={data.costCents === null ? '未记录' : (data.costCents / 100).toFixed(4)}
              />
              <Readout label="计量" value={numFmt.format(data.usage.total)} />
              <Readout
                label="入 / 出"
                value={`${numFmt.format(data.usage.prompt)}/${numFmt.format(data.usage.completion)}`}
              />
              <Readout
                label="缓存读 / 写"
                value={`${numFmt.format(data.usage.cacheRead)}/${numFmt.format(data.usage.cacheCreation)}`}
              />
              <Readout
                label="可重试档"
                value={
                  data.status === 'success'
                    ? '不适用'
                    : data.retryable === 1
                      ? '可重试'
                      : '不可重试'
                }
              />
              <Readout label="调用类型" value={data.callType} />
              <Readout label="已退款" value={data.refunded ? '是' : '否'} />
              <Readout
                label="原文留存"
                value={
                  data.rawRetention.retained
                    ? `在存 ${data.rawRetention.retentionDays ?? '默认'} 天`
                    : '已关闭'
                }
              />
              <Readout
                label="清除时刻"
                value={
                  data.rawRetention.purgedAt
                    ? fmt.format(new Date(data.rawRetention.purgedAt))
                    : '从未清除'
                }
              />
              <Readout label="客户端 IP" value={data.clientIp ?? '未记录'} />
            </div>

            {data.errorMessage && (
              <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">错误信息:</span>
                <span className="break-words">{data.errorMessage}</span>
              </div>
            )}

            <RawTextBlock title="Prompt 正文" readout={data.prompt} />
            <RawTextBlock title="Response 正文" readout={data.response} />

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                metadata
                {data.metadataState === 'unjudged' && (
                  <span className="whitespace-nowrap rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600 dark:text-red-400">
                    未判定:后端未取到该列
                  </span>
                )}
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                  凭据类键已整值剥除
                </span>
              </div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-mono text-xs">
                {data.metadata === null ? '(无 metadata)' : JSON.stringify(data.metadata, null, 2)}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Readout label="会话 id" value={data.conversationId ?? '无'} />
              <Readout label="Trace id" value={data.traceId ?? '未记录'} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
