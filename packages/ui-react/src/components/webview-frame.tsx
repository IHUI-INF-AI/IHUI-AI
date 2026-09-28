// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ExternalLink, Loader2, AlertTriangle, ImageIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'

/**
 * 通用 WebView 抽象组件。
 * 根据 mode 渲染:iframe(直接嵌入)/ screenshot(截图模式)/ external(外部打开兜底)。
 *
 * 各端可基于此组件扩展:
 * - web: iframe + 后端 Playwright 降级
 * - desktop: Tauri WebView2(覆盖 render props)
 * - mobile-rn: 用 react-native-webview(各端自实现,不使用此组件)
 *
 * 圆角守门:容器用 rounded-lg(8px),禁用 rounded-full。
 * 图标垂直对齐依赖全局 --text-vcenter-offset CSS 变量(已在 globals.css 配置)。
 */

export type WebViewMode = 'iframe' | 'screenshot' | 'external'
export type WebViewStatus = 'idle' | 'loading' | 'loaded' | 'screenshot' | 'failed' | 'blocked'

/* ────────────────────────────────────────────────────────────────────────────────
 * iframe 沙箱档位:全仓唯一实现(2026-09-27 安全票「严档缺省 + 放宽必须逐处声明」)
 *
 * 立因:本组件此前把 sandbox 当"调用方爱传什么传什么"的自由字符串,而**缺省值本身**是
 * 全仓最宽的一档 `allow-same-origin allow-scripts allow-forms allow-popups`。缺省即最宽,
 * 等于"不写 sandbox 的人拿到最松的沙箱";而 `allow-scripts` 与 `allow-same-origin` 同时给
 * 时沙箱形同虚设 —— 帧内脚本可以自己摘掉 sandbox 属性、读同源存储。实测那条缺省正被
 * `apps/web/src/components/work-panel/web-work-panel.tsx` 的直接嵌入分支原样使用(它不传 sandbox)。
 *
 * 三条规矩(判据由 `__tests__/webview-frame-sandbox.test.tsx` 逐条钉住):
 *   ① 缺省 = STRICT_SANDBOX(空串)⇒ 渲染 `sandbox=""` ⇒ 浏览器施加**全部**限制。
 *      注意不是"不渲染该属性":属性缺席 = 完全不限,那正是旧缺陷的形态。
 *   ② 放宽只有一条出路:传 `{ tokens, reason }`,reason 去空白后必须非空 ——
 *      没有理由的放宽**不生效**(仍然落到严档),而不是"少一道提醒"。
 *   ③ 裸 token 字符串一律不生效。这是刻意的破坏性收紧:静默把一串 token 递进来
 *      就放宽,等于没有这条政策。旧调用点必须改成 ② 的形态。
 *
 * 不得在本文件之外再写第二份 sandbox 字符串字面量。apps/web 里那几处**原生 `<iframe>`**
 * 暂时引不到这里的常量(`@ihui/ui-react` 的 barrel `src/index.ts` 未导出它们,补导出属该包
 * 持有人职权),由 `apps/web/tests/iframe-sandbox-declaration.test.ts` 按**源码审计**口径
 * 与本文件的常量逐字对账,并要求每一处宽档都带行内 `iframe-sandbox-relax: <原因>`。
 * ──────────────────────────────────────────────────────────────────────────────── */

/** 严档:属性存在且不含任何 token ⇒ 脚本/表单/弹窗/同源身份全部禁止 */
export const STRICT_SANDBOX = ''
export const STRICT_SANDBOX_TOKENS: readonly string[] = []

/**
 * 模型生成 / 用户上传 HTML 的渲染档:只给 `allow-scripts`。
 * 这类内容必须有脚本才能出图(图表、Canvas 动画),但**绝不给** `allow-same-origin`
 * —— 给了就等于把本站 Cookie/localStorage 交到一段模型现写的 HTML 手里。
 */
export const MODEL_CONTENT_SANDBOX = 'allow-scripts'
export const MODEL_CONTENT_SANDBOX_TOKENS: readonly string[] = ['allow-scripts']

/** HTML 规范里 sandbox 合法的 token 全集;词外的值会被 resolveSandbox 丢掉(不静默放宽) */
export const SANDBOX_TOKEN_VOCAB: readonly string[] = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-modals',
  'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-presentation',
  'allow-downloads',
  'allow-top-navigation',
  'allow-top-navigation-by-user-activation',
  'allow-top-navigation-to-custom-protocols',
  'allow-storage-access-by-user-activation',
]

const SANDBOX_TOKEN_SET = new Set(SANDBOX_TOKEN_VOCAB)

/** 一次显式的沙箱放宽声明:tokens 之外**必须**带 reason */
export interface SandboxRelaxation {
  tokens: readonly string[]
  /** 为什么这一处非放宽不可。空白 / 缺省视为未声明 ⇒ 不放宽(仍然严档) */
  reason: string
}

/** WebViewFrame 的 sandbox 入参形态(裸串接受但不生效,见文件头规矩③) */
export type SandboxInput = string | SandboxRelaxation | null | undefined

/**
 * 把入参折成最终要写进 DOM 的 sandbox 值。**唯一**的判定出口,别处不得再抄一份逻辑。
 * 返回空串 = 严档。
 */
export function resolveSandbox(input?: SandboxInput): string {
  if (input === null || input === undefined) return STRICT_SANDBOX

  if (typeof input === 'string') {
    // 规矩③:裸 token 串不生效。能走到这里说明调用点还留着旧写法,喊出来而不是照办。
    if (process.env.NODE_ENV !== 'production' && input.trim() !== '') {
      console.warn(
        '[WebViewFrame] sandbox 收到裸字符串已被忽略(仍按严档渲染)。' +
          '放宽请传 resolveSandbox({ tokens, reason }) 的形态并写明理由:' +
          ` 收到的值是 ${JSON.stringify(input)}`,
      )
    }
    return STRICT_SANDBOX
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) {
    if (process.env.NODE_ENV !== 'production' && input.tokens.length > 0) {
      console.warn('[WebViewFrame] 放宽声明缺少 reason,已按严档渲染:', JSON.stringify(input.tokens))
    }
    return STRICT_SANDBOX
  }

  // 词表外的 token 直接丢弃:拼出一个浏览器不认识的档不算放宽,只算把严档写坏
  const kept: string[] = []
  for (const token of input.tokens) {
    if (SANDBOX_TOKEN_SET.has(token) && !kept.includes(token)) kept.push(token)
  }
  return kept.join(' ')
}

export interface WebViewFrameProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onLoad' | 'onError'
> {
  /** 当前 URL */
  url: string
  /** 嵌入模式 */
  mode: WebViewMode
  /** 加载状态 */
  status: WebViewStatus
  /** 截图 base64(screenshot 模式,不含 data: 前缀) */
  screenshot?: string
  /** 页面标题 */
  title?: string
  /** 错误信息 */
  error?: string
  /**
   * iframe 沙箱。**缺省 = 严档**(`sandbox=""`,全禁),见文件头 STRICT_SANDBOX 的三条规矩。
   * 需要放宽只能传 `{ tokens, reason }` 且 reason 非空;裸 token 字符串不生效(仍渲染严档)。
   */
  sandbox?: SandboxInput
  /** iframe 加载完成回调 */
  onLoad?: () => void
  /** iframe 加载失败回调 */
  onError?: (error: string) => void
  /** "在外部打开"点击回调(status=external/failed 时显示) */
  onOpenExternal?: (url: string) => void
  /** 重试回调 */
  onRetry?: () => void
  /** 界面文案注入(不传的键回退 DEFAULT_WEB_VIEW_FRAME_LABELS 简体中文 — 不注入即不本地化) */
  labels?: Partial<WebViewFrameLabels>
}

/** WebViewFrame 界面文案(加载/截图提示/兜底标题/按钮/空态),由消费端注入 */
export interface WebViewFrameLabels {
  loadingText: string
  screenshotNotice: string
  blockedTitle: string
  failedTitle: string
  externalTitle: string
  retry: string
  openExternal: string
  idlePlaceholder: string
}

/** i18n 默认值(不传 labels 时回退到简体中文) */
const DEFAULT_WEB_VIEW_FRAME_LABELS: WebViewFrameLabels = {
  loadingText: '加载中...',
  screenshotNotice: '该网站禁止嵌入,已切换到截图模式',
  blockedTitle: 'URL 不安全,已拦截',
  failedTitle: '加载失败',
  externalTitle: '无法在面板内嵌入',
  retry: '重试',
  openExternal: '在外部浏览器打开',
  idlePlaceholder: '输入网址或点击 AI 消息中的链接以打开',
}

export const WebViewFrame = React.forwardRef<HTMLDivElement, WebViewFrameProps>(
  (
    {
      url,
      mode,
      status,
      screenshot,
      title,
      error,
      sandbox,
      onLoad,
      onError,
      onOpenExternal,
      onRetry,
      labels: labelsProp,
      className,
      ...rest
    },
    ref,
  ) => {
    const labels = React.useMemo<WebViewFrameLabels>(
      () => ({ ...DEFAULT_WEB_VIEW_FRAME_LABELS, ...labelsProp }),
      [labelsProp],
    )
    // 2026-07-25 用户反馈:彻底隐藏滚动条
    // 通过 same-origin 访问 contentDocument 注入 CSS 强制隐藏 iframe 内部 html/body 滚动条
    const injectHideScrollbar = React.useCallback((iframe: HTMLIFrameElement) => {
      try {
        const doc = iframe.contentDocument
        if (!doc || !doc.documentElement) return
        // 幂等:已有标记就跳过,避免重复注入
        if (doc.documentElement.dataset.hideScrollbar === '1') return
        doc.documentElement.dataset.hideScrollbar = '1'
        const style = doc.createElement('style')
        style.dataset.origin = 'ihui-hide-scrollbar'
        style.textContent = `
          html, body {
            overflow: hidden !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          html::-webkit-scrollbar, body::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
          }
          /* 兜底:部分网站用 overscroll-behavior 也得关掉,避免滚动链 */
          html, body { overscroll-behavior: none !important; }
        `
        if (doc.head) doc.head.appendChild(style)
        else doc.documentElement.appendChild(style)
      } catch {
        // cross-origin iframe,无法访问 contentDocument,静默忽略
      }
    }, [])

    const handleIframeLoad = React.useCallback(
      (e: React.SyntheticEvent<HTMLIFrameElement>) => {
        onLoad?.()
        injectHideScrollbar(e.currentTarget)
      },
      [onLoad],
    )

    // 2026-07-25 用户反馈:彻底隐藏滚动条(鼠标滚轮/触摸板足够)
    // - 外层 .work-panel-content 的 overflow:hidden 只能裁剪 iframe 元素自身,
    //   真正显示的滚动条来自 iframe 内部文档(html/body 的 overflow:auto)
    // - 通过 same-origin 访问 contentDocument 注入 CSS 强制隐藏内部滚动条
    // - 鼠标滚轮:wheel 事件在 iframe 内部触发滚动,即使 overflow:hidden 也允许
    //   (现代浏览器在 overflow:hidden 元素上仍响应 wheel 事件传播给父文档)
    // - 同时挂 useEffect:组件 mount/url 变化时主动尝试注入,覆盖"iframe 已加载但 onLoad
    //   不会再触发"的场景(HMR 更新代码后旧 iframe 不会重新触发 onLoad)
    const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
    React.useEffect(() => {
      const tryInject = () => {
        const iframe = iframeRef.current
        if (!iframe) return
        try {
          const doc = iframe.contentDocument
          if (doc && doc.documentElement) {
            injectHideScrollbar(iframe)
          }
        } catch {
          // cross-origin,等加载完成后再试
        }
      }
      // 立即尝试一次(iframe 可能已经加载完)
      tryInject()
      // 再延迟 500ms / 1500ms 各试一次,覆盖 HMR 后旧 iframe 没重新触发 onLoad 的情况
      const t1 = setTimeout(tryInject, 500)
      const t2 = setTimeout(tryInject, 1500)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }, [url, mode])

    return (
      <div
        ref={ref}
        className={cn('relative h-full w-full overflow-hidden rounded-lg bg-background', className)}
        {...rest}
      >
        {/* 加载中遮罩 */}
        {status === 'loading' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">{labels.loadingText}</span>
            </div>
          </div>
        )}

        {/* iframe 模式(2026-07-25 用户反馈:彻底隐藏滚动条,鼠标滚轮/触摸板足够)
            - 外层 .work-panel-content 已用 overflow:hidden + !important 干掉滚动条
            - iframe 用 overflow:auto 让内容溢出时出现 iframe 自身滚动条
              (iframe 内部滚动条由 globals.css 的 iframe::-webkit-scrollbar 全部隐藏)
            - scrolling="no" 关掉 Webkit 兼容模式的双滚动条
            - 不让 overflow:hidden 阻止外层触发鼠标滚轮:wheel 事件天然冒泡到外层 div
            - onLoad + useEffect 双重保障:通过 same-origin contentDocument 注入 CSS 隐藏 iframe 内部 html/body 滚动条 */}
        {mode === 'iframe' && url && (
          <iframe
            key={url}
            ref={iframeRef}
            src={url}
            title={title ?? url}
            className="h-full w-full border-0"
            sandbox={resolveSandbox(sandbox)}
            referrerPolicy="no-referrer"
            loading="lazy"
            scrolling="no"
            style={{ overflow: 'hidden' }}
            onLoad={handleIframeLoad}
            onError={() => onError?.('iframe load failed')}
          />
        )}

        {/* 截图模式(2026-07-25 用户反馈:彻底隐藏滚动条,鼠标滚轮/触摸板足够)
            - screenshot-scroll 类 + globals.css !important 强制隐藏滚动条
            - overflow-hidden 而不是 auto:即使图片超出也不出现原生滚动条 */}
        {mode === 'screenshot' && (
          <div className="flex h-full w-full flex-col">
            {screenshot ? (
              <>
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>{labels.screenshotNotice}</span>
                </div>
                <div className="screenshot-scroll flex-1 overflow-hidden bg-muted/20 p-2">
                  <img
                    src={`data:image/png;base64,${screenshot}`}
                    alt={title ?? url}
                    className="h-auto w-full rounded-md border border-border shadow-sm"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* 外部打开 / 失败兜底 */}
        {(mode === 'external' || status === 'failed' || status === 'blocked') && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-3 text-center">
            {status === 'blocked' || status === 'failed' ? (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            ) : (
              <ExternalLink className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status === 'blocked'
                  ? labels.blockedTitle
                  : status === 'failed'
                    ? labels.failedTitle
                    : labels.externalTitle}
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">{url}</p>
                </TooltipTrigger>
                <TooltipContent>{url}</TooltipContent>
              </Tooltip>
              {error && <p className="text-xs text-muted-foreground">{error}</p>}
            </div>
            <div className="flex gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {labels.retry}
                </button>
              )}
              {onOpenExternal && (
                <button
                  type="button"
                  onClick={() => onOpenExternal(url)}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-cta px-3 py-1.5 text-xs text-cta-foreground hover:bg-cta/90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>{labels.openExternal}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* idle 空状态 */}
        {status === 'idle' && !url && (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span className="text-xs">{labels.idlePlaceholder}</span>
          </div>
        )}
      </div>
    )
  },
)
WebViewFrame.displayName = 'WebViewFrame'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
