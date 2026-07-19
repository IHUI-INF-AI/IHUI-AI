/**
 * Content Script — 沉浸式翻译 + 重点高亮 + 浮动工具栏。
 *
 * 设计:
 * 1. 监听 mouseup / keyup,在用户完成选区时显示浮动工具栏
 * 2. 工具栏:翻译 / 高亮 / 查词 / 发送到 AI
 * 3. 沉浸式翻译:点击翻译后,选区上方/下方插入翻译结果(用 ihui-tx 类)
 * 4. 重点高亮:点击高亮后,在当前页面内所有匹配文本用 <mark class="ihui-hl"> 包裹
 * 5. 通过 background 中转 API(避免 content script 直连受 CORS 限制)
 */
import {
  extractSelectionText,
  isValidSelection,
  computeToolbarPosition,
  highlightInElement,
  clearHighlights,
  detectLanguage,
  type ToolbarPosition,
} from '../src/content/content-utils'
import { sendMessage } from '../lib/message-router'

interface ToolbarElements {
  root: HTMLDivElement
  translateBtn: HTMLButtonElement
  highlightBtn: HTMLButtonElement
  vocabBtn: HTMLButtonElement
  sendBtn: HTMLButtonElement
}

const TOOLBAR_ID = 'ihui-content-toolbar'
const TX_CLASS = 'ihui-tx'
const HL_CLASS = 'ihui-hl'

let hideTimer: ReturnType<typeof setTimeout> | null = null
let highlightEnabled = false
const translationCache = new Map<string, string>()

function ensureToolbar(doc: Document): ToolbarElements {
  const existing = doc.getElementById(TOOLBAR_ID) as HTMLDivElement | null
  if (existing) {
    return {
      root: existing,
      translateBtn: existing.querySelector<HTMLButtonElement>('[data-act="translate"]')!,
      highlightBtn: existing.querySelector<HTMLButtonElement>('[data-act="highlight"]')!,
      vocabBtn: existing.querySelector<HTMLButtonElement>('[data-act="vocab"]')!,
      sendBtn: existing.querySelector<HTMLButtonElement>('[data-act="send"]')!,
    }
  }
  const root = doc.createElement('div')
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
  ].join(';')

  const mkBtn = (act: string, label: string): HTMLButtonElement => {
    const b = doc.createElement('button')
    b.dataset.act = act
    b.textContent = label
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
    ].join(';')
    return b
  }

  const translateBtn = mkBtn('translate', '翻译')
  const highlightBtn = mkBtn('highlight', '高亮')
  const vocabBtn = mkBtn('vocab', '查词')
  const sendBtn = mkBtn('send', '问 AI')

  root.append(translateBtn, highlightBtn, vocabBtn, sendBtn)
  doc.body.appendChild(root)

  const els: ToolbarElements = { root, translateBtn, highlightBtn, vocabBtn, sendBtn }
  bindToolbarHandlers(els)
  return els
}

function bindToolbarHandlers(els: ToolbarElements) {
  els.translateBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void handleTranslate()
  })
  els.highlightBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void handleHighlight()
  })
  els.vocabBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void handleVocab()
  })
  els.sendBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    void handleSendToAI()
  })
}

function showToolbar(selection: Selection) {
  const doc = selection.anchorNode?.ownerDocument ?? document
  const tb = ensureToolbar(doc)
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const pos: ToolbarPosition = computeToolbarPosition(
    rect,
    tb.root.offsetWidth || 200,
    tb.root.offsetHeight || 32,
    { width: window.innerWidth, height: window.innerHeight },
  )
  if (!pos.visible) {
    hideToolbar()
    return
  }
  tb.root.style.top = `${pos.top}px`
  tb.root.style.left = `${pos.left}px`
  tb.root.style.display = 'flex'
}

function hideToolbar() {
  const existing = document.getElementById(TOOLBAR_ID)
  if (existing) existing.style.display = 'none'
}

function getActiveSelectionText(): string {
  const sel = window.getSelection()
  const text = extractSelectionText(sel)
  return isValidSelection(text) ? text : ''
}

async function handleTranslate() {
  const text = getActiveSelectionText()
  if (!text) return
  const key = text.slice(0, 32)
  let translated = translationCache.get(key)
  if (translated) {
    insertTranslation(text, translated)
    return
  }
  try {
    const res = (await sendMessage({
      type: 'vocab.lookup',
      payload: { word: text, source: 'selection' },
      requestId: `tx-${Date.now()}`,
    })) as { translation?: string }
    translated = res?.translation || ''
    if (translated) {
      translationCache.set(key, translated)
      insertTranslation(text, translated)
    }
  } catch (err) {
    console.warn('[IHUI AI] translate failed:', err)
  }
}

function insertTranslation(_original: string, translated: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const doc = range.commonAncestorContainer.ownerDocument || document
  const wrap = doc.createElement('span')
  wrap.className = TX_CLASS
  wrap.setAttribute('data-ihui', 'translation')
  wrap.style.cssText = [
    'display:block',
    'margin:4px 0',
    'padding:6px 10px',
    'background:rgba(20,184,166,0.08)',
    'color:#0f766e',
    'border-left:2px solid #14b8a6',
    'border-radius:4px',
    'font-size:12px',
    'line-height:1.5',
  ].join(';')
  wrap.textContent = `🌐 ${translated}`
  range.insertNode(wrap)
  sel.removeAllRanges()
  hideToolbar()
}

async function handleHighlight() {
  const text = getActiveSelectionText()
  if (!text) return
  highlightEnabled = !highlightEnabled
  try {
    // 本地立即应用:对当前页面所有匹配项加 mark
    if (highlightEnabled) {
      highlightInElement(document.body, text, document)
    } else {
      clearHighlights(document.body)
    }
  } catch (err) {
    console.warn('[IHUI AI] highlight failed:', err)
  }
  hideToolbar()
}

async function handleVocab() {
  const text = getActiveSelectionText()
  if (!text) return
  // 词汇查询:把选中文本写入 session storage,
  // sidepanel VocabularyPage 启动时检测并展示
  try {
    await chrome.storage.session?.set({ ihui_pending_vocab: text })
  } catch (err) {
    console.warn('[IHUI AI] save pending vocab failed:', err)
  }
  hideToolbar()
}

async function handleSendToAI() {
  const text = getActiveSelectionText()
  if (!text) return
  try {
    await chrome.storage.session?.set({ ihui_pending_prompt: text })
  } catch {
    // ignore
  }
  // 通过 runtime 打开 sidepanel
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    const winId = tabs[0]?.windowId
    if (typeof tabId === 'number') {
      await chrome.sidePanel.open({ tabId })
    } else if (typeof winId === 'number') {
      await chrome.sidePanel.open({ windowId: winId })
    }
  } catch (err) {
    console.warn('[IHUI AI] open side panel failed:', err)
  }
  hideToolbar()
}

function onSelectionChange() {
  const text = getActiveSelectionText()
  if (!text) {
    scheduleHide()
    return
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  const sel = window.getSelection()
  if (sel) showToolbar(sel)
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => hideToolbar(), 200)
}

function injectStyle(doc: Document) {
  if (doc.getElementById('ihui-content-style')) return
  const style = doc.createElement('style')
  style.id = 'ihui-content-style'
  style.textContent = `
    mark.${HL_CLASS} { background: rgba(250, 204, 21, 0.45); color: inherit; padding: 0 1px; border-radius: 2px; }
    .${TX_CLASS} { animation: ihui-tx-fade 240ms ease-out; }
    @keyframes ihui-tx-fade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
    #${TOOLBAR_ID} button:hover { background: #262626 !important; }
  `
  ;(doc.head || doc.documentElement).appendChild(style)
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    injectStyle(document)
    document.addEventListener('mouseup', () => {
      setTimeout(onSelectionChange, 10)
    })
    document.addEventListener('keyup', () => {
      setTimeout(onSelectionChange, 10)
    })
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest(`#${TOOLBAR_ID}`)) return
      scheduleHide()
    })

    // 接收 background 主动消息
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return false
      const m = msg as { type?: string; payload?: { word?: string; matches?: number } }
      if (m.type === 'highlight.applied' && m.payload?.word) {
        if (m.payload.matches === 0) {
          clearHighlights(document.body)
        } else {
          highlightInElement(document.body, m.payload.word, document)
        }
        sendResponse({ ok: true })
        return true
      }
      return false
    })

    if (typeof window !== 'undefined' && detectLanguage('hello world') === 'en') {
      console.info('[IHUI AI] content script loaded')
    }

    ctx.onInvalidated(() => {
      hideToolbar()
    })
  },
})
