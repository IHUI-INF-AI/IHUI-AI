<template>
  <!--
    MyCertificates.vue — 我的证书页
    展示已获得的课程证书卡片列表，支持查看 PDF / 下载
    路由: EduLearnCertificate (/edu/learn/certificate)
  -->
  <div class="my-certs">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.learn.myCerts') }}</h1>
        <p class="page-subtitle">{{ t('edu.learn.certsSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadCerts">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <div v-loading="loading" class="certs-body">
      <el-empty
        v-if="!loading && !certificates.length"
        :description="t('edu.learn.noCerts')"
      />
      <div v-else class="cert-grid">
        <el-card
          v-for="cert in certificates"
          :key="cert.id"
          class="cert-card"
          shadow="hover"
        >
          <div class="cert-head">
            <div class="cert-icon">
              <el-icon :size="40"><Certificate /></el-icon>
            </div>
            <div class="cert-head-info">
              <h3 class="cert-title" :title="cert.title">{{ cert.title }}</h3>
              <span class="cert-no">{{ t('edu.profile.certNo') }}: {{ cert.certificate_no }}</span>
            </div>
          </div>

          <div class="cert-meta">
            <div class="meta-row">
              <span class="meta-label">{{ t('edu.profile.issueDate') }}</span>
              <span class="meta-value">{{ cert.issue_date }}</span>
            </div>
            <div v-if="cert.expire_date" class="meta-row">
              <span class="meta-label">{{ t('edu.profile.expireDate') }}</span>
              <span class="meta-value">{{ cert.expire_date }}</span>
            </div>
            <div v-if="cert.score !== undefined && cert.score !== null" class="meta-row">
              <span class="meta-label">{{ t('edu.profile.score') }}</span>
              <span class="meta-value cert-score">{{ cert.score }}</span>
            </div>
          </div>

          <div class="cert-actions">
            <el-button
              v-if="cert.pdf_url"
              type="primary"
              size="small"
              :icon="View"
              @click="viewPdf(cert.pdf_url!)"
            >
              {{ t('edu.profile.viewPdf') }}
            </el-button>
            <el-button
              v-if="cert.pdf_url"
              size="small"
              :icon="Download"
              @click="downloadPdf(cert.pdf_url!)"
            >
              {{ t('edu.learn.downloadCert') }}
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Refresh, View, Download, Certificate } from '@element-plus/icons-vue'
import { learnApi, type EduCertificate } from '@/api/edu'

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const certificates = ref<EduCertificate[]>([])

async function loadCerts() {
  loading.value = true
  error.value = false
  try {
    const res = await learnApi.myCertificates()
    certificates.value = res.data?.data ?? []
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function viewPdf(url: string) {
  window.open(url, '_blank')
}

function downloadPdf(url: string) {
  // 触发下载：通过 a 标签 download
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

onMounted(loadCerts)
</script>

<style scoped lang="scss">
.my-certs {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.certs-body {
  width: 100%;
  min-height: 200px;
}

.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.cert-card {
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

.cert-card:hover {
  border-color: var(--el-color-primary);
}

.cert-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.cert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  border-radius: 8px;
  flex-shrink: 0;
}

.cert-head-info {
  flex: 1;
  min-width: 0;
}

.cert-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cert-no {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cert-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.meta-label {
  color: var(--el-text-color-secondary);
}

.meta-value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.cert-score {
  color: var(--el-color-success);
  font-size: 15px;
  font-weight: 700;
}

.cert-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
