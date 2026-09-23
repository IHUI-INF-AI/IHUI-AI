// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Code2, Copy, Eye, Maximize2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { CenteredText } from '@/components/common/CenteredText'
import { useClipboard } from '@/hooks/use-clipboard'
import { useCanvasStore } from '@/stores/canvas-store'
import { CanvasVersionMenu } from './canvas-overlay'

/**
 * Artifact 产物对象(工具执行产物,如 html / css / js 代码或图表产物)。
 * 字段来自后端 tc.result.artifacts / summaryData.artifacts,目前以 path 为主,
 * 后续可携带内联 content(本组件核心能力:srcDoc 沙箱实时预览)。
 */
export interface Artifact {
  /** 产物类型:html / svg / css / js / javascript / typescript / code / text 等 */
  type?: string
  /** 内联代码/HTML 内容(优先用于 srcDoc 预览或代码视图) */
  content?: string
  /** 产物在服务器上的绝对/相对路径(文件型产物,如图表 .html) */
  path?: string
  /** 产物文件名 */
  name?: string
  /** 创建时间 ISO 字符串 */
  created_at?: string
}

/** HTML 启发式判定:含 <!DOCTYPE html> / <html> / <script> / <body> 即视为可渲染 HTML */
const HTML_HINT_RE = /<!DOCTYPE\s+html|<html[\s>]|<script[\s>]|<body[\s>]/i

/** 精确类型守卫:content 是否为可直接 iframe 渲染的 HTML(零 any) */
export function looksLikeHtml(content: string): boolean {
  return HTML_HINT_RE.test(content)
}

/** 是否可交互预览(HTML 类):type 命中 html/svg,或 content 命中 HTML 启发式 */
export function isInteractivePreviewArtifact(artifact: Artifact): boolean {
  const t = artifact.type
  const isHtmlType = t === 'html' || t === 'svg'
  const content = typeof artifact.content === 'string' ? artifact.content : ''
  return isHtmlType || (content.trim().length > 0 && looksLikeHtml(content))
}

/** 纯代码型(css/js 等):只显示代码视图,不强行 iframe 预览 */
function isCodeOnlyArtifact(artifact: Artifact): boolean {
  const t = artifact.type
  return (
    t === 'css' ||
    t === 'js' ||
    t === 'javascript' ||
    t === 'typescript' ||
    t === 'code' ||
    t === 'text'
  )
}

const PREVIEW_HEIGHT = 'h-[320px]'
const MAX_CODE_HEIGHT = 'max-h-[320px]'

type TabKey = 'preview' | 'code'

interface ArtifactCanvasProps {
  artifact: Artifact
}

/**
 * Artifact 画布(P0-4 升级为可编辑工作台):为 HTML/代码类产物提供「预览 | 代码」切换。
 * - HTML 类(content 命中 HTML 启发式):沙箱 iframe(srcDoc)实时预览 + 可编辑源码
 * - 源码编辑「应用并刷新预览」→ store.setContent + pushVersion(版本历史,上限 50)
 * - 版本历史下拉回退;Maximize2 一键打开全屏画布(CanvasOverlay,Esc/X 关闭)
 * - 仅 path 无内联 content 的文件型产物:交还 ChartArtifactBlock 处理,本组件返回 null
 */
export function ArtifactCanvas({ artifact }: ArtifactCanvasProps) {
  const t = useTranslations('chat')
  const clipboard = useClipboard()
  const [tab, setTab] = React.useState<TabKey>('preview')
  const content = typeof artifact.content === 'string' ? artifact.content : ''

  // 本地「已应用」内容(预览渲染源)与「草稿」(textarea 编辑源)
  const [applied, setApplied] = React.useState(content)
  const [draft, setDraft] = React.useState(content)

  const openCanvas = useCanvasStore((s) => s.openCanvas)
  const setContent = useCanvasStore((s) => s.setContent)
  const pushVersion = useCanvasStore((s) => s.pushVersion)
  const revertToVersion = useCanvasStore((s) => s.revertToVersion)
  const versions = useCanvasStore((s) => s.versions)

  // 外部 AI 更新 artifact.content → 重置本地态并存一版(去重:与末版相同不 push;
  // 挂载时首渲染不 push,避免污染版本历史)
  const prevContentRef = React.useRef(content)
  React.useEffect(() => {
    if (prevContentRef.current === content) return
    prevContentRef.current = content
    setApplied(content)
    setDraft(content)
    if (content) pushVersion(content)
  }, [content, pushVersion])

  const canPreview = isInteractivePreviewArtifact(artifact) && content.length > 0
  const codeOnly = isCodeOnlyArtifact(artifact)
  const dirty = draft !== applied

  const handleCopy = React.useCallback(() => {
    void clipboard.copy(applied || artifact.path || '')
  }, [clipboard, applied, artifact.path])

  const applyEdit = () => {
    setApplied(draft)
    setContent(draft)
    pushVersion(draft, t('canvasEdited'))
  }

  const handleRevert = (index: number) => {
    const v = versions[index]
    if (!v) return
    setApplied(v.content)
    setDraft(v.content)
    revertToVersion(index)
  }

  const openInCanvas = () => {
    openCanvas(applied, artifact.name ?? artifact.type ?? '')
  }

  // 仅 path 无内联 content:文件型产物由 ChartArtifactBlock 负责,这里不渲染
  if (!content && !artifact.path) return null

  const showTabs = canPreview && !codeOnly
  const activeTab: TabKey = showTabs ? tab : 'code'

  const copyLabel = clipboard.copied ? t('copied') : t('copy')

  return (
    <div className="overflow-hidden rounded-sm border border-border/30 bg-card/50">
      <div className="flex items-center justify-between gap-2 bg-muted/30 px-2 py-1">
        <div className="flex items-center gap-1">
          {showTabs ? (
            <>
              <ArtifactTabButton
                active={activeTab === 'preview'}
                onClick={() => setTab('preview')}
                icon={<Eye className="h-3.5 w-3.5" />}
                label={t('artifactPreview')}
              />
              <ArtifactTabButton
                active={activeTab === 'code'}
                onClick={() => setTab('code')}
                icon={<Code2 className="h-3.5 w-3.5" />}
                label={t('artifactCode')}
              />
            </>
          ) : (
            <CenteredText className="px-1 text-[10px] font-medium text-muted-foreground/70">
              {codeOnly ? t('artifactCode') : (artifact.name ?? artifact.type ?? t('artifactCode'))}
            </CenteredText>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {canPreview && <CanvasVersionMenu versions={versions} onRevert={handleRevert} />}
          <Tooltip content={copyLabel}>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copyLabel}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('canvasFullscreen')}>
            <button
              type="button"
              onClick={openInCanvas}
              aria-label={t('canvasFullscreen')}
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {activeTab === 'preview' && canPreview ? (
        <iframe
          title={artifact.name ?? 'artifact-preview'}
          sandbox="allow-scripts"
          srcDoc={applied}
          className={cn(PREVIEW_HEIGHT, 'w-full bg-background')}
        />
      ) : (
        <div>
          <div className="flex items-center justify-end gap-2 bg-muted/30 px-2 py-1">
            <button
              type="button"
              onClick={applyEdit}
              disabled={!dirty}
              className="rounded-sm bg-primary px-2 py-0.5 text-[10px] text-primary-foreground disabled:opacity-40"
            >
              {t('canvasApplyRefresh')}
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className={cn(
              MAX_CODE_HEIGHT,
              'w-full resize-none bg-muted/40 p-2 font-mono text-[11px] leading-4 outline-none',
            )}
          />
        </div>
      )}
    </div>
  )
}

interface ArtifactTabButtonProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function ArtifactTabButton({ active, onClick, icon, label }: ArtifactTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
      )}
    >
      {icon}
      <CenteredText>{label}</CenteredText>
    </button>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
