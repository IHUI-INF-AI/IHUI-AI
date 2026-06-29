<template>
  <MemberLayout active="certificate">
    <div class="member-certificate-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberCertificate.myCertificates') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberCertificate.noCertificate')" />
      <div v-else class="cert-grid">
        <div v-for="c in list" :key="c.id" class="cert-card">
          <div class="cert-icon">🏆</div>
          <div class="cert-name">{{ c.name }}</div>
          <div class="cert-time">{{ t('memberCertificate.issueTime') }}:{{ c.issueTime }}</div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const { t } = useI18n()
const list = ref<unknown[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await memberApi.myCertificates() as unknown as { data?: { items?: unknown[]; list?: unknown[] } }
    list.value = (res.data?.items || res.data?.list) || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-certificate-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.cert-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

:where(.cert-card) {
  padding: 24px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  text-align: center;
}

:where(.cert-icon) {
  font-size: 48px;
  margin-bottom: 12px;
}

:where(.cert-name) {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

:where(.cert-time) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
