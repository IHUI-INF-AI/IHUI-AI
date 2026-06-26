<template>
  <div class="design-system-input-wrapper">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="text-placeholder">*</span>
    </label>

    <div class="input-container" :class="{ 'input-error': hasError, 'input-focused': isFocused }">
      <input
        :id="inputId"
        ref="inputRef"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        class="design-system-input"
        @input="handleInput"
        @focus="isFocused = true"
        @blur="handleBlur"
      />

      <div v-if="hasError && errorMessage" class="input-error-message">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  modelValue: string | number
  label?: string
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  errorMessage?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

// getSpacing 和 getRadius 未使用，不需要导入
const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

const inputId = computed(() => props.id || `input-${Math.random().toString(36).substr(2, 9)}`)
const hasError = computed(() => !!props.errorMessage)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

onMounted(() => {
  // 自动聚焦（如果需要）
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.design-system-input-wrapper {
  width: 100%;

  .input-label {
    display: block;
    margin-bottom: $spacing-xs;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: var(--app-text-primary);
  }
}

.input-container {
  position: relative;

  &.input-focused {
    .design-system-input {
      border-color: $primary-color;
    }
  }

  &.input-error {
    .design-system-input {
      border-color: $danger-color;
    }
  }
}

.design-system-input {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  border: var(--unified-border);
  border-radius: $radius-8;
  font-size: $font-size-base;
  font-family: var(--global-font-family);
  color: var(--app-text-primary);
  background-color: var(--app-surface-2);
  transition: $transition-base;

  &:focus {
    outline: none;
    border-color: $primary-color;
    background-color: $bg-hover;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    background-color: $bg-secondary;
  }

  &::placeholder {
    color: $text-placeholder;
  }
}

.input-error-message {
  margin-top: $spacing-xs;
  font-size: $font-size-xs;
  color: $danger-color;
}

// 暗色主题适配
:where(html.dark) {
  .design-system-input {
    background-color: var(--app-surface-2);
    color: var(--app-text-primary);
    border-color: var(--app-divider);

    &:focus {
      background-color: var(--el-bg-color-hover);
    }
  }
}
</style>
