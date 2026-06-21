<template>
  <div class="forbidden-container radius-auto" role="main" aria-labelledby="forbidden-heading">
    <div class="forbidden-content radius-auto">
      <h1 id="forbidden-heading" class="forbidden-title">403</h1>
      <p class="forbidden-message">{{ t('routes.forbidden') }}</p>
      <div class="forbidden-actions">
        <el-button type="primary" @click="goHome">{{ t('errorBoundary.goHome') }}</el-button>
        <el-button @click="goBack">{{ t('common.back') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useNavigation } from '@/utils/navigation'

const { t } = useI18n()
const { goHome, goBack } = useNavigation()
</script>

<style scoped lang="scss">
.forbidden-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
}

.forbidden-content {
  text-align: center;
  width: 100%;
}

.forbidden-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
  line-height: 1;
}

.forbidden-message {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  margin: 0 0 40px;
  line-height: 1.6;
}

.forbidden-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (width <= 768px) {
  .forbidden-title {
    font-size: 48px;
  }

  .forbidden-message {
    font-size: 16px;
  }
}
</style>
