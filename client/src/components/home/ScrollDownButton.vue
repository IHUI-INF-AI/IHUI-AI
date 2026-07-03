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
import { ref, computed, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

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

// ── 工作区水平中心定位 ──
// 按钮需居中于「右侧工作区」(.workspace)，而非整个视口。
// 由于左侧 Sidebar 宽度可变（116px/60px/拖拽）、AI 对话面板可开关可拖拽，
// 纯 CSS 难以精确计算工作区中心，故用 JS 读取 .workspace 的 getBoundingClientRect，
// 配合 ResizeObserver 监听其尺寸变化（sidebar 折叠 / ai-panel 开关 / 拖拽均会引起 .workspace 宽度变化）。
const centerLeft = ref<number | null>(null)
let workspaceEl: HTMLElement | null = null
let sidebarEl: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null

const updateCenter = () => {
  if (!workspaceEl) return
  const rect = workspaceEl.getBoundingClientRect()
  // 工作区水平中心 = left + width / 2（相对于视口，与 fixed 定位坐标系一致）
  centerLeft.value = rect.left + rect.width / 2
}

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

onMounted(() => {
  const cleanup = useCleanup()
   
  console.log('[ScrollDownButton] onMounted fired')
  workspaceEl = document.querySelector('.workspace')
  sidebarEl = document.querySelector('.app-sidebar')
   
  console.log('[ScrollDownButton] workspaceEl found:', !!workspaceEl, 'sidebarEl:', !!sidebarEl)
  if (!workspaceEl) return

  updateCenter()
   
  console.log('[ScrollDownButton] centerLeft after updateCenter:', centerLeft.value)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateCenter)
    // 监听工作区自身宽度变化（ai-panel 开关 / 拖拽会改变 .workspace 宽度）
    resizeObserver.observe(workspaceEl)
    // 监听侧边栏宽度变化（折叠 / 展开 / 拖拽），更早触发更新，避免一帧延迟
    if (sidebarEl) resizeObserver.observe(sidebarEl)
  }
  window.addEventListener('resize', updateCenter)
  cleanup.add(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    window.removeEventListener('resize', updateCenter)
    workspaceEl = null
    sidebarEl = null
  })
})
</script>

<style scoped lang="scss">
.scroll-down-button {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: var(--z-dropdown);
  padding: 0;
  outline: none;

  // 仅过渡 transform，不过渡 left：left 由 JS 按工作区中心动态设置，
  // 过渡会导致 sidebar 折叠 / ai-panel 拖拽时按钮滑动跟随，体验割裂。
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateX(-50%) translateY(-2px);
    
    .button-inner {
      background: var(--color-white-95);
      border-color: var(--border-unified-color);
      border: var(--unified-border);
      box-shadow: var(--global-box-shadow);
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
      box-shadow: var(--global-box-shadow);
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
  box-shadow: var(--global-box-shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  // 容器缩小一倍(22px)后，向下箭头图标保持原尺寸(24px)会略大于容器，
  // 需放开 overflow 让图标完整显示，不被裁剪。
  overflow: visible;
}

.arrow-icon {
  position: relative;
  width: 24px;
  height: 24px;

  // 容器缩小一倍(22px)后图标(24px)大于容器，需禁止 flex 收缩，
  // 否则 flex 容器(.button-inner)会把图标压缩到容器尺寸，违背"不缩小图标"要求。
  flex-shrink: 0;
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
    box-shadow: var(--global-box-shadow);
  }
  
  .scroll-down-button:hover .button-inner {
    background: var(--color-white-15);
    border-color: var(--border-unified-color-hover);
    box-shadow: var(--global-box-shadow);
  }
  
  .scroll-down-button:active .button-inner,
  .scroll-down-button.is-clicking .button-inner {
    background: var(--color-white-20);
    border-color: var(--border-unified-color-hover);
    box-shadow: var(--global-box-shadow);
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

// 响应式设计：容器尺寸跟随减半，向下箭头图标尺寸保持不变（用户要求不缩小图标）
@media (width <= 768px) {
  .scroll-down-button {
    width: 20px;
    height: 20px;
    bottom: 64px;
  }

  .button-inner {
    border-radius: var(--global-border-radius);
  }
}

@media (width <= 480px) {
  .scroll-down-button {
    width: 20px;
    height: 20px;
    bottom: 64px;
  }

  .button-inner {
    border-radius: var(--global-border-radius);
  }
}
</style>
