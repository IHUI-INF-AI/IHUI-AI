/**
 * Content Script 浮动工具栏组件。
 *
 * 职责(从 entrypoints/content.ts 抽离):
 * 1. 创建 / 获取工具栏 DOM(4 按钮:翻译 / 高亮 / 查词 / 问 AI)
 * 2. 注入 hover 动效(fade + scale,GPU 友好)+ 入场 / 离场动画
 * 3. 通过 position-memory 计算 viewport 内最佳位置(支持 flip + 防抖)
 * 4. 暴露 show / hide / updatePosition / setLabels API
 *
 * 设计原则:
 * - 与 React 解耦(避免在 content script 启 React runtime)
 * - 用 CSS transition / animation,无 JS 帧循环(零性能损耗)
 * - 单例:同一 document 共享一个 toolbar 节点,跨次选区复用
 * - 视觉:dark theme,border-radius 6px(非胶囊),gap 4px,无渐变
 */
import {
  computePositionWithMemory,
  isNearbyRect,
  type RectLike,
  type ViewportLike,
  type AnchorSnapshot,
  type ToolbarPlacement,
} from '../../src/content/position-memory'

export type ToolbarAction = 'translate' | 'highlight' | 'vocab' | 'send'

export interface ToolbarLabels {
  translate: string
  highlight: string
  vocab: string
  send: string
}

export interface ToolbarRefs {
  root: HTMLDivElement
  translateBtn: HTMLButtonElement
  highlightBtn: HTMLButtonElement
  vocabBtn: HTMLButtonElement
  sendBtn: HTMLButtonElement
}

const TOOLBAR_ID = 'ihui-content-toolbar'
const STYLE_ID = 'ihui-content-style'
const TOOLBAR_ESTIMATED_WIDTH = 220
const TOOLBAR_ESTIMATED_HEIGHT = 32

export class ContentToolbar {
  private doc: Document
  private refs: ToolbarRefs | null = null
  private anchor: AnchorSnapshot | null = null
  private lastRect: RectLike | null = null
  private shown = false
  private lastShownAt = 0
  private static readonly SHOW_DEBOUNCE_MS = 500

  constructor(doc: Document) {
    this.doc = doc
  }

  /** 获取工具栏 DOM 节点(单例,首次创建后缓存 refs) */
  getRefs(): ToolbarRefs {
    if (this.refs) return this.refs
    this.injectStyle(this.doc)
    const existing = this.doc.getElementById(TOOLBAR_ID) as HTMLDivElement | null
    if (existing) {
      this.refs = {
        root: existing,
        translateBtn: existing.querySelector<HTMLButtonElement>('[data-act="translate"]')!,
        highlightBtn: existing.querySelector<HTMLButtonElement>('[data-act="highlight"]')!,
        vocabBtn: existing.querySelector<HTMLButtonElement>('[data-act="vocab"]')!,
        sendBtn: existing.querySelector<HTMLButtonElement>('[data-act="send"]')!,
      }
      return this.refs
    }
    const root = this.doc.createElement('div')
    root.id = TOOLBAR_ID
    root.setAttribute('data-ihui', 'content-toolbar')
    root.style.cssText = [
      'position:fixed',
      'z-index:2147483646',
      'display:none',
      'gap:4px',
      'padding:4px',
      'background:var(--color-card)',
      'color:var(--color-foreground)',
      'border:1px solid var(--color-border)',
      'border-radius:6px',
      'box-shadow:var(--shadow-toolbar)',
      'font:12px/1 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
      'pointer-events:auto',
      'user-select:none',
      'opacity:0',
      'transform:scale(0.96)',
      'transform-origin:center top',
      'transition:opacity 140ms ease-out, transform 140ms ease-out',
    ].join(';')

    const translateBtn = this.mkBtn('translate')
    const highlightBtn = this.mkBtn('highlight')
    const vocabBtn = this.mkBtn('vocab')
    const sendBtn = this.mkBtn('send')
    root.append(translateBtn, highlightBtn, vocabBtn, sendBtn)
    this.doc.body.appendChild(root)

    this.refs = { root, translateBtn, highlightBtn, vocabBtn, sendBtn }
    return this.refs
  }

  /** 绑定 4 个按钮的 click 事件 */
  bindHandlers(handlers: Record<ToolbarAction, (e: MouseEvent) => void>): void {
    const refs = this.getRefs()
    const wire = (el: HTMLButtonElement, key: ToolbarAction) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handlers[key](e)
      })
    }
    wire(refs.translateBtn, 'translate')
    wire(refs.highlightBtn, 'highlight')
    wire(refs.vocabBtn, 'vocab')
    wire(refs.sendBtn, 'send')
  }

  /** 更新按钮文字(i18n) */
  setLabels(labels: ToolbarLabels): void {
    const refs = this.getRefs()
    refs.translateBtn.textContent = labels.translate
    refs.highlightBtn.textContent = labels.highlight
    refs.vocabBtn.textContent = labels.vocab
    refs.sendBtn.textContent = labels.send
  }

  /** 显示工具栏(fade-in + scale-up) */
  show(rect: RectLike, viewport: ViewportLike): ToolbarPlacement {
    const refs = this.getRefs()
    const now = Date.now()
    const w = refs.root.offsetWidth || TOOLBAR_ESTIMATED_WIDTH
    const h = refs.root.offsetHeight || TOOLBAR_ESTIMATED_HEIGHT

    // 防抖:同选区附近 500ms 内重复调用忽略(selectionchange 高频触发时避免重复定位/抖动)
    if (
      this.lastRect &&
      isNearbyRect(this.lastRect, rect) &&
      this.shown &&
      now - this.lastShownAt < ContentToolbar.SHOW_DEBOUNCE_MS
    ) {
      return {
        top: parseFloat(refs.root.style.top) || 0,
        left: parseFloat(refs.root.style.left) || 0,
        placement: this.anchor?.placement ?? 'bottom',
        visible: true,
        visibilityRatio: 1,
      }
    }

    const placement = computePositionWithMemory(rect, w, h, viewport, {
      anchor: this.anchor,
      margin: 8,
      offset: 8,
      jitterThreshold: 4,
    })
    if (!placement.visible) {
      this.hide()
      return placement
    }

    refs.root.style.top = `${placement.top}px`
    refs.root.style.left = `${placement.left}px`
    if (!this.shown) {
      // 首次显示:display + 下一帧 opacity/transform 触发过渡
      refs.root.style.display = 'flex'
      // 强制 reflow,确保 transition 生效
      void refs.root.offsetHeight
      refs.root.style.opacity = '1'
      refs.root.style.transform = 'scale(1)'
      this.shown = true
    }
    this.anchor = { placement: placement.placement, left: placement.left }
    this.lastRect = rect
    this.lastShownAt = now
    return placement
  }

  /** 隐藏工具栏(fade-out,过渡完成后 display:none) */
  hide(): void {
    if (!this.refs) return
    const root = this.refs.root
    root.style.opacity = '0'
    root.style.transform = 'scale(0.96)'
    const finalize = () => {
      if (root.style.opacity === '0') {
        root.style.display = 'none'
        this.shown = false
      }
    }
    // 监听 transitionend,失败兜底用 setTimeout
    const onEnd = () => {
      root.removeEventListener('transitionend', onEnd)
      finalize()
    }
    root.addEventListener('transitionend', onEnd)
    setTimeout(onEnd, 200)
  }

  /** 销毁(测试 / ctx.onInvalidated 用) */
  destroy(): void {
    if (this.refs) {
      this.refs.root.remove()
      this.refs = null
      this.shown = false
      this.anchor = null
      this.lastRect = null
    }
  }

  private mkBtn(act: ToolbarAction): HTMLButtonElement {
    const b = this.doc.createElement('button')
    b.dataset.act = act
    b.type = 'button'
    b.style.cssText = [
      'appearance:none',
      'background:transparent',
      'color:inherit',
      'border:1px solid var(--color-accent-strong)',
      'border-radius:4px',
      'padding:4px 8px',
      'font:inherit',
      'cursor:pointer',
      'transition:background-color 120ms ease, color 120ms ease, border-color 120ms ease',
    ].join(';')
    return b
  }

  private injectStyle(doc: Document): void {
    if (doc.getElementById(STYLE_ID)) return
    const style = doc.createElement('style')
    style.id = STYLE_ID
    // 严格遵守 §4:无胶囊圆角,无渐变,无 border 分割线;hover 用 subtle 颜色变化
    style.textContent = `
      /*
       * 容器级 design-tokens CSS 变量(content script 注入第三方页面,
       * 不依赖宿主 :root;变量定义在扩展容器自身,命名对齐 @ihui/design-tokens,
       * 值保留 content script dark theme 色板确保视觉一致)。
       */
      #${TOOLBAR_ID}, .ihui-ctx-popup {
        --color-card: #161616;
        --color-foreground: #f5f5f5;
        --color-border: #262626;
        --color-accent: #262626;
        --color-accent-strong: #404040;
        --color-accent-foreground: #fafafa;
        --color-muted: #525252;
        --color-muted-foreground: #a3a3a3;
        --color-secondary-foreground: #d4d4d4;
        /* design-tokens 无 teal,content script 品牌强调色保留,借名 --color-info */
        --color-info: #14b8a6;
        --color-info-foreground: #0f766e;
        --color-info-muted: rgba(20, 184, 166, 0.08);
        --color-warning: rgba(250, 204, 21, 0.45);
        --shadow-toolbar: 0 4px 16px rgba(0, 0, 0, 0.18);
        --shadow-popup: 0 8px 24px rgba(0, 0, 0, 0.22);
      }
      mark.ihui-hl {
        --color-warning: rgba(250, 204, 21, 0.45);
        background: var(--color-warning);
        color: inherit;
        padding: 0 1px;
        border-radius: 2px;
      }
      .ihui-tx { animation: ihui-tx-fade 240ms ease-out; }
      @keyframes ihui-tx-fade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
      #${TOOLBAR_ID} button:hover {
        background: var(--color-accent) !important;
        color: var(--color-accent-foreground) !important;
        border-color: var(--color-muted) !important;
      }
      #${TOOLBAR_ID} button:active {
        background: var(--color-accent-strong) !important;
        transform: scale(0.96);
      }
      #${TOOLBAR_ID} button:focus-visible {
        outline: 2px solid var(--color-info);
        outline-offset: 1px;
      }
      .ihui-ctx-popup {
        position: fixed;
        z-index: 2147483645;
        max-width: 360px;
        padding: 10px 12px;
        background: var(--color-card);
        color: var(--color-foreground);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        box-shadow: var(--shadow-popup);
        font: 12px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
        animation: ihui-ctx-pop 160ms ease-out;
      }
      .ihui-ctx-popup .ihui-ctx-word {
        font-size: 14px;
        font-weight: 600;
        color: var(--color-info);
        margin-right: 8px;
      }
      .ihui-ctx-popup .ihui-ctx-phonetic {
        font-family: monospace;
        font-size: 11px;
        color: var(--color-muted-foreground);
      }
      .ihui-ctx-popup .ihui-ctx-translation {
        margin-top: 6px;
        font-size: 13px;
      }
      .ihui-ctx-popup .ihui-ctx-defs {
        margin: 6px 0 0 0;
        padding-left: 16px;
        font-size: 11px;
        color: var(--color-secondary-foreground);
      }
      .ihui-ctx-popup .ihui-ctx-actions {
        margin-top: 8px;
        display: flex;
        gap: 6px;
      }
      .ihui-ctx-popup .ihui-ctx-btn {
        appearance: none;
        background: transparent;
        color: var(--color-foreground);
        border: 1px solid var(--color-accent-strong);
        border-radius: 4px;
        padding: 3px 8px;
        font: inherit;
        cursor: pointer;
        transition: background-color 120ms ease;
      }
      .ihui-ctx-popup .ihui-ctx-btn:hover {
        background: var(--color-accent);
      }
      @keyframes ihui-ctx-pop {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `
    ;(doc.head || doc.documentElement).appendChild(style)
  }
}
