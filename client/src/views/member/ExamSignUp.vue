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
import { memberApi } from '@/api/member'
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

async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const res: any = await memberApi.examSignUp()
    list.value = res.data?.items || res.data?.list || []
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
