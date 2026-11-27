// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Download, Loader2, Maximize2, MessageSquare, Minimize2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { fetchRaw } from '@/lib/api'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useFileHandoffStore } from '@/stores/file-handoff'
import { AiDocumentPanel, canAnalyzeWithAi } from './ai-document-panel'
import { UniversalFilePreview } from './universal-file-preview'

/**
 * 统一文件查看器弹窗(2026-11-26 立,文档中心 / 项目文件 / IDE 共用)。
 *
 * 立因:仓库文件、项目上传文件、工作区文件三条链路都要"带鉴权取字节 → 全格式预览",
 * 各自写一遍 blob 生命周期与工具栏必然漂移。这里收成一份:
 *  - `load` 缺省走 `fetchRaw(src)`;IDE 传 POST `/fs/raw` 的读取函数,不必伪造 URL;
 *  - 工具栏提供原文件下载与全屏切换,尺寸信息取实际 blob;
 *  - 渲染仍交 `UniversalFilePreview`,本组件不管格式。
 */

export interface FileViewerTarget {
  /** 必须带扩展名:判型靠它(blob URL 自身没有后缀) */
  readonly name: string
  /** 同源取件地址;给了 `load` 时可省略 */
  readonly src?: string
  /** 覆盖取件方式(如 IDE 的 POST /fs/raw) */
  readonly load?: () => Promise<Blob>
  /** 标题下的附加说明(项目名 / 相对路径) */
  readonly subtitle?: string
}

interface Props {
  target: FileViewerTarget | null
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : 'FILE'
}

export function FileViewerDialog({ target, onClose }: Props) {
  const t = useTranslations('docs.projectFiles')
  const [url, setUrl] = React.useState<string | null>(null)
  const [blob, setBlob] = React.useState<Blob | null>(null)
  const [size, setSize] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    setExpanded(false)
    setAiOpen(false)
    if (!target) {
      setUrl(null)
      setBlob(null)
      setSize(0)
      setLoading(false)
      setFailed(false)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setBlob(null)
    setSize(0)
    setFailed(false)
    setLoading(true)
    const load = target.load ?? (() => fetchRaw(target.src ?? ''))
    void load()
      .then((loaded) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(loaded)
        setBlob(loaded)
        setSize(loaded.size)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [target, reloadKey])

  const download = () => {
    if (!url || !target) return
    const a = document.createElement('a')
    a.href = url
    a.download = target.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  /**
   * 查看器 → 主 AI 对话(2026-11-27 立):
   * 不再让用户“关掉查看器 → 去聊天页 → 手动再上传一遍”,而是把当前已取到的字节
   * 直接排进跨组件交接队列,打开 AISidePanel 后由根输入区消费成附件 chip。
   * 预填一句 prompt,用户仍可改写;不自动发送(上传是异步的,自动发送会在附件未 ready
   * 时被 canSendReferences 拦下,反而像“点了没反应”)。
   */
  const continueInChat = () => {
    if (!target || !blob) return
    // 与 /api/office/analyze、主对话附件上下文统一 20MB 闸:超限就别先上传再等报错。
    if (blob.size > 20 * 1024 * 1024) {
      toast.error(t('aiTooLarge'))
      return
    }
    const file = new File([blob], target.name, {
      type: blob.type || 'application/octet-stream',
      lastModified: Date.now(),
    })
    useFileHandoffStore.getState().enqueue({ file, prompt: t('aiContinuePrompt') })
    useAiPanelStore.getState().openPanel()
    onClose()
  }

  const aiAvailable = !!target && canAnalyzeWithAi(target.name)

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          expanded
            ? 'h-[92vh] max-w-[96vw]'
            : aiOpen
              ? 'h-[88vh] max-w-[min(96vw,78rem)]'
              : 'max-w-3xl',
        )}
      >
        <DialogHeader className="pr-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="break-words">{target?.name ?? ''}</DialogTitle>
              {target ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {extOf(target.name)}
                  </span>
                  {size > 0 ? <span className="tabular-nums">{formatBytes(size)}</span> : null}
                  {target.subtitle ? (
                    <span className="max-w-[40ch] truncate" title={target.subtitle}>
                      {target.subtitle}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {aiAvailable ? (
                <Button
                  variant={aiOpen ? 'secondary' : 'ghost'}
                  size="sm"
                  disabled={!blob}
                  onClick={() => setAiOpen((v) => !v)}
                  aria-label={t('aiAnalyze')}
                  title={t('aiAnalyze')}
                  className="gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span className="hidden text-xs sm:inline">{t('aiAnalyze')}</span>
                </Button>
              ) : null}
              {aiAvailable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!blob}
                  onClick={continueInChat}
                  aria-label={t('aiContinueChat')}
                  title={t('aiContinueChat')}
                  className="gap-1.5"
                >
                  <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span className="hidden text-xs sm:inline">{t('aiContinueChat')}</span>
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                disabled={!url}
                onClick={download}
                aria-label={t('download')}
                title={t('download')}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? t('exitFullscreen') : t('fullscreen')}
                title={expanded ? t('exitFullscreen') : t('fullscreen')}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div
          className={cn(
            'min-h-0 overflow-y-auto',
            aiOpen && 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]',
          )}
        >
          <div className="min-h-[300px] min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('loading')}
              </div>
            ) : failed ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <p className="text-center text-body text-muted-foreground">{t('previewFailed')}</p>
                <Button variant="outline" size="sm" onClick={() => setReloadKey((v) => v + 1)}>
                  {t('retry')}
                </Button>
              </div>
            ) : url && target ? (
              <UniversalFilePreview
                src={url}
                name={target.name}
                className={expanded ? 'max-h-[72vh]' : 'max-h-[60vh]'}
              />
            ) : null}
          </div>
          {aiOpen && blob && target ? (
            <AiDocumentPanel
              file={blob}
              name={target.name}
              onClose={() => setAiOpen(false)}
              className="max-h-[60vh] lg:h-[60vh] lg:max-h-none"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
