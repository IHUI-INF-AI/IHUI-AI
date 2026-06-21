<template>
  <div class="learn-certificate-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnCertificate.breadcrumbCourse'), path: '/learn' }, { title: t('learnCertificate.breadcrumbMyCertificate') }]" />

    <div v-loading="loading" class="content">
      <el-empty v-if="!list.length" :description="t('learnCertificate.noCertificate')" />
      <div v-else class="cert-grid">
        <div v-for="c in list" :key="c.id" class="cert-card" @click="goDetail(c)">
          <div class="cert-icon">🏆</div>
          <div class="cert-name">{{ c.name }}</div>
          <div class="cert-meta">{{ t('learnCertificate.issueTime') }}:{{ c.issueTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRouter } from 'vue-router'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn'

const router = useRouter()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.certificateList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

function goDetail(c: any) {
  router.push({ path: `/learn/certificate/download/${c.id}` })
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-certificate-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.content) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.cert-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

:where(.cert-card) {
  background: var(--el-bg-color);
  padding: 24px;
  border-radius: var(--global-border-radius);
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

:where(.cert-icon) {
  font-size: 48px;
  margin-bottom: 12px;
}

:where(.cert-name) {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

:where(.cert-meta) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
