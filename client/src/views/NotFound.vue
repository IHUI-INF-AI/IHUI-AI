<template>
  <div class="not-found-container radius-auto" role="main" aria-labelledby="not-found-heading">
    <div class="not-found-content radius-auto">
      <h1 id="not-found-heading" class="not-found-title">404</h1>
      <p class="not-found-message">{{ t('routes.notFound') }}</p>
      <div class="not-found-actions">
        <el-button type="primary" @click="goHome">{{ t('errorBoundary.goHome') }}</el-button>
        <el-button @click="goBack">{{ t('common.back') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onMounted } from 'vue'
import { useNavigation } from '@/utils/navigation'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const route = useRoute() as ReturnType<typeof useRoute> & {
  fullPath: string
}
const { goHome, goBack } = useNavigation()

onMounted(() => {
  // 404 页面正常展示，不触发 ErrorEvent 避免被 ErrorBoundary 拦截
})
</script>

<style scoped lang="scss">
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
}

.not-found-content {
  text-align: center;
  width: 100%;
}

.not-found-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
  line-height: 1;
}

.not-found-message {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  margin: 0 0 40px;
  line-height: 1.6;
}

.not-found-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (width <= 768px) {
  .not-found-title {
    font-size: 48px;
  }

  .not-found-message {
    font-size: 16px;
  }

  .not-found-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
