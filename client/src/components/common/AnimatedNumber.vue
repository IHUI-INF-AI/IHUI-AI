<script setup lang="ts">
/**
 * 动画数字组件
 * 用于显示从0到目标值的平滑动画效果
 */
import { ref, onMounted, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

interface Props {
  /** 目标数值 */
  value: number
  /** 动画持续时间（毫秒） */
  duration?: number
  /** 延迟开始时间（毫秒） */
  delay?: number
  /** 数字前缀 */
  prefix?: string
  /** 数字后缀 */
  suffix?: string
}

const props = withDefaults(defineProps<Props>(), {
  duration: 2000,
  delay: 0,
  prefix: '',
  suffix: '',
})

const displayValue = ref(0)
const hasAnimated = ref(false)

// 用于在卸载时清理定时器和动画帧
let rafId: number | null = null

const cleanup = useCleanup()
cleanup.add(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

const animate = () => {
  if (hasAnimated.value) return
  hasAnimated.value = true

  cleanup.addTimer(() => {
    const startTime = performance.now()
    const animateFrame = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / props.duration, 1)
      // easeOutQuart 缓动函数
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      displayValue.value = Math.floor(props.value * easeOutQuart)

      if (progress < 1) {
        rafId = requestAnimationFrame(animateFrame)
      } else {
        displayValue.value = props.value
      }
    }
    rafId = requestAnimationFrame(animateFrame)
  }, props.delay)
}

onMounted(() => {
  animate()
})

// 监听 value 变化，重新播放动画
watch(() => props.value, () => {
  hasAnimated.value = false
  displayValue.value = 0
  animate()
})
</script>

<template>
  <span class="animated-number">
    {{ prefix }}{{ displayValue }}{{ suffix }}
  </span>
</template>

<style scoped>
.animated-number {
  font-variant-numeric: tabular-nums;
}
</style>
