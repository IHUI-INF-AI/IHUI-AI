<!--
  AgentPill.vue - AI 对话输入框顶部 Agent 胶囊 (2026-07-06 Trae 风格)

  用法:
    <AgentPill
      :agent-name="agentName"
      :show-close="true"
      :close-aria="t('aiChatInput.removeAgentAriaLabel')"
      @remove="handleRemoveAgent"
    />

  视觉对齐 Trae 截图: 小绿头像 + @Agent 文字 + × 关闭
  样式: 圆角 6px, 描边 1px var(--border-unified-color), 浅色 fill var(--el-fill-color-light)
-->
<template>
  <div v-if="agentName" class="agent-pill" role="status" :aria-label="agentName">
    <span class="agent-pill-avatar" aria-hidden="true">
      <el-icon><Cpu /></el-icon>
    </span>
    <span class="agent-pill-label">@{{ agentName }}</span>
    <button
      v-if="showClose"
      type="button"
      class="agent-pill-close"
      :aria-label="closeAria || t('aiChatInput.removeAgentAriaLabel')"
      :title="closeAria || t('aiChatInput.removeAgentAriaLabel')"
      @click="emit('remove')"
    >
      <el-icon><Close /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Cpu, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

withDefaults(
  defineProps<{
    agentName: string
    showClose?: boolean
    closeAria?: string
  }>(),
  {
    showClose: true,
    closeAria: '',
  },
)

const emit = defineEmits<{
  (e: 'remove'): void
}>()
</script>

<style lang="scss" scoped>
.agent-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 6px 0 4px;
  margin: 4px 4px 0;
  border-radius: 6px;
  border: 1px solid var(--border-unified-color);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: var(--border-unified-color-hover);
  }

  :where(html.dark) & {
    background: var(--color-white-4);
    border-color: var(--border-unified-color);
  }
}

.agent-pill-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--ai-send-btn-bg, #16a34a);
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}

.agent-pill-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}

.agent-pill-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }
}
</style>
