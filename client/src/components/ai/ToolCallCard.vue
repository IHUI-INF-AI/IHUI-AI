<template>
  <div class="tool-call-card" :class="[`is-${status}`, { 'is-expanded': isExpanded }]">
    <!-- 头部：可点击展开/折叠 -->
    <div class="tool-call-card__header" role="button" tabindex="0"
      :aria-expanded="isExpanded"
      :aria-label="isExpanded ? t('floatingChat.workspaceAgent.collapse') : t('floatingChat.workspaceAgent.expand')"
      @click="toggleExpand"
      @keydown.enter.prevent="toggleExpand"
      @keydown.space.prevent="toggleExpand">
      <!-- 状态图标 -->
      <span class="tool-call-card__status-icon">
        <el-icon v-if="status === 'running'" class="is-loading">
          <Loading />
        </el-icon>
        <el-icon v-else-if="status === 'completed'" class="status-completed">
          <CircleCheckFilled />
        </el-icon>
        <el-icon v-else-if="status === 'failed'" class="status-failed">
          <CircleCloseFilled />
        </el-icon>
        <el-icon v-else-if="status === 'blocked'" class="status-blocked">
          <WarnTriangleFilled />
        </el-icon>
      </span>

      <!-- 工具名称 + 迭代号 -->
      <span class="tool-call-card__title">
        <span class="tool-call-card__name">{{ toolName }}</span>
        <el-tag v-if="iteration != null" size="small" type="info" effect="plain" class="tool-call-card__iteration">
          {{ t('floatingChat.workspaceAgent.iteration') }} #{{ iteration }}
        </el-tag>
      </span>

      <!-- 状态标签 -->
      <el-tag :type="statusTagType" size="small" effect="light" class="tool-call-card__status-tag">
        {{ statusLabel }}
      </el-tag>

      <!-- 展开/折叠指示 -->
      <el-icon class="tool-call-card__chevron" :class="{ 'is-rotated': isExpanded }">
        <ArrowDown />
      </el-icon>
    </div>

    <!-- 展开内容 -->
    <Transition name="tool-call-expand">
      <div v-show="isExpanded" class="tool-call-card__body">
        <!-- 输入参数 -->
        <div v-if="hasInput" class="tool-call-card__section">
          <div class="tool-call-card__section-header">
            <span class="tool-call-card__section-label">{{ t('floatingChat.workspaceAgent.input') }}</span>
            <el-button link size="small" class="tool-call-card__copy-btn"
              @click.stop="handleCopy(formattedInput)">
              <el-icon><DocumentCopy /></el-icon>
              {{ t('floatingChat.workspaceAgent.copyContent') }}
            </el-button>
          </div>
          <pre class="tool-call-card__code-block tool-call-card__input"><code>{{ formattedInput }}</code></pre>
        </div>

        <!-- 输出结果 -->
        <div v-if="toolOutput || status === 'running'" class="tool-call-card__section">
          <div class="tool-call-card__section-header">
            <span class="tool-call-card__section-label">{{ t('floatingChat.workspaceAgent.output') }}</span>
            <el-button v-if="toolOutput" link size="small" class="tool-call-card__copy-btn"
              @click.stop="handleCopy(toolOutput)">
              <el-icon><DocumentCopy /></el-icon>
              {{ t('floatingChat.workspaceAgent.copyContent') }}
            </el-button>
          </div>
          <pre v-if="toolOutput" class="tool-call-card__code-block tool-call-card__output"><code>{{ toolOutput }}</code></pre>
          <div v-else class="tool-call-card__placeholder">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ t('floatingChat.workspaceAgent.statusRunning') }}...</span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="errorMessage" class="tool-call-card__section tool-call-card__error-section">
          <div class="tool-call-card__section-header">
            <span class="tool-call-card__section-label">{{ t('floatingChat.workspaceAgent.error') }}</span>
          </div>
          <pre class="tool-call-card__code-block tool-call-card__error">{{ errorMessage }}</pre>
        </div>

        <!-- 被安全钩子阻止提示 -->
        <el-alert v-if="status === 'blocked'" :title="t('floatingChat.workspaceAgent.blockedByHook')"
          type="warning" :closable="false" show-icon class="tool-call-card__alert" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Loading,
  CircleCheckFilled,
  CircleCloseFilled,
  WarnTriangleFilled,
  ArrowDown,
  DocumentCopy,
} from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'
import { copyToClipboard } from '@/utils/clipboard'

const { t } = useI18n()

interface Props {
  /** 工具名称 */
  toolName: string
  /** 工具输入参数 */
  toolInput: Record<string, unknown>
  /** 工具输出结果 */
  toolOutput?: string
  /** 执行状态 */
  status: 'running' | 'completed' | 'failed' | 'blocked'
  /** 迭代号 */
  iteration?: number
  /** 错误信息（来自 ToolCallInfo.error） */
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  toolOutput: undefined,
  iteration: undefined,
  error: undefined,
})

const isExpanded = ref(false)

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

const hasInput = computed(() => {
  return props.toolInput && Object.keys(props.toolInput).length > 0
})

const formattedInput = computed(() => {
  if (!hasInput.value) return ''
  try {
    return JSON.stringify(props.toolInput, null, 2)
  } catch {
    return String(props.toolInput)
  }
})

const errorMessage = computed(() => props.error || '')

const statusLabel = computed(() => {
  switch (props.status) {
    case 'running':
      return t('floatingChat.workspaceAgent.statusRunning')
    case 'completed':
      return t('floatingChat.workspaceAgent.statusCompleted')
    case 'failed':
      return t('floatingChat.workspaceAgent.statusFailed')
    case 'blocked':
      return t('floatingChat.workspaceAgent.statusBlocked')
    default:
      return ''
  }
})

const statusTagType = computed<'primary' | 'success' | 'danger' | 'warning'>(() => {
  switch (props.status) {
    case 'running':
      return 'primary'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'blocked':
      return 'warning'
    default:
      return 'primary'
  }
})

async function handleCopy(text: string): Promise<void> {
  try {
    const result = await copyToClipboard(text)
    if (result.success) {
      ElMessage.success(t('floatingChat.workspaceAgent.copied'))
    } else {
      ElMessage.error(t('floatingChat.workspaceAgent.copyFailed'))
    }
  } catch {
    ElMessage.error(t('floatingChat.workspaceAgent.copyFailed'))
  }
}
</script>

<style lang="scss" scoped>
.tool-call-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  transition: border-color 0.25s ease, background-color 0.25s ease;
  margin: 8px 0;

  &:hover {
    border-color: var(--el-border-color);
  }

  &.is-running {
    border-left: 3px solid var(--el-color-primary);
  }

  &.is-completed {
    border-left: 3px solid var(--el-color-success);
  }

  &.is-failed {
    border-left: 3px solid var(--el-color-danger);
  }

  &.is-blocked {
    border-left: 3px solid var(--el-color-warning);
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary);
      outline-offset: -2px;
    }
  }

  &__status-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;

    .is-loading {
      animation: tool-call-spin 1s linear infinite;
      color: var(--el-color-primary);
    }

    .status-completed {
      color: var(--el-color-success);
    }

    .status-failed {
      color: var(--el-color-danger);
    }

    .status-blocked {
      color: var(--el-color-warning);
    }
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__iteration {
    flex-shrink: 0;
  }

  &__status-tag {
    flex-shrink: 0;
  }

  &__chevron {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    transition: transform 0.25s ease;
    flex-shrink: 0;

    &.is-rotated {
      transform: rotate(180deg);
    }
  }

  &__body {
    padding: 0 12px 12px;
    border-top: 1px solid var(--el-border-color-lighter);
    margin-top: 0;
  }

  &__section {
    margin-top: 10px;

    &-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    &-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  &__copy-btn {
    font-size: 12px;
    padding: 0;
    height: auto;
  }

  &__code-block {
    margin: 0;
    padding: 10px 12px;
    background-color: var(--el-fill-color-darker);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
    overflow-x: auto;
    max-height: 320px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;

    code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    }
  }

  &__input {
    border-left: 2px solid var(--el-color-primary-light-5);
  }

  &__output {
    border-left: 2px solid var(--el-color-success-light-5);
  }

  &__error {
    border-left: 2px solid var(--el-color-danger-light-5);
    color: var(--el-color-danger);
  }

  &__placeholder {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    color: var(--el-text-color-secondary);
    font-size: 12px;

    .is-loading {
      animation: tool-call-spin 1s linear infinite;
    }
  }

  &__alert {
    margin-top: 10px;
    border-radius: var(--global-border-radius);
  }

  &__error-section {
    .tool-call-card__code-block {
      color: var(--el-color-danger);
    }
  }
}

/* 展开过渡动画 */
.tool-call-expand-enter-active,
.tool-call-expand-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
}

.tool-call-expand-enter-from,
.tool-call-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.tool-call-expand-enter-to,
.tool-call-expand-leave-from {
  opacity: 1;
  max-height: 800px;
}

@keyframes tool-call-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 暗色模式 */
:where(html.dark) {
  .tool-call-card {
    background-color: var(--el-bg-color-overlay);

    &__code-block {
      background-color: var(--color-black-12);
    }

    &__input {
      border-left-color: var(--el-color-primary-light-5);
    }

    &__output {
      border-left-color: var(--el-color-success-light-5);
    }
  }
}
</style>
