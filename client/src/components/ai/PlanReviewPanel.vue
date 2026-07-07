<template>
  <div class="plan-review-panel">
    <!-- 标题栏 -->
    <div class="plan-review-panel__header">
      <span class="plan-review-panel__icon">📋</span>
      <span class="plan-review-panel__title">{{ plan.title || t('floatingChat.workspaceAgent.planReview.untitled') }}</span>
      <el-tag size="small" type="warning" effect="plain" class="plan-review-panel__badge">
        {{ t('floatingChat.workspaceAgent.planReview.badge') }}
      </el-tag>
    </div>

    <!-- 摘要 -->
    <div v-if="plan.summary" class="plan-review-panel__summary">
      {{ plan.summary }}
    </div>

    <!-- 步骤列表 -->
    <div v-if="steps.length > 0" class="plan-review-panel__steps">
      <div class="plan-review-panel__steps-title">
        {{ t('floatingChat.workspaceAgent.planReview.stepsTitle') }} ({{ steps.length }})
      </div>
      <ol class="plan-review-panel__steps-list">
        <li
          v-for="(step, idx) in steps"
          :key="step.id || idx"
          class="plan-review-panel__step"
        >
          <div class="plan-review-panel__step-head">
            <span class="plan-review-panel__step-index">{{ idx + 1 }}</span>
            <span class="plan-review-panel__step-title">{{ step.title }}</span>
            <el-tag
              v-if="step.tool_hint"
              size="small"
              type="info"
              effect="plain"
              class="plan-review-panel__step-tool"
            >
              {{ step.tool_hint }}
            </el-tag>
          </div>
          <div v-if="step.description" class="plan-review-panel__step-desc">
            {{ step.description }}
          </div>
          <div v-if="step.files && step.files.length > 0" class="plan-review-panel__step-files">
            <span class="plan-review-panel__step-files-label">
              {{ t('floatingChat.workspaceAgent.planReview.filesLabel') }}
            </span>
            <el-tag
              v-for="(file, fi) in step.files"
              :key="fi"
              size="small"
              type="info"
              effect="plain"
              class="plan-review-panel__file-tag"
            >
              {{ file }}
            </el-tag>
          </div>
        </li>
      </ol>
    </div>

    <!-- 风险点 -->
    <div v-if="risks.length > 0" class="plan-review-panel__risks">
      <div class="plan-review-panel__risks-title">
        {{ t('floatingChat.workspaceAgent.planReview.risksTitle') }}
      </div>
      <ul class="plan-review-panel__risks-list">
        <li v-for="(risk, ri) in risks" :key="ri" class="plan-review-panel__risk">
          {{ risk }}
        </li>
      </ul>
    </div>

    <!-- 操作按钮 -->
    <div class="plan-review-panel__actions">
      <el-button
        type="primary"
        :loading="accepting"
        @click="onAccept"
        class="plan-review-panel__btn-accept"
      >
        {{ t('floatingChat.workspaceAgent.planReview.accept') }}
      </el-button>
      <el-button
        :loading="rejecting"
        @click="onReject"
        class="plan-review-panel__btn-reject"
      >
        {{ t('floatingChat.workspaceAgent.planReview.reject') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface PlanStep {
  id?: string
  title: string
  description?: string
  files?: string[]
  tool_hint?: string
}

export interface PlanData {
  title?: string
  summary?: string
  steps?: PlanStep[]
  risks?: string[]
}

const { t } = useI18n()

interface Props {
  /** Plan 数据 (来自 agent.plan.proposed 事件) */
  plan: PlanData
}

const props = withDefaults(defineProps<Props>(), {
  plan: () => ({}),
})

const emit = defineEmits<{
  (e: 'accept', extraInstructions: string): void
  (e: 'reject'): void
}>()

const steps = computed<PlanStep[]>(() => props.plan?.steps ?? [])
const risks = computed<string[]>(() => props.plan?.risks ?? [])

const accepting = ref(false)
const rejecting = ref(false)

import { ref } from 'vue'

async function onAccept(): Promise<void> {
  accepting.value = true
  try {
    emit('accept', '')
  } finally {
    accepting.value = false
  }
}

async function onReject(): Promise<void> {
  rejecting.value = true
  try {
    emit('reject')
  } finally {
    rejecting.value = false
  }
}
</script>

<style lang="scss" scoped>
.plan-review-panel {
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  overflow: hidden;
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background-color: var(--el-color-warning-light-9);
    border-bottom: 1px solid var(--el-color-warning-light-5);
  }

  &__icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  &__title {
    flex: 1;
    font-weight: 600;
    color: var(--el-text-color-primary);
    word-break: break-word;
  }

  &__badge {
    flex-shrink: 0;
  }

  &__summary {
    padding: 12px 14px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
    background-color: var(--el-fill-color-blank);
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  &__steps {
    padding: 10px 14px;
  }

  &__steps-title {
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }

  &__steps-list {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: step;
  }

  &__step {
    padding: 10px 12px;
    margin-bottom: 6px;
    background-color: var(--el-fill-color-light);
    border-radius: calc(var(--global-border-radius) - 2px);
    border: 1px solid var(--el-border-color-lighter);
  }

  &__step-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__step-index {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background-color: var(--el-color-primary);
    color: var(--el-color-white);
    font-size: 12px;
    font-weight: 600;
  }

  &__step-title {
    flex: 1;
    font-weight: 500;
    color: var(--el-text-color-primary);
    word-break: break-word;
  }

  &__step-tool {
    flex-shrink: 0;
  }

  &__step-desc {
    color: var(--el-text-color-regular);
    line-height: 1.5;
    margin-left: 30px;
    word-break: break-word;
  }

  &__step-files {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
    margin-left: 30px;
  }

  &__step-files-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__file-tag {
    font-size: 11px;
  }

  &__risks {
    padding: 10px 14px;
    background-color: var(--el-color-danger-light-9);
    border-top: 1px solid var(--el-color-danger-light-5);
  }

  &__risks-title {
    font-weight: 600;
    color: var(--el-color-danger);
    margin-bottom: 4px;
  }

  &__risks-list {
    margin: 0;
    padding-left: 20px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
  }

  &__risk {
    margin-bottom: 2px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    background-color: var(--el-fill-color-light);
    border-top: 1px solid var(--el-border-color-lighter);
  }

  &__btn-accept,
  &__btn-reject {
    flex: 1;
  }
}

/* 暗色模式 */
:where(html.dark) {
  .plan-review-panel {
    &__step {
      background-color: var(--color-white-5);
    }
  }
}
</style>
