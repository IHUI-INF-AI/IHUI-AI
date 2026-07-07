<!--
  InlineDiffViewer - 文件变更预览组件 (对标 Cursor/Trae Inline Diff)
  显示 write_file/edit_file 工具的 old_content → new_content diff
  提供 Accept / Reject 按钮 (本组件为占位骨架, 待完善)
-->
<template>
  <div class="inline-diff" :class="{ 'is-collapsed': !isExpanded, 'is-decided': decision !== null }">
    <!-- 顶部工具栏 -->
    <div class="inline-diff__toolbar">
      <div
        class="inline-diff__file-info"
        role="button"
        tabindex="0"
        :aria-expanded="isExpanded"
        :aria-label="isExpanded ? t('floatingChat.workspaceAgent.collapse') : t('floatingChat.workspaceAgent.expand')"
        @click="toggleExpand"
        @keydown.enter.prevent="toggleExpand"
        @keydown.space.prevent="toggleExpand"
      >
        <el-icon class="inline-diff__chevron" :class="{ 'is-rotated': isExpanded }">
          <ArrowDown />
        </el-icon>
        <el-icon class="inline-diff__file-icon"><Document /></el-icon>
        <span class="inline-diff__file-name" :title="fileName">{{ fileName }}</span>
        <span v-if="diffInfo?.is_new_file" class="inline-diff__badge inline-diff__badge--new">NEW</span>
      </div>
      <div v-if="decision === null" class="inline-diff__actions">
        <button
          class="inline-diff__btn inline-diff__btn--reject"
          :aria-label="t('floatingChat.workspaceAgent.reject')"
          @click="onReject"
        >
          <el-icon><Close /></el-icon>
          <span>{{ t('floatingChat.workspaceAgent.reject') }}</span>
        </button>
        <button
          class="inline-diff__btn inline-diff__btn--accept"
          :aria-label="t('floatingChat.workspaceAgent.accept')"
          @click="onAccept"
        >
          <el-icon><Check /></el-icon>
          <span>{{ t('floatingChat.workspaceAgent.accept') }}</span>
        </button>
      </div>
      <div v-else class="inline-diff__decision">
        <el-icon v-if="decision === 'accepted'" class="inline-diff__decision-icon inline-diff__decision-icon--accept">
          <Check />
        </el-icon>
        <el-icon v-else class="inline-diff__decision-icon inline-diff__decision-icon--reject">
          <Close />
        </el-icon>
        <span class="inline-diff__decision-text">{{
          decision === 'accepted'
            ? t('floatingChat.workspaceAgent.accepted')
            : t('floatingChat.workspaceAgent.rejected')
        }}</span>
      </div>
    </div>
    <!-- Diff 内容区 -->
    <div v-show="isExpanded" class="inline-diff__content">
      <div class="inline-diff__pane">
        <div class="inline-diff__pane-header">{{ t('floatingChat.workspaceAgent.original') }}</div>
        <pre class="inline-diff__code"><code>{{ diffInfo?.old_content || '' }}</code></pre>
      </div>
      <div class="inline-diff__pane">
        <div class="inline-diff__pane-header">{{ t('floatingChat.workspaceAgent.modified') }}</div>
        <pre class="inline-diff__code"><code>{{ diffInfo?.new_content || '' }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, Document, Check, Close } from '@element-plus/icons-vue'

export interface InlineDiffInfo {
  file_path: string
  old_content: string
  new_content: string
  is_new_file?: boolean
}

const props = defineProps<{
  diffInfo: InlineDiffInfo | null
}>()

const emit = defineEmits<{
  (e: 'accept', diffInfo: InlineDiffInfo): void
  (e: 'reject', diffInfo: InlineDiffInfo): void
}>()

const { t } = useI18n()

const isExpanded = ref(true)
const decision = ref<'accepted' | 'rejected' | null>(null)

const fileName = computed(() => {
  if (!props.diffInfo) return ''
  const parts = props.diffInfo.file_path.split(/[/\\]/)
  return parts[parts.length - 1] || props.diffInfo.file_path
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const onAccept = () => {
  if (!props.diffInfo) return
  decision.value = 'accepted'
  emit('accept', props.diffInfo)
}

const onReject = () => {
  if (!props.diffInfo) return
  decision.value = 'rejected'
  emit('reject', props.diffInfo)
}
</script>

<style scoped lang="scss">
.inline-diff {
  border: 1px solid var(--app-border-color, #e4e7ed);
  border-radius: 8px;
  background: var(--app-bg-color, #ffffff);
  overflow: hidden;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--app-bg-color-page, #f5f7fa);
    border-bottom: 1px solid var(--app-border-color, #e4e7ed);
  }

  &__file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  &__chevron {
    transition: transform 0.2s ease;
    &.is-rotated {
      transform: rotate(0deg);
    }
  }

  &__file-name {
    font-weight: 500;
    color: var(--app-text-color, #303133);
  }

  &__badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--el-color-success-light-9, #f0f9eb);
    color: var(--el-color-success, #67c23a);
    &--new {
      background: var(--el-color-success-light-9, #f0f9eb);
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--app-border-color, #e4e7ed);
    border-radius: 6px;
    background: var(--app-bg-color, #ffffff);
    color: var(--app-text-color, #303133);
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      border-color: var(--el-color-primary, #409eff);
    }
    &--accept:hover {
      background: var(--el-color-success-light-9, #f0f9eb);
      color: var(--el-color-success, #67c23a);
    }
    &--reject:hover {
      background: var(--el-color-danger-light-9, #fef0f0);
      color: var(--el-color-danger, #f56c6c);
    }
  }

  &__decision {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__decision-icon--accept {
    color: var(--el-color-success, #67c23a);
  }

  &__decision-icon--reject {
    color: var(--el-color-danger, #f56c6c);
  }

  &__content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--app-border-color, #e4e7ed);
  }

  &__pane {
    background: var(--app-bg-color, #ffffff);
  }

  &__pane-header {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--app-text-color-secondary, #606266);
    background: var(--app-bg-color-page, #f5f7fa);
    border-bottom: 1px solid var(--app-border-color, #e4e7ed);
  }

  &__code {
    margin: 0;
    padding: 8px 12px;
    font-family: var(--app-font-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    color: var(--app-text-color, #303133);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
