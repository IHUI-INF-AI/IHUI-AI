<template>
  <div class="agents-empty-state">
    <div class="empty-illustration">
      <el-icon :size="120" class="empty-icon">
        <Server />
      </el-icon>
    </div>
    <h3 class="empty-title">{{ t('agents.noAgents') }}</h3>
    <p class="empty-description">
      {{ t('agents.emptyDescription') }}
    </p>
    <div class="empty-actions">
      <el-button type="primary" size="large" @click="handleCreate">
        {{ t('agents.createAgent') }}
      </el-button>
      <el-button @click="handleClearFilters">
        {{ t('agents.clearFilters') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Server } from '@/lib/lucide-fallback'

interface Emits {
  (e: 'create'): void
  (e: 'clearFilters'): void
}

const { t } = useI18n()
const emit = defineEmits<Emits>()

const handleCreate = () => {
  emit('create')
}

const handleClearFilters = () => {
  emit('clearFilters')
}
</script>

<style scoped lang="scss">
// 组件级 CSS 变量定义
.agents-empty-state {
  // 主按钮变量
  --aes-btn-bg: var(--el-text-color-primary);
  --aes-btn-bg-hover: var(--color-dark-bg-3);
  --aes-btn-bg-active: var(--color-gray-333);

  // 2026-07-04 修复: var(--el-bg-color) 是背景 token, 误用作文字色 token 定义
  --aes-btn-color: var(--app-button-text-on-primary);
  --aes-btn-border: none;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  min-height: 400px;

  .empty-illustration {
    position: relative;
    margin-bottom: 32px;

    .empty-icon {
      color: var(--el-color-info-light-5);
      animation: float 3s ease-in-out infinite;
    }
  }

  .empty-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 12px;
  }

  .empty-description {
    font-size: 15px;
    color: var(--el-text-color-regular);
    margin: 0 0 32px;
    max-width: 480px;
    line-height: 1.6;
  }

  // 操作按钮区域 - 使用高特异性选择器
  .empty-actions {
    display: flex;
    gap: 12px;

    :deep(.el-button.el-button--primary) {
      background: var(--aes-btn-bg);
      border: var(--aes-btn-border);
      color: var(--aes-btn-color);
      box-shadow: none;

      span,
      .el-button__text,
      .el-icon {
        color: var(--aes-btn-color);
      }

      &:hover,
      &:focus {
        background: var(--aes-btn-bg-hover);
        border-color: var(--aes-btn-bg-hover);
        color: var(--aes-btn-color);
        box-shadow: none;

        span,
        .el-button__text,
        .el-icon {
          color: var(--aes-btn-color);
        }
      }

      &:active {
        background: var(--aes-btn-bg-active);
        border-color: var(--aes-btn-bg-active);
        color: var(--aes-btn-color);

        span,
        .el-button__text,
        .el-icon {
          color: var(--aes-btn-color);
        }
      }
    }
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

// 暗色模式 - 使用变量覆盖：纯白背景 + 黑字
:global(html.dark) .agents-empty-state,
html.dark .agents-empty-state,
.login-content.login-page.dark-mode .agents-empty-state {
  --aes-btn-bg: var(--el-bg-color);
  --aes-btn-bg-hover: var(--color-neutral-e6);
  --aes-btn-bg-active: var(--color-gray-ccc);
  --aes-btn-color: var(--el-text-color-primary);
}
</style>
