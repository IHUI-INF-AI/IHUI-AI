<template>
  <div class="learn-homework-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnHomework.course'), path: '/learn' }, { title: t('learnHomework.homework') }]" />

    <div v-loading="loading" class="content">
      <el-empty v-if="!list.length" :description="t('learnHomework.empty')" />
      <div v-else class="hw-list">
        <div v-for="hw in list" :key="hw.id" class="hw-item">
          <div class="hw-info">
            <h3 class="hw-title">{{ hw.title }}</h3>
            <p class="hw-content">{{ hw.content }}</p>
            <div class="hw-meta">
              <span>{{ t('learnHomework.deadline') }}{{ hw.deadline || '—' }}</span>
              <span>{{ t('learnHomework.status') }}{{ statusLabel(hw.submitStatus) }}</span>
              <span v-if="hw.score != null">{{ t('learnHomework.score') }}{{ hw.score }}</span>
            </div>
          </div>
          <el-button
            :type="hw.submitStatus === 'submitted' ? 'success' : 'primary'"
            :disabled="hw.submitStatus === 'submitted'"
            @click="handleSubmit(hw)"
          >
            {{ hw.submitStatus === 'submitted' ? t('learnHomework.submitted') : t('learnHomework.submit') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn/learn'

const list = ref<any[]>([])
const loading = ref(false)

function statusLabel(s?: string) {
  return s === 'submitted' ? '已提交' : s === 'graded' ? '已批改' : '待提交'
}

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.homeworkList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

function handleSubmit(hw: any) {
  // 简化:弹窗录入
  hw.submitStatus = 'submitted'
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-homework-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.hw-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.hw-item) {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--el-bg-color);
  padding: 16px;
  border-radius: var(--global-border-radius);
}

:where(.hw-info) {
  flex: 1;
}

:where(.hw-title) {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
}

:where(.hw-content) {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.hw-meta) {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
