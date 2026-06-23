<template>
  <MemberLayout active="exam-sign-up">
    <div class="member-exam-signup-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberExamSignUp.title') }}</h2>
      <el-empty v-if="!list.length" :description="emptyDescription" />
      <el-table v-else :data="list" stripe>
        <el-table-column prop="examName" :label="t('memberExamSignUp.exam')" />
        <el-table-column :label="t('memberExamSignUp.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'primary'">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="score" :label="t('memberExamSignUp.score')" width="80" />
        <el-table-column prop="duration" :label="t('memberExamSignUp.duration')" width="120" />
        <el-table-column prop="startTime" :label="t('memberExamSignUp.startTime')" />
        <el-table-column :label="t('memberExamSignUp.actions')" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="goExam(row)">{{ t('memberExamSignUp.enterExam') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { examApi } from '@/api/exam'
import { useRouter } from 'vue-router'

const router = useRouter()
const list = ref<any[]>([])
const loading = ref(false)
const loadFailed = ref(false)

const emptyDescription = computed(() => {
  if (loadFailed.value) return t('memberExamSignUp.loadFailed', '报名记录加载失败，请稍后重试')
  return t('memberExamSignUp.noSignUp')
})

function statusLabel(s?: string) {
  return s === 'completed' ? t('memberExamSignUp.completed') : s === 'cancel_sign_up' ? t('memberExamSignUp.cancelled') : t('memberExamSignUp.inProgress')
}

function toSignUpRow(record: any) {
  return {
    examId: record.paper_id ?? record.examId ?? record.id,
    examName: record.paper_title ?? record.examName,
    status: record.status === 2 ? 'completed' : record.status_name === '已完成' ? 'completed' : record.status_name === '已取消' ? 'cancel_sign_up' : 'signing_up',
    score: record.score,
    totalScore: record.total_score,
    passScore: record.pass_score,
    passed: record.is_pass ?? record.passed,
    duration: record.cost_time ?? record.duration,
    startTime: record.start_time ?? record.startTime,
    submitTime: record.submit_time ?? record.submitTime,
  }
}

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const res = await examApi.records({ page: 1, limit: 50 })
    const records = ((res?.data?.data || res?.data?.list || res?.data || []) as any[])
    list.value = records.map(toSignUpRow)
  } catch {
    loadFailed.value = true
    list.value = []
  } finally {
    loading.value = false
  }
}

function goExam(row: any) {
  const id = row.examId || row.paperId || row.id
  if (id) router.push(`/exam/${id}`)
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-exam-signup-page) {
  width: 100%;
}

:where(.page-title) {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px;
}
</style>
