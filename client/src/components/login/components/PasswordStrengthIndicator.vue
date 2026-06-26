<template>
  <div v-if="password" class="password-strength-indicator">
    <div class="strength-bar">
      <div
        class="strength-fill"
        :class="strengthLevel"
        :style="{ width: strengthWidth + '%' }"
      ></div>
    </div>
    <span class="strength-text" :class="strengthLevel">
      {{ strengthText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePasswordStrength } from '../composables/usePasswordStrength'
import { useI18n } from 'vue-i18n'

interface PasswordStrengthIndicatorProps {
  password: string
}

const props = defineProps<PasswordStrengthIndicatorProps>()

const { t } = useI18n()
const { calculateStrength } = usePasswordStrength()

const strength = computed(() => calculateStrength(props.password))

const strengthLevel = computed(() => {
  const score = strength.value.score
  if (score < 2) return 'weak'
  if (score < 4) return 'medium'
  return 'strong'
})

const strengthWidth = computed(() => {
  return (strength.value.score / 4) * 100
})

const strengthText = computed(() => {
  const level = strengthLevel.value
  switch (level) {
    case 'weak':
      return t('auth.passwordStrengthWeak')
    case 'medium':
      return t('auth.passwordStrengthMedium')
    case 'strong':
      return t('auth.passwordStrengthStrong')
    default:
      return ''
  }
})
</script>

<style scoped lang="scss">
.password-strength-indicator {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background-color: var(--el-border-color-light);
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: var(--global-border-radius);
  transition: background-color 0.3s ease;

  &.weak {
    background-color: var(--color-danger-variant);
  }

  &.medium {
    background-color: var(--color-warning-variant);
  }

  &.strong {
    background-color: var(--color-success);
  }
}

.strength-text {
  font-size: 12px;
  white-space: nowrap;

  &.weak {
    color: var(--color-danger-variant);
  }

  &.medium {
    color: var(--color-warning-variant);
  }

  &.strong {
    color: var(--color-success);
  }
}
</style>
