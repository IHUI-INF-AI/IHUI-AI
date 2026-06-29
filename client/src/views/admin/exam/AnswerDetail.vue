<template>
  <div class="admin-list-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminExamAnswerDetail.title') }} #{{ route.params.id }}</h2>
    <template v-if="data.id">
      <el-descriptions :column="2" border class="desc-wrap">
        <el-descriptions-item :label="t('exam.label.user')">{{ data.userName }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.paper')">{{ data.paperTitle }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.score')">{{ data.score }} / {{ data.totalScore }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.duration')">{{ data.duration }} {{ t('adminExamAnswerDetail.minutes') }}</el-descriptions-item>
        <el-descriptions-item :label="t('exam.label.submitTime')" :span="2">{{ data.submitTime }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <h3>{{ t('adminExamAnswerDetail.answerDetail') }}</h3>
      <div v-for="(q, i) in (data.questions || [])" :key="q.id" class="answer-block">
        <p class="q-title">{{ Number(i) + 1 }}. {{ q.title }} <el-tag size="small">{{ q.score }} {{ t('adminExamAnswerDetail.points') }}</el-tag></p>
        <p class="q-answer">{{ t('adminExamAnswerDetail.userAnswer') }} {{ q.userAnswer || t('adminExamAnswerDetail.notAnswered') }}</p>
        <p class="q-correct">{{ t('adminExamAnswerDetail.correctAnswer') }} {{ q.correctAnswer }}</p>
      </div>
    </template>
    <el-empty v-else :description="t('adminExamAnswerDetail.notExist')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { adminApi } from '@/api/admin'
const route = useRoute()
const loading = ref(false)
const data = ref<unknown>({})
async function load() {
  loading.value = true
  try { data.value = (await adminApi.examAnswerDetail(route.params.id as string))?.data || {} } finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped lang="scss">
:where(.admin-list-page) {
  .page-title { margin: 0 0 16px; font-size: 22px; color: var(--el-text-color-primary); }
  .desc-wrap { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .answer-block { padding: 12px 0; border-bottom: var(--unified-border-bottom); .q-title { margin: 0 0 6px; font-size: 14px; color: var(--el-text-color-primary); } .q-answer, .q-correct { margin: 4px 0; font-size: 13px; color: var(--el-text-color-regular); } }
}
</style>
