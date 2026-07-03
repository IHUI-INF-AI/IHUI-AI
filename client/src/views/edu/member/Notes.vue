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
        <el-button type="primary" :icon="Plus" @click="openCreate">
          {{ t('edu.profile.createNote') }}
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

    <!-- PR-F F6：骨架屏替换 v-loading -->
    <div v-if="loading && !notes.length" class="notes-skeleton">
      <el-skeleton v-for="i in 3" :key="i" :rows="3" animated style="margin-bottom: 16px" />
    </div>
    <div v-else v-loading="loading" class="notes-body">
      <NotesList
        :notes="notes"
        @view-all="handleViewAll"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <NoteDialog v-model:visible="dialogVisible" :note="editingNote" @success="reload" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { notesApi } from '@/api/edu/notes'
import type { LearningNote } from '@/api/edu/notes'
import NotesList from '@/components/edu/NotesList.vue'
import NoteDialog from '@/components/edu/NoteDialog.vue'

const { t } = useI18n()
const { loading, error, notes, loadAll, refresh } = useStudentProfile()

const dialogVisible = ref(false)
const editingNote = ref<LearningNote | null>(null)

function openCreate() {
  editingNote.value = null
  dialogVisible.value = true
}

function handleEdit(note: LearningNote) {
  editingNote.value = note
  dialogVisible.value = true
}

async function handleDelete(note: LearningNote) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.profile.cancel'), {
      type: 'warning',
      confirmButtonText: t('edu.profile.submit'),
      cancelButtonText: t('edu.profile.cancel'),
    })
    await notesApi.delete(note.id)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await reload()
  } catch {
    // 用户取消删除，无需处理
  }
}

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

.header-actions {
  display: flex;
  gap: 8px;
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

/* PR-F F6：骨架屏 */
.notes-skeleton {
  width: 100%;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
}
</style>
