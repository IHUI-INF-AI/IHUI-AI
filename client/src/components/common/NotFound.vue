<template>
  <div class="not-found">
    <h1>404</h1>
    <p>{{ t('routes.notFound') }}</p>
    <p>{{ t('errorBoundary.currentPath') }}: {{ currentPath }}</p>
    <el-button type="primary" @click="goHome">{{ t('errorBoundary.goHome') }}</el-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElButton } from 'element-plus'

const route = useRoute()
const router = useRouter()

const currentPath = computed(() => route.path)

const goHome = () => {
  router.push('/')
}
</script>

<style scoped lang="scss">
.not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  text-align: center;
  padding: 2rem;
}

.not-found h1 {
  font-size: 4rem;
  margin-bottom: 1rem;
  color: var(--color-red-ff4444);
}

.not-found p {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}
</style>
