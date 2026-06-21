<template>
  <MemberLayout active="exam-wrong">
    <div class="member-exam-wrong-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberExamWrong.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberExamWrong.empty')" />
      <div v-else class="wrong-list">
        <div v-for="w in list" :key="w.id" class="wrong-item">
          <div class="wrong-head">
            <span class="wrong-exam">{{ w.examName || w.examId }}</span>
            <el-button size="small" @click="handleRemove(w.id)">{{ t('memberExamWrong.remove') }}</el-button>
          </div>
          <div class="wrong-question">{{ w.questionTitle || w.questionId }}</div>
          <div class="wrong-row">
            <span class="label">{{ t('memberExamWrong.myAnswer') }}</span>
            <span class="value mine">{{ w.userAnswer || t('memberExamWrong.notAnswered') }}</span>
          </div>
          <div class="wrong-row">
            <span class="label">{{ t('memberExamWrong.correctAnswer') }}</span>
            <span class="value right">{{ w.correctAnswer || '—' }}</span>
          </div>
          <div v-if="w.analysis" class="wrong-row">
            <span class="label">{{ t('memberExamWrong.analysis') }}</span>
            <span class="value">{{ w.analysis }}</span>
          </div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const { t } = useI18n()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.examWrongList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

async function handleRemove(id: string) {
  try {
    await memberApi.examWrongRemove(id)
    ElMessage.success(t('memberExamWrong.removed'))
    load()
  } catch {
    ElMessage.error('移除失败，请重试')
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-exam-wrong-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.wrong-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.wrong-item) {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.wrong-head) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

:where(.wrong-exam) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:where(.wrong-question) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

:where(.wrong-row) {
  display: flex;
  gap: 8px;
  font-size: 13px;
  margin-bottom: 4px;
}

:where(.wrong-row .label) {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

:where(.value.mine) {
  color: var(--el-color-danger);
}

:where(.value.right) {
  color: var(--el-color-success);
}
</style>
