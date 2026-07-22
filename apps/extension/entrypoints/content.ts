/**
 * Content Script — 沉浸式翻译 + 重点高亮 + 浮动工具栏。
 *
 * 设计:
 * 1. 监听 mouseup / keyup,在用户完成选区时显示浮动工具栏
 * 2. 工具栏(由 ContentToolbar 提供):翻译 / 高亮 / 查词 / 发送到 AI
 *    - hover 动效(fade + scale,subtle 颜色变化)
 *    - 位置记忆(viewport 边缘自动 flip,同选区防抖)
 * 3. 沉浸式翻译:点击翻译后,选区上方/下方插入翻译结果(用 ihui-tx 类)
 * 4. 重点高亮:点击高亮后,在当前页面内所有匹配文本用 <mark class="ihui-hl"> 包裹
 * 5. 右键即时翻译:监听 background 派发的 `vocab.result`,在选区旁弹 popup
 * 6. 通过 background 中转 API(避免 content script 直连受 CORS 限制)
 */
import {
  extractSelectionText,
  isValidSelection,
  highlightInElement,
  clearHighlights,
  detectLanguage,
} from '../src/content/content-utils'
import { sendMessage } from '../lib/message-router'
import { ContentToolbar } from './content/content-toolbar'
import {
  computePositionWithMemory,
  type RectLike,
} from '../src/content/position-memory'
import { executeDomAction } from '../lib/agent-control'
import type { BrowserControlActionType } from '@ihui/types'

const TX_CLASS = 'ihui-tx'
const CTX_POPUP_ID = 'ihui-ctx-popup'
const CTX_POPUP_TTL_MS = 6000

let hideTimer: ReturnType<typeof setTimeout> | null = null
let highlightEnabled = false
const translationCache = new Map<string, string>()
let toolbar: ContentToolbar | null = null
let lastSelectionRect: RectLike | null = null

function getToolbar(doc: Document): ContentToolbar {
  if (!toolbar) {
    toolbar = new ContentToolbar(doc)
    toolbar.setLabels({
      translate: '翻译',
      highlight: '高亮',
      vocab: '查词',
      send: '问 AI',
    })
    toolbar.bindHandlers({
      translate: () => void handleTranslate(),
      highlight: () => void handleHighlight(),
      vocab: () => void handleVocab(),
      send: () => void handleSendToAI(),
    })
  }
  return toolbar
}

function showToolbar(selection: Selection) {
  const doc = selection.anchorNode?.ownerDocument ?? document
  const tb = getToolbar(doc)
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  lastSelectionRect = toRect(rect)
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const placement = tb.show(lastSelectionRect, viewport)
  if (!placement.visible) {
    tb.hide()
  }
}

function toRect(r: DOMRect): RectLike {
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
}

function hideToolbar() {
  toolbar?.hide()
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

  const host = doc.createElement('span')
  host.className = TX_CLASS
  host.setAttribute('data-ihui', 'translation')
  host.style.cssText = 'display:block;all:initial;'

  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .tx {
      display: block;
      margin: 4px 0;
      padding: 6px 10px;
      background: rgba(20, 184, 166, 0.08);
      color: #0f766e;
      border-left: 2px solid #14b8a6;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
    }
  `
  const inner = doc.createElement('span')
  inner.className = 'tx'
  inner.textContent = `🌐 ${translated}`
  shadow.appendChild(style)
  shadow.appendChild(inner)

  range.insertNode(host)
  sel.removeAllRanges()
  hideToolbar()
}

async function handleHighlight() {
  const text = getActiveSelectionText()
  if (!text) return
  highlightEnabled = !highlightEnabled
  try {
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

// ===== 右键即时翻译:在选区旁显示 popup =====

interface CtxVocabResult {
  word: string
  translation: string
  phonetic?: string
  definitions?: string[]
}

function showContextResultPopup(payload: CtxVocabResult, rect: RectLike | null) {
  // 移除旧 popup
  const old = document.getElementById(CTX_POPUP_ID)
  if (old) old.remove()

  const popup = document.createElement('div')
  popup.id = CTX_POPUP_ID
  popup.className = 'ihui-ctx-popup'
  popup.setAttribute('data-ihui', 'context-result')

  const head = document.createElement('div')
  const word = document.createElement('span')
  word.className = 'ihui-ctx-word'
  word.textContent = payload.word
  head.appendChild(word)
  if (payload.phonetic) {
    const ph = document.createElement('span')
    ph.className = 'ihui-ctx-phonetic'
    ph.textContent = `/${payload.phonetic}/`
    head.appendChild(ph)
  }
  popup.appendChild(head)

  const tr = document.createElement('div')
  tr.className = 'ihui-ctx-translation'
  tr.textContent = payload.translation
  popup.appendChild(tr)

  if (payload.definitions && payload.definitions.length > 0) {
    const ul = document.createElement('ul')
    ul.className = 'ihui-ctx-defs'
    for (const d of payload.definitions.slice(0, 5)) {
      const li = document.createElement('li')
      li.textContent = d
      ul.appendChild(li)
    }
    popup.appendChild(ul)
  }

  const actions = document.createElement('div')
  actions.className = 'ihui-ctx-actions'
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'ihui-ctx-btn'
  saveBtn.textContent = '保存到生词本'
  saveBtn.addEventListener('click', async () => {
    try {
      const { addWord } = await import('../src/idb/vocab-db')
      await addWord({ word: payload.word, translation: payload.translation, source: 'context-menu' })
      saveBtn.textContent = '已保存'
    } catch (err) {
      console.warn('[IHUI AI] save word failed:', err)
    }
  })
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'ihui-ctx-btn'
  closeBtn.textContent = '关闭'
  closeBtn.addEventListener('click', () => popup.remove())
  actions.append(saveBtn, closeBtn)
  popup.appendChild(actions)

  document.body.appendChild(popup)

  // 定位:有 rect 用 rect(选区),没有就 viewport 中央
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const w = popup.offsetWidth
  const h = popup.offsetHeight
  const targetRect: RectLike =
    rect ?? {
      top: viewport.height / 2 - h / 2,
      left: viewport.width / 2 - w / 2,
      right: viewport.width / 2 + w / 2,
      bottom: viewport.height / 2 + h / 2,
      width: w,
      height: h,
    }
  const placement = computePositionWithMemory(targetRect, w, h, viewport, { margin: 12, offset: 8 })
  popup.style.top = `${placement.top}px`
  popup.style.left = `${placement.left}px`

  // 自动消失(可被 close 按钮提前关掉)
  setTimeout(() => {
    const current = document.getElementById(CTX_POPUP_ID)
    if (current) current.remove()
  }, CTX_POPUP_TTL_MS)
}

export default defineContentScript({
  matches: ['<all_urls>'],
  // 2026-07-22 P0 Round 5 鲁棒性加固:排除银行/支付/政府等敏感网站
  // 防止 content script 注入到敏感页面拦截银行卡号/密码/验证码等
  exclude_matches: [
    '*://*.icbc.com.cn/*',      // 工商银行
    '*://*.cmbchina.com/*',     // 招商银行
    '*://*.abchina.com/*',      // 农业银行
    '*://*.boc.cn/*',           // 中国银行
    '*://*.bankcomm.com/*',     // 交通银行
    '*://*.ccb.com/*',          // 建设银行
    '*://*.psbc.com/*',         // 邮储银行
    '*://*.alipay.com/*',       // 支付宝
    '*://*.tenpay.com/*',       // 财付通
    '*://pay.weixin.qq.com/*',  // 微信支付
    '*://*.unionpay.com/*',     // 银联
    '*://*.gov.cn/*',           // 政府网站
    '*://*.12306.cn/*',         // 12306
    '*://*.chinatax.gov.cn/*',  // 税务
  ],
  runAt: 'document_idle',
  main(ctx) {
    document.addEventListener('mouseup', () => {
      setTimeout(onSelectionChange, 10)
    })
    document.addEventListener('keyup', () => {
      setTimeout(onSelectionChange, 10)
    })
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest(`#${'ihui-content-toolbar'}`)) return
      if (target.closest(`#${CTX_POPUP_ID}`)) return
      scheduleHide()
    })

    // 接收 background 主动消息
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return false
      const m = msg as {
        type?: string
        payload?: { word?: string; matches?: number; text?: string; rect?: RectLike } & CtxVocabResult
      }
      // Agent DOM action forwarded from background (AI browser control)
      if (m.type === 'agent.action.dom') {
        const req = m.payload as unknown as { action: string; params: Record<string, unknown>; timeout?: number }
        void executeDomAction(
          req.action as BrowserControlActionType,
          req.params,
          req.timeout ?? 30000,
        ).then((result) => sendResponse(result))
        return true
      }
      if (m.type === 'highlight.applied' && m.payload?.word) {
        if (m.payload.matches === 0) {
          clearHighlights(document.body)
        } else {
          highlightInElement(document.body, m.payload.word, document)
        }
        sendResponse({ ok: true })
        return true
      }
      // 右键菜单触发的查询结果 → 弹 popup
      if (m.type === 'vocab.result' && m.payload?.word && m.payload?.translation) {
        showContextResultPopup(
          {
            word: m.payload.word,
            translation: m.payload.translation,
            phonetic: m.payload.phonetic,
            definitions: m.payload.definitions,
          },
          m.payload.rect ?? lastSelectionRect,
        )
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
