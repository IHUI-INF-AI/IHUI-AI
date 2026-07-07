<!--
  PermissionConfirmDialog — 工具执行确认弹窗

  当 Agent WebSocket 在 default 权限模式下需要用户确认某个工具调用时,
  后端推送 agent.tool.confirm 事件, 前端弹出此对话框让用户选择:
  - 允许 (confirm): 仅放行本次工具调用
  - 拒绝 (deny): 阻止本次工具调用
  - 本次会话全部允许 (allow-all): 切换到 acceptEdits 权限模式, 后续不再弹窗

  用法:
    <PermissionConfirmDialog
      v-model:visible="showPermissionDialog"
      :tool-call="pendingConfirmation"
      @confirm="confirmToolCall"
      @deny="denyToolCall"
      @allow-all="allowAllInSession"
    />
-->

<template>
  <el-dialog
    :model-value="visible"
    :title="t('floatingChat.workspaceAgent.permission.title')"
    width="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    append-to-body
    align-center
    class="permission-confirm-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div v-if="toolCall" class="pcd-body">
      <!-- 工具名称 + 图标 -->
      <div class="pcd-tool-header">
        <span class="pcd-tool-icon" :class="toolIconClass">
          <el-icon :size="20">
            <component :is="toolIcon" />
          </el-icon>
        </span>
        <div class="pcd-tool-meta">
          <span class="pcd-tool-label">{{ t('floatingChat.workspaceAgent.permission.tool') }}</span>
          <span class="pcd-tool-name">{{ toolCall.name }}</span>
        </div>
        <el-tag
          v-if="toolCall.iteration != null"
          size="small"
          type="info"
          effect="plain"
          class="pcd-iteration-tag"
        >
          {{ t('floatingChat.workspaceAgent.permission.iteration') }} #{{ toolCall.iteration }}
        </el-tag>
      </div>

      <!-- 工具输入参数 (JSON) -->
      <div v-if="hasInput" class="pcd-section">
        <span class="pcd-section-label">{{ t('floatingChat.workspaceAgent.permission.input') }}</span>
        <pre class="pcd-code-block"><code>{{ formattedInput }}</code></pre>
      </div>

      <!-- 确认原因 -->
      <div v-if="toolCall.reason" class="pcd-section">
        <span class="pcd-section-label">{{ t('floatingChat.workspaceAgent.permission.reason') }}</span>
        <p class="pcd-reason">{{ toolCall.reason }}</p>
      </div>

      <!-- 本次会话全部允许 -->
      <el-checkbox v-model="allowAllChecked" class="pcd-allow-all">
        {{ t('floatingChat.workspaceAgent.permission.allowAll') }}
      </el-checkbox>
    </div>

    <template #footer>
      <div class="pcd-footer">
        <el-button type="danger" plain class="pcd-btn" @click="handleDeny">
          {{ t('floatingChat.workspaceAgent.permission.deny') }}
        </el-button>
        <el-button type="success" class="pcd-btn" @click="handleAllow">
          {{ t('floatingChat.workspaceAgent.permission.allow') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Edit, Monitor, WarningFilled, Document } from '@/lib/lucide-fallback'

/** 待确认的工具调用 */
interface PendingToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  reason?: string
  iteration?: number
}

const props = defineProps<{
  visible: boolean
  toolCall: PendingToolCall | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', id: string): void
  (e: 'deny', id: string): void
  (e: 'allow-all'): void
}>()

const { t } = useI18n()

/** 「本次会话全部允许」复选框 */
const allowAllChecked = ref(false)

/** 是否有可展示的输入参数 */
const hasInput = computed(() => {
  return !!props.toolCall?.input && Object.keys(props.toolCall.input).length > 0
})

/** 格式化后的 JSON 输入 */
const formattedInput = computed(() => {
  if (!props.toolCall?.input || !hasInput.value) return ''
  try {
    return JSON.stringify(props.toolCall.input, null, 2)
  } catch {
    return String(props.toolCall.input)
  }
})

/**
 * 根据工具名称选择图标:
 * - write/edit/file → Edit
 * - run/command/exec/shell → Monitor (终端/屏幕)
 * - delete/remove → WarningFilled
 * - 其他 → Document
 */
const toolIcon = computed<Component>(() => {
  const name = (props.toolCall?.name || '').toLowerCase()
  if (name.includes('write') || name.includes('edit') || name.includes('file')) return Edit
  if (
    name.includes('run') ||
    name.includes('command') ||
    name.includes('exec') ||
    name.includes('shell')
  ) {
    return Monitor
  }
  if (name.includes('delete') || name.includes('remove')) return WarningFilled
  return Document
})

/** 工具图标颜色类 */
const toolIconClass = computed(() => {
  const name = (props.toolCall?.name || '').toLowerCase()
  if (name.includes('delete') || name.includes('remove')) return 'is-danger'
  if (name.includes('write') || name.includes('edit') || name.includes('file')) return 'is-primary'
  if (
    name.includes('run') ||
    name.includes('command') ||
    name.includes('exec') ||
    name.includes('shell')
  ) {
    return 'is-warning'
  }
  return 'is-info'
})

/** el-dialog 可见性双向绑定桥接 */
function handleVisibleChange(val: boolean): void {
  emit('update:visible', val)
}

/** 允许: 放行本次工具调用; 若勾选「全部允许」则同时切换权限模式 */
function handleAllow(): void {
  const id = props.toolCall?.id
  if (!id) return
  emit('confirm', id)
  if (allowAllChecked.value) {
    emit('allow-all')
  }
  resetAndClose()
}

/** 拒绝: 阻止本次工具调用 */
function handleDeny(): void {
  const id = props.toolCall?.id
  if (!id) return
  emit('deny', id)
  resetAndClose()
}

/** 关闭弹窗并重置复选框 */
function resetAndClose(): void {
  allowAllChecked.value = false
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.permission-confirm-dialog {
  // el-dialog 内部容器圆角统一为全局圆角
  :deep(.el-dialog) {
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-dialog__title) {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dialog__body) {
    padding: 20px;
    color: var(--el-text-color-regular);
  }

  :deep(.el-dialog__footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.pcd-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pcd-tool-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pcd-tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius);
  background-color: var(--el-fill-color-light);
  transition: background-color 0.25s ease;

  &.is-primary {
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }

  &.is-warning {
    color: var(--el-color-warning);
    background-color: var(--el-color-warning-light-9);
  }

  &.is-danger {
    color: var(--el-color-danger);
    background-color: var(--el-color-danger-light-9);
  }

  &.is-info {
    color: var(--el-text-color-secondary);
    background-color: var(--el-fill-color-light);
  }
}

.pcd-tool-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.pcd-tool-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pcd-tool-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.pcd-iteration-tag {
  flex-shrink: 0;
}

.pcd-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pcd-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pcd-code-block {
  margin: 0;
  padding: 12px 14px;
  background-color: var(--el-fill-color-darker);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  overflow-x: auto;
  max-height: 280px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;

  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  }
}

.pcd-reason {
  margin: 0;
  padding: 10px 14px;
  background-color: var(--el-color-warning-light-9);
  border-left: 3px solid var(--el-color-warning);
  border-radius: var(--global-border-radius);
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.pcd-allow-all {
  margin-top: 4px;

  :deep(.el-checkbox__label) {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}

.pcd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.pcd-btn {
  min-width: 96px;
  border-radius: var(--global-border-radius);
}

/* 暗色模式 */
:where(html.dark) {
  .pcd-tool-icon {
    &.is-primary {
      background-color: var(--el-color-primary-light-9, rgba(64, 158, 255, 0.12));
    }

    &.is-warning {
      background-color: var(--el-color-warning-light-9, rgba(230, 162, 60, 0.12));
    }

    &.is-danger {
      background-color: var(--el-color-danger-light-9, rgba(245, 108, 108, 0.12));
    }
  }

  .pcd-code-block {
    background-color: var(--color-black-12, rgba(255, 255, 255, 0.05));
  }

  .pcd-reason {
    background-color: var(--el-color-warning-light-9, rgba(230, 162, 60, 0.12));
    color: var(--el-text-color-regular);
  }
}
</style>
