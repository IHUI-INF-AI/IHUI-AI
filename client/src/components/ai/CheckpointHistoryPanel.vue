<template>
  <div class="checkpoint-panel">
    <!-- 标题栏 -->
    <div class="checkpoint-panel__header">
      <span class="checkpoint-panel__title">
        <el-icon class="checkpoint-panel__icon"><Clock /></el-icon>
        {{ t('aiChat.checkpointPanel.title') }}
      </span>
      <div class="checkpoint-panel__actions">
        <el-button
          text
          size="small"
          :loading="undoLoading"
          :disabled="!checkpoints.length || allUndone"
          @click="handleUndo"
          class="checkpoint-panel__btn"
        >
          <el-icon><Back /></el-icon>
          {{ t('aiChat.checkpointPanel.undo') }}
        </el-button>
        <el-button
          text
          size="small"
          @click="refresh"
          class="checkpoint-panel__btn"
        >
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="checkpoint-panel__loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      {{ t('aiChat.checkpointPanel.loading') }}
    </div>

    <!-- 空状态 -->
    <div v-else-if="!checkpoints.length" class="checkpoint-panel__empty">
      {{ t('aiChat.checkpointPanel.empty') }}
    </div>

    <!-- 检查点列表 -->
    <ul v-else class="checkpoint-panel__list">
      <li
        v-for="cp in checkpoints"
        :key="cp.id"
        class="checkpoint-panel__item"
        :class="{ 'is-undone': !cp.applied }"
      >
        <div class="checkpoint-panel__item-main">
          <span class="checkpoint-panel__status-dot" :class="cp.applied ? 'is-applied' : 'is-undone'" />
          <div class="checkpoint-panel__item-info">
            <span class="checkpoint-panel__tool">{{ cp.tool }}</span>
            <span class="checkpoint-panel__desc">{{ cp.description }}</span>
            <span v-if="cp.files?.length" class="checkpoint-panel__files">
              {{ cp.files.join(', ') }}
            </span>
          </div>
        </div>
        <div class="checkpoint-panel__item-actions">
          <span class="checkpoint-panel__time">{{ formatTime(cp.timestamp) }}</span>
          <el-button
            v-if="cp.applied"
            text
            size="small"
            :loading="rollbackId === cp.id"
            @click="handleRollback(cp.id)"
            class="checkpoint-panel__btn"
          >
            {{ t('aiChat.checkpointPanel.rollback') }}
          </el-button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Clock, Back, Refresh, Loading } from '@element-plus/icons-vue'
import {
  listCheckpoints,
  undoLastCheckpoint,
  rollbackToCheckpoint,
  type CheckpointInfo,
} from '@/api/services/workspace.service'

const { t } = useI18n()

interface Props {
  workspacePath: string
}

const props = defineProps<Props>()

const loading = ref(false)
const undoLoading = ref(false)
const rollbackId = ref<string | null>(null)
const checkpoints = ref<CheckpointInfo[]>([])

const allUndone = computed(() => checkpoints.value.length > 0 && checkpoints.value.every(cp => !cp.applied))

async function refresh() {
  if (!props.workspacePath) return
  loading.value = true
  try {
    checkpoints.value = await listCheckpoints(props.workspacePath, 20)
  } catch {
    checkpoints.value = []
  } finally {
    loading.value = false
  }
}

async function handleUndo() {
  undoLoading.value = true
  try {
    const result = await undoLastCheckpoint(props.workspacePath)
    if (result.success) {
      ElMessage.success(t('aiChat.checkpointPanel.undoSuccess'))
    } else {
      ElMessage.warning(result.message || t('aiChat.checkpointPanel.noCheckpoint'))
    }
    await refresh()
  } catch {
    ElMessage.error(t('aiChat.checkpointPanel.undoFailed'))
  } finally {
    undoLoading.value = false
  }
}

async function handleRollback(id: string) {
  rollbackId.value = id
  try {
    const result = await rollbackToCheckpoint(props.workspacePath, id)
    if (result.success) {
      ElMessage.success(t('aiChat.checkpointPanel.rollbackSuccess'))
    } else {
      ElMessage.warning(result.message)
    }
    await refresh()
  } catch {
    ElMessage.error(t('aiChat.checkpointPanel.rollbackFailed'))
  } finally {
    rollbackId.value = null
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

onMounted(() => {
  refresh()
})

defineExpose({ refresh })
</script>

<style lang="scss" scoped>
.checkpoint-panel {
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  font-size: 12px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__icon {
    font-size: 14px;
    color: var(--el-color-primary);
  }

  &__actions {
    display: flex;
    gap: 4px;
  }

  &__btn {
    padding: 2px 6px !important;
    font-size: 11px !important;
  }

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 20px;
    color: var(--el-text-color-secondary);
    font-size: 12px;

    .is-loading {
      animation: rotate 1s linear infinite;
    }
  }

  &__empty {
    padding: 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 11px;
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    max-height: 240px;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background-color 0.15s ease;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &.is-undone {
      opacity: 0.55;
    }
  }

  &__item-main {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  &__status-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-top: 5px;

    &.is-applied {
      background-color: var(--el-color-success);
    }

    &.is-undone {
      background-color: var(--el-text-color-placeholder);
    }
  }

  &__item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__tool {
    font-weight: 600;
    color: var(--el-color-primary);
    font-size: 11px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  &__desc {
    color: var(--el-text-color-regular);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__files {
    color: var(--el-text-color-secondary);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }

  &__item-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  &__time {
    color: var(--el-text-color-placeholder);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 暗色模式 */
:where(html.dark) {
  .checkpoint-panel {
    &__item:hover {
      background-color: var(--el-fill-color-dark);
    }
  }
}
</style>
