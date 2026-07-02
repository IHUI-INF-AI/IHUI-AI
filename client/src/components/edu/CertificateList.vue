<template>
  <section class="certificate-list">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.certificates') }}</h3>
    </header>

    <el-tabs v-model="activeTab" class="cert-tabs">
      <el-tab-pane :label="t('edu.profile.onlineCerts')" name="online">
        <el-empty v-if="!certs.length" :description="t('edu.profile.empty')" />

        <el-table
          v-else
          :data="certs"
          style="width: 100%"
          row-key="id"
        >
          <el-table-column :label="t('edu.profile.certNo')" min-width="160">
            <template #default="{ row }">
              <span class="cert-no">{{ row.certificate_no || '-' }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="t('edu.profile.certTitle')" min-width="200">
            <template #default="{ row }">
              <div class="cert-title-cell">
                <span class="cert-title-text">{{ row.title || '-' }}</span>
                <a
                  v-if="row.pdf_url"
                  :href="row.pdf_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="cert-pdf-link"
                >
                  {{ t('edu.profile.viewPdf') }}
                </a>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="t('edu.profile.issueDate')" width="130">
            <template #default="{ row }">
              {{ formatDate(row.issue_date) }}
            </template>
          </el-table-column>

          <el-table-column :label="t('edu.profile.expireDate')" width="130">
            <template #default="{ row }">
              <span v-if="row.expire_date" :class="{ 'is-expired': isExpired(row.expire_date) }">
                {{ formatDate(row.expire_date) }}
              </span>
              <span v-else class="text-muted">{{ t('edu.profile.permanent') }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="t('edu.profile.score')" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.score != null" class="cert-score">{{ row.score }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="t('edu.profile.uploadedCerts')" name="uploaded">
        <el-empty v-if="!uploaded.length" :description="t('edu.profile.empty')" />

        <el-row v-else :gutter="16">
          <el-col
            v-for="item in uploaded"
            :key="item.id"
            :xs="24"
            :sm="12"
            :md="8"
          >
            <div class="uploaded-cert-card">
              <div class="cert-thumb">
                <el-image
                  v-if="isImageFile(item.file_url)"
                  :src="item.file_url"
                  fit="cover"
                  class="thumb-image"
                >
                  <template #error>
                    <div class="thumb-fallback">
                      <el-icon :size="32"><Document /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div v-else class="thumb-fallback">
                  <el-icon :size="32"><Document /></el-icon>
                </div>
                <el-tag
                  :type="getCertTypeTagType(item.cert_type)"
                  size="small"
                  effect="dark"
                  class="cert-type-tag"
                >
                  {{ getCertTypeLabel(item.cert_type) }}
                </el-tag>
              </div>

              <div class="cert-body">
                <div class="cert-card-title" :title="item.title">{{ item.title || '-' }}</div>
                <div class="cert-card-issuer" :title="item.issuer">
                  <span class="meta-label">{{ t('edu.profile.issuer') }}:</span>
                  <span class="meta-value">{{ item.issuer || '-' }}</span>
                </div>
                <div class="cert-card-date">
                  <span class="meta-label">{{ t('edu.profile.issueDate') }}:</span>
                  <span class="meta-value">{{ formatDate(item.issue_date) }}</span>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import { Document } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { EduCertificate } from '@/api/edu'
import type { UploadedCert } from '@/api/edu/uploaded-certs'

const { t } = useI18n()

defineProps<{
  certs: EduCertificate[]
  uploaded: UploadedCert[]
}>()

const activeTab = ref<'online' | 'uploaded'>('online')

function formatDate(value?: string): string {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : value
}

function isExpired(dateStr: string): boolean {
  const d = dayjs(dateStr)
  if (!d.isValid()) return false
  return d.isBefore(dayjs())
}

function isImageFile(url?: string): boolean {
  if (!url) return false
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url)
}

function getCertTypeTagType(type: string): 'primary' | 'success' | 'warning' | 'info' {
  switch (type) {
    case 'certificate':
      return 'primary'
    case 'transcript':
      return 'success'
    case 'diploma':
      return 'warning'
    default:
      return 'info'
  }
}

function getCertTypeLabel(type: string): string {
  switch (type) {
    case 'certificate':
      return t('edu.profile.certTypeCertificate')
    case 'transcript':
      return t('edu.profile.certTypeTranscript')
    case 'diploma':
      return t('edu.profile.certTypeDiploma')
    default:
      return t('edu.profile.certTypeOther')
  }
}
</script>

<style lang="scss" scoped>
:where(.certificate-list) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

:where(.section-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:where(.section-title) {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.cert-no) {
  font-family: 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

:where(.cert-title-cell) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:where(.cert-title-text) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:where(.cert-pdf-link) {
  font-size: 12px;
  color: #2563eb;
  text-decoration: none;
  width: fit-content;

  &:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }
}

:where(.cert-score) {
  font-weight: 600;
  color: var(--el-color-success);
}

:where(.text-muted) {
  color: var(--el-text-color-placeholder);
}

:where(.is-expired) {
  color: var(--el-color-danger);
}

:where(.uploaded-cert-card) {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-white-30);
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-bg-color);
  transition: border-color 0.2s ease;
  margin-bottom: 16px;

  &:hover {
    border-color: var(--color-white-50);
  }
}

:where(.cert-thumb) {
  position: relative;
  width: 100%;
  height: 140px;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

:where(.thumb-image) {
  width: 100%;
  height: 100%;
}

:where(.thumb-fallback) {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
}

:where(.cert-type-tag) {
  position: absolute;
  top: 8px;
  right: 8px;
}

:where(.cert-body) {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:where(.cert-card-title) {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.cert-card-issuer),
:where(.cert-card-date) {
  font-size: 12px;
  display: flex;
  gap: 4px;
}

:where(.meta-label) {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

:where(.meta-value) {
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:where(.certificate-list) :deep(.el-table) {
  border-radius: 8px;
  border: 1px solid var(--color-white-30);
}

:where(.certificate-list) :deep(.el-table th.el-table__cell) {
  background: var(--el-fill-color-light);
}
</style>
