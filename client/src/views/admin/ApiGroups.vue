<template>
  <div class="api-platform-groups-page" v-loading="loading">
    <h2 class="page-title">{{ t('apiMgmt.groups.title', 'API 分组管理 (接入 GroupCard)') }}</h2>
    <p class="page-subtitle">{{ t('apiMgmt.groups.subtitle', '管理 API 模型分组，设置模型集合、并发上限与限流') }}</p>

    <div class="toolbar">
      <el-button type="primary" @click="onCreate">
        {{ t('apiService.groups.create', '创建分组') }}
      </el-button>
      <el-button @click="reload">
        {{ t('common.refresh', '刷新') }}
      </el-button>
    </div>

    <div v-if="error" class="error-banner">
      <el-alert :title="error" type="error" :closable="false" show-icon />
    </div>

    <div v-if="groups.length === 0 && !loading" class="empty-state">
      <el-empty :description="t('apiMgmt.groups.empty', '暂无分组')" />
    </div>

    <div v-else class="group-grid">
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        @view="onView(group)"
        @edit="onEdit(group)"
        @delete="onDelete(group)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getGroups, deleteGroup, type ApiGroup } from '@/api/groups'
import { logger } from '@/utils/logger'
import GroupCard from '@/components/api/GroupCard.vue'

defineOptions({ name: 'AdminApiGroups' })

const { t } = useI18n()
const groups = ref<ApiGroup[]>([])
const loading = ref(false)
const error = ref('')

const loadGroups = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await getGroups({ page: 1, pageSize: 50 })
    if (res.code === 0 && res.data) {
      groups.value = res.data.list || []
    } else {
      error.value = res.msg || t('apiMgmt.groups.loadFailed', '加载分组失败')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    logger.error('[ApiGroups] load failed:', e)
  } finally {
    loading.value = false
  }
}

const reload = () => loadGroups()

const onCreate = () => {
  ElMessage.info(t('apiMgmt.groups.createHint', '请使用 /open 路由的创建分组入口'))
}

const onView = (group: ApiGroup) => {
  ElMessage.info(`${t('common.view', '查看')}: ${group.name}`)
}

const onEdit = (group: ApiGroup) => {
  ElMessage.info(`${t('common.edit', '编辑')}: ${group.name}`)
}

const onDelete = async (group: ApiGroup) => {
  try {
    await ElMessageBox.confirm(
      t('apiService.groups.deleteConfirm', { name: group.name }),
      t('common.confirm', '确认'),
      { type: 'warning' }
    )
    loading.value = true
    const res = await deleteGroup(group.id)
    if (res.code === 0) {
      ElMessage.success(t('apiService.groups.deleteSuccess', '分组已删除'))
      await loadGroups()
    } else {
      ElMessage.error(res.msg || t('apiService.groups.deleteFailed', '删除失败'))
    }
  } catch (e) {
    if (e === 'cancel') return
    logger.error('[ApiGroups] delete failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadGroups)
</script>

<style scoped lang="scss">
.api-platform-groups-page {
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

.group-grid {
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
