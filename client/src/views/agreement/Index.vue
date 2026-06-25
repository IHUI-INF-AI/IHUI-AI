<!--
  协议详情页（用户协议 / 隐私政策 / 服务条款等）
  迁移自 H:\edu client\web\web\src\views\agreement\index.vue
  通过路由 :type 切换不同协议类型，由后端 setting-service 提供内容
-->
<template>
  <div class="agreement-container">
    <div class="agreement-content" v-safe-html="agreement.content" />
    <el-empty v-if="!loading && !agreement.content" :description="t('agreementPage.contentNotConfigured')" />
    <div v-else-if="loading" class="loading">{{ t('agreementPage.loading') }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getAgreement } from '@/api/settings'

const { t } = useI18n()
const route = useRoute()
const agreement = ref<{ title?: string; content?: string }>({})
const loading = ref(false)

const type = String(route.params.type || 'user')

onMounted(async () => {
  loading.value = true
  try {
    const res: any = await getAgreement({ type })
    agreement.value = res?.data || res || {}
  } catch {
    ElMessage.warning('协议内容加载失败')
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.agreement-container {
  margin: 60px auto 40px;
  background: var(--el-fill-color-blank);
  max-width: 1200px;
  padding: clamp(20px, 4vw, 40px);
  border: 1px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
}
.agreement-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
}
.loading {
  text-align: center;
  padding: 60px 0;
  color: var(--el-text-color-secondary);
}
</style>
