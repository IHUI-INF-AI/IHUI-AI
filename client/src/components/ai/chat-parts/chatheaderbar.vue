<template>
  <!-- 标题栏（可拖拽区域），置于 dialog 内第一项，无需单独定位 -->
  <div ref="headerRef" class="dialog-header"
    @mousedown="handleMouseDown"
    @dblclick="handleDblClick">
    <div class="header-left">
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
import { AIStarIcon } from '@/components/icons'
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
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

<style scoped lang="scss">
// ========== 标题栏内部元素样式 ==========
// 2026-07-03 从 styles/ai-chat/_header.scss 迁移至子组件自己的 scoped 块
// 原因：_header.scss 被 AIChat.vue scoped 块 @use 引入后，编译器给选择器加 [data-v-f3f3558b] 后缀，
// 但子组件内部元素（.header-left/.header-right/.mode-tag 等）不接收父 scope attr → 选择器失配 → 样式永不生效。
// 迁到子组件自己的 scoped 块后，选择器加 [data-v-yyy]（子组件自己的 scope hash），所有内部元素都有该属性 → 命中。
// 根元素 .dialog-header 本身的样式（display/padding/background 等）仍保留在 _header.scss（被 AIChat.vue @use），
// 因为子组件根元素接收父 scope attr，可被父 scoped 命中。

.dialog-header {
  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .header-center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: calc(100% - 220px);
    max-width: 160px; // 缩短标签宽度，与右侧按钮留出明显空隙，避免重叠
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-0);
    pointer-events: none;

    .mode-tag {
      pointer-events: auto;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow-x: hidden; /* 仅水平裁切以配合 ellipsis，避免垂直裁切导致汉字顶部笔画被裁浅 */
      overflow-y: visible;
      box-sizing: border-box;

      :deep(.el-tag__content) {
        min-width: 0;
        flex: 1 1 0;
        overflow-x: hidden;
        overflow-y: visible;
        max-width: 100%;
      }

      span {
        display: block;
        min-width: 0;
        overflow-x: hidden;
        overflow-y: visible;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.2; /* 略放宽，避免「豆」等字顶部一横被 line-height:1 裁切后看起来变浅 */
      }
    }
  }

  .header-left .model-tag,
  .header-left .mode-tag,
  .header-center .model-tag,
  .header-center .mode-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px; // 进一步放大字体
    height: 32px; // 大幅增大高度
    flex-shrink: 0;
    font-weight: 500;
    padding: 0 14px; // 增加左右内边距
    line-height: 1; // 强制 line-height 为 1，完全靠 flex 居中
    vertical-align: middle;
    // 该容器仅作文字/图标展示，无背景、描边、圆角
    background-color: transparent;
    border: none;
    border-radius: 0;

    .mode-tag-icon {
      width: 20px; // 大幅放大图标
      height: 20px;
      margin-right: 6px;
      flex-shrink: 0;
      object-fit: contain;
      display: flex;
      align-items: center;
      justify-content: center;

      &.el-icon {
        font-size: 18px; // 放大 el-icon
        margin-right: 6px; // 确保 el-icon 也有间距
      }

      &.mode-tag-avatar {
        border-radius: var(--global-border-radius);
        object-fit: cover;
      }
    }

    // 穿透覆盖 Element Plus 默认样式，确保内容区也是 flex 居中
    :deep(.el-tag__content) {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      line-height: 1.2;
    }

    span {
      line-height: 1.2; /* 避免汉字顶部笔画被裁切/反锯齿导致看起来变浅 */
      display: inline-block;
    }
  }

  .header-left .mode-tag {
    margin-left: 4px;
  }

  .header-center .mode-tag {
    margin-left: 0;
    min-width: 0;
    flex-shrink: 1; // 允许收缩，与上面公共 flex-shrink: 0 覆盖，避免压住右侧按钮

    span {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    margin-left: 8px;

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: var(--global-border-radius);
      background: var(--el-color-primary);
      animation: typing 1.4s infinite;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }

  // 最小化状态的模型信息
  .minimized-model-info {
    display: flex;
    align-items: center;
    gap: 12px; // 进一步增大间距

    .minimized-model-icon {
      width: 32px; // 大幅放大图标
      height: 32px;
      border-radius: var(--global-border-radius);
      object-fit: contain;
      flex-shrink: 0;
    }

    .minimized-model-icon-fallback {
      width: 32px; // 大幅放大图标
      height: 32px;
      color: var(--el-color-primary);
      flex-shrink: 0;
    }

    .minimized-model-name {
      font-size: 16px; // 进一步放大文字
      font-weight: 500;
      color: var(--el-text-color-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px; // 增加最大宽度
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px; // 2026-07-03 拉大三个图标间距，避免视觉粘连
    flex-shrink: 0;
    position: relative;
    z-index: var(--z-base); // 始终在 header-center 之上，保证搜索等按钮可点
    // 按钮样式已在统一按钮系统中定义
  }
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.7;
  }

  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
</style>
