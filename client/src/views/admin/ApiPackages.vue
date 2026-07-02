<template>
  <div class="api-platform-packages-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.packages.title', 'API 套餐管理 (接入 PackageCard)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.packages.subtitle', '管理 API 套餐，配置价格、有效期、关联应用与配额') }}</p>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">
        {{ t('apiService.packages.create', '创建套餐') }}
      </el-button>
      <el-button @click="reload">
        {{ t('common.refresh', '刷新') }}
      </el-button>
    </div>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <div v-if="packages.length === 0 && !loading" class="empty-state">
      <el-empty :description="t('apiMgmt.packages.empty', '暂无套餐')" />
    </div>

    <div v-else class="package-grid">
      <PackageCard
        v-for="pkg in packages"
        :key="pkg.id"
        :package="pkg"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getPackages, type Package } from '@/api/packages'
import { logger } from '@/utils/logger'
import PackageCard from '@/components/api/PackageCard.vue'

defineOptions({ name: 'AdminApiPackages' })

const { t } = useI18n()
const packages = ref<Package[]>([])
const loading = ref(false)
const error = ref('')

const loadPackages = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getPackages({ page: 1, pageSize: 50 })
    if (res.code === 0 && res.data) {
      packages.value = res.data.list || []
    } else {
      error.value = res.msg || t('apiMgmt.packages.loadFailed', '加载套餐失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    logger.error('[ApiPackages] load failed:', e)
  } finally {
    loading.value = false
  }
}

const reload = () => loadPackages()

const onCreate = () => {
  ElMessage.info(t('apiMgmt.packages.createHint', '请使用 /open 路由的创建套餐入口'))
}

onMounted(loadPackages)
</script>

<style scoped lang="scss">
.api-platform-packages-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.package-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.error-banner {
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
}
</style>
