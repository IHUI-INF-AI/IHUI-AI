<template>
  <div class="api-platform-apps-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.apps.title', 'API 应用管理 (接入 AppCard)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.apps.subtitle', '集中管理 API 平台的应用，统一维护 API Key 与调用配额') }}</p>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">
        {{ t('apiService.apps.createApp', '创建应用') }}
      </el-button>
      <el-button @click="reload">
        {{ t('common.refresh', '刷新') }}
      </el-button>
    </div>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <div v-if="apps.length === 0 && !loading" class="empty-state">
      <el-empty :description="t('apiMgmt.apps.empty', '暂无应用，点击上方按钮创建第一个')" />
    </div>

    <div v-else class="app-grid">
      <AppCard
        v-for="app in apps"
        :key="app.id"
        :app="app"
        @view="onView(app)"
        @edit="onEdit(app)"
        @delete="onDelete(app)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getApps, deleteApp, type App } from '@/api/app/apps'
import { logger } from '@/utils/logger'
import AppCard from '@/components/api/AppCard.vue'

defineOptions({ name: 'AdminApiApps' })

const { t } = useI18n()
const apps = ref<App[]>([])
const loading = ref(false)
const error = ref('')

const loadApps = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getApps({ page: 1, pageSize: 50 })
    if (res.code === 0 && res.data) {
      apps.value = res.data.list || []
    } else {
      error.value = res.msg || t('apiMgmt.apps.loadFailed', '加载应用列表失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    logger.error('[ApiApps] load failed:', e)
  } finally {
    loading.value = false
  }
}

const reload = () => loadApps()

const onCreate = () => {
  ElMessage.info(t('apiMgmt.apps.createHint', '请使用 /open 路由的创建应用入口'))
}

const onView = (app: App) => {
  ElMessage.info(`${t('common.view', '查看')}: ${app.name}`)
}

const onEdit = (app: App) => {
  ElMessage.info(`${t('common.edit', '编辑')}: ${app.name}`)
}

const onDelete = async (app: App) => {
  try {
    await ElMessageBox.confirm(
      t('apiService.apps.deleteConfirm', { name: app.name }),
      t('common.confirm', '确认'),
      { type: 'warning' }
    )
    loading.value = true
    const res = await deleteApp(app.id)
    if (res.code === 0) {
      ElMessage.success(t('apiService.apps.deleteSuccess', '应用已删除'))
      await loadApps()
    } else {
      ElMessage.error(res.msg || t('apiService.apps.deleteFailed', '删除失败'))
    }
  } catch (e) {
    if (e === 'cancel') return
    logger.error('[ApiApps] delete failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadApps)
</script>

<style scoped lang="scss">
.api-platform-apps-page {
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

.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.error-banner {
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
}
</style>
