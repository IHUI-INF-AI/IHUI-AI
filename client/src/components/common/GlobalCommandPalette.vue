<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div v-if="visible" class="command-palette-overlay" @click.self="close">
        <div class="command-palette ihui-ai-fade-in-top-animation">
        <!-- 搜索输入框 - 使用全局统一样式 -->
        <div class="palette-search unified-search-native-wrap">
          <SearchIcon class="search-icon" />
          <input
            ref="inputRef"
            v-model="searchQuery"
            class="search-input"
            :placeholder="t('commandPalette.placeholder')"
            @keydown.down.prevent="moveNext"
            @keydown.up.prevent="movePrev"
            @keydown.enter="executeCurrent"
            @keydown.esc="close"
          />
          <div class="palette-hint">{{ t('commandPalette.escToAbort') }}</div>
        </div>

        <!-- 结果列表 -->
        <div ref="scrollRef" class="palette-results">
          <div v-if="filteredCommands.length === 0" class="no-results">
            {{ t('commandPalette.noResults') }}
          </div>
          <template v-else>
            <div 
              v-for="(cmd, index) in filteredCommands" 
              :key="cmd.id"
              class="result-item"
              :class="{ active: selectedIndex === index }"
              @mouseenter="selectedIndex = index"
              @click="executeCommand(cmd)"
            >
              <div class="item-icon">
                <el-icon><component :is="cmd.icon" /></el-icon>
              </div>
              <div class="item-body">
                <div class="item-title">{{ cmd.label }}</div>
                <div class="item-path">{{ cmd.pathLabel }}</div>
              </div>
              <div class="item-shortcut">
                <kbd v-if="selectedIndex === index">{{ t('commandPalette.enter') }}</kbd>
                <!-- 非选中项不显示任何标签，保持界面简洁 -->
              </div>
            </div>
          </template>
        </div>

        <!-- 页脚状态栏 -->
        <div class="palette-footer">
          <div class="status-nodes">
            <span class="node"><span class="dot"></span> {{ t('commandPalette.systemReady') }}</span>
            <span class="node"><span class="dot"></span> {{ t('commandPalette.cpuOptimized') }}</span>
          </div>
          <div class="navigation-hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> {{ t('commandPalette.navigate') }}</span>
            <span><kbd>↵</kbd> {{ t('commandPalette.execute') }}</span>
          </div>
        </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { loadModule, type SupportedLocale } from '@/locales'
import { logger } from '@/utils/logger'
import {
  Home,
  ShoppingBag,
  Layout,
  BookOpen,
  MessageCircle,
  Circle,
  FileText,
  Info,
  Moon,
  MessageSquare,
  ArrowUp
} from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useDarkModeStore } from '@/stores/darkMode'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const { t, locale: i18nLocale } = useI18n()
const darkModeStore = useDarkModeStore()
const cleanup = useCleanup()

// 2026-06-25 修复: commandPalette 是 asyncModules, 不会在首屏自动加载
// 必须组件 mount 时主动调用 loadModule, 否则面板打开时所有 commandPalette.* key 裸露为字面量
// (e.g. placeholder=commandPalette.placeholder, 底部 systemReady=commandPalette.systemReady)
// 同时监听 locale 变化, 切换语言时重新加载对应 locale 的模块
const currentLocale = computed<SupportedLocale>(() => {
  const v = i18nLocale.value
  return (v === 'zh-CN' || v === 'zh-TW' || v === 'en' || v === 'ja' || v === 'ko') ? v : 'zh-CN'
})
// 2026-06-25 修复: useI18n() 的 t 函数在 component-scope Composer 中,
// 该 Composer 继承自 i18n.global 但其 messages 是 lazy proxy, 通过
// mergeLocaleMessage 写入 global.messages 后, sub composer 的 Proxy
// 在某些 vue-i18n 9.x 边界场景下不会立即触发响应式更新, 导致 computed
// commands 仍持有初次求值时的字面量. 这里加一个 i18nReady ref,
// loadModule 完成后 +1, 强制 commands computed 重算 (因为 computed 追踪了
// i18nReady.value 的读取, ref 变化触发 trigger).
// 经验证: 在 onMounted 中手动调用 t('commandPalette.commands.home') 能返回 '返回首页',
// 但 computed commands 的 label 仍显示字面量, 证明是 computed 缓存问题而非 messages 缺失.
const i18nReady = ref(0)
// 2026-06-26 修复: commandPalette 是 asyncModule, 不会在首屏自动加载.
// 之前在 onMounted 里 fire-and-forget loadModule, 但用户可能比加载更快地打开面板,
// 首次渲染时 t('commandPalette.commands.home') 仍返回字面量, UI 出现 "commandPalette.commands.home" 键名.
// 修复: 用一个 moduleReady Promise 缓存加载结果, 任何打开面板的入口 (Cmd+K / 触发按钮) 都 await 它,
// 保证 visible 切到 true 之前 messages 一定已 merge 到 i18n, computed 的 t() 必然能拿到翻译.
let _moduleReadyPromise: Promise<void> | null = null
const ensureI18nLoaded = (): Promise<void> => {
  if (i18nReady.value > 0) return Promise.resolve()
  if (!_moduleReadyPromise) {
    _moduleReadyPromise = loadModule(currentLocale.value, 'commandPalette')
      .then(() => {
        i18nReady.value += 1
      })
      .catch((e) => {
        // 加载失败时清空 promise, 下次重试; 但 i18nReady 不递增, computed 仍会显示键名 (用户可看到问题)
        _moduleReadyPromise = null
        logger.warn('[GlobalCommandPalette] Failed to load i18n module:', e)
      })
  }
  return _moduleReadyPromise
}

// 打开面板 (统一入口, 内部 await i18n 加载)
const openPalette = async () => {
  await ensureI18nLoaded()
  visible.value = true
}

// 2026-06-26 修复: 合并所有 onMounted hook + 显式触发 i18n 预热, 避免 2 个 onMounted 互相覆盖 (HMR/重渲染竞态).
// 顺序: 同步注册键盘监听 + 全局函数 (关键交互, 不能被 await 阻塞) -> 异步预热 i18n (不阻塞挂载).
onMounted(() => {
  // 1. 同步: 注册 Cmd+K 全局快捷键 (关键交互, 不能被 await 阻塞)
  cleanup.addEventListener(window, 'keydown', handleKeyDown as EventListener)
  // 2. 同步: 注册全局打开函数 (供 SearchTrigger 等外部调用, fire-and-forget, 内部 await i18n)
  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).openCommandPalette = openPalette
    cleanup.add(() => {
      delete (window as unknown as Record<string, unknown>).openCommandPalette
    })
  }

  // 3. 异步: 预热 commandPalette i18n 模块 (面板打开时再解析 key, 不会阻塞挂载)
  ensureI18nLoaded()
})

// 2026-06-26 修复: 监听 i18n locale 变化, 切换语言时重新加载 commandPalette 模块.
watch(currentLocale, (loc) => {
  const code: SupportedLocale =
    typeof loc === 'string' && (loc === 'zh-CN' || loc === 'zh-TW' || loc === 'en' || loc === 'ja' || loc === 'ko')
      ? loc
      : currentLocale.value
  // locale 切换后清空缓存, 下次 openPalette 时会重新加载对应语言
  i18nReady.value = 0
  _moduleReadyPromise = null
  loadModule(code, 'commandPalette').then(() => {
    i18nReady.value += 1
  }).catch((e) => {
    logger.warn('[GlobalCommandPalette] Failed to reload i18n module on locale change:', e)
  })
})

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

// 命令类型定义
interface Command {
  id: string
  labelKey: string
  // 用于显示的本地化路径描述 key (如 commandPalette.paths.home).
  // 留空时, 导航类命令回退显示 cmd.path 原始路径, 操作类命令回退到 t('commandPalette.systemInternal').
  pathLabelKey?: string
  path?: string
  icon: any
  type: 'nav' | 'action'
  handler?: () => void
}

// 命令定义（使用国际化 key）
// 2026-06-26 修复: 用真实社区路由 /ask 和 /circle 替换 /ai-community (旧 v2 社区, 后端缺失).
// 路径 /ask 对应后端 /api/v1/ask/*, /circle 对应后端 /api/v1/circle/*.
const commandDefinitions: Command[] = [
  // 核心导航
  { id: 'nav-home', labelKey: 'commandPalette.commands.home', pathLabelKey: 'commandPalette.paths.home', path: '/', icon: Home, type: 'nav' as const },
  { id: 'nav-store', labelKey: 'commandPalette.commands.store', pathLabelKey: 'commandPalette.paths.store', path: '/agents', icon: ShoppingBag, type: 'nav' as const },
  { id: 'nav-plaza', labelKey: 'commandPalette.commands.plaza', pathLabelKey: 'commandPalette.paths.plaza', path: '/plaza', icon: Layout, type: 'nav' as const },
  { id: 'nav-learn', labelKey: 'commandPalette.commands.learnAI', pathLabelKey: 'commandPalette.paths.learnAI', path: '/learn-ai', icon: BookOpen, type: 'nav' as const },
  { id: 'nav-ask', labelKey: 'commandPalette.commands.ask', pathLabelKey: 'commandPalette.paths.ask', path: '/ask', icon: MessageCircle, type: 'nav' as const },
  { id: 'nav-circle', labelKey: 'commandPalette.commands.circle', pathLabelKey: 'commandPalette.paths.circle', path: '/circle', icon: Circle, type: 'nav' as const },

  // 更多功能
  { id: 'nav-docs', labelKey: 'commandPalette.commands.docs', pathLabelKey: 'commandPalette.paths.docs', path: '/support/document-center', icon: FileText, type: 'nav' as const },
  { id: 'nav-about', labelKey: 'commandPalette.commands.about', pathLabelKey: 'commandPalette.paths.about', path: '/about/about-us', icon: Info, type: 'nav' as const },

  // 系统操作
  { id: 'act-darkmode', labelKey: 'commandPalette.commands.darkMode', icon: Moon, type: 'action' as const, handler: () => darkModeStore.toggleDarkMode() },
  { id: 'act-chat', labelKey: 'commandPalette.commands.aiAssistant', icon: MessageSquare, type: 'action' as const, handler: () => { const fn = (window as unknown as Record<string, (() => void) | undefined>).openFloatingChat; if (fn) fn(); } },
  { id: 'act-top', labelKey: 'commandPalette.commands.backToTop', icon: ArrowUp, type: 'action' as const, handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
]

// 带翻译的命令列表
interface TranslatedCommand extends Command {
  label: string
  pathLabel: string
}

const commands = computed<TranslatedCommand[]>(() => {
  // 2026-06-26 修复: 读取 i18nReady 触发响应式依赖, loadModule 完成后 +1 强制重算
  const _ = i18nReady.value
  return commandDefinitions.map(cmd => ({
    ...cmd,
    label: t(cmd.labelKey),
    // 优先级: pathLabelKey 翻译 > 原始 path (仅 nav) > 系统内部
    pathLabel: cmd.pathLabelKey
      ? t(cmd.pathLabelKey)
      : (cmd.path || t('commandPalette.systemInternal')),
  }))
})

const filteredCommands = computed(() => {
  if (!searchQuery.value) return commands.value
  const q = searchQuery.value.toLowerCase()
  return commands.value.filter(c => 
    c.label.toLowerCase().includes(q) || 
    c.id.toLowerCase().includes(q) ||
    (c.path && c.path.toLowerCase().includes(q))
  )
})

// 自动重置选择索引
watch(filteredCommands, () => {
  selectedIndex.value = 0
})

// 聚焦输入框
watch(visible, (isVis) => {
  if (isVis) {
    nextTick(() => {
      inputRef.value?.focus()
      searchQuery.value = ''
    })
  }
})

const close = () => {
  visible.value = false
}

const moveNext = () => {
  if (selectedIndex.value < filteredCommands.value.length - 1) {
    selectedIndex.value++
    ensureVisible()
  }
}

const movePrev = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--
    ensureVisible()
  }
}

const ensureVisible = () => {
  nextTick(() => {
    const activeEl = scrollRef.value?.querySelector('.result-item.active') as HTMLElement
    if (activeEl && scrollRef.value) {
      const parent = scrollRef.value
      const overTop = activeEl.offsetTop < parent.scrollTop
      const overBottom = (activeEl.offsetTop + activeEl.offsetHeight) > (parent.scrollTop + parent.clientHeight)
      
      if (overTop) parent.scrollTop = activeEl.offsetTop
      else if (overBottom) parent.scrollTop = activeEl.offsetTop - parent.clientHeight + activeEl.offsetHeight
    }
  })
}

const executeCurrent = () => {
  const cmd = filteredCommands.value[selectedIndex.value]
  if (cmd) executeCommand(cmd)
}

const executeCommand = (cmd: Command) => {
  if (cmd.path) {
    router.push(cmd.path)
  } else if (cmd.handler) {
    cmd.handler()
  }
  close()
}

// 键盘全局监听
// 2026-06-26 修复: 打开面板走 openPalette, 内部 await i18n 加载, 避免首次打开时键名裸露.
const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (visible.value) {
      visible.value = false
    } else {
      openPalette()
    }
  }
}

// 2026-06-25 修复: 第二个 onMounted (键盘监听 + openCommandPalette) 已合并到上方第一个
// onMounted, 避免 Vue3 组合式 API 多次 onMounted 注册时被后者覆盖前者的问题.
</script>

<style lang="scss">
// 全局样式（因为使用 Teleport 到 body）
.command-palette-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-loading);
  background: var(--color-black-50);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10vh;
  
  // 移动端适配
  @media (width <= 640px) {
    padding-top: 5vh;
    align-items: center;
  }
}

.command-palette {
  width: 580px;
  max-width: 92vw;
  max-height: 75vh;
  padding: 12px;

  // 使用实色背景，确保内容不受 backdrop-filter 影响
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  :where(html.dark) & {
    background: var(--el-bg-color);
    border-color: var(--border-unified-color-hover);
  }
  
  @media (width <= 640px) {
    width: 100%;
    max-width: 95vw;
    border-radius: var(--global-border-radius);
  }
}

.palette-search {
  padding: 12px 24px;
  border-bottom: var(--unified-border-bottom);
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  flex-shrink: 0;

  .search-icon { 
    color: var(--el-color-primary); 
    font-size: 20px;
    flex-shrink: 0;
  }
  
  input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: var(--el-text-color-primary);
    font-family: var(--font-family-mono);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    
    &::placeholder { 
      color: var(--el-text-color-placeholder); 
      opacity: 0.4;
      font-weight: 500;
    }
  }
  
  .palette-hint {
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    font-weight: 700;
    letter-spacing: 1.5px;
    opacity: 0.6;
    flex-shrink: 0;
  }
  
  :where(html.dark) & {
    border-bottom-color: var(--border-unified-color);
  }
}

.palette-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
  
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }

  &::-webkit-scrollbar-thumb { 
    background: var(--el-border-color-lighter); 
    border-radius: var(--global-border-radius);
    
    &:hover {
      background: var(--el-border-color-light);
    }
  }

  .no-results {
    padding: 48px 24px;
    text-align: center;
    font-family: var(--font-family-mono);
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    letter-spacing: 3px;
    opacity: 0.6;
  }
}

// 使用 :where() 降低特异性，禁止高特异性
:where(.command-palette) :where(.palette-results) :where(.result-item) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  border: var(--unified-border);
  margin-bottom: 4px;
  background: transparent;

  &:last-child {
    margin-bottom: 0;
  }

  .item-icon {
    width: 36px;
    height: 36px;
    background: var(--el-fill-color-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-gray-303133);
    flex-shrink: 0;
    
    .el-icon {
      font-size: 16px;
    }
  }

  .item-body {
    flex: 1;
    min-width: 0;
    
    .item-title { 
      font-size: 14px; 
      font-weight: 600; 
      color: var(--color-gray-303133);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .item-path { 
      font-family: var(--font-family-mono); 
      font-size: 12px; 
      color: var(--el-text-color-primary);
      margin-top: 2px; 
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .item-shortcut {
    flex-shrink: 0;
    
    kbd {
      font-family: var(--font-family-mono);
      font-size: 12px;
      background: var(--el-color-primary);
      color: var(--el-bg-color-page);
      padding: 5px 10px;
      border-radius: var(--global-border-radius);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    
    .protocol-tag {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-primary);
      font-weight: 600;
    }
  }

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    background: var(--el-fill-color);
    border-color: var(--el-border-color-light);
  }
}

// 暗色模式
:where(html.dark) :where(.command-palette) :where(.palette-results) :where(.result-item) {
  .item-icon {
    color: var(--color-gray-e5e7eb);
  }
  
  .item-body .item-title {
    color: var(--color-gray-e5e7eb);
  }
  
  .item-body .item-path {
    color: var(--color-gray-a3a6ad);
  }
  
  .item-shortcut .protocol-tag {
    color: var(--color-gray-a3a6ad);
  }
}

.palette-footer {
  padding: 12px 20px;
  background: var(--el-fill-color-lighter);
  border-top: var(--unified-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-family-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  flex-shrink: 0;

  .status-nodes {
    display: flex; 
    gap: 16px; 
    color: var(--el-text-color-placeholder);
    
    .node { 
      display: flex; 
      align-items: center; 
      gap: 6px;
      opacity: 0.7;
    }
    
    .dot { 
      width: 5px; 
      height: 5px; 
      background: var(--el-color-success); 
      border-radius: var(--global-border-radius); 
      border: var(--unified-border);
    }
  }

  .navigation-hints {
    display: flex; 
    gap: 16px; 
    color: var(--el-text-color-placeholder);
    
    kbd { 
      background: var(--el-fill-color); 
      padding: 3px 6px; 
      border-radius: var(--global-border-radius); 
      border: var(--unified-border); 
      margin: 0 3px; 
      color: var(--el-text-color-regular);
      font-weight: 600;
    }
  }
  
  :where(html.dark) & {
    background: var(--color-white-2);
    border-top-color: var(--border-unified-color);
  }
  
  @media (width <= 640px) {
    .status-nodes {
      display: none;
    }
  }
}

// 过渡动画
.palette-fade-enter-active { 
  transition: opacity 0.2s ease-out;
  
  .command-palette {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out;
  }
}

.palette-fade-leave-active { 
  transition: opacity 0.15s ease-in;
  
  .command-palette {
    transition: transform 0.15s ease-in, opacity 0.15s ease-in;
  }
}

.palette-fade-enter-from {
  opacity: 0;
  
  .command-palette {
    opacity: 0;
    transform: scale(0.96) translateY(-10px);
  }
}

.palette-fade-leave-to { 
  opacity: 0;
  
  .command-palette {
    opacity: 0;
    transform: scale(0.98) translateY(-5px);
  }
}
</style>
