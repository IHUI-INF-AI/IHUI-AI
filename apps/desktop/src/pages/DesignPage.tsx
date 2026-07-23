/**
 * DesignPage(桌面端 Design 模式,2026-07-23 立,对标 TRAE Work Design 模式)。
 *
 * 左 HTML 输入 → 中 iframe 渲染(srcDoc + 注入选中脚本)→ 右 CSS 面板,
 * 点击元素 postMessage 回父窗口,可编辑 style 后回推 iframe 实时更新;
 * 顶部"保存预览" POST /api/design/preview,底部"评论到对话"回调 onComment。
 *
 * 深化(2026-07-23):撤销/重做历史栈 + 预览列表侧栏(GET /design/previews)+ 全 i18n 化。
 *
 * 自研实现,不引入新依赖。遵循 AGENTS.md §4(禁圆角/禁分割线/禁渐变遮罩)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import type { DesignPreview, DesignPreviewResponse } from '@ihui/shared'
import { useI18n } from '../i18n'
import { useTheme } from '../hooks/use-theme'

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

/** 构造 iframe srcDoc:用户 HTML + 暗黑适配 + 选/改 style 注入脚本。 */
function buildSrcDoc(html: string, isDark: boolean): string {
  const bg = isDark ? '#0a0a0a' : '#ffffff'
  const fg = isDark ? '#f5f5f5' : '#111111'
  const script = `<script>(function(){
document.documentElement.style.background='${bg}';
document.documentElement.style.color='${fg}';
var PROPS=['color','background','fontSize','padding','margin','width','height','display'];
var selected=null;
function gs(el){var s={};var cs=getComputedStyle(el);PROPS.forEach(function(p){s[p]=cs.getPropertyValue(p)});return s;}
document.addEventListener('click',function(e){
e.preventDefault();e.stopPropagation();
if(selected) selected.style.outline='';
selected=e.target;
selected.style.outline='2px solid hsl(142 71% 45%)';
parent.postMessage({__ihui:true,type:'select',elementId:selected.id||'',tagName:selected.tagName,text:(selected.textContent||'').slice(0,80),style:gs(selected)},'*');
},true);
window.addEventListener('message',function(e){
var d=e.data;if(!d||d.__ihui!==true||d.type!=='update-style')return;
if(selected){Object.keys(d.style).forEach(function(k){selected.style[k]=d.style[k];});}
});
})();<\/script>`
  return html + script
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

  const srcDoc = useMemo(() => buildSrcDoc(renderedHtml, isDark), [renderedHtml, isDark])

  const historyRef = useRef(history)
  historyRef.current = history
  const htmlRef = useRef(html)
  htmlRef.current = html

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

  useEffect(() => {
    loadPreviews()
  }, [loadPreviews])

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
      pushHistory(p.html)
    },
    [pushHistory],
  )

  const onSubmitComment = () => {
    if (!commentText.trim()) return
    onComment?.({ elementId: selected?.elementId ?? '', comment: commentText, html: renderedHtml })
    setCommentMsg(
      t('design.commented', {
        tagName: selected?.tagName ?? '',
        elementId: selected?.elementId || '?',
        comment: commentText,
      }),
    )
    setCommentText('')
    setCommentOpen(false)
  }

  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t('design.title')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            placeholder={t('design.previewNamePlaceholder')}
            style={{ width: 160, fontSize: 12 }}
            aria-label={t('design.previewName')}
          />
          <button type="button" onClick={onSavePreview} disabled={saving}>
            {saving ? t('common.loading') : t('design.savePreview')}
          </button>
        </div>
      </header>
      {saveMsg && <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>{saveMsg}</p>}

      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 180px)' }}>
        <section style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('design.previewList')}</h3>
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
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--card)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{dateFormatter.format(new Date(p.createdAt))}</span>
            </button>
          ))}
        </section>

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

        <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            title="design-preview"
            style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}
          />
        </section>

        <section style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t('design.cssPanel')}</h3>
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
                    <button type="button" onClick={onSubmitComment}>{t('common.submit')}</button>
                    <button type="button" onClick={() => setCommentOpen(false)}>{t('common.cancel')}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('design.clickElementHint')}</span>
          )}
          {commentMsg && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>{commentMsg}</p>}
        </section>
      </div>
    </div>
  )
}
