<template>
  <MemberLayout active="exam-record">
    <div class="member-exam-record-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberExamRecord.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberExamRecord.noRecords')" />
      <el-table v-else :data="list" stripe @row-click="goDetail">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="paper_title" :label="t('memberExamRecord.examPaper')" min-width="220" />
        <el-table-column prop="score" :label="t('memberExamRecord.score')" width="100" />
        <el-table-column prop="total_score" :label="t('memberExamRecord.totalScore')" width="100" />
        <el-table-column prop="correct_num" :label="t('memberExamRecord.correct')" width="100" />
        <el-table-column prop="wrong_num" :label="t('memberExamRecord.wrong')" width="100" />
        <el-table-column prop="duration" :label="t('memberExamRecord.duration')" width="120" />
        <el-table-column prop="submit_time" :label="t('memberExamRecord.submitTime')" min-width="180" />
      </el-table>
      <div class="record-tip">
        <span>{{ t('memberExamRecord.detailTip', '点击记录可查看答题详情') }}</span>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { useRouter } from 'vue-router'
import { examApi } from '@/api/learn/exam'

const router = useRouter()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await examApi.records({ page: 1, limit: 50 })
    const data = res?.data
    list.value = (data?.data || data?.list || data || []) as any[]
  } finally {
    loading.value = false
  }
}

function goDetail(row: any) {
  const id = row.id ?? row.recordId
  if (id) router.push(`/member/exam-record/${id}`)
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-exam-record-page) {
  width: 100%;
}

:where(.page-title) {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px;
}

.record-tip {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
