<template>
  <img
    ref="imageRef"
    :src="currentSrc"
    :alt="alt"
    :class="['lazy-image', { 'lazy-image-loading': isLoading, 'lazy-image-error': isError }]"
    @load="handleLoad"
    @error="handleError"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useLazyImage } from '@/composables/useLazyImage'

interface Props {
  src: string
  alt?: string
  placeholder?: string
  errorPlaceholder?: string
  rootMargin?: string
  threshold?: number | number[]
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  rootMargin: '50px',
  threshold: 0.1,
})

const imageRef = ref<HTMLImageElement | null>(null)

const { currentSrc, isLoading, isError } = useLazyImage(imageRef, () => props.src, {
  placeholder: props.placeholder,
  errorPlaceholder: props.errorPlaceholder,
  rootMargin: props.rootMargin,
  threshold: props.threshold,
})

const handleLoad = () => {
  // 图片加载完成
}

const handleError = () => {
  // 图片加载失败
}

// 暴露原生图片元素
defineExpose({
  $el: imageRef,
})
</script>

<style scoped lang="scss">
.lazy-image {
  transition: opacity 0.3s ease;

  &.lazy-image-loading {
    opacity: 0.6;
  }

  &.lazy-image-error {
    opacity: 0.5;
  }
}
</style>
