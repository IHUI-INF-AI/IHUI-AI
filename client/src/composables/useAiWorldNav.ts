/**
 * useAiWorldNav - AiWorld 自建侧栏的独立折叠状态 (2026-07-06 立)
 *
 * 背景:
 *   全局 sidebar 有折叠/展开 (useSidebar.isCollapsed), 但 AiWorld 自建侧栏
 *   (Teleport 到 body 的 .ai-world-page__nav) 没响应全局折叠 — 全局折叠到 60px
 *   时, AiWorld 侧栏仍停在 --sidebar-width (136px) 位置, 跟全局 sidebar 之间
 *   出现 76px 空隙. 同时, AiWorld 侧栏本身也缺少独立的"收起"能力 (200px 全展开
 *   占空间).
 *
 * 设计:
 *   1. 响应全局 sidebar 折叠: 通过 _sidebar-layout.scss 把 nav.left 从
 *      var(--sidebar-width) 改为 var(--sidebar-current-width) 自动跟随
 *   2. AiWorld 侧栏独立折叠: 顶部加 chevron 按钮, 折叠后 width 200→60,
 *      只留展开按钮. 状态持久化到 localStorage 'ai-world-nav-collapsed'.
 *   3. body class 同步: Vue watch 把 isCollapsed 同步到 <body> 上
 *      'ai-world-nav-collapsed' class, 让全局 CSS 规则 body:has(.app-layout):has(.ai-world-nav-collapsed)
 *      能匹配并切换 nav 宽度. (用 body class 而非 :has() 自匹配是因为
 *      .ai-world-page__nav 跟折叠按钮在不同 DOM 子树, :has 不能跨级查询.)
 *
 * 跟 useSidebar 的关系:
 *   - 不耦合, 各管各的状态 (AiWorld 独立折叠是用户需求, 跟全局无关)
 *   - 视觉响应通过 CSS --sidebar-current-width 自动级联
 */
import { ref, watch, type Ref } from 'vue'

const STORAGE_KEY = 'ai-world-nav-collapsed'

// 模块级单例
const isCollapsed = ref(false)
let initialized = false

function loadPersisted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persist(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage 不可用 (隐私模式等), 静默忽略
  }
}

function syncBodyClass(value: boolean): void {
  if (typeof document === 'undefined') return
  if (value) document.body.classList.add('ai-world-nav-collapsed')
  else document.body.classList.remove('ai-world-nav-collapsed')
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true
  isCollapsed.value = loadPersisted()
  syncBodyClass(isCollapsed.value)
  // 跨标签页同步
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        isCollapsed.value = loadPersisted()
        syncBodyClass(isCollapsed.value)
      }
    })
  }
}

export function useAiWorldNav() {
  ensureInitialized()

  function toggle(): void {
    isCollapsed.value = !isCollapsed.value
    persist(isCollapsed.value)
    syncBodyClass(isCollapsed.value)
  }

  function setCollapsed(value: boolean): void {
    if (isCollapsed.value === value) return
    isCollapsed.value = value
    persist(value)
    syncBodyClass(value)
  }

  return {
    isCollapsed: isCollapsed as Ref<boolean>,
    toggle,
    setCollapsed,
  }
}
