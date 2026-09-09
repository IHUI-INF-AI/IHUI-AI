// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy, Download, Image as ImageIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { extractFileAssets, type ExtractedFileAsset } from '@ihui/api-client'

export interface MarkdownResult {
  fileName: string
  markdown: string
  /** 源文件 ID(用于「提取图片」接口调用);纯文本结果可为空。 */
  fileId?: string
}

interface Props {
  result: MarkdownResult | null
  onClose: () => void
}

/** 提取出的图片资产网格卡片 */
function AssetGrid({ assets, loading }: { assets: ExtractedFileAsset[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }
  const images = assets.filter((a) => a.mediaType.startsWith('image/'))
  if (!images.length) return null
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((asset) => (
        <a
          key={asset.id}
          href={asset.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {asset.extension} · {(asset.size / 1024).toFixed(1)} KB
          </div>
        </a>
      ))}
    </div>
  )
}

/** 转换结果展示:GFM 渲染 + 复制原文 + 下载 .md + 提取内嵌图片(2026-09-09 anydoc 深度融合) */
export function MarkdownResultDialog({ result, onClose }: Props) {
  const t = useTranslations('workspace.convertMarkdownDialog')
  const fileId = result?.fileId ?? null
  const [copied, setCopied] = React.useState(false)
  const [copyFailed, setCopyFailed] = React.useState(false)
  const [extracting, setExtracting] = React.useState(false)
  const [assets, setAssets] = React.useState<ExtractedFileAsset[]>([])
  const [unsupported, setUnsupported] = React.useState(false)
  const [assetsOpen, setAssetsOpen] = React.useState(false)

  React.useEffect(() => {
    if (!result) {
      setCopied(false)
      setCopyFailed(false)
      setAssets([])
      setUnsupported(false)
      setAssetsOpen(false)
    }
  }, [result])

  const handleExtractImages = async () => {
    if (!fileId || extracting) return
    setExtracting(true)
    try {
      const res = await extractFileAssets(fileId)
      if (res.success) {
        if (res.data.unsupported) {
          setUnsupported(true)
          setAssets([])
        } else {
          setAssets(res.data.assets ?? [])
          setUnsupported(false)
        }
      } else {
        console.error('extract images failed', res.error)
      }
      setAssetsOpen(true)
    } catch (e) {
      console.error('extract images failed', e)
    } finally {
      setExtracting(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    // 双通道复制:async Clipboard API 优先;失败(窗口非聚焦/权限受限 webview/旧浏览器)
    // 降级 execCommand('copy') 临时 textarea,最大化复制成功率。
    const legacyCopy = (): boolean => {
      try {
        const ta = document.createElement('textarea')
        ta.value = result.markdown
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }
    try {
      await navigator.clipboard.writeText(result.markdown)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (legacyCopy()) {
        setCopied(true)
        setCopyFailed(false)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setCopyFailed(true)
      }
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.fileName.replace(/\.[^.]+$/, '')}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <Dialog
      open={!!result}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="break-words">{result?.fileName}</DialogTitle>
        </DialogHeader>
        <div className="mb-2 flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? t('copied') : t('copy')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!result}>
            <Download className="mr-1 h-4 w-4" />
            {t('download')}
          </Button>
          {fileId && (
            <Button variant="outline" size="sm" onClick={handleExtractImages} disabled={!result || extracting}>
              <ImageIcon className="mr-1 h-4 w-4" />
              {extracting ? t('extracting') : t('extractImages')}
            </Button>
          )}
          {copyFailed && <span className="self-center text-xs text-destructive">{t('copyFailed')}</span>}
        </div>
        <div className="min-h-[200px] overflow-y-auto rounded-md border bg-muted/20 p-4 text-sm">
          <ReactMarkdown
            // anydoc 输出为 GFM:表格/删除线/任务列表需 remark-gfm 才能渲染成真实元素
            remarkPlugins={[remarkGfm]}
            components={{
              // Markdown 内长表/长代码块横向滚动,不撑破弹窗
              table: (props) => (
                <div className="overflow-x-auto">
                  <table {...props} />
                </div>
              ),
              pre: (props) => (
                <pre className="overflow-x-auto" {...props} />
              ),
            }}
          >
            {result?.markdown ?? ''}
          </ReactMarkdown>
          {assetsOpen && (
            <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}>
              <DialogContent className="max-h-[70vh] max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('extractedImages')}</DialogTitle>
                  {unsupported && <p className="text-sm text-muted-foreground">{t('assetNotSupported')}</p>}
                  {!unsupported && assets.length === 0 && !extracting && (
                    <p className="text-sm text-muted-foreground">{t('extractedNone')}</p>
                  )}
                </DialogHeader>
                <div className="overflow-y-auto py-2">
                  <AssetGrid assets={assets} loading={extracting} />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
