<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ref, watch, provide, onMounted, onUnmounted, computed } from 'vue'
import { cn } from '@/lib/utils'
import { DIALOG_KEY } from './dialogContext'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    class?: HTMLAttributes['class']
    width?: string
    top?: string
    closeOnClickOverlay?: boolean
    closeOnEsc?: boolean
  }>(),
  {
    width: '',
    top: '',
    closeOnClickOverlay: true,
    closeOnEsc: true,
  },
)

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  open: []
}>()

const isOpen = ref(props.modelValue)

watch(
  () => props.modelValue,
  (val) => {
    isOpen.value = val
    if (val) {
      emits('open')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
)

const contentStyle = computed(() => ({
  ...(props.width ? { maxWidth: props.width, width: '100%' } : {}),
  ...(props.top ? { marginTop: props.top } : {}),
}))

function closeDialog() {
  emits('close')
  isOpen.value = false
  emits('update:modelValue', false)
}

function handleOverlayClick() {
  if (props.closeOnClickOverlay) {
    closeDialog()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value && props.closeOnEsc) {
    closeDialog()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

provide(DIALOG_KEY, { isOpen, closeDialog })
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 md:p-8" style="top: 0;">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="handleOverlayClick" />
        <div
          :class="cn(
            'relative z-50 w-full my-8 rounded-lg border bg-background p-6 shadow-lg',
            props.class,
          )"
          :style="contentStyle"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
            @click="closeDialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span class="sr-only">Close</span>
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
