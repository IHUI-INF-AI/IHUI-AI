<template>
  <div class="learn-map-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnMap.breadcrumbCourse'), path: '/learn' }, { title: t('learnMap.breadcrumbMap') }]" />
    <div class="map-wrap" v-loading="loading">
      <el-empty v-if="!maps.length" :description="t('learnMap.noMaps')" />
      <div v-else class="map-list">
        <div v-for="m in maps" :key="m.id" class="map-item" @click="goDetail(m)">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="map-icon" v-html="iconFor(m.name)"></div>
          <div class="map-info">
            <div class="map-name">{{ m.name }}</div>
            <div class="map-desc">{{ t('learnMap.clickToLearn') }}</div>
          </div>
          <el-icon><ArrowRight /></el-icon>
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
import { ArrowRight } from '@element-plus/icons-vue'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import { learnApi } from '@/api/learn/learn'
import { businessIcons } from '@/assets/business-icons'

const router = useRouter()
const maps = ref<any[]>([])
const loading = ref(false)

function iconFor(_name: string) {
  return businessIcons.lesson || ''
}

async function load() {
  loading.value = true
  try {
    const res: any = await learnApi.mapList()
    maps.value = res.data || []
  } finally {
    loading.value = false
  }
}

function goDetail(m: any) {
  router.push({ path: '/learn/list', query: { cid: m.id } })
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.learn-map-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.map-wrap) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.map-list) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

:where(.map-item) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    
  }
}

:where(.map-icon) {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);

  :deep(svg) {
    width: 100%;
    height: 100%;
  }
}

:where(.map-info) {
  flex: 1;
}

:where(.map-name) {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:where(.map-desc) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
