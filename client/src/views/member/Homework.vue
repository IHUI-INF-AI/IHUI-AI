<template>
  <MemberLayout active="homework">
    <div class="member-homework-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberHomework.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberHomework.empty')" />
      <div v-else class="hw-list">
        <div v-for="hw in list" :key="hw.id" class="hw-item">
          <div class="hw-info">
            <div class="hw-title">{{ hw.title }}</div>
            <div class="hw-content">{{ hw.content }}</div>
            <div class="hw-meta">
              <span>{{ t('memberHomework.deadline') }}{{ hw.deadline || '—' }}</span>
              <span>{{ t('memberHomework.status') }}{{ statusLabel(hw.submitStatus) }}</span>
            </div>
          </div>
          <el-button
            :type="hw.submitStatus === 'submitted' ? 'success' : 'primary'"
            :disabled="hw.submitStatus === 'submitted'"
          >
            {{ hw.submitStatus === 'submitted' ? t('memberHomework.submitted') : t('memberHomework.submit') }}
          </el-button>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const list = ref<unknown[]>([])
const loading = ref(false)

function statusLabel(s?: string) {
  return s === 'submitted' ? '已提交' : s === 'graded' ? '已批改' : '待提交'
}

async function load() {
  loading.value = true
  try {
    const res = await memberApi.myHomework() as unknown as { data?: { items?: unknown[]; list?: unknown[] } }
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-homework-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.hw-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.hw-item) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.hw-info) {
  flex: 1;
}

:where(.hw-title) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

:where(.hw-content) {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.hw-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
