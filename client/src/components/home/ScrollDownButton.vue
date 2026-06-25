<template>
  <Transition name="scroll-button-fade">
    <button
      v-if="visible"
      class="scroll-down-button"
      :class="{ 'is-clicking': isClicking }"
      @click="handleClick"
      :aria-label="t('hardcoded.scroll_down_button.向下滚动')"
    >
      <div class="button-inner">
        <!-- 简洁的向下箭头 -->
        <svg
          class="arrow-icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 10L12 15L17 10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        
        <!-- 微妙的背景光晕 -->
        <div class="glow-effect"></div>
      </div>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'

const { t } = useI18n()

interface Props {
  currentPage: number
  totalPages: number
  scrollToPage: (index: number) => void
}

const props = defineProps<Props>()

const isClicking = ref(false)

// 是否可见：最后一页时隐藏
const visible = computed(() => props.currentPage < props.totalPages - 1)

const handleClick = () => {
  if (props.currentPage >= props.totalPages - 1) return

  isClicking.value = true

  // 延迟执行滚动，让动画先播放
  setTimeout(() => {
    props.scrollToPage(props.currentPage + 1)
    setTimeout(() => {
      isClicking.value = false
    }, 300)
  }, 100)
}
</script>

<style scoped lang="scss">
.scroll-down-button {
  position: fixed;
  bottom: 32px; /* 上移避开 .hero-cta 按钮区，避免重叠 */
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: var(--z-dropdown);
  padding: 0;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateX(-50%) translateY(-2px);
    
    .button-inner {
      background: var(--color-white-95);
      border-color: var(--border-unified-color);
      border: var(--unified-border);
      }
    
    .arrow-icon {
      transform: translateY(2px);
      color: var(--color-black-90);
    }
    
    .glow-effect {
      opacity: 0.2;
    }
  }
  
  &:active,
  &.is-clicking {
    transform: translateX(-50%) translateY(0) scale(0.96);
    
    .button-inner {
      background: color-mix(in srgb, var(--el-color-primary) 100%, transparent);
      border-color: var(--border-unified-color);
      border: var(--unified-border);
      }
  }
}

.button-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
  background: var(--color-white-90);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: var(--unified-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.arrow-icon {
  position: relative;
  width: 24px;
  height: 24px;
  color: var(--color-black-75);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: calc(var(--z-base) + 1);
  animation: subtle-bounce 2s ease-in-out infinite;
}

.glow-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80%;
  height: 80%;
  border-radius: var(--global-border-radius);
  background: var(--color-black-04);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: var(--z-base);
}

@keyframes subtle-bounce {
  0%, 100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(3px);
  }
}

// 暗色模式适配
:where(html.dark) {
  .button-inner {
    background: var(--color-white-10);
    border: var(--unified-border);
    }
  
  .scroll-down-button:hover .button-inner {
    background: var(--color-white-15);
    border-color: var(--border-unified-color-hover);
    }
  
  .scroll-down-button:active .button-inner,
  .scroll-down-button.is-clicking .button-inner {
    background: var(--color-white-20);
    border-color: var(--border-unified-color-hover);
    }
  
  .arrow-icon {
    color: var(--color-white-90);
  }
  
  .glow-effect {
    background: var(--color-white-10);
  }
}

// 淡入淡出过渡
.scroll-button-fade-enter-active,
.scroll-button-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.scroll-button-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.9);
}

.scroll-button-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(0.9);
}

// 响应式设计
@media (width <= 768px) {
  .scroll-down-button {
    width: 40px;
    height: 40px;
    bottom: 96px; /* 移动端上移更多，避开 .hero-cta */
  }
  
  .arrow-icon {
    width: 20px;
    height: 20px;
  }
  
  .button-inner {
    border-radius: var(--global-border-radius);
  }
}

@media (width <= 480px) {
  .scroll-down-button {
    width: 40px;
    height: 40px;
    bottom: 96px; /* 窄屏同样上移 */
  }

  .arrow-icon {
    width: 18px;
    height: 18px;
  }

  .button-inner {
    border-radius: var(--global-border-radius);
  }
}
</style>
