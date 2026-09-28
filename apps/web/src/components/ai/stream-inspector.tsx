// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D116 原始 SSE 全帧检查器(G-230,开发者 transcript,对标 Codex TUI Ctrl+R):
// 开发者视角的主流原始帧视图 —— 逐帧(seq/时间/类型/字节)+ 类型过滤 + 单帧复制 +
// 整流导出 JSONL。数据源 = api-client stream-frame-log(采集默认关闭,本面板手动开关),
// 不新增采集层。与 D40③(subagent 会话内容 transcript)边界见 stream-frame-log.ts 文件头。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Download, Play, Square, Trash2 } from 'lucide-react'
import { toast } from '@/components/common'
import {
  clearStreamFrames,
  countStreamFrames,
  exportStreamFramesJsonl,
  getStreamFrames,
  isStreamFrameCaptureOn,
  setStreamFrameCapture,
} from '@ihui/api-client'
import type { RawStreamFrame } from '@ihui/api-client'

/** 列表最多渲染的帧数(完整数据仍可导出 JSONL;不做完整虚拟化,注明即可) */
const RENDER_CAP = 300
/** 展开帧的正文最多显示字符数 */
const RAW_PREVIEW_CAP = 2000

export function StreamInspector() {
  const t = useTranslations('aiToolsPanel.inspector')
  const [on, setOn] = React.useState(false)
  const [frames, setFrames] = React.useState<readonly RawStreamFrame[]>([])
  const [total, setTotal] = React.useState(0)
  const [kindFilter, setKindFilter] = React.useState('')
  const [expandedSeq, setExpandedSeq] = React.useState<number | null>(null)
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // 采集开启时每 500ms 拉一次快照(环形缓冲只读,无需订阅机制)
  React.useEffect(() => {
    if (!on) {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
      return
    }
    const pull = () => {
      setFrames(getStreamFrames())
      setTotal(countStreamFrames())
    }
    pull()
    tickRef.current = setInterval(pull, 500)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [on])

  const kinds = React.useMemo(() => {
    const set = new Set<string>()
    for (const f of frames) set.add(f.kind)
    return Array.from(set).sort()
  }, [frames])

  const visible = React.useMemo(() => {
    const filtered = kindFilter ? frames.filter((f) => f.kind === kindFilter) : frames
    return filtered.slice(-RENDER_CAP)
  }, [frames, kindFilter])

  const toggle = () => {
    const next = !isStreamFrameCaptureOn()
    setStreamFrameCapture(next)
    setOn(next)
  }

  const copyFrame = async (f: RawStreamFrame) => {
    try {
      await navigator.clipboard.writeText(f.raw)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const exportJsonl = () => {
    const text = exportStreamFramesJsonl()
    if (!text) {
      toast.info(t('empty'))
      return
    }
    const blob = new Blob([text], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sse-frames-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-2" data-testid="stream-inspector">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
            on
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-muted text-foreground hover:bg-accent'
          }`}
        >
          {on ? (
            <Square className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          <span>{on ? t('stop') : t('start')}</span>
        </button>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="h-7 rounded-md border border-input bg-card px-1.5 text-xs"
          aria-label={t('filter')}
        >
          <option value="">{t('filterAll')}</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportJsonl}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          <span>{t('export')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            clearStreamFrames()
            setFrames([])
            setTotal(0)
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs hover:bg-accent"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          <span>{t('clear')}</span>
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {t('count', { total: String(total), shown: String(visible.length) })}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {on ? t('waiting') : t('hint')}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 font-mono text-[11px] leading-relaxed">
          {visible.map((f) => {
            const isOpen = expandedSeq === f.seq
            return (
              <li key={f.seq} className="rounded-xs bg-muted/40">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-1.5 py-0.5 text-left hover:bg-accent/50"
                  onClick={() => setExpandedSeq(isOpen ? null : f.seq)}
                >
                  <span className="w-12 shrink-0 text-muted-foreground tabular-nums">#{f.seq}</span>
                  <span className="w-14 shrink-0 text-muted-foreground tabular-nums">
                    {(f.atMs / 1000).toFixed(2)}s
                  </span>
                  <span className="w-24 shrink-0 truncate font-medium text-teal-600 dark:text-teal-400">
                    {f.kind}
                  </span>
                  <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                    {f.bytes}B
                  </span>
                  <span className="truncate text-muted-foreground">{f.raw.slice(0, 80)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t('copyOne')}
                    className="ml-auto shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      void copyFrame(f)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation()
                        void copyFrame(f)
                      }
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </span>
                </button>
                {isOpen && (
                  <pre className="mx-1.5 mb-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xs bg-background p-1.5 text-[10px]">
                    {f.raw.length > RAW_PREVIEW_CAP ? `${f.raw.slice(0, RAW_PREVIEW_CAP)}…` : f.raw}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {total > RENDER_CAP && (
        <p className="text-[10px] text-muted-foreground">
          {t('truncated', { total: String(total) })}
        </p>
      )}
    </div>
  )
}
