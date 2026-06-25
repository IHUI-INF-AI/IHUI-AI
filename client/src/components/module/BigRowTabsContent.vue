<template>
  <div class="big-row-tabs-content-module">
    <div class="big-row" v-for="row in rows" :key="row.title">
      <div class="big-row-head" :style="{ borderColor: row.color || 'var(--el-color-primary)' }">
        <h3 class="big-row-title">{{ row.title }}</h3>
        <span v-if="row.subtitle" class="big-row-sub">{{ row.subtitle }}</span>
        <router-link v-if="row.more" :to="row.more" class="big-row-more">{{ t('bigRowTabsContent.more') }} →</router-link>
      </div>
      <div class="big-row-grid">
        <div v-for="item in row.items" :key="item.id" class="big-card" @click="handleClick(item)">
          <div class="big-cover" v-if="item.cover">
            <img :src="item.cover" :alt="item.title" loading="lazy" />
          </div>
          <div class="big-info">
            <h4 class="big-card-title" :title="item.title">{{ item.title }}</h4>
            <p class="big-card-desc" v-if="item.desc">{{ item.desc }}</p>
            <div class="big-card-foot">
              <span v-if="item.author" class="big-author">{{ item.author }}</span>
              <span v-if="item.count !== undefined" class="big-count">{{ item.count }}{{ t('bigRowTabsContent.peopleWatching') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!rows || !rows.length" :description="t('bigRowTabsContent.noContent')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
interface BigItem { id: string | number; title: string; cover?: string; desc?: string; author?: string; count?: number; link?: string }
interface BigRow { title: string; subtitle?: string; color?: string; more?: string; items: BigItem[] }
defineProps<{ rows?: BigRow[] }>()
const { t } = useI18n()
const emit = defineEmits<{ (e: 'click', item: BigItem): void }>()
const handleClick = (item: BigItem) => emit('click', item)
</script>

<style scoped lang="scss">
:where(.big-row-tabs-content-module) {
  .big-row { margin-bottom: 28px; }

  .big-row-head {
    display: flex; align-items: baseline; gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--el-color-primary);
  }

  .big-row-title {
    margin: 0; font-size: 20px; font-weight: 700;
    color: var(--el-text-color-primary);
  }

  .big-row-sub {
    font-size: 13px; color: var(--el-text-color-secondary);
  }

  .big-row-more {
    margin-left: auto;
    font-size: 13px; color: var(--el-text-color-regular);
    text-decoration: none;
    &:hover { color: var(--el-color-primary); }
  }

  .big-row-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .big-card {
    display: flex; gap: 12px;
    padding: 12px; border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    border: var(--unified-border);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--el-color-primary);
      transform: translateY(-2px);
      }
  }

  .big-cover {
    width: 100px; height: 70px; flex-shrink: 0;
    border-radius: var(--global-border-radius); overflow: hidden;
    background: var(--el-fill-color-light);
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }
  .big-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  .big-card-title {
    margin: 0 0 4px; font-size: 14px; font-weight: 500;
    color: var(--el-text-color-primary);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .big-card-desc {
    margin: 0 0 auto; font-size: 12px;
    color: var(--el-text-color-secondary);
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .big-card-foot {
    display: flex; justify-content: space-between;
    font-size: 12px; color: var(--el-text-color-placeholder);
    margin-top: 4px;
  }
}
</style>
