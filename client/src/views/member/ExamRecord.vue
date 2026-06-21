<template>
  <MemberLayout active="exam-record">
    <div class="member-exam-record-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberExamRecord.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberExamRecord.noRecords')" />
      <el-table v-else :data="list" stripe>
        <el-table-column prop="examName" :label="t('memberExamRecord.examPaper')" />
        <el-table-column prop="score" :label="t('memberExamRecord.score')" width="80" />
        <el-table-column prop="correctNum" :label="t('memberExamRecord.correct')" width="80" />
        <el-table-column prop="wrongNum" :label="t('memberExamRecord.wrong')" width="80" />
        <el-table-column prop="duration" :label="t('memberExamRecord.duration')" width="120" />
        <el-table-column prop="createTime" :label="t('memberExamRecord.submitTime')" />
      </el-table>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.examRecord()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-exam-record-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}
</style>
