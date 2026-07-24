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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import type { DesignComment, DesignPreview, DesignPreviewResponse } from '@ihui/shared'
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
import type { ResponsiveDeviceIcon } from '@/lib/design/responsive-devices'
import { DESIGN_TEMPLATES } from '@/lib/design/design-templates'

type CssGroupId = 'layout' | 'boxModel' | 'typography' | 'background' | 'effects' | 'responsive'
type CssPropType = 'text' | 'number' | 'select' | 'color'

interface CssProperty {
  key: string
  label: string
  type: CssPropType
  unit?: string
  options?: string[]
  group: CssGroupId
}

interface CssGroup {
  id: CssGroupId
  label: string
  props: CssProperty[]
}

const CSS_GROUPS: CssGroup[] = [
  {
    id: 'layout',
    label: 'design.cssGroup.layout',
    props: [
      { key: 'display', label: 'design.css.display', type: 'select', group: 'layout', options: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'none'] },
      { key: 'flexDirection', label: 'design.css.flexDirection', type: 'select', group: 'layout', options: ['row', 'row-reverse', 'column', 'column-reverse'] },
      { key: 'justifyContent', label: 'design.css.justifyContent', type: 'select', group: 'layout', options: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'] },
      { key: 'alignItems', label: 'design.css.alignItems', type: 'select', group: 'layout', options: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'] },
      { key: 'gap', label: 'design.css.gap', type: 'text', group: 'layout' },
      { key: 'flexWrap', label: 'design.css.flexWrap', type: 'select', group: 'layout', options: ['nowrap', 'wrap', 'wrap-reverse'] },
      { key: 'position', label: 'design.css.position', type: 'select', group: 'layout', options: ['static', 'relative', 'absolute', 'fixed', 'sticky'] },
      { key: 'top', label: 'design.css.top', type: 'text', group: 'layout' },
      { key: 'right', label: 'design.css.right', type: 'text', group: 'layout' },
      { key: 'bottom', label: 'design.css.bottom', type: 'text', group: 'layout' },
      { key: 'left', label: 'design.css.left', type: 'text', group: 'layout' },
      { key: 'zIndex', label: 'design.css.zIndex', type: 'number', group: 'layout' },
    ],
  },
  {
    id: 'boxModel',
    label: 'design.cssGroup.boxModel',
    props: [
      { key: 'width', label: 'design.css.width', type: 'text', group: 'boxModel' },
      { key: 'height', label: 'design.css.height', type: 'text', group: 'boxModel' },
      { key: 'padding', label: 'design.css.padding', type: 'text', group: 'boxModel' },
      { key: 'margin', label: 'design.css.margin', type: 'text', group: 'boxModel' },
      { key: 'border', label: 'design.css.border', type: 'text', group: 'boxModel' },
      { key: 'borderRadius', label: 'design.css.borderRadius', type: 'text', group: 'boxModel' },
      { key: 'boxSizing', label: 'design.css.boxSizing', type: 'select', group: 'boxModel', options: ['content-box', 'border-box'] },
    ],
  },
  {
    id: 'typography',
    label: 'design.cssGroup.typography',
    props: [
      { key: 'color', label: 'design.css.color', type: 'color', group: 'typography' },
      { key: 'fontSize', label: 'design.css.fontSize', type: 'text', group: 'typography' },
      { key: 'fontWeight', label: 'design.css.fontWeight', type: 'select', group: 'typography', options: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'] },
      { key: 'lineHeight', label: 'design.css.lineHeight', type: 'text', group: 'typography' },
      { key: 'textAlign', label: 'design.css.textAlign', type: 'select', group: 'typography', options: ['left', 'right', 'center', 'justify'] },
      { key: 'letterSpacing', label: 'design.css.letterSpacing', type: 'text', group: 'typography' },
    ],
  },
  {
    id: 'background',
    label: 'design.cssGroup.background',
    props: [
      { key: 'background', label: 'design.css.background', type: 'text', group: 'background' },
      { key: 'backgroundColor', label: 'design.css.backgroundColor', type: 'color', group: 'background' },
      { key: 'backgroundImage', label: 'design.css.backgroundImage', type: 'text', group: 'background' },
    ],
  },
  {
    id: 'effects',
    label: 'design.cssGroup.effects',
    props: [
      { key: 'opacity', label: 'design.css.opacity', type: 'number', group: 'effects' },
      { key: 'boxShadow', label: 'design.css.boxShadow', type: 'text', group: 'effects' },
      { key: 'transform', label: 'design.css.transform', type: 'text', group: 'effects' },
      { key: 'transition', label: 'design.css.transition', type: 'text', group: 'effects' },
      { key: 'cursor', label: 'design.css.cursor', type: 'select', group: 'effects', options: ['auto', 'default', 'pointer', 'text', 'wait', 'move', 'not-allowed'] },
      { key: 'overflow', label: 'design.css.overflow', type: 'select', group: 'effects', options: ['visible', 'hidden', 'scroll', 'auto'] },
    ],
  },
  {
    id: 'responsive',
    label: 'design.cssGroup.responsive',
    props: [
      { key: 'minWidth', label: 'design.css.minWidth', type: 'text', group: 'responsive' },
      { key: 'maxWidth', label: 'design.css.maxWidth', type: 'text', group: 'responsive' },
    ],
  },
]

const ALL_CSS_KEYS = CSS_GROUPS.flatMap((g) => g.props.map((p) => p.key))

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

type TranslationFn = (key: string, params?: Record<string, string | number>) => string

/** 构造 iframe srcDoc:用户 HTML + 暗黑适配 + 选/改 style + 树节点定位 注入脚本。 */
function buildSrcDoc(html: string, isDark: boolean): string {
  const bg = isDark ? '#0a0a0a' : '#ffffff'
  const fg = isDark ? '#f5f5f5' : '#111111'
  // camelCase → kebab-case for getComputedStyle keys
  const propsJson = JSON.stringify(ALL_CSS_KEYS)
  const script = `<script data-ihui-injected="true">(function(){
document.documentElement.style.background='${bg}';
document.documentElement.style.color='${fg}';
var PROPS=${propsJson};
function toKebab(s){return s.replace(/([A-Z])/g,function(m){return '-'+m.toLowerCase();});}
var selected=null;
var dragging=null;
var dragStarted=false;
var suppressClick=false;
var dragThreshold=3;
var guideOverlay=null;
function gs(el){var s={};var cs=getComputedStyle(el);PROPS.forEach(function(p){var k=toKebab(p);s[p]=cs.getPropertyValue(k);});return s;}
function notify(){if(selected){parent.postMessage({__ihui:true,type:'select',elementId:selected.id||'',tagName:selected.tagName,text:(selected.textContent||'').slice(0,80),style:gs(selected)},'*');}}
function highlight(el){if(selected) selected.style.outline='';selected=el;selected.style.outline='2px solid hsl(142 71% 45%)';selected.scrollIntoView({block:'center',behavior:'smooth'});notify();}
function ensureOverlay(){if(!guideOverlay){guideOverlay=document.createElement('div');guideOverlay.setAttribute('data-ihui-injected','true');guideOverlay.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:99999;';document.body.appendChild(guideOverlay);}return guideOverlay;}
function renderGuides(guides){var ov=ensureOverlay();ov.innerHTML='';for(var i=0;i<guides.length;i++){var g=guides[i];var line=document.createElement('div');line.style.cssText='position:absolute;background:#ef4444;';if(g.type==='h'){line.style.left=g.start+'px';line.style.top=g.position+'px';line.style.width=(g.end-g.start)+'px';line.style.height='1px';}else{line.style.left=g.position+'px';line.style.top=g.start+'px';line.style.width='1px';line.style.height=(g.end-g.start)+'px';}ov.appendChild(line);}}
function clearGuides(){if(guideOverlay){guideOverlay.innerHTML='';}}
function collectSiblings(el){var sibs=[];var p=el.parentElement;if(!p)return sibs;var ch=p.children;for(var i=0;i<ch.length;i++){var c=ch[i];if(c===el)continue;if(c.tagName==='SCRIPT'||c.tagName==='STYLE')continue;if(c.getAttribute&&c.getAttribute('data-ihui-injected')==='true')continue;var r=c.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;sibs.push({id:c.id||('el'+i),x:r.left,y:r.top,width:r.width,height:r.height});}return sibs;}
document.addEventListener('click',function(e){
if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;return;}
e.preventDefault();e.stopPropagation();
highlight(e.target);
},true);
document.addEventListener('mousedown',function(e){
var el=e.target;
if(el===document.body||el===document.documentElement)return;
if(el.tagName==='SCRIPT'||el.tagName==='STYLE')return;
if(el.getAttribute&&el.getAttribute('data-ihui-injected')==='true')return;
var pos=getComputedStyle(el).position;
if(pos==='static'){el.style.position='relative';}
dragging={el:el,startX:e.clientX,startY:e.clientY,origLeft:el.offsetLeft,origTop:el.offsetTop,id:el.id||'',snapOffsetX:0,snapOffsetY:0};
dragStarted=false;
},true);
document.addEventListener('mousemove',function(e){
if(!dragging)return;
var dx=e.clientX-dragging.startX;
var dy=e.clientY-dragging.startY;
if(!dragStarted){if(Math.abs(dx)<dragThreshold&&Math.abs(dy)<dragThreshold)return;dragStarted=true;}
e.preventDefault();
dragging.el.style.left=(dragging.origLeft+dx+dragging.snapOffsetX)+'px';
dragging.el.style.top=(dragging.origTop+dy+dragging.snapOffsetY)+'px';
var myRect=dragging.el.getBoundingClientRect();
parent.postMessage({__ihui:true,type:'drag-move',elementId:dragging.id,rect:{id:dragging.id,x:myRect.left,y:myRect.top,width:myRect.width,height:myRect.height},others:collectSiblings(dragging.el)},'*');
},true);
document.addEventListener('mouseup',function(e){
if(!dragging)return;
if(dragStarted){
e.preventDefault();
suppressClick=true;
var clone=document.body.cloneNode(true);
var injected=clone.querySelectorAll('[data-ihui-injected="true"]');
for(var i=0;i<injected.length;i++){injected[i].parentNode.removeChild(injected[i]);}
parent.postMessage({__ihui:true,type:'drag-end',html:clone.innerHTML},'*');
clearGuides();
}
dragging=null;
dragStarted=false;
},true);
window.addEventListener('message',function(e){
var d=e.data;if(!d||d.__ihui!==true)return;
if(d.type==='update-style'){if(selected){Object.keys(d.style).forEach(function(k){selected.style.setProperty(toKebab(k),d.style[k]);});}return;}
if(d.type==='reset-style'){if(selected){PROPS.forEach(function(p){selected.style.removeProperty(toKebab(p));});notify();}return;}
if(d.type==='scroll-to-element'){
var target=null;
if(d.elementId){target=document.getElementById(d.elementId);}
else if(d.tagName){var els=document.getElementsByTagName(d.tagName);target=els[d.index]||els[0];}
if(target){highlight(target);}
return;
}
if(d.type==='render-guides'){renderGuides(d.guides||[]);return;}
if(d.type==='clear-guides'){clearGuides();return;}
if(d.type==='apply-snap'){if(dragging&&dragStarted){var cr=dragging.el.getBoundingClientRect();var dX=d.x-cr.left;var dY=d.y-cr.top;dragging.snapOffsetX+=dX;dragging.snapOffsetY+=dY;var cl=parseFloat(dragging.el.style.left)||0;var ct=parseFloat(dragging.el.style.top)||0;dragging.el.style.left=(cl+dX)+'px';dragging.el.style.top=(ct+dY)+'px';}return;}
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

/** 设备图标:phone/tablet 横屏时旋转 90°,desktop/custom 不旋转。 */
function DeviceIcon({ icon, rotate }: { icon: ResponsiveDeviceIcon; rotate: boolean }) {
  const transform = rotate ? 'rotate(90deg)' : undefined
  if (icon === 'phone') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform }} aria-hidden="true">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    )
  }
  if (icon === 'tablet') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform }} aria-hidden="true">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    )
  }
  if (icon === 'desktop') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </svg>
  )
}

/** 把 rgb()/rgba() 转 #hex,便于 <input type="color"> 回填;非颜色值原样返回。 */
function normalizeColorHex(v: string): string {
  if (!v) return ''
  const m = v.match(/rgba?\(([^)]+)\)/i)
  if (!m || !m[1]) return v
  const parts = m[1].split(',').map((s) => s.trim())
  if (parts.length < 3) return v
  const toHex = (n: string) => {
    const num = parseFloat(n)
    if (Number.isNaN(num)) return '00'
    return Math.max(0, Math.min(255, Math.round(num))).toString(16).padStart(2, '0')
  }
  return '#' + toHex(parts[0] ?? '0') + toHex(parts[1] ?? '0') + toHex(parts[2] ?? '0')
}

/** 从带单位字符串中提取数字部分(用于 number 输入回填)。 */
function extractNumber(v: string): string {
  if (!v) return ''
  const m = v.match(/^-?\d*\.?\d+/)
  return m ? m[0] : ''
}

/** 单行 CSS 属性编辑控件:按 type 渲染 select/number/text/color。 */
function CssPropRow({
  prop,
  value,
  onChange,
  t,
}: {
  prop: CssProperty
  value: string
  onChange: (v: string) => void
  t: TranslationFn
}) {
  const labelEl = (
    <label style={{ flex: '0 0 92px', fontSize: 12, color: 'var(--muted)' }}>{t(prop.label)}</label>
  )
  let inputEl: ReactNode
  if (prop.type === 'select' && prop.options) {
    inputEl = (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      >
        <option value="">—</option>
        {prop.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  } else if (prop.type === 'color') {
    const hex = normalizeColorHex(value)
    inputEl = (
      <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }}>
        <input
          type="color"
          value={hex || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 32, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('design.css.placeholder')}
          style={{ flex: 1, fontSize: 12, minWidth: 0 }}
        />
      </div>
    )
  } else if (prop.type === 'number') {
    inputEl = (
      <input
        type="number"
        value={extractNumber(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('design.css.placeholder')}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      />
    )
  } else {
    inputEl = (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('design.css.placeholder')}
        style={{ flex: 1, fontSize: 12, minWidth: 0 }}
      />
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {labelEl}
      {inputEl}
    </div>
  )
}

/** 可折叠 CSS 分组面板(Accordion 风格)。 */
function CssGroupSection({
  group,
  values,
  onChange,
  t,
}: {
  group: CssGroup
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  t: TranslationFn
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '4px 6px',
          border: 'none',
          background: 'transparent',
          borderRadius: 4,
          textAlign: 'left',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text, inherit)',
        }}
      >
        <span style={{ width: 10, fontSize: 10, color: 'var(--muted)' }}>{collapsed ? '▶' : '▼'}</span>
        <span>{t(group.label)}</span>
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
          {group.props.map((prop) => (
            <CssPropRow
              key={prop.key}
              prop={prop}
              value={values[prop.key] ?? ''}
              onChange={(v) => onChange(prop.key, v)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
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
      setSelected({ elementId: d.elementId, tagName: d.tagName, text: d.text, style: d.style as Record<string, string> })
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
    iframeRef.current?.contentWindow?.postMessage(
      { __ihui: true, type: 'reset-style' },
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
  const onApplyTemplate = useCallback((templateHtml: string) => {
    setHtml(templateHtml)
    setRenderedHtml(templateHtml)
    pushHistory(templateHtml)
    setSelected(null)
    setTemplateDialogOpen(false)
  }, [pushHistory])

  const canUndo = history.index > 0
  const canRedo = history.index < history.stack.length - 1

  const tf = t as TranslationFn

  return (
    <div className="page" style={{ maxWidth: 1280 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t('design.title')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setTemplateDialogOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={t('design.templates.title')}
            title={t('design.templates.title')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            <span>{t('design.templates.title')}</span>
          </button>
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
            {aiGenerating ? t('common.loading') : t('design.aiGenerate.button')}
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
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              aria-label={t('design.export.exportButton')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t('design.export.exportButton')}</span>
            </button>
            {exportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  zIndex: 10,
                  minWidth: 140,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--card)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => onExport('react')}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                >
                  {t('design.export.exportReact')}
                </button>
                <button
                  type="button"
                  onClick={() => onExport('vue')}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                >
                  {t('design.export.exportVue')}
                </button>
                <button
                  type="button"
                  onClick={() => onExport('html')}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                >
                  {t('design.export.exportHtml')}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '0 6px' }}>
            {RESPONSIVE_DEVICES.map((device) => {
              const isLandscape = device.id === 'mobile-landscape' || device.id === 'tablet-landscape'
              const isSelected = selectedDeviceId === device.id
              const title = device.width > 0
                ? `${t(device.nameKey)} (${device.width}×${device.height})`
                : t(device.nameKey)
              return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => onSelectDevice(device.id)}
                  title={title}
                  aria-label={title}
                  aria-pressed={isSelected}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 28,
                    padding: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: isSelected ? 'var(--accent-soft, rgba(0,0,0,0.06))' : 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                >
                  <DeviceIcon icon={device.icon} rotate={isLandscape} />
                </button>
              )
            })}
            {customInputOpen && (
              <div
                ref={customInputRef}
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <input
                  type="number"
                  value={customWidthInput}
                  onChange={(e) => setCustomWidthInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onApplyCustomWidth() }}
                  min={200}
                  max={3840}
                  placeholder={t('design.responsive.customWidth')}
                  style={{ width: 80, fontSize: 12 }}
                  aria-label={t('design.responsive.customWidth')}
                />
                <button
                  type="button"
                  onClick={onApplyCustomWidth}
                  style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--text, inherit)' }}
                >
                  {t('design.responsive.apply')}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowDeviceFrame((v) => !v)}
              title={t('design.responsive.deviceFrame')}
              aria-label={t('design.responsive.deviceFrame')}
              aria-pressed={showDeviceFrame}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 28,
                padding: '0 8px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: showDeviceFrame ? 'var(--accent-soft, rgba(0,0,0,0.06))' : 'transparent',
                fontSize: 11,
                cursor: 'pointer',
                color: 'var(--text, inherit)',
              }}
            >
              {t('design.responsive.deviceFrame')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setGuidesEnabled((v) => !v)}
            title={guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span>{guidesEnabled ? t('design.layout.hideGuides') : t('design.layout.showGuides')}</span>
          </button>
        </div>
      </header>
      {(saveMsg || aiMsg || exportMsg) && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
          {[saveMsg, aiMsg, exportMsg].filter(Boolean).join(' · ')}
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

        {/* 中:iframe 画布(响应式预览:wrapper 控制最大宽度 + 居中 + 可选设备外框) */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 8 }}>
          <div
            style={{
              width: '100%',
              maxWidth: currentWidth,
              margin: '0 auto',
              flex: '1 1 auto',
              minHeight: 0,
              border: '1px solid var(--border)',
              borderRadius: showFrame ? deviceRadius : 8,
              overflow: 'hidden',
              background: 'var(--card)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: showFrame ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'max-width 0.2s ease, border-radius 0.2s ease',
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="design-preview"
              style={{ flex: 1, border: 'none', background: 'var(--card)', width: '100%', height: '100%' }}
            />
          </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {selected.tagName}
                      {selected.elementId ? `#${selected.elementId}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={onResetStyles}
                      style={{ fontSize: 11, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      {t('design.css.reset')}
                    </button>
                  </div>
                  {CSS_GROUPS.map((group) => (
                    <CssGroupSection
                      key={group.id}
                      group={group}
                      values={styleEdits}
                      onChange={onStyleChange}
                      t={tf}
                    />
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

      {/* 模板库 Dialog(P2-a):网格展示 8 个模板卡片,点击应用 */}
      {templateDialogOpen && (
        <div
          onClick={() => setTemplateDialogOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 90vw)',
              maxHeight: '80vh',
              overflow: 'auto',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t('design.templates.title')}</h3>
              <button
                type="button"
                onClick={() => setTemplateDialogOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--muted)', lineHeight: 1 }}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 8,
              }}
            >
              {DESIGN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onApplyTemplate(tpl.html)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: 10,
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--card)',
                    cursor: 'pointer',
                    color: 'var(--text, inherit)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-soft, rgba(0,0,0,0.04))'
                    e.currentTarget.style.borderColor = 'var(--accent, hsl(142 71% 45%))'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--card)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t(tpl.nameKey)}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t(tpl.descriptionKey)}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                    {t(`design.templates.categories.${tpl.category}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
