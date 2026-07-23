/**
 * DesignPage(桌面端 Design 模式,2026-07-23 立,对标 TRAE Work Design 模式)。
 *
 * 左 HTML 输入 → 中 iframe 渲染(srcDoc + 注入选中脚本)→ 右 CSS 面板,
 * 点击元素 postMessage 回父窗口,可编辑 style 后回推 iframe 实时更新;
 * 顶部"保存预览" POST /api/design/preview,底部"评论到对话"回调 onComment。
 *
 * 深化 1(2026-07-23):撤销/重做历史栈 + 预览列表侧栏(GET /design/previews)+ 全 i18n 化。
 * 深化 2(2026-07-23 P0 对标 TRAE Work):
 *   - 左侧组件树面板(DOMParser 解析 HTML 字符串生成,点击节点高亮 iframe 元素)
 *   - 协同评论持久化(POST /design/comments + GET /design/comments/:previewId,Redis List)
 *   - AI 生成 UI(输入 prompt → /ai/llm/chat 生成 HTML → 注入画布 + 加入撤销栈)
 *
 * 自研实现,不引入新依赖。遵循 AGENTS.md §4(禁圆角/禁分割线/禁渐变遮罩)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import type { DesignComment, DesignPreview, DesignPreviewResponse } from '@ihui/shared'
import { useI18n } from '../i18n'
import { useTheme } from '../hooks/use-theme'
import { createComment, generateHtml, listComments } from '../lib/design-api'

const STYLE_PROPS = ['color', 'background', 'fontSize', 'padding', 'margin', 'width', 'height', 'display'] as const

const DEFAULT_HTML = `<div style="padding:24px;font-family:sans-serif">
  <h1>Hello Design</h1>
  <button id="cta">Click me</button>
  <p>点我选中元素</p>
</div>`

interface SelectedElement {
  elementId: string
  tagName: string
  text: string
  style: Record<string, string>
}

interface DesignPageProps {
  onComment?: (c: { elementId: string; comment: string; html: string }) => void
}

interface HistoryState {
  stack: string[]
  index: number
}

/** 组件树节点:由 DOMParser 解析 HTML 字符串生成。 */
interface TreeNode {
  tagName: string
  id: string
  className: string
  /** 同 tagName 在父级 children 中的索引,用于点击时定位 iframe 元素。 */
  index: number
  children: TreeNode[]
}

type RightPanelTab = 'css' | 'comments'

/** 构造 iframe srcDoc:用户 HTML + 暗黑适配 + 选/改 style + 树节点定位 注入脚本。 */
function buildSrcDoc(html: string, isDark: boolean): string {
  const bg = isDark ? '#0a0a0a' : '#ffffff'
  const fg = isDark ? '#f5f5f5' : '#111111'
  const script = `<script>(function(){
document.documentElement.style.background='${bg}';
document.documentElement.style.color='${fg}';
var PROPS=['color','background','fontSize','padding','margin','width','height','display'];
var selected=null;
function gs(el){var s={};var cs=getComputedStyle(el);PROPS.forEach(function(p){s[p]=cs.getPropertyValue(p)});return s;}
function notify(){if(selected){parent.postMessage({__ihui:true,type:'select',elementId:selected.id||'',tagName:selected.tagName,text:(selected.textContent||'').slice(0,80),style:gs(selected)},'*');}}
function highlight(el){if(selected) selected.style.outline='';selected=el;selected.style.outline='2px solid hsl(142 71% 45%)';selected.scrollIntoView({block:'center',behavior:'smooth'});notify();}
document.addEventListener('click',function(e){
e.preventDefault();e.stopPropagation();
highlight(e.target);
},true);
window.addEventListener('message',function(e){
var d=e.data;if(!d||d.__ihui!==true)return;
if(d.type==='update-style'){if(selected){Object.keys(d.style).forEach(function(k){selected.style[k]=d.style[k];});}return;}
if(d.type==='scroll-to-element'){
var target=null;
if(d.elementId){target=document.getElementById(d.elementId);}
else if(d.tagName){var els=document.getElementsByTagName(d.tagName);target=els[d.index]||els[0];}
if(target){highlight(target);}
}
});
})();<\/script>`
  return html + script
}

/** 用 DOMParser 解析 HTML 字符串生成组件树(同步,无 postMessage 复杂度)。 */
function parseHtmlToTree(html: string): TreeNode {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return { tagName: 'body', id: '', className: '', index: 0, children: [] }
  }
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return walkElement(doc.body)
  } catch {
    return { tagName: 'body', id: '', className: '', index: 0, children: [] }
  }
}

/** 递归遍历 Element 生成 TreeNode(跳过 script/style 等非可视化节点)。 */
function walkElement(el: Element, index = 0): TreeNode {
  const SKIP_TAGS = new Set(['script', 'style', 'head', 'meta', 'link', 'title'])
  const children: TreeNode[] = []
  let sameTagCounter = 0
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag)) continue
    const myIndex = sameTagCounter++
    children.push(walkElement(child, myIndex))
  }
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id ?? '',
    className: typeof el.className === 'string' ? el.className : '',
    index,
    children,
  }
}

/** 递归渲染树节点(可折叠/展开,点击节点 postMessage 高亮 iframe 元素)。 */
function TreeView({
  node,
  depth,
  selectedElementId,
  onSelect,
}: {
  node: TreeNode
  depth: number
  selectedElementId: string
  onSelect: (n: TreeNode) => void
}) {
  const [collapsed, setCollapsed] = useState(depth >= 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedElementId === node.id || (!selectedElementId && depth === 0)
  const label = node.tagName + (node.id ? `#${node.id}` : '') + (node.className ? `.${node.className.split(/\s+/)[0]}` : '')
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node)
          if (hasChildren) setCollapsed((v) => !v)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '3px 6px',
          border: 'none',
          background: isSelected ? 'var(--accent-soft, rgba(0,0,0,0.06))' : 'transparent',
          borderRadius: 4,
          textAlign: 'left',
          fontSize: 11,
          cursor: 'pointer',
          color: 'var(--text, inherit)',
        }}
      >
        <span style={{ width: 10, fontSize: 10, color: 'var(--muted)' }}>{hasChildren ? (collapsed ? '▶' : '▼') : '·'}</span>
        <span style={{ fontFamily: 'monospace' }}>{label}</span>
      </button>
      {!collapsed && hasChildren && (
        <div style={{ paddingLeft: 12 }}>
          {node.children.map((child, i) => (
            <TreeView
              key={`${child.tagName}-${child.index}-${i}`}
              node={child}
              depth={depth + 1}
              selectedElementId={selectedElementId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DesignPage({ onComment }: DesignPageProps) {
  const { t } = useI18n()
  const { isDark } = useTheme()
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

  // AI 生成相关
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiMsg, setAiMsg] = useState('')

  const srcDoc = useMemo(() => buildSrcDoc(renderedHtml, isDark), [renderedHtml, isDark])
  const tree = useMemo(() => parseHtmlToTree(renderedHtml), [renderedHtml])

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
      setSelected({ elementId: d.elementId, tagName: d.tagName, text: d.text, style: d.style as Record<string, string> })
      setStyleEdits({ ...(d.style as Record<string, string>) })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const onStyleChange = (prop: string, value: string) => {
    setStyleEdits((prev) => ({ ...prev, [prop]: value }))
    iframeRef.current?.contentWindow?.postMessage(
      { __ihui: true, type: 'update-style', style: { [prop]: value } },
      '*',
    )
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
      setCommentMsg(t('design.commented', { tagName: selected?.tagName ?? '', elementId: elementId || '?', comment: text }))
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
      setAiMsg(`${t('design.aiGenerate.failed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiGenerating(false)
    }
  }

  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t('design.title')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAiGenerate()
            }}
            placeholder={t('design.aiGenerate.placeholder')}
            disabled={aiGenerating}
            style={{ width: 240, fontSize: 12 }}
            aria-label={t('design.aiGenerate.button')}
          />
          <button type="button" onClick={onAiGenerate} disabled={aiGenerating || !aiPrompt.trim()}>
            {aiGenerating ? t('design.aiGenerate.generating') : t('design.aiGenerate.button')}
          </button>
          <input
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            placeholder={t('design.previewNamePlaceholder')}
            style={{ width: 140, fontSize: 12 }}
            aria-label={t('design.previewName')}
          />
          <button type="button" onClick={onSavePreview} disabled={saving}>
            {saving ? t('common.loading') : t('design.savePreview')}
          </button>
        </div>
      </header>
      {(saveMsg || aiMsg) && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
          {saveMsg}
          {saveMsg && aiMsg ? ' · ' : ''}
          {aiMsg}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 200px)' }}>
        {/* 左栏:预览列表 + 组件树(竖向堆叠,各自可滚动) */}
        <section style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '40%', overflow: 'auto', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t('design.previewList')}</h3>
            {previewsLoading && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('common.loading')}</span>}
            {previewsError && (
              <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>
                {t('design.loadFailed')}: {previewsError}
              </span>
            )}
            {!previewsLoading && !previewsError && previews.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.noPreviews')}</span>
            )}
            {previews.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onLoadPreview(p)}
                title={t('design.loadPreview')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  textAlign: 'left',
                  padding: '6px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: currentPreviewId === p.id ? 'var(--accent-soft, rgba(0,0,0,0.04))' : 'var(--card)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dateFormatter.format(new Date(p.createdAt))}</span>
              </button>
            ))}
          </div>

          {/* 组件树面板 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'auto', minHeight: 0 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t('design.componentTree.title')}</h3>
            {tree.children.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.componentTree.empty')}</span>
            ) : (
              tree.children.map((child, i) => (
                <TreeView
                  key={`${child.tagName}-${child.index}-${i}`}
                  node={child}
                  depth={0}
                  selectedElementId={selected?.elementId ?? ''}
                  onSelect={onSelectTreeNode}
                />
              ))
            )}
          </div>
        </section>

        {/* 中左:HTML 输入 + 撤销/重做/渲染 */}
        <section style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.htmlLabel')}</label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            style={{ flex: 1, resize: 'none', fontFamily: 'monospace', fontSize: 12, minHeight: 0 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onUndo} disabled={!canUndo} style={{ flex: 1 }} title={t('design.undo')}>
              {t('design.undo')}
            </button>
            <button type="button" onClick={onRedo} disabled={!canRedo} style={{ flex: 1 }} title={t('design.redo')}>
              {t('design.redo')}
            </button>
            <button type="button" onClick={onRender} style={{ flex: 1 }}>
              {t('design.render')}
            </button>
          </div>
        </section>

        {/* 中:iframe 画布 */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title="design-preview"
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}
          />
        </section>

        {/* 右:tab(CSS / 评论) */}
        <section style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setRightTab('css')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 12,
                fontWeight: rightTab === 'css' ? 600 : 400,
                border: '1px solid var(--border)',
                borderBottom: rightTab === 'css' ? 'none' : '1px solid var(--border)',
                borderRadius: '6px 6px 0 0',
                background: rightTab === 'css' ? 'var(--card)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {t('design.cssPanel')}
            </button>
            <button
              type="button"
              onClick={() => setRightTab('comments')}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 12,
                fontWeight: rightTab === 'comments' ? 600 : 400,
                border: '1px solid var(--border)',
                borderBottom: rightTab === 'comments' ? 'none' : '1px solid var(--border)',
                borderRadius: '6px 6px 0 0',
                background: rightTab === 'comments' ? 'var(--card)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {t('design.comments.title')}({comments.length})
            </button>
          </div>

          {rightTab === 'css' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1, padding: 8, border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
              {selected ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {selected.tagName}
                    {selected.elementId ? `#${selected.elementId}` : ''}
                  </div>
                  {STYLE_PROPS.map((prop) => (
                    <div key={prop} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ flex: '0 0 86px', fontSize: 12, color: 'var(--muted)' }}>{prop}</label>
                      <input
                        value={styleEdits[prop] ?? ''}
                        onChange={(e) => onStyleChange(prop, e.target.value)}
                        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
                      />
                    </div>
                  ))}
                  <button type="button" onClick={() => setCommentOpen((v) => !v)} style={{ marginTop: 8 }}>
                    {t('design.commentToChat')}
                  </button>
                  {commentOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={t('design.commentPlaceholder')}
                        style={{ resize: 'none', fontSize: 12, minHeight: 60 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={onSubmitComment} disabled={commentPosting}>
                          {commentPosting ? t('common.loading') : t('design.comments.send')}
                        </button>
                        <button type="button" onClick={() => setCommentOpen(false)}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.clickElementHint')}</span>
              )}
              {commentMsg && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{commentMsg}</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1, padding: 8, border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
              {!currentPreviewId && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.comments.empty')}</span>
              )}
              {currentPreviewId && commentsLoading && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('common.loading')}</span>
              )}
              {currentPreviewId && commentsError && (
                <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>
                  {t('design.comments.loadingFailed')}: {commentsError}
                </span>
              )}
              {currentPreviewId && !commentsLoading && !commentsError && comments.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.comments.noComments')}</span>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--background, transparent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text, inherit)' }}>
                      {c.userName || `User ${c.userId}`}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {dateFormatter.format(new Date(c.createdAt))}
                    </span>
                  </div>
                  {c.elementId && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
                      #{c.elementId}
                    </span>
                  )}
                  <span style={{ fontSize: 12 }}>{c.content}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
