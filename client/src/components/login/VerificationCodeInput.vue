<template>
  <div class="verification-code-container">
    <div class="verification-code-inputs">
      <input
        v-for="(digit, index) in digits"
        :key="index"
        :ref="(el: HTMLElement | null) => setInputRef(el as HTMLInputElement, index)"
        v-model="digits[index]"
        link
        inputmode="numeric"
        maxlength="1"
        class="verification-code-digit"
        :class="{ 'has-value': digit, 'is-focused': focusedIndex === index }"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
        @paste="handlePaste($event)"
        @focus="handleFocus(index)"
        @blur="handleBlur"
      />
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, nextTick, onMounted } from 'vue'

interface Props {
  modelValue?: string
  length?: number
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  errorMessage?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'complete', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  length: 6,
  disabled: false,
  placeholder: '',
  autoFocus: false,
  errorMessage: '',
})

const emit = defineEmits<Emits>()

// 响应式数据
const digits = reactive<string[]>(new Array(props.length).fill(''))
const inputRefs = ref<(HTMLInputElement | null)[]>([])
const focusedIndex = ref(-1)

// 设置输入框引用
const setInputRef = (el: HTMLInputElement | null, index: number) => {
  if (el) {
    inputRefs.value[index] = el
  }
}

// 更新数字数组
const updateDigits = (value: string) => {
  const chars = value.slice(0, props.length).split('')
  for (let i = 0; i < props.length; i++) {
    digits[i] = chars[i] || ''
  }
}

// 获取完整值
const getFullValue = (): string => {
  return digits.join('')
}

// 处理输入
const handleInput = (index: number, event: Event) => {
  if (props.disabled) return

  const target = event.target as HTMLInputElement
  let value = target.value

  // 只允许数字
  value = value.replace(/[^0-9]/g, '')

  // 如果输入多个字符，只取最后一个
  if (value.length > 1) {
    value = value.slice(-1)
  }

  // 更新当前位置的值
  digits[index] = value

  // 发出更新事件
  const fullValue = getFullValue()
  emit('update:modelValue', fullValue)
  emit('change', fullValue)

  // 如果输入了数字且不是最后一个输入框，自动跳转到下一个
  if (value && index < props.length - 1) {
    nextTick(() => {
      const nextInput = inputRefs.value[index + 1]
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    })
  }

  // 如果所有输入框都已填满，触发完成事件
  if (fullValue.length === props.length) {
    emit('complete', fullValue)
  }
}

// 处理键盘事件
const handleKeydown = (index: number, event: KeyboardEvent) => {
  if (props.disabled) return

  const { key } = event

  // 处理退格键
  if (key === 'Backspace') {
    if (!digits[index] && index > 0) {
      // 当前输入框为空，跳转到前一个输入框并清空
      event.preventDefault()
      digits[index - 1] = ''
      const prevInput = inputRefs.value[index - 1]
      if (prevInput) {
        prevInput.focus()
        prevInput.select()
      }

      // 发出更新事件
      const fullValue = getFullValue()
      emit('update:modelValue', fullValue)
      emit('change', fullValue)
    } else {
      // 清空当前输入框
      digits[index] = ''
      const fullValue = getFullValue()
      emit('update:modelValue', fullValue)
      emit('change', fullValue)
    }
    return
  }

  // 处理删除键
  if (key === 'Delete') {
    digits[index] = ''
    const fullValue = getFullValue()
    emit('update:modelValue', fullValue)
    emit('change', fullValue)
    return
  }

  // 处理左右箭头键
  if (key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    const prevInput = inputRefs.value[index - 1]
    if (prevInput) {
      prevInput.focus()
      prevInput.select()
    }
    return
  }

  if (key === 'ArrowRight' && index < props.length - 1) {
    event.preventDefault()
    const nextInput = inputRefs.value[index + 1]
    if (nextInput) {
      nextInput.focus()
      nextInput.select()
    }
    return
  }

  // 处理Home和End键
  if (key === 'Home') {
    event.preventDefault()
    const firstInput = inputRefs.value[0]
    if (firstInput) {
      firstInput.focus()
      firstInput.select()
    }
    return
  }

  if (key === 'End') {
    event.preventDefault()
    const lastInput = inputRefs.value[props.length - 1]
    if (lastInput) {
      lastInput.focus()
      lastInput.select()
    }
    return
  }

  // 处理Tab键（允许正常的Tab导航）
  if (key === 'Tab') {
    return
  }

  // 处理回车键
  if (key === 'Enter') {
    const fullValue = getFullValue()
    if (fullValue.length === props.length) {
      emit('complete', fullValue)
    }
    return
  }

  // 阻止非数字输入
  if (
    !/[0-9]/.test(key) &&
    !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
  ) {
    event.preventDefault()
  }
}

// 处理粘贴
const handlePaste = (event: ClipboardEvent) => {
  if (props.disabled) return

  event.preventDefault()

  const pasteData = event.clipboardData?.getData('text') || ''
  const numericData = pasteData.replace(/[^0-9]/g, '').slice(0, props.length)

  if (numericData.length > 0) {
    // 分配粘贴的数字到各个输入框
    updateDigits(numericData)

    // 发出更新事件
    const fullValue = getFullValue()
    emit('update:modelValue', fullValue)
    emit('change', fullValue)

    // 焦点移动到最后一个有值的输入框或下一个空输入框
    const lastFilledIndex = Math.min(numericData.length - 1, props.length - 1)
    const nextEmptyIndex = Math.min(numericData.length, props.length - 1)
    const targetIndex = numericData.length === props.length ? lastFilledIndex : nextEmptyIndex

    nextTick(() => {
      const targetInput = inputRefs.value[targetIndex]
      if (targetInput) {
        targetInput.focus()
        targetInput.select()
      }
    })

    // 如果粘贴后所有输入框都已填满，触发完成事件
    if (numericData.length === props.length) {
      emit('complete', fullValue)
    }
  }
}

// 处理焦点
const handleFocus = (index: number) => {
  if (props.disabled) return

  focusedIndex.value = index

  // 选中输入框中的所有内容
  nextTick(() => {
    const input = inputRefs.value[index]
    if (input) {
      input.select()
    }
  })
}

// 处理失焦
const handleBlur = () => {
  focusedIndex.value = -1
}

// 清空所有输入框
const clear = () => {
  for (let i = 0; i < props.length; i++) {
    digits[i] = ''
  }
  emit('update:modelValue', '')
  emit('change', '')

  // 焦点回到第一个输入框
  nextTick(() => {
    const firstInput = inputRefs.value[0]
    if (firstInput) {
      firstInput.focus()
    }
  })
}

// 聚焦到第一个输入框
const focus = () => {
  nextTick(() => {
    const firstInput = inputRefs.value[0]
    if (firstInput) {
      firstInput.focus()
      firstInput.select()
    }
  })
}

// 监听外部值变化
watch(
  () => props.modelValue,
  newValue => {
    if (newValue !== getFullValue()) {
      updateDigits(newValue)
    }
  },
  { immediate: true }
)

// 组件挂载后自动聚焦
onMounted(() => {
  if (props.autoFocus) {
    focus()
  }
})

// 暴露方法给父组件
defineExpose({
  clear,
  focus,
  getFullValue,
})
</script>

<style scoped>
.verification-code-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.verification-code-inputs {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 300px;
}

.verification-code-digit {
  width: 48px;
  height: 64px;
  border: 2px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  background-color: var(--el-bg-color);
  transition: all 0.2s ease;
  outline: none;
  box-sizing: border-box;
}

.verification-code-digit:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

.verification-code-digit:focus {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  }

.verification-code-digit.has-value {
  border-color: var(--el-color-success);
  background-color: var(--el-color-success-light-9);
}

.verification-code-digit.is-focused {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
  }

.verification-code-digit:disabled {
  background-color: var(--el-disabled-bg-color);
  border-color: var(--el-disabled-border-color);
  color: var(--el-disabled-text-color);
  cursor: not-allowed;
}

.error-message {
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  margin-top: 4px;
}

/* 响应式设计 */
@media (width <= 480px) {
  .verification-code-digit {
    width: 40px;
    height: 56px;
    font-size: 20px;
  }

  .verification-code-inputs {
    gap: 4px;
  }
}

/* 暗色模式适配 */
html.dark .verification-code-digit {
  background-color: var(--el-bg-color-page);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

html.dark .verification-code-digit:hover {
  border: var(--el-border-width-primary) solid var(--el-color-primary);
}

html.dark .verification-code-digit.has-value {
  border-color: var(--el-color-success);
  background-color: var(--el-color-success-dark-2);
}
</style>
