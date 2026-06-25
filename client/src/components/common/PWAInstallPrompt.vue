<template>
  <el-card v-if="isInstallable && !isInstalled" class="pwa-install-prompt" shadow="hover">
    <div class="prompt-content">
      <div class="prompt-icon">
        <el-icon :size="32">
          <Download />
        </el-icon>
      </div>
      <div class="prompt-text">
        <div class="prompt-title">{{ t('pwa.installTitle') }}</div>
        <div class="prompt-description">{{ t('pwa.installDescription') }}</div>
      </div>
      <div class="prompt-actions">
        <el-button type="primary" @click="handleInstall" :loading="installing">{{
          t('pwa.install')
        }}</el-button>
        <el-button @click="handleDismiss">{{ t('pwa.installLater') }}</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { usePwa } from '@/composables/usePWA'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

const { t } = useI18n()
const { isInstallable, isInstalled, install } = usePwa()
const { showSuccess } = useOperationFeedback()

const installing = ref(false)

const handleInstall = async () => {
  installing.value = true
  const success = await install()
  installing.value = false

  if (success) {
    showSuccess(t('pwa.installSuccess'))
  }
}

const handleDismiss = () => {
  localStorage.setItem('pwa-install-dismissed', Date.now().toString())
}
</script>

<style scoped lang="scss">
.pwa-install-prompt {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: var(--z-modal);
  max-width: 400px;
  border-radius: var(--global-border-radius);
  .prompt-content {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }

  .prompt-icon {
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .prompt-text {
    flex: 1;

    .prompt-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
    }

    .prompt-description {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.5;
    }
  }

  .prompt-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
}

// 移动端适配
@media (width <= 768px) {
  .pwa-install-prompt {
    bottom: 80px; // 避免与底部导航重叠
    right: 12px;
    left: 12px;
    max-width: none;
  }
}
</style>
