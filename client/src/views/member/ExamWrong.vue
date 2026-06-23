<template>
  <MemberLayout active="exam-wrong">
    <div class="member-exam-wrong-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberExamWrong.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberExamWrong.empty')" />
      <div v-else class="wrong-list">
        <div v-for="w in list" :key="w.id" class="wrong-item">
          <div class="wrong-head">
            <span class="wrong-exam">{{ w.paper_title || w.paper_id || w.exam_id }}</span>
            <el-button size="small" @click="goPaper(w)">{{ t('memberExamWrong.enterExam') }}</el-button>
            <el-button size="small" @click="handleMaster(w.id)">{{ t('memberExamWrong.master') }}</el-button>
          </div>
          <div class="wrong-question">{{ w.question_title || w.question_id }}</div>
          <div class="wrong-row">
            <span class="label">{{ t('memberExamWrong.myAnswer') }}</span>
            <span class="value mine">{{ w.user_answer || t('memberExamWrong.notAnswered') }}</span>
          </div>
          <div class="wrong-row">
            <span class="label">{{ t('memberExamWrong.correctAnswer') }}</span>
            <span class="value right">{{ w.correct_answer || '—' }}</span>
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
import { useRouter } from 'vue-router'
import { examApi } from '@/api/exam'

const { t } = useI18n()
const router = useRouter()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await examApi.wrongList({ page: 1, limit: 50 })
    const data = res?.data
    list.value = (data?.data || data?.list || data || []) as any[]
  } finally {
    loading.value = false
  }
}

async function handleMaster(id: number) {
  try {
    await (examApi as unknown as { markWrongMastered: (id: number) => Promise<unknown> }).markWrongMastered(id)
    list.value = list.value.filter((item) => item.id !== id)
    ElMessage.success(t('memberExamWrong.masteredSuccess'))
  } catch {
    ElMessage.error(t('memberExamWrong.masteredFailed'))
  }
}

function goPaper(w: any) {
  const paperId = w.paper_id || w.exam_id
  if (paperId) router.push(`/exam/${paperId}`)
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-exam-wrong-page) {
  width: 100%;
}

:where(.page-title) {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px;
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
  gap: 8px;
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
