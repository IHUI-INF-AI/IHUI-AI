<template>
  <div class="error-page error-404" role="main" aria-labelledby="error-404-heading">
    <div class="error-404-content">
      <h1 id="error-404-heading" class="error-404-title">404</h1>
      <p class="error-404-message">{{ t('error404.notFound') }}</p>
      <div class="error-404-actions">
        <el-button type="primary" @click="goHome">{{ t('error404.backHome') }}</el-button>
        <el-button @click="goBack">{{ t('common.back') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const goHome = () => {
  router.push('/')
}
const goBack = () => {
  router.back()
}
</script>

<style scoped lang="scss">
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
}

.error-404-content {
  text-align: center;
  width: 100%;
}

.error-404-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 20px;
  line-height: 1;
}

.error-404-message {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  margin: 0 0 40px;
  line-height: 1.6;
}

.error-404-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

@media (width <= 768px) {
  .error-404-title {
    font-size: 48px;
  }

  .error-404-message {
    font-size: 16px;
  }

  .error-404-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
