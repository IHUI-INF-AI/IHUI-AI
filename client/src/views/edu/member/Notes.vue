<template>
  <div class="member-notes">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.notesTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.notesSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="reload">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="notes-body">
      <NotesList :notes="notes" @view-all="handleViewAll" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Refresh } from '@element-plus/icons-vue'
import { useStudentProfile } from '@/composables/useStudentProfile'
import NotesList from '@/components/edu/NotesList.vue'

const { t } = useI18n()
const { loading, error, notes, loadAll, refresh } = useStudentProfile()

async function reload() {
  await refresh('notes')
}

function handleViewAll() {
  // 当前页就是全部笔记列表，无需跳转
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.member-notes {
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

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.notes-body {
  width: 100%;
}
</style>
