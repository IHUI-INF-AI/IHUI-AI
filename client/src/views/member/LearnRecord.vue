<template>
  <MemberLayout active="learn-record">
    <div class="member-learn-record-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberLearnRecord.title') }}</h2>

      <div class="stat-row">
        <div class="stat">
          <div class="num">{{ stat.totalDays || 0 }}</div>
          <div class="label">{{ t('memberLearnRecord.learnDays') }}</div>
        </div>
        <div class="stat">
          <div class="num">{{ stat.totalMinutes || 0 }}</div>
          <div class="label">{{ t('memberLearnRecord.learnMinutes') }}</div>
        </div>
        <div class="stat">
          <div class="num">{{ stat.continuousDays || 0 }}</div>
          <div class="label">{{ t('memberLearnRecord.continuousDays') }}</div>
        </div>
        <div class="stat">
          <div class="num">{{ stat.todayMinutes || 0 }}</div>
          <div class="label">{{ t('memberLearnRecord.today') }}</div>
        </div>
      </div>

      <el-empty v-if="!list.length" :description="t('memberLearnRecord.empty')" />
      <div v-else class="record-list">
        <div v-for="r in list" :key="r.id" class="record-item">
          <div class="record-name">{{ r.lessonName || r.lessonId }}</div>
          <div class="record-progress">
            <el-progress :percentage="r.progress || 0" :stroke-width="6" />
          </div>
          <div class="record-time">{{ r.lastTime || r.createTime }}</div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/learn/member'

const { t } = useI18n()
const list = ref<any[]>([])
const stat = ref<any>({})
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [records, s] = await Promise.all([
      memberApi.learnRecord(),
      memberApi.learnStat(),
    ])
    list.value = (records as any).data?.items || (records as any).data?.list || []
    stat.value = (s as any).data || {}
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-learn-record-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.stat-row) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

:where(.stat) {
  background: var(--el-fill-color-lighter);
  padding: 16px;
  border-radius: var(--global-border-radius);
  text-align: center;
}

:where(.stat .num) {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
}

:where(.stat .label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

:where(.record-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.record-item) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.record-name) {
  flex: 0 0 200px;
  font-size: 14px;
}

:where(.record-progress) {
  flex: 1;
}

:where(.record-time) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
