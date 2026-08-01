'use client'

import * as React from 'react'
import { Eye } from 'lucide-react'
import { useIsPreviewDraft } from '@/hooks/use-home-schema'

/**
 * 草稿预览模式提示条(P3-4.6)。
 *
 * 当 URL 含 ?preview=draft 时,在页面顶部(GlobalTopBar 下方)显示琥珀色提示条,
 * 让 admin 一眼看出当前为草稿预览,生产环境未变化。
 * 非预览模式时不渲染任何内容。
 *
 * 固定定位(top-[50px] = GlobalTopBar 高度),z-40 低于 modal(z-50)但高于内容。
 */
export function PreviewBanner(): React.ReactElement | null {
  const isPreviewDraft = useIsPreviewDraft()
  if (!isPreviewDraft) return null
  return (
    <div className="fixed left-0 right-0 top-[50px] z-40 flex items-center justify-center gap-1.5 bg-amber-500/95 px-4 py-1.5 text-center text-xs font-medium text-white shadow-sm">
      <Eye className="h-3.5 w-3.5" />
      草稿预览模式 — 此为 admin 草稿预览,生产环境未变化
    </div>
  )
}
