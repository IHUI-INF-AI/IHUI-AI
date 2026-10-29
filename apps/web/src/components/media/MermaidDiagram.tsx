// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Check, ImageDown, Maximize2, RotateCcw, Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
// D198:渲染成功图表一键「复制为图片」(SVG→PNG→剪贴板),落盘实现见 lib/copy-as-image.ts
import { svgElementToPngBlob } from '@/lib/copy-as-image'
// G-854:倍率域 / 适应视口 / 定点缩放的算式改走共享层唯一出口,组件内不得再留第二份
// (改造前这里是 `MermaidDiagram.tsx` 里的私有 `clampZoom` + 三个常量,逐字搬走了)
import { ZOOM_STEP, clampZoom, fitZoom } from '@ihui/shared/utils/diagram-viewport'
import { DiagramPreviewModal } from './DiagramPreviewModal'
import {
  MERMAID_SKIP_NOTICE_KEYS,
  decideMermaidRender,
  isMermaidContentOverBudget,
  measureMermaidSource,
  type MermaidRenderDecision,
} from '@/components/ai/mermaid-render-budget'

/**
 * 2026-10-29 流式观感档⑨:模块级「已成功的消毒后 SVG」台账。
 * 立因:① markdown-stream 的 stable/active 切分(P3 #35)会把写完的 mermaid 块跨
 * ReactMarkdown 双树迁居晋升——重挂载实例读不到旧实例的 renderedKeyRef(组件级),
 * 首帧只能"渲染中"占位、再付一次主线程全量布局,图闪一拍;② 本组件是 web 端唯一
 * mermaid 渲染点(markdown-stream / MarkdownViewer / vision-analysis / mcp-resource-viewer
 * 四入口共用),切页返回列表重挂、同图多实例并发,付的都是同一份布局。把"渲染成功过"
 * 的事实从实例级抬到模块级:命中 ⇒ 首帧同步取图;在飞 ⇒ 同键合流只付一次。
 * 卫生:只入消毒后的成功结果(错误不固化);LRU 上限 12 条;病态尺寸(>512 万字符)
 * 不入账(一条占满 1/12 会把全家挤光);键含主题,明暗图绝不互串。
 */
const MERMAID_SVG_CACHE_MAX = 12
const MERMAID_SVG_CACHE_MAX_CHARS = 5_120_000
const mermaidSvgCache = new Map<string, string>()
const mermaidInflight = new Map<string, Promise<string>>()

function mermaidCacheKey(theme: string | undefined, code: string): string {
  return `${theme ?? 'none'}\u0000${code}`
}

/** 命中即 touch(delete+set 挪 FIFO 队尾),上限处只挤最久未读的头一条。 */
function readMermaidSvgCache(key: string): string | null {
  const hit = mermaidSvgCache.get(key)
  if (hit === undefined) return null
  mermaidSvgCache.delete(key)
  mermaidSvgCache.set(key, hit)
  return hit
}

function noteMermaidSvgCache(key: string, svg: string): void {
  if (svg.length > MERMAID_SVG_CACHE_MAX_CHARS) return
  mermaidSvgCache.delete(key)
  mermaidSvgCache.set(key, svg)
  if (mermaidSvgCache.size > MERMAID_SVG_CACHE_MAX) {
    const oldest = mermaidSvgCache.keys().next().value
    if (oldest !== undefined) mermaidSvgCache.delete(oldest)
  }
}

interface MermaidDiagramProps {
  code: string
  className?: string
}

/**
 * 页面可见性(本链路唯一的一个开关,不要再在别处读 document.hidden)。
 *
 * 为什么需要它:mermaid 的 parse + layout 是主线程同步工作,在后台标签页里
 * 做完也没有任何人看到 —— 而流式回答恰恰最容易发生在"用户已经切走了"的时候。
 * 隐藏期间不发起渲染;回到前台由本 hook 翻牌触发一次正常渲染(不是重渲染)。
 *
 * SSR 面:本组件经 `dynamic({ ssr:false })` 挂载,`document` 恒存在;
 * 仍留 `typeof document` 兜底,是为了让单测能在无 DOM 环境下 import 而不炸。
 */
function usePageVisible(): boolean {
  const [visible, setVisible] = React.useState<boolean>(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  )
  React.useEffect(() => {
    const sync = (): void => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', sync)
    // 订阅后立刻回读一次:state 初值与订阅之间标签页可能已经切换过
    sync()
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return visible
}

/**
 * Mermaid 渲染错误边界。
 * 单次渲染失败不会冒泡到外层页面,保证整页可用。
 */
class MermaidErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/**
 * Mermaid 图表渲染组件(客户端 only)。
 *
 * - mermaid 通过 dynamic import 加载,不影响首屏 bundle
 * - 主题跟随 next-themes 的 resolvedTheme,自动切换 dark / default
 * - **渲染预算**:源码规模超三维上限或页面不可见时**根本不进入 render**,降级为
 *   `<pre>` 源码 + 一条走 i18n 的提示(判据见 `@/components/ai/mermaid-render-budget`)。
 *   这一道是前置的,因为下面的 ErrorBoundary 抓得到抛错、抓不到挂死。
 * - 渲染失败时显示错误降级块 + 源码
 * - **档⑨ 模块级 SVG 台账**:同主题同内容的"已成功渲染"跨实例移交 —— 晋升重挂/
 *   多入口共用同一图时首帧同步取图、并发同键只付一次布局(卫生规则见台账定义处),不影响外层页面
 * - SVG 容器 overflow-auto,长图表可横向滚动;D196 起右上角悬浮缩放工具条
 *   (transform 缩放,scrollable overflow 随之扩展,横/纵滚动可达全部内容)
 *
 * 本组件是 web 端**唯一**的 mermaid 客户端渲染点(4 个调用方:markdown-stream /
 * MarkdownViewer / vision-analysis / mcp-resource-viewer 都 dynamic-import 它),
 * 所以预算落在这里 = 四个入口一起被覆盖,不需要在每个调用方各判一次。
 */
function MermaidDiagramInner({ code, className }: MermaidDiagramProps) {
  const t = useTranslations('a11y')
  const { resolvedTheme } = useTheme()
  // 档⑨:台账键(主题+内容);晋升/重挂实例同主题同内容 ⇒ 初帧经台账同步取图。
  // resolvedTheme 未定位的首帧归 'none' —— 不误配明暗任何一图,theme 落定后由
  // effect 补读台账(仍是同步 setSvg,零 render 调用,零布局)。
  const cacheKey = mermaidCacheKey(resolvedTheme, code)
  const [svg, setSvg] = React.useState<string | null>(() => readMermaidSvgCache(cacheKey))
  const [error, setError] = React.useState<Error | null>(null)
  const pageVisible = usePageVisible()

  // 用 useId 生成唯一 id,避免多实例冲突
  const rawId = React.useId()
  const id = `mermaid-${rawId.replace(/:/g, '')}`

  const decision = React.useMemo<MermaidRenderDecision>(
    () => decideMermaidRender({ ...measureMermaidSource(code), pageVisible }),
    [code, pageVisible],
  )
  // 内容超预算时给出提示键;页面在后台不算超预算(那不是内容问题,是时机问题)
  const skipNoticeKey =
    decision.outcome === 'skip' && isMermaidContentOverBudget(decision.reason)
      ? MERMAID_SKIP_NOTICE_KEYS[decision.reason]
      : null
  const shouldRender = decision.outcome === 'render'

  // 已成功的 code+主题组合不再重复 render:否则"切走标签页 → 切回来"会为一张
  // 已经画好的图再付一次全量布局(可见性开关是为了省工,不是为了造工)。
  // 档⑨:初帧台账命中 ⇒ 初始即"已渲染",ref 初值同步跟上,effect 直接短路。
  const renderedKeyRef = React.useRef<string | null>(svg !== null ? cacheKey : null)

  React.useEffect(() => {
    if (!shouldRender) return
    const key = cacheKey
    if (renderedKeyRef.current === key) return

    // 档⑨:台账命中(theme 晚到帧的补读也在这一支)⇒ 同步交图,一次 async render 都不发起
    const cached = readMermaidSvgCache(key)
    if (cached !== null) {
      renderedKeyRef.current = key
      setSvg(cached)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        // 档⑨并发合流:同键已有在飞任务 ⇒ 搭上同一份结果,不为同一张图付第二次主线程布局。
        // 发起者负责:成功入台账(不管自己活没活着,给"被晋升重挂顶掉"的原实例留结果)、
        // inflight 清账(只清还是自己那条)。
        let task = mermaidInflight.get(key)
        if (task === undefined) {
          const owned = (async (): Promise<string> => {
            // dynamic import,避免 SSR 报错 & 影响首屏 bundle size
            const mermaidModule = await import('mermaid')
            const mermaid = mermaidModule.default
            await mermaid.initialize({
              startOnLoad: false,
              theme: resolvedTheme === 'dark' ? 'dark' : 'default',
              // 2026-07-21 安全审计加固:securityLevel 改为 'strict' 阻止 Mermaid 代码内嵌 HTML/事件
              // 旧值 'loose' 允许 click/callback 等 HTML 事件 + 自定义 HTML 标签,可能被 XSS 利用
              // 严格模式:仅渲染 SVG,无 HTML 事件,无 script 标签
              securityLevel: 'strict',
            })
            const result = await mermaid.render(id, code)
            // DOMPurify 消毒 SVG,防止 XSS(mermaid securityLevel: 'strict' 已阻断 HTML 事件,此处二次防御)
            const DOMPurifyModule = await import('dompurify')
            const DOMPurify = DOMPurifyModule.default
            return DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true } })
          })()
          task = owned
          mermaidInflight.set(key, owned)
          // 成功入台账、随后清 inflight —— 必须挂在同一支已 catch 的链上:
          // `owned.finally` 另起一支的话,leader 失败时该支以原 reject 收尾,
          // void 接不住 ⇒ unhandled rejection(2026-10-29 现测,首跑即红被这格逮住)
          void owned
            .then((clean) => noteMermaidSvgCache(key, clean))
            .catch(() => {})
            .finally(() => {
              if (mermaidInflight.get(key) === owned) mermaidInflight.delete(key)
            })
        }
        const clean = await task
        if (cancelled) return
        renderedKeyRef.current = key
        setSvg(clean)
        setError(null)
      } catch (err) {
        if (cancelled) return
        // 失败只进本实例错误态,绝不入台账(⑨头注卫生)
        setError(err instanceof Error ? err : new Error(String(err)))
        setSvg(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shouldRender, code, resolvedTheme, id, cacheKey])

  // ── D196 缩放 + D198 复制为图片(全部 hook 置于下方条件 return 之前,rules-of-hooks)──
  const [zoom, setZoom] = React.useState(1)
  // G-854:「展开为独立预览」的开关。Modal 自持一份视角状态(倍率/滚动/手势),内联这份不受影响;
  // 入口做在本组件身上,是因为本组件已是 web 端唯一的 mermaid 渲染点(见文件头),
  // 在 markdown 侧另接一条只会造出第二个入口 —— 而那个文件此刻由他人持有。
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [imageCopied, setImageCopied] = React.useState(false)
  // 滚动视口(适应屏幕的视口测量基准)与被 transform 的内容(量取真实内容尺寸)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const zoomedRef = React.useRef<HTMLDivElement>(null)
  // 「图片已复制」回退 timer 收进 ref,卸载时清理(与 markdown-stream useCopy 同纪律)
  const imageTimerRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    return () => {
      if (imageTimerRef.current !== null) {
        window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = null
      }
    }
  }, [])

  const handleZoomIn = (): void => setZoom((z) => clampZoom(z * ZOOM_STEP))
  const handleZoomOut = (): void => setZoom((z) => clampZoom(z / ZOOM_STEP))
  const handleZoomReset = (): void => setZoom(1)
  /** 适应屏幕:量取内容自然尺寸(实测值含当前缩放,除回当前倍率),取「完整可见」的最大不放大倍率 */
  const handleZoomToFit = (): void => {
    const viewport = scrollRef.current
    const rect = zoomedRef.current?.getBoundingClientRect()
    if (!viewport || !rect) {
      setZoom(1)
      return
    }
    // G-854:算式(含「测不到就回落 100%」这一档)只有共享层那一份,端内不再判一次 measurability
    setZoom(
      fitZoom({
        viewportW: viewport.clientWidth,
        viewportH: viewport.clientHeight,
        naturalW: rect.width / zoom,
        naturalH: rect.height / zoom,
      }),
    )
    viewport.scrollTop = 0
    viewport.scrollLeft = 0
  }

  /** D198:把渲染出的 SVG 绘成 PNG 写入剪贴板;环境不支持(无 ClipboardItem)时静默保持原状 */
  const handleCopyImage = (): void => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return
    const svgEl = zoomedRef.current?.querySelector('svg')
    if (!svgEl) return
    const background = resolvedTheme === 'dark' ? '#09090b' : '#ffffff'
    svgElementToPngBlob(svgEl, { background })
      .then((blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]))
      .then(() => {
        setImageCopied(true)
        if (imageTimerRef.current !== null) window.clearTimeout(imageTimerRef.current)
        imageTimerRef.current = window.setTimeout(() => setImageCopied(false), 1500)
      })
      .catch(() => {})
  }

  const zoomToolBtnClass =
    'inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  // 预算判退:不进 render,回落成源码 + 一条明示原因的提示(不得静默变空白)
  if (skipNoticeKey !== null) {
    return (
      <div className={cn('rounded-md border border-border bg-muted/50 p-3 text-xs', className)}>
        <p className="text-muted-foreground">{t(skipNoticeKey)}</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre text-muted-foreground">{code}</pre>
      </div>
    )
  }

  // 渲染失败,显示错误降级块 + 源码
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <p className="text-destructive">{error.message}</p>
        <pre className="mt-2 text-xs text-muted-foreground">{code}</pre>
      </div>
    )
  }

  // 渲染中占位
  if (svg === null) {
    return (
      <div className="animate-pulse text-xs text-muted-foreground">{t('diagramRendering')}</div>
    )
  }

  // 渲染成功,展示 SVG(横向滚动以适配长图表)
  return (
    <div className={cn('relative', className)}>
      {/* D196/D198:缩放 + 复制为图片 工具条(悬浮右上角,形态同 markdown-stream 代码块动作区) */}
      <div
        className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-float-indicator-bg p-0.5"
        data-testid="mermaid-zoom-toolbar"
      >
        <button
          type="button"
          onClick={handleZoomOut}
          data-testid="mermaid-zoom-out"
          className={zoomToolBtnClass}
          aria-label={t('mermaidZoomOut')}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span
          data-testid="mermaid-zoom-level"
          aria-label={t('mermaidZoomLevel')}
          className="min-w-9 text-center text-[11px] tabular-nums text-muted-foreground"
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          data-testid="mermaid-zoom-in"
          className={zoomToolBtnClass}
          aria-label={t('mermaidZoomIn')}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomToFit}
          data-testid="mermaid-zoom-fit"
          className={zoomToolBtnClass}
          aria-label={t('mermaidZoomToFit')}
        >
          <Scan className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          data-testid="mermaid-zoom-reset"
          className={zoomToolBtnClass}
          aria-label={t('mermaidZoomReset')}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCopyImage}
          data-testid="mermaid-copy-image"
          className={zoomToolBtnClass}
          aria-label={imageCopied ? t('mermaidImageCopied') : t('mermaidCopyImage')}
        >
          {imageCopied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <ImageDown className="h-3.5 w-3.5" />
          )}
        </button>
        {/* G-854:展开为独立预览 Modal(焦点陷阱 + Esc 关闭由承载层给) */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          data-testid="mermaid-expand-preview"
          className={zoomToolBtnClass}
          aria-label={t('mermaidExpandPreview')}
          aria-haspopup="dialog"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* transform 缩放:scrollable overflow 含被变换内容的包围盒,缩放后横/纵滚动可达;
          zoom=1 时不挂 style,渲染路径与引入缩放前逐字节一致 */}
      <div ref={scrollRef} className="overflow-auto" data-testid="mermaid-scroll">
        <div
          ref={zoomedRef}
          style={
            zoom === 1 ? undefined : { transform: `scale(${zoom})`, transformOrigin: 'top left' }
          }
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      {/* G-854:独立预览 Modal。刻意常驻挂载而不是 `{open && <Modal/>}` ——
          后者会在关闭的那一刻整块卸载,Radix 的退出动画被切成"瞬间消失";
          open=false 时 Portal 不渲染任何东西,所以常驻的成本只是一次 effect。 */}
      <DiagramPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        svgMarkup={svg}
      />
    </div>
  )
}

/**
 * 导出的 Mermaid 图表组件,内部已用 ErrorBoundary 包裹。
 */
export function MermaidDiagram(props: MermaidDiagramProps): React.ReactElement {
  const t = useTranslations('a11y')
  return (
    <MermaidErrorBoundary
      fallback={
        <div className="ui-card rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
          <p className="text-destructive">{t('mermaidRenderFailed')}</p>
          <pre className="mt-2 text-xs text-muted-foreground">{props.code}</pre>
        </div>
      }
    >
      <MermaidDiagramInner {...props} />
    </MermaidErrorBoundary>
  )
}

/**
 * 测试隔离出口(§22c:测试 import 生产出口,不复制判据):模块台账跨用例存活,
 * 单测件必须能清空它 —— 否则"先渲染成功"一例会把后写的"render 只调一次"类断言
 * 短路成假绿。LRU 上限/并发合流的正反面另有专例钉死。
 */
export const __test__ = {
  clearMermaidRenderCache: (): void => {
    mermaidSvgCache.clear()
    mermaidInflight.clear()
  },
  mermaidCacheKey,
  readMermaidSvgCache,
  noteMermaidSvgCache,
}

export default MermaidDiagram
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
