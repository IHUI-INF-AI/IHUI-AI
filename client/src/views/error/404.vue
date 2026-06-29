<template>
  <div class="error-page error-404">
    <h1>404</h1>
    <p>{{ t('error404.notFound') }}</p>
    <el-button @click="goHome">{{ t('error404.backHome') }}</el-button>
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
</script>
