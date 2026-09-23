// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import type { ContentScriptContext } from 'wxt/utils/content-script-context'
import { RADIUS_CSS_PX } from '@ihui/design-tokens'

import {
  extractSelectionText,
  isValidSelection,
  highlightInElement,
  clearHighlights,
  detectLanguage,
} from '../src/content/content-utils'
import { sendMessage } from '../lib/message-router'
import { ContentToolbar } from './content/content-toolbar'
import { computePositionWithMemory, type RectLike } from '../src/content/position-memory'
import { executeDomAction } from '../lib/agent-control'
import type { BrowserControlActionType } from '@ihui/types'
// 2026-09-12 W6:内容脚本无 React 上下文,复用 background.ts 的翻译表 + locale 读取模式
import { translate, mergeMessages, isLocale, type Locale, type Messages } from '@ihui/i18n'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import extZhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import extEn from '@ihui/i18n/messages/extension/en.json'
import extJa from '@ihui/i18n/messages/extension/ja.json'
import extKo from '@ihui/i18n/messages/extension/ko.json'
import extZhTW from '@ihui/i18n/messages/extension/zh-TW.json'

const TX_CLASS = 'ihui-tx'
const CTX_POPUP_ID = 'ihui-ctx-popup'
const CTX_POPUP_TTL_MS = 6000

// ---- i18n(内容脚本) ----
const LOCALE_STORAGE_KEY = 'ihui_locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'
const contentMessages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN, extZhCN),
  en: mergeMessages(sharedEn, extEn),
  ja: mergeMessages(sharedJa, extJa),
  ko: mergeMessages(sharedKo, extKo),
  'zh-TW': mergeMessages(sharedZhTW, extZhTW),
}
let activeLocale: Locale = DEFAULT_LOCALE

/** 异步预加载用户语言(与 background.ts 读同一键),失败时保持默认 zh-CN。 */
async function loadActiveLocale(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(LOCALE_STORAGE_KEY)
      const value: unknown = result[LOCALE_STORAGE_KEY]
      if (typeof value === 'string' && isLocale(value)) activeLocale = value
    }
  } catch {
    // ignore and fall through
  }
}

/** 同步翻译:内容脚本无 React,直接按模块级 locale 查表。 */
function t(key: string): string {
  return translate(contentMessages[activeLocale], key, {
    fallback: contentMessages[DEFAULT_LOCALE],
  })
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
let highlightEnabled = false
const translationCache = new Map<string, string>()
let toolbar: ContentToolbar | null = null
let lastSelectionRect: RectLike | null = null

function getToolbar(doc: Document): ContentToolbar {
  if (!toolbar) {
    toolbar = new ContentToolbar(doc)
    toolbar.setLabels({
      translate: t('content.translate'),
      highlight: t('content.highlight'),
      vocab: t('content.vocab'),
      send: t('content.sendAi'),
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
  return {
    top: r.top,
    left: r.left,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  }
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
      /* design-tokens 无 teal,shadow DOM 隔离环境内借名 --color-info,值保留品牌强调色 */
      --color-info: #14b8a6;
      --color-info-foreground: #0f766e;
      --color-info-muted: rgba(20, 184, 166, 0.08);
      display: block;
      margin: 4px 0;
      padding: 6px 10px;
      background: var(--color-info-muted);
      color: var(--color-info-foreground);
      border-left: 2px solid var(--color-info);
      border-radius: ${RADIUS_CSS_PX.sm};
      font-size: 12px;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
    }
  `
  const inner = doc.createElement('span')
  inner.className = 'tx'
  // 向量化地球图标(lucide Globe 的 SVG path),替代 emoji 🌐
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const globeSvg = doc.createElementNS(SVG_NS, 'svg')
  globeSvg.setAttribute('width', '12')
  globeSvg.setAttribute('height', '12')
  globeSvg.setAttribute('viewBox', '0 0 24 24')
  globeSvg.setAttribute('fill', 'none')
  globeSvg.setAttribute('stroke', 'currentColor')
  globeSvg.setAttribute('stroke-width', '2')
  globeSvg.setAttribute('stroke-linecap', 'round')
  globeSvg.setAttribute('stroke-linejoin', 'round')
  globeSvg.setAttribute('style', 'margin-right:4px;vertical-align:-2px')
  globeSvg.setAttribute('aria-hidden', 'true')
  const gCircle = doc.createElementNS(SVG_NS, 'circle')
  gCircle.setAttribute('cx', '12')
  gCircle.setAttribute('cy', '12')
  gCircle.setAttribute('r', '10')
  const gPath1 = doc.createElementNS(SVG_NS, 'path')
  gPath1.setAttribute('d', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20')
  const gPath2 = doc.createElementNS(SVG_NS, 'path')
  gPath2.setAttribute('d', 'M2 12h20')
  globeSvg.append(gCircle, gPath1, gPath2)
  inner.appendChild(globeSvg)
  inner.appendChild(doc.createTextNode(translated))
  shadow.appendChild(style)
  shadow.appendChild(inner)

  // 先删除选中文本,再插入译文(否则译文插在原选区文本之后,原文残留)
  range.deleteContents()
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
  saveBtn.textContent = t('content.saveWord')
  saveBtn.addEventListener('click', async () => {
    try {
      const { addWord } = await import('../src/idb/vocab-db')
      await addWord({
        word: payload.word,
        translation: payload.translation,
        source: 'context-menu',
      })
      saveBtn.textContent = t('content.saved')
    } catch (err) {
      console.warn('[IHUI AI] save word failed:', err)
    }
  })
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'ihui-ctx-btn'
  closeBtn.textContent = t('content.close')
  closeBtn.addEventListener('click', () => popup.remove())
  actions.append(saveBtn, closeBtn)
  popup.appendChild(actions)

  document.body.appendChild(popup)

  // 定位:有 rect 用 rect(选区),没有就 viewport 中央
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const w = popup.offsetWidth
  const h = popup.offsetHeight
  const targetRect: RectLike = rect ?? {
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
  excludeMatches: [
    '*://*.icbc.com.cn/*', // ICBC
    '*://*.cmbchina.com/*', // China Merchants Bank
    '*://*.abchina.com/*', // Agricultural Bank of China
    '*://*.boc.cn/*', // Bank of China
    '*://*.bankcomm.com/*', // Bank of Communications
    '*://*.ccb.com/*', // China Construction Bank
    '*://*.psbc.com/*', // Postal Savings Bank of China
    '*://*.alipay.com/*', // Alipay
    '*://*.tenpay.com/*', // Tenpay
    '*://pay.weixin.qq.com/*', // WeChat Pay
    '*://*.unionpay.com/*', // UnionPay
    '*://*.gov.cn/*', // government sites
    '*://*.12306.cn/*', // railway ticketing
    '*://*.chinatax.gov.cn/*', // taxation
  ],
  runAt: 'document_idle',
  main(ctx: ContentScriptContext) {
    // W6:预加载语言(异步),使工具栏/弹窗文案跟随侧边栏语言设置
    void loadActiveLocale()
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
        payload?: {
          word?: string
          matches?: number
          text?: string
          rect?: RectLike
        } & CtxVocabResult
      }
      // Agent DOM action forwarded from background (AI browser control)
      if (m.type === 'agent.action.dom') {
        const req = m.payload as unknown as {
          action: string
          params: Record<string, unknown>
          timeout?: number
        }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
