<template>
  <el-card v-if="updateAvailable" class="pwa-update-prompt" shadow="hover">
    <div class="prompt-content">
      <div class="prompt-icon">
        <el-icon :size="24"><Refresh /></el-icon>
      </div>
      <div class="prompt-text">
        <div class="prompt-title">{{ t('pwa.updateTitle') }}</div>
        <div class="prompt-description">{{ t('pwa.updateDescription') }}</div>
      </div>
      <div class="prompt-actions">
        <el-button type="primary" size="small" @click="handleUpdate">{{ t('pwa.updateNow') }}</el-button>
        <el-button size="small" @click="handleDismiss">{{ t('pwa.updateLater') }}</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { usePwa } from '@/composables/usePWA'

const { t } = useI18n()
const { updateAvailable, applyUpdate } = usePwa()

const handleUpdate = () => applyUpdate()
const handleDismiss = () => { updateAvailable.value = false }
</script>

<style scoped lang="scss">
.pwa-update-prompt {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: var(--z-modal);
  max-width: 360px;
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);

  .prompt-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }

  .prompt-icon {
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .prompt-text {
    flex: 1;

    .prompt-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 2px;
    }

    .prompt-description {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .prompt-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
}

@media (width <= 768px) {
  .pwa-update-prompt {
    top: 8px;
    right: 8px;
    left: 8px;
    max-width: none;
  }
}
</style>
