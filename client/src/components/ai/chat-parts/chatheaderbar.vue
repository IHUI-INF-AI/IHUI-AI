<template>
  <!-- 标题栏（可拖拽区域），置于 dialog 内第一项，无需单独定位 -->
  <div ref="headerRef" class="dialog-header"
    @mousedown="handleMouseDown"
    @dblclick="handleDblClick">
    <div class="header-left">
      <!-- 面板标题前缀（仅 embedded 模式由外层 App 传入时显示，与原 ai-side-panel-header 合并） -->
      <div v-if="panelTitle" class="panel-title-prefix" :title="panelTitle">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="panel-title-icon" aria-hidden="true">
          <path d="M12 8V4H8"></path>
          <rect width="16" height="12" x="4" y="8" rx="2"></rect>
          <path d="M2 14h2"></path>
          <path d="M20 14h2"></path>
          <path d="M15 13v2"></path>
          <path d="M9 13v2"></path>
        </svg>
        <span class="panel-title-text">{{ panelTitle }}</span>
      </div>
      <!-- 展开会话列表按钮（仅非最小化时显示） -->
      <el-button v-if="!isMinimized" link size="small" class="header-btn session-list-btn"
        :title="t('floatingChat.history')" @click="emit('toggle-session-list')" @mousedown.stop>
        <SessionListIcon :size="16" />
      </el-button>
      <!-- 最小化状态：只显示模型图标和名称 -->
      <div v-if="isMinimized" class="minimized-model-info">
        <img v-if="selectedModel?.icon" :src="selectedModel.icon" alt="Model Icon"
          class="minimized-model-icon" loading="lazy" />
        <AIStarIcon v-else class="minimized-model-icon-fallback" :size="14" />
        <span class="minimized-model-name">{{ selectedModel ? getModelDisplayName(selectedModel) :
          t('floatingChat.selectModel') }}</span>
      </div>
      <!-- 正常状态：显示正在输入状态 -->
      <span v-else-if="isTyping" class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </span>
    </div>

    <!-- 标题栏中心：显示当前模型/模式标签 -->
    <div v-if="!isMinimized" class="header-center">
      <el-tag size="small" class="mode-tag"
        :type="currentAIMode === 'model' && selectedModel ? getModelTagType(selectedModel) : getModeTagType(currentAIMode)">
        <!-- 模型模式且有选中的模型 -->
        <template v-if="currentAIMode === 'model' && selectedModel">
          <img v-if="selectedModel.icon" :src="selectedModel.icon" :alt="getModelDisplayName(selectedModel)"
            class="mode-tag-icon" loading="lazy" />
          <AIStarIcon v-else class="mode-tag-icon" :size="14" />
          <span>{{ getModelDisplayName(selectedModel) }}</span>
        </template>
        <!-- 模型模式但没有选中的模型（加载中或失败） -->
        <template v-else-if="currentAIMode === 'model' && !selectedModel">
          <AIStarIcon class="mode-tag-icon" :size="14" />
          <span>{{ t('floatingChat.selectModel') }}</span>
        </template>
        <!-- Agent 模式：有选中智能体时显示其头像，否则显示图标 -->
        <template v-else-if="currentAIMode === 'agent'">
          <img v-if="selectedAgent?.avatar" :src="selectedAgent.avatar" alt="" class="mode-tag-icon mode-tag-avatar" loading="lazy" />
          <el-icon v-else class="mode-tag-icon">
            <Bot />
          </el-icon>
          <span>{{ selectedAgent ? selectedAgent.name : getModeLabel(currentAIMode) }}</span>
        </template>
        <!-- Agentic 模式 -->
        <template v-else-if="currentAIMode === 'agentic'">
          <el-icon class="mode-tag-icon">
            <Network />
          </el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>
        <!-- MCP 模式 -->
        <template v-else-if="currentAIMode === 'mcp'">
          <el-icon class="mode-tag-icon">
            <Wrench />
          </el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>
        <!-- 智能模式（原 Hybrid，自动决策工具/智能体/模型） -->
        <template v-else-if="currentAIMode === 'hybrid' || currentAIMode === 'auto'">
          <el-icon class="mode-tag-icon">
            <Zap />
          </el-icon>
          <span>{{ getModeLabel(currentAIMode) }}</span>
        </template>
        <!-- 已移除：AI生成模式 -->
      </el-tag>
    </div>

    <div class="header-right">
      <!-- 客服主题：连接状态指示 -->
      <div v-if="isCustomServiceTheme && !isMinimized" class="cs-status-wrap">
        <span class="cs-status-indicator" :class="csConnectionStatus">
          <span class="cs-status-ring"></span>
          <span class="cs-status-dot"></span>
        </span>
        <span class="cs-status-text">{{ csConnectionStatusText }}</span>
      </div>
      <!-- 搜索按钮（最小化时隐藏） -->
      <el-button v-if="enableSearch && !isMinimized" link size="small" class="header-btn search-btn"
        @click="emit('toggle-search')" @mousedown.stop :title="t('floatingChat.search')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round" class="header-svg-icon">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="22" y1="22" x2="16.65" y2="16.65"></line>
        </svg>
      </el-button>
      <!-- 更多操作（最小化时隐藏） -->
      <el-dropdown v-if="!isMinimized" trigger="click" @command="handleMenuCommand" class="header-menu"
        popper-class="ai-chat-popper">
        <el-button link size="small" class="header-btn" @mousedown.stop :title="t('common.moreActions')">
          <el-icon>
            <MoreHorizontal />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="export">
              <el-icon>
                <Download />
              </el-icon>
              <span>{{ t('floatingChat.exportChat') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="export-markdown">
              <el-icon>
                <Download />
              </el-icon>
              <span>{{ t('floatingChat.exportMarkdown') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="export-json">
              <el-icon>
                <Download />
              </el-icon>
              <span>{{ t('floatingChat.exportJSON') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="history">
              <el-icon>
                <FileText />
              </el-icon>
              <span>{{ t('floatingChat.history') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="stats">
              <el-icon>
                <BarChart3 />
              </el-icon>
              <span>{{ t('floatingChat.stats') }}</span>
            </el-dropdown-item>
            <el-dropdown-item v-if="effectiveShowTickets" command="tickets">
              <el-icon>
                <Ticket />
              </el-icon>
              <span>MY TICKETS</span>
            </el-dropdown-item>
            <el-dropdown-item command="customer-service">
              <el-icon>
                <Headset />
              </el-icon>
              <span>{{ t('navigation.customerService') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="clear" divided>
              <el-icon>
                <Trash2 />
              </el-icon>
              <span>{{ t('floatingChat.clearChat') }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon>
                <Settings />
              </el-icon>
              <span>{{ t('floatingChat.settings') }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <!-- 最小化/最大化按钮 -->
      <el-button v-if="showMinimize" link size="small" class="header-btn minimize-btn" @click="emit('toggle-minimize')"
        @mousedown.stop :title="isMinimized ? t('floatingChat.maximize') : t('floatingChat.minimize')">
        <!-- 最小化状态：使用展开图标（对角向外） -->
        <svg v-if="isMinimized" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round" class="header-svg-icon">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <!-- 正常状态：使用收缩图标（对角向内） -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round" class="header-svg-icon">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </el-button>
      <!-- 关闭按钮 -->
      <el-button v-if="showClose" link size="small" class="header-btn close-btn" @click="emit('close-dialog')"
        @mousedown.stop :title="t('common.close')">
        <!-- 使用细线条 × 图标 -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round" class="header-svg-icon">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MoreHorizontal,
  Download,
  FileText,
  BarChart3,
  Bot,
  Network,
  Wrench,
  Zap,
  Trash2,
  Settings,
  Ticket,
  Headset,
} from '@/lib/lucide-fallback'
import { AIStarIcon, SessionListIcon } from '@/components/icons'
import type { Model } from '@/types/api'
import type { Agent } from '@/api/agents'

/** AI 模式类型 */
type AIMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'auto' | 'generation'

interface Props {
  /** 是否最小化 */
  isMinimized: boolean
  /** 是否正在输入 */
  isTyping: boolean
  /** 是否为客服主题 */
  isCustomServiceTheme: boolean
  /** 客服连接状态 */
  csConnectionStatus: string
  /** 客服连接状态文本 */
  csConnectionStatusText: string
  /** 是否启用搜索 */
  enableSearch: boolean
  /** 是否显示最小化按钮 */
  showMinimize: boolean
  /** 是否显示关闭按钮 */
  showClose: boolean
  /** 是否可拖拽 */
  draggable: boolean
  /** 显示模式 */
  mode: 'floating' | 'embedded'
  /** 当前 AI 模式 */
  currentAIMode: AIMode
  /** 选中的模型 */
  selectedModel: Model | null
  /** 选中的智能体 */
  selectedAgent: Agent | null
  /** 是否显示工单入口 */
  effectiveShowTickets: boolean
  /**
   * 面板标题前缀（仅 embedded 模式由外层 App 传入）。
   * 非空时在 header-left 最左侧渲染图标+文本，
   * 用于替代原 ai-side-panel-header，避免双标题栏堆叠。
   * floating 模式不传，保持原 dialog-header 行为。
   */
  panelTitle?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle-session-list'): void
  (e: 'toggle-search'): void
  (e: 'menu-command', command: string): void
  (e: 'toggle-minimize'): void
  (e: 'close-dialog'): void
  (e: 'start-drag', event: MouseEvent): void
  (e: 'dblclick'): void
}>()

const { t } = useI18n()

/** 标题栏根元素引用，暴露给父组件用于拖拽与 ResizeObserver */
const headerRef = ref<HTMLElement | null>(null)

/** 鼠标按下：仅 floating 模式且可拖拽时触发 start-drag */
const handleMouseDown = (event: MouseEvent) => {
  if (props.draggable && props.mode === 'floating') {
    emit('start-drag', event)
  }
}

/** 双击：仅在显示最小化按钮时触发 toggle-minimize */
const handleDblClick = () => {
  if (props.showMinimize) {
    emit('toggle-minimize')
  }
}

/** 菜单命令转发 */
const handleMenuCommand = (command: string) => {
  emit('menu-command', command)
}

/** 获取模型标签类型（统一返回 primary） */
const getModelTagType = (_model: Model): string => {
  return 'primary'
}

/** 获取模型显示名称：优先 modelName > name > modelCode > unknown */
const getModelDisplayName = (model: Model): string => {
  return model.modelName || model.name || model.modelCode || t('floatingChat.unknown')
}

/** 获取模式标签类型（用于 el-tag 的 type 属性） */
const getModeTagType = (mode: AIMode): string => {
  const types: Record<string, string> = {
    model: 'primary',
    agent: 'success',
    agentic: 'warning',
    mcp: 'info',
    hybrid: 'danger',
    auto: 'danger',
    generation: 'warning',
  }
  return types[mode] || 'primary'
}

/** 获取模式标签文本（国际化） */
const getModeLabel = (mode: AIMode): string => {
  const labels: Record<string, string> = {
    model: t('floatingChat.modeModel'),
    agent: t('floatingChat.modeAgent'),
    agentic: t('floatingChat.modeAgentic'),
    mcp: t('floatingChat.modeMCP'),
    hybrid: t('floatingChat.modeHybrid'),
    auto: t('floatingChat.modeAuto'),
    generation: t('floatingChat.modeGeneration'),
  }
  return labels[mode] || mode
}

/** 暴露根元素引用给父组件，保持 headerRef 的原有行为（拖拽、ResizeObserver、style 操作） */
defineExpose({
  headerRef,
})
</script>
