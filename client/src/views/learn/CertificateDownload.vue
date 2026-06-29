<template>
  <div class="learn-cert-download-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="breadcrumbItems" />

    <div v-loading="loading" class="content">
      <el-empty v-if="!cert.id" :description="t('learnCertificateDownload.notExist')" />
      <div v-else class="cert-preview">
        <div class="cert-card">
          <div class="cert-banner">{{ t('learnCertificateDownload.banner') }}</div>
          <h1 class="cert-name">{{ cert.name }}</h1>
          <p class="cert-text">{{ t('learnCertificateDownload.certText') }}</p>
          <div class="cert-time">{{ t('learnCertificateDownload.issueTime') }}{{ cert.issueTime }}</div>
        </div>
        <div class="actions">
          <el-button type="primary" @click="handleDownload">{{ t('learnCertificateDownload.download') }}</el-button>
          <el-button @click="handlePrint">{{ t('learnCertificateDownload.print') }}</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn'

const { t } = useI18n()
const route = useRoute()
const id = String(route.params.id || '')

const cert = ref<Record<string, unknown>>({})
const loading = ref(false)

const breadcrumbItems = computed(() => [
  { title: t('learnCertificateDownload.breadcrumbCourse'), path: '/learn' },
  { title: t('learnCertificateDownload.breadcrumbCert'), path: '/learn/certificate' },
  { title: (cert.value.name as string) || t('learnCertificateDownload.download') },
])

async function load() {
  loading.value = true
  try {
    const res = await learnApi.certificateDetail(id) as unknown as { data?: Record<string, unknown> }
    cert.value = res.data || {}
  } finally {
    loading.value = false
  }
}

function handleDownload() {
  ElMessage.info(t('learnCertificateDownload.downloadStart'))
}

function handlePrint() {
  window.print()
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-cert-download-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 12px;
}

:where(.cert-preview) {
  text-align: center;
}

:where(.cert-card) {
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color));
  border: 2px solid var(--el-color-primary);
  border-radius: var(--global-border-radius);
  padding: 60px 40px;
  margin-bottom: 24px;
}

:where(.cert-banner) {
  font-size: 14px;
  letter-spacing: 6px;
  color: var(--el-color-primary);
  margin-bottom: 24px;
}

:where(.cert-name) {
  margin: 0 0 24px;
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

:where(.cert-text) {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

:where(.cert-time) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.actions) {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
