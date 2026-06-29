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
                <div class="item-path">{{ cmd.path || t('commandPalette.systemInternal') }}</div>
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
import { ref, computed, onMounted, nextTick, watch, type Component } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { 
  Home, 
  ShoppingBag, 
  Layout, 
  BookOpen, 
  Users, 
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
const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const cleanup = useCleanup()

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
  path?: string
  icon: Component
  type: 'nav' | 'action'
  handler?: () => void
}

// 命令定义（使用国际化 key）
const commandDefinitions: Command[] = [
  // 核心导航
  { id: 'nav-home', labelKey: 'commandPalette.commands.home', path: '/', icon: Home, type: 'nav' as const },
  { id: 'nav-store', labelKey: 'commandPalette.commands.store', path: '/agents', icon: ShoppingBag, type: 'nav' as const },
  { id: 'nav-plaza', labelKey: 'commandPalette.commands.plaza', path: '/plaza', icon: Layout, type: 'nav' as const },
  { id: 'nav-learn', labelKey: 'commandPalette.commands.learnAI', path: '/learn-ai', icon: BookOpen, type: 'nav' as const },
  { id: 'nav-community', labelKey: 'commandPalette.commands.community', path: '/ai-community', icon: Users, type: 'nav' as const },
  
  // 更多功能
  { id: 'nav-docs', labelKey: 'commandPalette.commands.docs', path: '/support/document-center', icon: FileText, type: 'nav' as const },
  { id: 'nav-about', labelKey: 'commandPalette.commands.about', path: '/about/about-us', icon: Info, type: 'nav' as const },
  
  // 系统操作
  { id: 'act-darkmode', labelKey: 'commandPalette.commands.darkMode', icon: Moon, type: 'action' as const, handler: () => darkModeStore.toggleDarkMode() },
  { id: 'act-chat', labelKey: 'commandPalette.commands.aiAssistant', icon: MessageSquare, type: 'action' as const, handler: () => { const fn = (window as unknown as Record<string, (() => void) | undefined>).openFloatingChat; if (fn) fn(); } },
  { id: 'act-top', labelKey: 'commandPalette.commands.backToTop', icon: ArrowUp, type: 'action' as const, handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
]

// 带翻译的命令列表
interface TranslatedCommand extends Command {
  label: string
}

const commands = computed<TranslatedCommand[]>(() => 
  commandDefinitions.map(cmd => ({
    ...cmd,
    label: t(cmd.labelKey)
  }))
)

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
const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    visible.value = !visible.value
  }
}

onMounted(() => {
  cleanup.addEventListener(window, 'keydown', handleKeyDown as EventListener)
  // 注册全局打开函数
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).openCommandPalette = () => visible.value = true
    cleanup.add(() => { delete (window as unknown as Record<string, unknown>).openCommandPalette })
  }
})
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
  
  html.dark & {
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
  
  html.dark & {
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
      border-radius: var(--global-border-radius-sm, 4px); 
      border: var(--unified-border); 
      margin: 0 3px; 
      color: var(--el-text-color-regular);
      font-weight: 600;
    }
  }
  
  html.dark & {
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
