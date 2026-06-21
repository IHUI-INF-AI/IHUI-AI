<template>
  <MemberLayout active="resource">
    <div class="member-resource-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberResource.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberResource.empty')" />
      <div v-else class="resource-list">
        <div v-for="r in list" :key="r.id" class="resource-item">
          <div class="resource-icon">📎</div>
          <div class="resource-info">
            <div class="resource-name">{{ r.name || r.title }}</div>
            <div class="resource-meta">
              <span>{{ r.size || '—' }}</span>
              <span>{{ r.downloadNum || 0 }} {{ t('memberResource.downloads') }}</span>
              <span>{{ r.createTime }}</span>
            </div>
          </div>
          <el-button size="small">{{ t('memberResource.download') }}</el-button>
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

const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.myResourceList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-resource-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.resource-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.resource-item) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.resource-icon) {
  font-size: 32px;
}

:where(.resource-info) {
  flex: 1;
}

:where(.resource-name) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

:where(.resource-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
