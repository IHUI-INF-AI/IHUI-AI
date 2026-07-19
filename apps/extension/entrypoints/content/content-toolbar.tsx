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
      'background:#161616',
      'color:#f5f5f5',
      'border:1px solid #262626',
      'border-radius:6px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
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
    const w = refs.root.offsetWidth || TOOLBAR_ESTIMATED_WIDTH
    const h = refs.root.offsetHeight || TOOLBAR_ESTIMATED_HEIGHT

    // 防抖:同选区附近不抖动
    if (this.lastRect && isNearbyRect(this.lastRect, rect)) {
      // 沿用 anchor,只更新 top
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
      'border:1px solid #404040',
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
      mark.ihui-hl { background: rgba(250, 204, 21, 0.45); color: inherit; padding: 0 1px; border-radius: 2px; }
      .ihui-tx { animation: ihui-tx-fade 240ms ease-out; }
      @keyframes ihui-tx-fade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
      #${TOOLBAR_ID} button:hover {
        background: #262626 !important;
        color: #fafafa !important;
        border-color: #525252 !important;
      }
      #${TOOLBAR_ID} button:active {
        background: #404040 !important;
        transform: scale(0.96);
      }
      #${TOOLBAR_ID} button:focus-visible {
        outline: 2px solid #14b8a6;
        outline-offset: 1px;
      }
      .ihui-ctx-popup {
        position: fixed;
        z-index: 2147483645;
        max-width: 360px;
        padding: 10px 12px;
        background: #161616;
        color: #f5f5f5;
        border: 1px solid #262626;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.22);
        font: 12px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
        animation: ihui-ctx-pop 160ms ease-out;
      }
      .ihui-ctx-popup .ihui-ctx-word {
        font-size: 14px;
        font-weight: 600;
        color: #14b8a6;
        margin-right: 8px;
      }
      .ihui-ctx-popup .ihui-ctx-phonetic {
        font-family: monospace;
        font-size: 11px;
        color: #a3a3a3;
      }
      .ihui-ctx-popup .ihui-ctx-translation {
        margin-top: 6px;
        font-size: 13px;
      }
      .ihui-ctx-popup .ihui-ctx-defs {
        margin: 6px 0 0 0;
        padding-left: 16px;
        font-size: 11px;
        color: #d4d4d4;
      }
      .ihui-ctx-popup .ihui-ctx-actions {
        margin-top: 8px;
        display: flex;
        gap: 6px;
      }
      .ihui-ctx-popup .ihui-ctx-btn {
        appearance: none;
        background: transparent;
        color: #f5f5f5;
        border: 1px solid #404040;
        border-radius: 4px;
        padding: 3px 8px;
        font: inherit;
        cursor: pointer;
        transition: background-color 120ms ease;
      }
      .ihui-ctx-popup .ihui-ctx-btn:hover {
        background: #262626;
      }
      @keyframes ihui-ctx-pop {
        from { opacity: 0; transform: translateY(-4px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `
    ;(doc.head || doc.documentElement).appendChild(style)
  }
}
