'use client'

/**
 * DesignPage(Web 端,从 desktop DesignPage.tsx 迁移,2026-07-24)。
 *
 * 左 HTML 输入 → 中 iframe 渲染(srcDoc + 注入选中脚本)→ 右 CSS 面板,
 * 点击元素 postMessage 回父窗口,可编辑 style 后回推 iframe 实时更新;
 * 顶部"保存预览" POST /api/design/preview,底部"评论到对话"回调 onComment。
 *
 * 适配点(相对 desktop):
 *  - 'use client' 指令(Next.js App Router)
 *  - useI18n() → useTranslations()(root,支持 design. / common. 跨命名空间)
 *  - useTheme() → @/hooks/use-theme(基于 next-themes,用 resolvedTheme 派生 isDark)
 *  - fetchApi from @/lib/api(已封装 token + baseURL)
 *  - lib 路径 ../lib/* → @/lib/design/*
 *
 * 零 Tauri 依赖,纯浏览器 API(iframe srcDoc + postMessage + DOMParser + fetch)。
 *
 * 本文件为组合根:状态/副作用/回调集中在此,视觉区块拆分为 DesignToolbar /
 * DesignLeftPanel / HtmlSourceEditor / PreviewCanvas / InspectorPanel / TemplateDialog。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import type {
  DesignComment,
  DesignPreview,
  DesignPreviewResponse,
} from '@ihui/shared/design/element'
import { useTheme } from '@/hooks/use-theme'
import { createComment, exportCode, generateHtml, listComments } from '@/lib/design/design-api'
import type { ExportFormat } from '@/lib/design/code-exporter'
import { applySnap, computeGuides } from '@/lib/design/alignment-guides'
import type { ElementRect } from '@/lib/design/alignment-guides'
import {
  DEFAULT_CUSTOM_WIDTH,
  DEFAULT_DEVICE_ID,
  RESPONSIVE_DEVICES,
  getDeviceRadius,
} from '@/lib/design/responsive-devices'
import { buildSrcDoc, parseHtmlToTree } from './design-utils'
import { DEFAULT_HTML } from './css-config'
import type { RightPanelTab, SelectedElement, TreeNode } from './design-types'

interface HistoryState {
  stack: string[]
  index: number
}
import { DesignToolbar } from './DesignToolbar'
import { DesignLeftPanel } from './DesignLeftPanel'
import { HtmlSourceEditor } from './HtmlSourceEditor'
import { PreviewCanvas } from './PreviewCanvas'
import { InspectorPanel } from './InspectorPanel'
import { TemplateDialog } from './TemplateDialog'

interface DesignPageProps {
  onComment?: (c: { elementId: string; comment: string; html: string }) => void
}

export default function DesignPage({ onComment }: DesignPageProps) {
  const t = useTranslations()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [html, setHtml] = useState(DEFAULT_HTML)
  const [renderedHtml, setRenderedHtml] = useState(DEFAULT_HTML)
  const [history, setHistory] = useState<HistoryState>({ stack: [DEFAULT_HTML], index: 0 })
  const [selected, setSelected] = useState<SelectedElement | null>(null)
  const [styleEdits, setStyleEdits] = useState<Record<string, string>>({})
  const [previewName, setPreviewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentMsg, setCommentMsg] = useState('')
  const [previews, setPreviews] = useState<DesignPreview[]>([])
  const [previewsLoading, setPreviewsLoading] = useState(false)
  const [previewsError, setPreviewsError] = useState('')

  // 当前预览 ID(保存后获得,用于关联评论)
  const [currentPreviewId, setCurrentPreviewId] = useState<string>('')
  const [comments, setComments] = useState<DesignComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentPosting, setCommentPosting] = useState(false)
  const [rightTab, setRightTab] = useState<RightPanelTab>('css')
  const [guidesEnabled, setGuidesEnabled] = useState(true)

  // AI 生成相关
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiMsg, setAiMsg] = useState('')

  // 导出代码相关
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const exportRef = useRef<HTMLDivElement>(null)

  // 响应式预览相关(P2-b):设备切换 + 自定义宽度 + 设备外框开关
  const [selectedDeviceId, setSelectedDeviceId] = useState(DEFAULT_DEVICE_ID)
  const [customWidth, setCustomWidth] = useState(DEFAULT_CUSTOM_WIDTH)
  const [customWidthInput, setCustomWidthInput] = useState(String(DEFAULT_CUSTOM_WIDTH))
  const [customInputOpen, setCustomInputOpen] = useState(false)
  const [showDeviceFrame, setShowDeviceFrame] = useState(true)
  const customInputRef = useRef<HTMLDivElement>(null)

  // 模板库相关(P2-a):8 个行业模板,点击应用 setHtml + pushHistory
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

  const srcDoc = useMemo(() => buildSrcDoc(renderedHtml, isDark), [renderedHtml, isDark])
  const tree = useMemo(() => parseHtmlToTree(renderedHtml), [renderedHtml])

  const currentDevice = useMemo(
    () => RESPONSIVE_DEVICES.find((d) => d.id === selectedDeviceId) ?? RESPONSIVE_DEVICES[4]!,
    [selectedDeviceId],
  )
  const currentWidth = currentDevice.id === 'custom' ? customWidth : currentDevice.width
  const deviceRadius = getDeviceRadius(currentDevice.category)
  const showFrame = showDeviceFrame && currentDevice.category !== 'desktop'

  const historyRef = useRef(history)
  historyRef.current = history
  const htmlRef = useRef(html)
  htmlRef.current = html
  const currentPreviewIdRef = useRef(currentPreviewId)
  currentPreviewIdRef.current = currentPreviewId

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  )

  const pushHistory = useCallback((snapshot: string) => {
    const prev = historyRef.current
    if (prev.stack[prev.index] === snapshot) return
    const truncated = prev.stack.slice(0, prev.index + 1)
    const next: HistoryState = { stack: [...truncated, snapshot], index: truncated.length }
    historyRef.current = next
    setHistory(next)
  }, [])

  const loadPreviews = useCallback(async () => {
    setPreviewsLoading(true)
    setPreviewsError('')
    try {
      const res = await fetchApi<{ previews: DesignPreview[]; total: number }>('/design/previews')
      if (res.success) {
        setPreviews(res.data.previews ?? [])
      } else {
        setPreviewsError(res.error)
      }
    } catch (err) {
      setPreviewsError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreviewsLoading(false)
    }
  }, [])

  const loadComments = useCallback(async (previewId: string) => {
    if (!previewId) {
      setComments([])
      return
    }
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const list = await listComments(previewId)
      setComments(list)
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : String(err))
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreviews()
  }, [loadPreviews])

  useEffect(() => {
    if (currentPreviewId) loadComments(currentPreviewId)
    else setComments([])
  }, [currentPreviewId, loadComments])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.__ihui !== true || d.type !== 'select') return
      setSelected({
        elementId: d.elementId,
        tagName: d.tagName,
        text: d.text,
        style: d.style as Record<string, string>,
      })
      setStyleEdits({ ...(d.style as Record<string, string>) })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // P1-c: 拖拽消息处理 — 接收 iframe 拖拽位置,计算参考线 + 吸附,回传 iframe 绘制
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.__ihui !== true) return
      if (d.type === 'drag-move' && d.rect && d.others) {
        if (guidesEnabled) {
          const dragged = d.rect as ElementRect
          const others = d.others as ElementRect[]
          const guides = computeGuides(dragged, others)
          iframeRef.current?.contentWindow?.postMessage(
            { __ihui: true, type: 'render-guides', guides },
            '*',
          )
          const snap = applySnap(dragged, guides)
          if (Math.abs(snap.x - dragged.x) > 0.5 || Math.abs(snap.y - dragged.y) > 0.5) {
            iframeRef.current?.contentWindow?.postMessage(
              { __ihui: true, type: 'apply-snap', x: snap.x, y: snap.y },
              '*',
            )
          }
        }
      } else if (d.type === 'drag-end' && typeof d.html === 'string') {
        setHtml(d.html)
        setRenderedHtml(d.html)
        pushHistory(d.html)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [guidesEnabled, pushHistory])

  const onStyleChange = (prop: string, value: string) => {
    setStyleEdits((prev) => ({ ...prev, [prop]: value }))
    iframeRef.current?.contentWindow?.postMessage(
      { __ihui: true, type: 'update-style', style: { [prop]: value } },
      '*',
    )
  }

  const onResetStyles = () => {
    setStyleEdits({})
    iframeRef.current?.contentWindow?.postMessage({ __ihui: true, type: 'reset-style' }, '*')
  }

  const onRender = useCallback(() => {
    const current = htmlRef.current
    setRenderedHtml(current)
    pushHistory(current)
  }, [pushHistory])

  const onUndo = useCallback(() => {
    const prev = historyRef.current
    if (prev.index <= 0) return
    const nextIndex = prev.index - 1
    const snap = prev.stack[nextIndex]
    if (snap === undefined) return
    const next: HistoryState = { ...prev, index: nextIndex }
    historyRef.current = next
    setHistory(next)
    setHtml(snap)
    setRenderedHtml(snap)
  }, [])

  const onRedo = useCallback(() => {
    const prev = historyRef.current
    if (prev.index >= prev.stack.length - 1) return
    const nextIndex = prev.index + 1
    const snap = prev.stack[nextIndex]
    if (snap === undefined) return
    const next: HistoryState = { ...prev, index: nextIndex }
    historyRef.current = next
    setHistory(next)
    setHtml(snap)
    setRenderedHtml(snap)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        onUndo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, onRedo])

  const onSavePreview = async () => {
    setSaving(true)
    setSaveMsg('')
    const name = previewName.trim() || t('design.previewNamePlaceholder')
    try {
      const res = await fetchApi<DesignPreviewResponse>('/design/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, html: renderedHtml }),
      })
      if (res.success) {
        setSaveMsg(t('design.saved', { name: res.data.preview.name }))
        setPreviewName(res.data.preview.name)
        setCurrentPreviewId(res.data.preview.id)
        await loadPreviews()
      } else {
        setSaveMsg(t('design.saveFailed', { error: res.error }))
      }
    } catch (err) {
      setSaveMsg(`${t('design.errorPrefix')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const onLoadPreview = useCallback(
    (p: DesignPreview) => {
      setHtml(p.html)
      setRenderedHtml(p.html)
      setPreviewName(p.name)
      setSelected(null)
      setCurrentPreviewId(p.id)
      pushHistory(p.html)
    },
    [pushHistory],
  )

  /** 点击树节点:postMessage 到 iframe,高亮 + 滚动到对应元素。 */
  const onSelectTreeNode = useCallback((node: TreeNode) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        __ihui: true,
        type: 'scroll-to-element',
        elementId: node.id,
        tagName: node.tagName,
        index: node.index,
      },
      '*',
    )
  }, [])

  /** 提交评论:持久化到 Redis + 触发 onComment 回调(到对话)。 */
  const onSubmitComment = async () => {
    const text = commentText.trim()
    if (!text) return
    const elementId = selected?.elementId ?? ''
    // 优先触发 onComment 回调(到对话闭环,保留原行为)
    onComment?.({ elementId, comment: text, html: renderedHtml })

    // 持久化到 Redis(若已有 previewId)
    const pid = currentPreviewIdRef.current
    if (pid) {
      setCommentPosting(true)
      try {
        await createComment(pid, text, elementId)
        await loadComments(pid)
        setCommentMsg(
          t('design.commented', {
            tagName: selected?.tagName ?? '',
            elementId: elementId || '?',
            comment: text,
          }),
        )
      } catch (err) {
        setCommentMsg(err instanceof Error ? err.message : String(err))
      } finally {
        setCommentPosting(false)
      }
    } else {
      // 无 previewId 时,仅本地提示(评论尚未持久化,需先保存预览)
      setCommentMsg(
        t('design.commented', {
          tagName: selected?.tagName ?? '',
          elementId: elementId || '?',
          comment: text,
        }),
      )
    }
    setCommentText('')
    setCommentOpen(false)
  }

  /** AI 生成 HTML:调 /ai/llm/chat 生成 HTML,注入画布 + 加入撤销栈。 */
  const onAiGenerate = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt || aiGenerating) return
    setAiGenerating(true)
    setAiMsg('')
    try {
      const generated = await generateHtml(prompt)
      if (!generated) {
        setAiMsg(t('design.aiGenerate.failed'))
        return
      }
      setHtml(generated)
      setRenderedHtml(generated)
      pushHistory(generated)
      setSelected(null)
      setAiMsg(t('design.aiGenerate.success'))
    } catch (err) {
      setAiMsg(
        `${t('design.aiGenerate.failed')}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setAiGenerating(false)
    }
  }

  useEffect(() => {
    if (!exportMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenuOpen])

  useEffect(() => {
    if (!customInputOpen) return
    const handler = (e: MouseEvent) => {
      if (customInputRef.current && !customInputRef.current.contains(e.target as Node)) {
        setCustomInputOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [customInputOpen])

  const onApplyCustomWidth = () => {
    const parsed = parseInt(customWidthInput, 10)
    if (Number.isFinite(parsed) && parsed >= 200 && parsed <= 3840) {
      setCustomWidth(parsed)
      setCustomInputOpen(false)
    }
  }

  const onSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (deviceId === 'custom') {
      setCustomWidthInput(String(customWidth))
      setCustomInputOpen(true)
    } else {
      setCustomInputOpen(false)
    }
  }

  /** 导出代码:把画布 HTML 转为 React/Vue/HTML 组件并触发下载。 */
  const onExport = async (format: ExportFormat) => {
    setExportMenuOpen(false)
    setExportMsg('')
    const name = previewName.trim() || t('design.previewNamePlaceholder')
    try {
      const { filename } = await exportCode(format, renderedHtml, name)
      setExportMsg(t('design.export.exportSuccess', { filename }))
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : String(err))
    }
  }

  /** 应用模板:setHtml + setRenderedHtml + pushHistory + 清选中 + 关闭 Dialog。 */
  const onApplyTemplate = useCallback(
    (templateHtml: string) => {
      setHtml(templateHtml)
      setRenderedHtml(templateHtml)
      pushHistory(templateHtml)
      setSelected(null)
      setTemplateDialogOpen(false)
    },
    [pushHistory],
  )

  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <DesignToolbar
        aiPrompt={aiPrompt}
        onAiPromptChange={setAiPrompt}
        onAiGenerate={onAiGenerate}
        aiGenerating={aiGenerating}
        previewName={previewName}
        onPreviewNameChange={setPreviewName}
        onSavePreview={onSavePreview}
        saving={saving}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        onExport={onExport}
        exportRef={exportRef}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={onSelectDevice}
        customInputOpen={customInputOpen}
        customInputRef={customInputRef}
        customWidthInput={customWidthInput}
        onCustomWidthInputChange={setCustomWidthInput}
        onApplyCustomWidth={onApplyCustomWidth}
        showDeviceFrame={showDeviceFrame}
        setShowDeviceFrame={setShowDeviceFrame}
        guidesEnabled={guidesEnabled}
        setGuidesEnabled={setGuidesEnabled}
        onOpenTemplates={() => setTemplateDialogOpen(true)}
      />
      {(saveMsg || aiMsg || exportMsg) && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
          {[saveMsg, aiMsg, exportMsg].filter(Boolean).join(' · ')}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 200px)' }}>
        <DesignLeftPanel
          previewsLoading={previewsLoading}
          previewsError={previewsError}
          previews={previews}
          onLoadPreview={onLoadPreview}
          currentPreviewId={currentPreviewId}
          dateFormatter={dateFormatter}
          tree={tree}
          selectedElementId={selected?.elementId ?? ''}
          onSelectTreeNode={onSelectTreeNode}
        />

        <HtmlSourceEditor
          html={html}
          onHtmlChange={setHtml}
          onUndo={onUndo}
          canUndo={canUndo}
          onRedo={onRedo}
          canRedo={canRedo}
          onRender={onRender}
        />

        <PreviewCanvas
          iframeRef={iframeRef}
          srcDoc={srcDoc}
          currentWidth={currentWidth}
          showFrame={showFrame}
          deviceRadius={deviceRadius}
        />

        <InspectorPanel
          selected={selected}
          onResetStyles={onResetStyles}
          styleEdits={styleEdits}
          onStyleChange={onStyleChange}
          commentOpen={commentOpen}
          setCommentOpen={setCommentOpen}
          commentText={commentText}
          onCommentTextChange={setCommentText}
          onSubmitComment={onSubmitComment}
          commentPosting={commentPosting}
          commentMsg={commentMsg}
          currentPreviewId={currentPreviewId}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          comments={comments}
          dateFormatter={dateFormatter}
          rightTab={rightTab}
          onTabChange={setRightTab}
        />
      </div>

      <TemplateDialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        onApplyTemplate={onApplyTemplate}
      />
    </div>
  )
}
