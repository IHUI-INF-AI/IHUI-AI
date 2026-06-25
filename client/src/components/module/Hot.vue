<template>
  <div class="hot-module">
    <div class="module-header">
      <h2 class="head-title">
        <router-link :to="{ path: type }">{{ title }}</router-link>
      </h2>
      <a class="refresh" @click="handleRefresh">
        <el-icon><Refresh /></el-icon>
        <span>{{ t('moduleHot.refresh') }}</span>
      </a>
    </div>
    <div v-loading="loading" class="hot-grid">
      <el-empty v-if="!list.length" :description="t('moduleHot.noRecommendation')" />
      <Rectangle
        v-for="item in list"
        :key="item.id"
        :item="item"
        :link="`/${type}/detail`"
        class="hot-item"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import Rectangle from './Rectangle.vue'

withDefaults(
  defineProps<{
    title?: string
    type?: string
    list: any[]
    loading?: boolean
  }>(),
  { title: '热门推荐', type: 'learn', loading: false }
)

const emit = defineEmits<{ refresh: [] }>()

function handleRefresh() {
  emit('refresh')
}
</script>

<style lang="scss" scoped>
:where(.hot-module) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto 24px;
  padding: 0 12px;
}

:where(.module-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .head-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;

    a {
      color: var(--el-text-color-primary);
      text-decoration: none;
    }
  }

  .refresh {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
    }
  }
}

:where(.hot-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

:where(.hot-item) {
  min-width: 0;
}
</style>
