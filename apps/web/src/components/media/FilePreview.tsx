// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { OfficeViewer } from './OfficeViewer'
import { ThreeDViewer } from './ThreeDViewer'
import { PDFViewer } from './PDFViewer'
import {
  PreviewFileUpdatedBar,
  PreviewNoContentState,
  PreviewSnapshotNotice,
  usePreviewCopy,
} from './preview-degradation-banner'
import { usePreviewMediaProbe, usePreviewTextFeed } from './use-preview-staleness'

interface FilePreviewProps {
  url: string
  type?: 'pdf' | 'office' | 'image' | 'text' | '3d' | 'auto'
  name?: string
  className?: string
}

export function FilePreview({ url, type = 'auto', name, className }: FilePreviewProps) {
  const detectedType = React.useMemo(() => {
    if (type !== 'auto') return type
    const ext = url.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext ?? '')) return 'office'
    if (['glb', 'gltf', 'obj', 'stl'].includes(ext ?? '')) return '3d'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext ?? '')) return 'image'
    if (['txt', 'md', 'json', 'csv', 'log'].includes(ext ?? '')) return 'text'
    return 'text'
  }, [url, type])

  if (detectedType === 'image') {
    return <ImagePreview url={url} name={name} className={className} />
  }

  if (detectedType === 'pdf') {
    return <PDFViewer url={url} className={className} />
  }

  if (detectedType === 'office') {
    return <OfficeViewer url={url} fileName={name} className={className} />
  }

  if (detectedType === '3d') {
    const ext = url.split('.').pop()?.toLowerCase()
    const format = (ext && ['glb', 'gltf', 'obj', 'stl'].includes(ext) ? ext : 'glb') as
      'glb' | 'gltf' | 'obj' | 'stl'
    return <ThreeDViewer url={url} format={format} className={className} />
  }

  return <TextPreview url={url} className={className} />
}

function TextPreview({ url, className }: { url: string; className?: string }) {
  const t = useTranslations('a11y')
  const copy = usePreviewCopy(t)
  const feed = usePreviewTextFeed(url)

  if (feed.loading) return <div className="p-3 text-sm text-muted-foreground">{t('loading')}</div>

  // 什么都没读到、也没有任何历史记录可展示:明说"没有可预览内容"并给出刷新这一步
  if (feed.notice === 'no-content')
    return (
      <PreviewNoContentState
        copy={copy}
        refreshLabel={t('refresh')}
        onRefresh={feed.refresh}
        className={className}
      />
    )

  return (
    <div
      data-preview-state={feed.isRecord ? 'record' : 'current'}
      className={cn('flex min-h-0 flex-col overflow-hidden rounded-md bg-muted', className)}
    >
      {feed.fileUpdated && (
        <PreviewFileUpdatedBar
          copy={copy}
          closeLabel={t('closeAlert')}
          onApply={feed.applyLatest}
          onDismiss={feed.dismissFileUpdated}
        />
      )}
      <PreviewSnapshotNotice
        isRecord={feed.isRecord}
        notice={feed.notice}
        readAt={feed.readAt}
        copy={copy}
      />
      <pre className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        <code>{feed.content}</code>
      </pre>
    </div>
  )
}

/**
 * 图片预览也走同一套内容身份判定(D90 降级依据"资源还能不能取到",与是否文本无关):
 * 取不到但手里有此前取到的内容 → 明说这是工具记录里的历史图片;两头都空 → L4。
 * 渲染源仍用调用方给的 url(可能是带有效期的签名地址),不改成 blob:那会牵动 CSP,
 * 且图片读不到时 L2 文案已把"看到的不是当前文件"说清楚。
 */
function ImagePreview({
  url,
  name,
  className,
}: {
  url: string
  name?: string
  className?: string
}) {
  const t = useTranslations('a11y')
  const copy = usePreviewCopy(t)
  const feed = usePreviewMediaProbe(url)

  if (feed.notice === 'no-content')
    return (
      <PreviewNoContentState
        copy={copy}
        refreshLabel={t('refresh')}
        onRefresh={feed.refresh}
        className={className}
      />
    )

  return (
    <div
      data-preview-state={feed.isRecord ? 'record' : 'current'}
      className={cn('flex min-h-0 flex-col', className)}
    >
      <PreviewSnapshotNotice
        isRecord={feed.isRecord}
        notice={feed.notice}
        readAt={feed.readAt}
        copy={copy}
      />
      <Image
        src={url}
        alt={name ?? 'preview'}
        width={800}
        height={600}
        unoptimized
        className="h-auto w-auto min-h-0 max-h-full max-w-full flex-1 object-contain"
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
