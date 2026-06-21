<template>
  <div
    v-if="visible"
    :class="['balance-alert', `level-${level}`]"
    :role="level === 'critical' ? 'alert' : 'status'"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="alert-icon" aria-hidden="true">{{ icon }}</div>
    <div class="alert-content">
      <h3 class="alert-title">{{ title }}</h3>
      <p class="alert-desc">{{ description }}</p>
    </div>
    <div class="alert-actions">
      <button
        v-if="showAction"
        type="button"
        class="alert-btn"
        :aria-label="actionLabel"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
      <button
        type="button"
        class="alert-close"
        aria-label="关闭余额提醒"
        @click="dismiss"
      >×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  balanceCents: number
  warningThresholdCents?: number
  criticalThresholdCents?: number
  showAction?: boolean
  actionLabel?: string
}>(), {
  warningThresholdCents: 10000,  // 100 元
  criticalThresholdCents: 1000,  // 10 元
  showAction: true,
  actionLabel: '立即充值',
})

const emit = defineEmits<{
  (e: 'action'): void
  (e: 'dismiss'): void
}>()

const dismissed = ref(false)

const level = computed<'normal' | 'warning' | 'critical'>(() => {
  if (props.balanceCents < 0) return 'critical'
  if (props.balanceCents < props.criticalThresholdCents) return 'critical'
  if (props.balanceCents < props.warningThresholdCents) return 'warning'
  return 'normal'
})

const visible = computed(() => !dismissed.value && level.value !== 'normal')

const icon = computed(() => {
  if (level.value === 'critical') return '⚠'
  return '!'
})

const title = computed(() => {
  if (level.value === 'critical') return '余额严重不足'
  return '余额不足提醒'
})

const description = computed(() => {
  const yuan = (props.balanceCents / 100).toFixed(2)
  if (level.value === 'critical') {
    return `当前余额仅 ¥${yuan}, 部分功能可能无法使用, 建议立即充值`
  }
  return `当前余额 ¥${yuan}, 低于预警值 ¥${(props.warningThresholdCents / 100).toFixed(2)}`
})

function dismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<style scoped lang="scss">
@use './../styles/variables' as v;

.balance-alert {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-radius: var(--global-border-radius);
  margin-bottom: 16px;
  transition: all 0.3s;

  &.level-warning {
    background: linear-gradient(135deg, var(--el-color-warning-light-9) 0%, var(--el-color-warning-light-7) 100%);
    border: var(--unified-border);

    .alert-icon {
      background: var(--el-color-warning);
      color: var(--el-bg-color);
    }
  }

  &.level-critical {
    background: linear-gradient(135deg, var(--el-color-danger-light-9) 0%, var(--el-color-danger-light-7) 100%);
    border: var(--unified-border);

    .alert-icon {
      background: var(--el-color-danger);
      color: var(--el-bg-color);
    }
  }

  .alert-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 16px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .alert-content {
    flex: 1;
  }

  .alert-title {
    font-size: 14px;
    font-weight: 700;
    color: v.$text-primary;
  }

  .alert-desc {
    font-size: 12px;
    color: v.$text-secondary;
    margin-top: 2px;
  }

  .alert-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .alert-btn {
    height: 30px;
    padding: 0 14px;
    border-radius: var(--global-border-radius);
    background: var(--el-text-color-primary);
    color: var(--el-bg-color);
    border: none;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.85;
    }
  }

  .alert-close {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: v.$text-secondary;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--color-black-6);
    }
  }
}
</style>
