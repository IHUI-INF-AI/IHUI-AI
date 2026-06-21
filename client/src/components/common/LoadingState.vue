<template>
  <div class="loading-state" :class="[`loading-${size}`, { 'loading-fullscreen': fullscreen }]">
    <div class="loading-content">
      <div v-if="showSpinner" class="loading-spinner">
        <el-icon class="spinner-icon" :size="spinnerSize">
          <Loading />
        </el-icon>
      </div>
      <div v-if="message" class="loading-message">{{ message }}</div>
      <div v-if="subMessage" class="loading-sub-message">{{ subMessage }}</div>
      <div v-if="showProgress && progress !== undefined" class="loading-progress">
        <el-progress :percentage="progress" :status="progressStatus" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'

interface Props {
  message?: string
  subMessage?: string
  size?: 'small' | 'medium' | 'large'
  fullscreen?: boolean
  showSpinner?: boolean
  showProgress?: boolean
  progress?: number
  progressStatus?: 'success' | 'exception' | 'warning'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  fullscreen: false,
  showSpinner: true,
  showProgress: false,
  progressStatus: undefined,
})

const spinnerSize = computed(() => {
  const sizeMap = {
    small: 24,
    medium: 32,
    large: 48,
  }
  return sizeMap[props.size as keyof typeof sizeMap]
})
</script>

<style scoped lang="scss">
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  &.loading-fullscreen {
    position: fixed;
    inset: 0;
    background-color: var(--color-white-90);
    z-index: var(--z-modal);
    backdrop-filter: blur(4px);
  }

  .loading-content {
    text-align: center;
  }

  .loading-spinner {
    margin-bottom: 16px;

    .spinner-icon {
      animation: spin 1s linear infinite;
      color: var(--el-color-primary);
    }
  }

  .loading-message {
    font-size: 16px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
  }

  .loading-sub-message {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin-bottom: 16px;
  }

  .loading-progress {
    width: 300px;
    margin: 0 auto;
  }

  &.loading-small {
    padding: 12px;

    .loading-message {
      font-size: 14px;
    }

    .loading-sub-message {
      font-size: 12px;
    }
  }

  &.loading-large {
    padding: 40px;

    .loading-message {
      font-size: 18px;
    }

    .loading-sub-message {
      font-size: 16px;
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

// 暗色模式支持
html.dark {
  .loading-state.loading-fullscreen {
    background-color: var(--color-black-80);
  }
}
</style>
