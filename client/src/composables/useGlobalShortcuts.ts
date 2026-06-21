import { t } from '@/utils/i18n'

/**
 * 全局快捷键系统
 * 
 * 功能：
 * 1. 统一管理所有AI模块的快捷键
 * 2. 支持组合键和序列键
 * 3. 防止与浏览器/系统快捷键冲突
 * 4. 显示快捷键帮助面板
 * 
 * @module composables/useGlobalShortcuts
 * @version 1.0.0
 */

import { ref, onMounted, computed, type Ref } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { logger } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

/** 快捷键修饰符 */
interface KeyModifiers {
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean  // Command键（Mac）/ Windows键
}

/** 快捷键定义 */
interface ShortcutDefinition {
  /** 唯一ID */
  id: string
  /** 按键（如 'c', 'enter', 'f1'） */
  key: string
  /** 修饰符 */
  modifiers?: KeyModifiers
  /** 描述 */
  description: string
  /** 分类 */
  category: ShortcutCategory
  /** 处理函数 */
  handler: (event: KeyboardEvent) => void | Promise<void>
  /** 是否启用 */
  enabled?: boolean
  /** 是否阻止默认行为 */
  preventDefault?: boolean
  /** 是否阻止冒泡 */
  stopPropagation?: boolean
  /** 仅在特定元素获得焦点时生效 */
  scope?: 'global' | 'input' | 'chat' | 'editor' | 'drama'
}

/** 快捷键分类 */
type ShortcutCategory = 
  | 'general'       // 通用
  | 'chat'          // AI对话
  | 'generation'    // AI生成
  | 'drama'         // 短剧创作
  | 'navigation'    // 导航
  | 'editing'       // 编辑

/** 快捷键组 */
interface ShortcutGroup {
  category: ShortcutCategory
  label: string
  shortcuts: ShortcutDefinition[]
}

// ============================================================================
// 状态
// ============================================================================

/** 注册的快捷键 */
const registeredShortcuts: Ref<Map<string, ShortcutDefinition>> = ref(new Map())

/** 是否显示帮助面板 */
const showHelpPanel: Ref<boolean> = ref(false)

/** 当前范围 */
const currentScope: Ref<string> = ref('global')

/** 是否启用快捷键 */
const isEnabled: Ref<boolean> = ref(true)

/** 最近触发的快捷键 */
const lastTriggered: Ref<string | null> = ref(null)

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成快捷键的唯一键名
 */
const generateKeyName = (key: string, modifiers?: KeyModifiers): string => {
  const parts: string[] = []
  
  if (modifiers?.ctrl) parts.push('ctrl')
  if (modifiers?.alt) parts.push('alt')
  if (modifiers?.shift) parts.push('shift')
  if (modifiers?.meta) parts.push('meta')
  
  parts.push(key.toLowerCase())
  
  return parts.join('+')
}

/**
 * 检查事件是否匹配快捷键
 */
const matchesShortcut = (event: KeyboardEvent, shortcut: ShortcutDefinition): boolean => {
  const eventKey = event.key.toLowerCase()
  const shortcutKey = shortcut.key.toLowerCase()
  
  // 检查按键
  if (eventKey !== shortcutKey && event.code.toLowerCase() !== shortcutKey) {
    return false
  }
  
  // 检查修饰符
  const modifiers = shortcut.modifiers || {}
  
  if (!!modifiers.ctrl !== event.ctrlKey) return false
  if (!!modifiers.alt !== event.altKey) return false
  if (!!modifiers.shift !== event.shiftKey) return false
  if (!!modifiers.meta !== event.metaKey) return false
  
  return true
}

/**
 * 检查是否在输入元素中
 */
const isInInputElement = (event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement
  const tagName = target.tagName.toLowerCase()
  
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true
  }
  
  if (target.contentEditable === 'true') {
    return true
  }
  
  return false
}

/**
 * 格式化快捷键显示文本
 */
const formatShortcut = (key: string, modifiers?: KeyModifiers): string => {
  const parts: string[] = []
  
  // 根据操作系统使用不同符号
  const isMac = navigator.platform.toLowerCase().includes('mac')
  
  if (modifiers?.ctrl) {
    parts.push(isMac ? '⌃' : 'Ctrl')
  }
  if (modifiers?.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }
  if (modifiers?.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  if (modifiers?.meta) {
    parts.push(isMac ? '⌘' : 'Win')
  }
  
  // 格式化按键
  const keyDisplay = key.length === 1 ? key.toUpperCase() : key
  parts.push(keyDisplay)
  
  return parts.join(isMac ? '' : '+')
}

// ============================================================================
// 核心方法
// ============================================================================

/**
 * 注册快捷键
 */
const registerShortcut = (shortcut: ShortcutDefinition): () => void => {
  const keyName = generateKeyName(shortcut.key, shortcut.modifiers)
  
  // 检查是否已存在
  if (registeredShortcuts.value.has(keyName)) {
    logger.warn(`Shortcut already exists, will be overwritten: ${keyName}`)
  }
  
  registeredShortcuts.value.set(keyName, {
    ...shortcut,
    enabled: shortcut.enabled !== false,
  })
  
  logger.debug(`Register shortcut: ${keyName} - ${shortcut.description}`)
  
  // 返回取消注册函数
  return () => unregisterShortcut(shortcut.id)
}

/**
 * 批量注册快捷键
 */
const registerShortcuts = (shortcuts: ShortcutDefinition[]): () => void => {
  const unregisterFns = shortcuts.map(s => registerShortcut(s))
  
  return () => {
    unregisterFns.forEach(fn => fn())
  }
}

/**
 * 取消注册快捷键
 */
const unregisterShortcut = (id: string): void => {
  // 找到并删除
  for (const [keyName, shortcut] of registeredShortcuts.value.entries()) {
    if (shortcut.id === id) {
      registeredShortcuts.value.delete(keyName)
      logger.debug(`Unregister shortcut: ${keyName}`)
      break
    }
  }
}

/**
 * 启用/禁用特定快捷键
 */
const setShortcutEnabled = (id: string, enabled: boolean): void => {
  for (const shortcut of registeredShortcuts.value.values()) {
    if (shortcut.id === id) {
      shortcut.enabled = enabled
      break
    }
  }
}

/**
 * 设置当前范围
 */
const setScope = (scope: string): void => {
  currentScope.value = scope
}

/**
 * 处理键盘事件
 */
const handleKeyDown = (event: KeyboardEvent): void => {
  if (!isEnabled.value) return
  
  // 遍历所有注册的快捷键
  for (const shortcut of registeredShortcuts.value.values()) {
    if (!shortcut.enabled) continue
    
    // 检查范围
    if (shortcut.scope === 'input' && !isInInputElement(event)) continue
    if (shortcut.scope && shortcut.scope !== 'input' && shortcut.scope !== currentScope.value) continue
    // 默认在输入元素中不触发（除非明确指定scope为'input'）
    if (!shortcut.scope && isInInputElement(event)) continue
    
    // 检查是否匹配
    if (matchesShortcut(event, shortcut)) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault()
      }
      if (shortcut.stopPropagation) {
        event.stopPropagation()
      }
      
      // 执行处理函数
      try {
        lastTriggered.value = shortcut.id
        void shortcut.handler(event)
      } catch (error) {
        logger.error(`Shortcut handling failed (${shortcut.id}):`, error)
      }
      
      break
    }
  }
}

/**
 * 切换帮助面板
 */
const toggleHelpPanel = (): void => {
  showHelpPanel.value = !showHelpPanel.value
}

/**
 * 获取分组后的快捷键
 */
const getGroupedShortcuts = computed((): ShortcutGroup[] => {
  const groups: Map<ShortcutCategory, ShortcutDefinition[]> = new Map()
  
  const categoryLabels: Record<ShortcutCategory, string> = {
    general: '通用',
    chat: 'AI对话',
    generation: 'AI生成',
    drama: '短剧创作',
    navigation: '导航',
    editing: '编辑',
  }
  
  // 分组
  for (const shortcut of registeredShortcuts.value.values()) {
    const category = shortcut.category
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(shortcut)
  }
  
  // 转换为数组
  const result: ShortcutGroup[] = []
  const categoryOrder: ShortcutCategory[] = ['general', 'chat', 'generation', 'drama', 'navigation', 'editing']
  
  for (const category of categoryOrder) {
    const shortcuts = groups.get(category)
    if (shortcuts && shortcuts.length > 0) {
      result.push({
        category,
        label: categoryLabels[category],
        shortcuts,
      })
    }
  }
  
  return result
})

// ============================================================================
// 预定义快捷键
// ============================================================================

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // 通用
  {
    id: 'show-help',
    key: '/',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.显示快捷键帮助'),
    category: 'general',
    handler: toggleHelpPanel,
  },
  {
    id: 'search',
    key: 'f',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.搜索1'),
    category: 'general',
    handler: () => {
      // 触发搜索事件
      window.dispatchEvent(new CustomEvent('ai-platform:search'))
    },
  },
  
  // AI对话
  {
    id: 'open-chat',
    key: 'c',
    modifiers: { ctrl: true, shift: true },
    description: t('text.use_global_shortcuts.打开AI对话框2'),
    category: 'chat',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:open-chat'))
    },
  },
  {
    id: 'new-chat',
    key: 'n',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.新建对话3'),
    category: 'chat',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:new-chat'))
    },
  },
  {
    id: 'send-message',
    key: 'enter',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.发送消息4'),
    category: 'chat',
    scope: 'chat',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:send-message'))
    },
  },
  {
    id: 'regenerate',
    key: 'r',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.重新生成5'),
    category: 'chat',
    scope: 'chat',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:regenerate'))
    },
  },
  
  // AI生成
  {
    id: 'generate',
    key: 'g',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.开始生成6'),
    category: 'generation',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:generate'))
    },
  },
  {
    id: 'pause-queue',
    key: 'p',
    modifiers: { ctrl: true, shift: true },
    description: t('text.use_global_shortcuts.暂停恢复队列7'),
    category: 'generation',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:toggle-queue'))
    },
  },
  
  // 短剧创作
  {
    id: 'add-fragment',
    key: 'n',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.新增片段8'),
    category: 'drama',
    scope: 'drama',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:add-fragment'))
    },
  },
  {
    id: 'generate-prompt',
    key: 'g',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.生成提示词9'),
    category: 'drama',
    scope: 'drama',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:generate-prompt'))
    },
  },
  {
    id: 'generate-video',
    key: 'g',
    modifiers: { ctrl: true, shift: true },
    description: t('text.use_global_shortcuts.生成视频10'),
    category: 'drama',
    scope: 'drama',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:generate-video'))
    },
  },
  {
    id: 'save-drama',
    key: 's',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.保存剧本11'),
    category: 'drama',
    scope: 'drama',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:save-drama'))
    },
  },
  
  // 编辑
  {
    id: 'undo',
    key: 'z',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.撤销12'),
    category: 'editing',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:undo'))
    },
  },
  {
    id: 'redo',
    key: 'y',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.重做13'),
    category: 'editing',
    handler: () => {
      window.dispatchEvent(new CustomEvent('ai-platform:redo'))
    },
  },
  {
    id: 'copy',
    key: 'c',
    modifiers: { ctrl: true },
    description: t('text.use_global_shortcuts.复制14'),
    category: 'editing',
    preventDefault: false, // 允许默认行为
    handler: () => {
      // 可以在这里添加额外逻辑
    },
  },
  
  // 导航
  {
    id: 'close-dialog',
    key: 'escape',
    description: t('text.use_global_shortcuts.关闭对话框取消15'),
    category: 'navigation',
    handler: () => {
      showHelpPanel.value = false
      window.dispatchEvent(new CustomEvent('ai-platform:close-dialog'))
    },
  },
]

// ============================================================================
// Vue Composable
// ============================================================================

/**
 * 使用全局快捷键
 */
export function useGlobalShortcuts() {
  const cleanup = useCleanup()

  // 初始化
  onMounted(() => {
    // 注册默认快捷键
    DEFAULT_SHORTCUTS.forEach(shortcut => registerShortcut(shortcut))

    // 添加全局监听
    cleanup.addEventListener(window, 'keydown', handleKeyDown)

    logger.info('Global shortcut system started')
  })

  return {
    // 状态
    registeredShortcuts,
    showHelpPanel,
    currentScope,
    isEnabled,
    lastTriggered,
    
    // 计算属性
    getGroupedShortcuts,
    
    // 方法
    registerShortcut,
    registerShortcuts,
    unregisterShortcut,
    setShortcutEnabled,
    setScope,
    toggleHelpPanel,
    
    // 工具函数
    formatShortcut,
    generateKeyName,
  }
}

// 默认导出
export default useGlobalShortcuts
