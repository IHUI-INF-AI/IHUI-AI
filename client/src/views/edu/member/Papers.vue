<template>
  <!--
    Papers.vue — 试卷列表页（PR-E E4）
    展示学员上传的试卷列表，支持上传（跳转 PaperUpload 路由页）/ 删除
    数据来自 useStudentProfile.uploadedPapers（singleton 模式）
  -->
  <div class="member-papers">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.profile.papersTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.profile.papersSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="reload">
          {{ t('edu.profile.retry') }}
        </el-button>
        <el-button type="primary" :icon="Upload" @click="goUpload">
          {{ t('edu.profile.paperUploadBtn') }}
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

    <div v-loading="loading" class="papers-body">
      <UploadedPapersList
        :papers="uploadedPapers"
        show-header
        @delete="handleDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Upload } from '@element-plus/icons-vue'
import { useStudentProfile } from '@/composables/useStudentProfile'
import { uploadedPapersApi } from '@/api/edu/uploaded-papers'
import type { UploadedPaper } from '@/api/edu/uploaded-papers'
import UploadedPapersList from '@/components/edu/UploadedPapersList.vue'

const { t } = useI18n()
const router = useRouter()
const { loading, error, uploadedPapers, loadAll, refresh } = useStudentProfile()

function goUpload() {
  router.push({ name: 'EduMemberPaperUpload' })
}

async function handleDelete(paper: UploadedPaper) {
  try {
    await ElMessageBox.confirm(t('edu.profile.deleteConfirm'), t('edu.profile.paperDelete'), {
      type: 'warning',
      confirmButtonText: t('edu.profile.submit'),
      cancelButtonText: t('edu.profile.cancel'),
    })
    await uploadedPapersApi.delete(paper.id)
    ElMessage.success(t('edu.profile.deleteSuccess'))
    await reload()
  } catch {
    // 用户取消删除，无需处理
  }
}

async function reload() {
  await refresh('papers')
}

onMounted(loadAll)
</script>

<style scoped lang="scss">
.member-papers {
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

.papers-body {
  width: 100%;
}
</style>
