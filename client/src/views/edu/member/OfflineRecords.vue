<template>
  <div class="member-offline" role="region" :aria-label="t('edu.profile.offlineTitle')">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.offlineTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.offlineSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <Button variant="outline" className="" :disabled="loading" :aria-label="t('edu.common.retry')" @click="reload">
          <Refresh />{{ t('edu.common.retry') }}
        </Button>
        <Button variant="default" className="" :aria-label="t('edu.profile.createOffline')" @click="openCreate">
          <Plus />{{ t('edu.profile.createOffline') }}
        </Button>
      </div>
    </header>

    <Alert
      v-if="error"
      variant="destructive"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- PR-F F6：骨架屏替换 v-loading -->
    <div v-if="loading && !offlineRecords.length" class="offline-skeleton">
      <div v-for="i in 3" :key="i" class="space-y-2" style="margin-bottom: 16px">
        <div v-for="j in 3" :key="j" class="h-4 bg-muted rounded animate-pulse"></div>
      </div>
    </div>
    <div v-else v-loading="loading" class="offline-body">
      <OfflineRecordsList
        :records="offlineRecords"
        @view-all="handleViewAll"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <OfflineRecordDialog v-model:visible="dialogVisible" :record="editingRecord" @success="reload" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert } from '@/components/ui/alert'
import Button from '@/components/ui/Button.vue'
import { ElMessage, ElMessageBox } from '@/utils/message'
import { Refresh, Plus } from '@/lib/lucide-fallback'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { offlineRecordsApi } from '@/api/edu/offline-records'
import type { OfflineRecord } from '@/api/edu/offline-records'
import OfflineRecordsList from '@/components/edu/OfflineRecordsList.vue'
import OfflineRecordDialog from '@/components/edu/OfflineRecordDialog.vue'

const { t } = useI18n()
const { loading, error, offlineRecords, loadAll, refresh } = useStudentProfile()

const dialogVisible = ref(false)
const editingRecord = ref<OfflineRecord | null>(null)

function openCreate() {
  editingRecord.value = null
  dialogVisible.value = true
}

function handleEdit(record: OfflineRecord) {
  editingRecord.value = record
  dialogVisible.value = true
}

async function handleDelete(record: OfflineRecord) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.common.cancel'), {
      type: 'warning',
      confirmButtonText: t('edu.common.submit'),
      cancelButtonText: t('edu.common.cancel'),
    })
    await offlineRecordsApi.delete(record.id!)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await reload()
  } catch {
    // 用户取消删除，无需处理
  }
}

async function reload() {
  await refresh('offline')
}

function handleViewAll() {
  // 当前页就是全部线下记录列表，无需跳转
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.member-offline {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.error-alert {
  margin: 0;
}

.offline-body {
  width: 100%;
}

/* PR-F F6：骨架屏 */
.offline-skeleton {
  width: 100%;
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
}
</style>
