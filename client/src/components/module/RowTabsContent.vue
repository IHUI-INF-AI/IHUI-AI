<template>
  <div class="row-tabs-content-module">
    <div class="row" v-for="row in rows" :key="row.title">
      <div class="row-head">
        <h3 class="row-title">{{ row.title }}</h3>
        <router-link v-if="row.more" :to="row.more" class="more">{{ t('rowTabsContent.viewMore') }} →</router-link>
      </div>
      <div class="row-list">
        <div v-for="item in row.items" :key="item.id" class="row-item" @click="handleClick(item)">
          <div class="thumb" v-if="item.cover">
            <img :src="item.cover" :alt="item.title" loading="lazy" />
          </div>
          <div class="meta">
            <p class="item-title" :title="item.title">{{ item.title }}</p>
            <span class="item-sub" v-if="item.sub">{{ item.sub }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!rows || !rows.length" :description="t('rowTabsContent.noContent')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface RowItem { id: string | number; title: string; cover?: string; sub?: string; link?: string }
interface Row { title: string; more?: string; items: RowItem[] }
defineProps<{ rows?: Row[] }>()
const emit = defineEmits<{ (e: 'click', item: RowItem): void }>()
const handleClick = (item: RowItem) => emit('click', item)
</script>

<style scoped lang="scss">
:where(.row-tabs-content-module) {
  .row { margin-bottom: 20px; }

  .row-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px;
  }

  .row-title {
    margin: 0; font-size: 16px; font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .more {
    font-size: 13px; color: var(--el-text-color-secondary);
    text-decoration: none;
    &:hover { color: var(--el-color-primary); }
  }

  .row-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .row-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px; border-radius: var(--global-border-radius);
    background: var(--el-fill-color-light);
    cursor: pointer;
    transition: background 0.2s;
    &:hover { background: var(--el-color-primary-light-9); }
  }

  .thumb {
    width: 60px; height: 40px; flex-shrink: 0;
    border-radius: var(--global-border-radius); overflow: hidden;
    background: var(--el-bg-color);
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }
  .meta { min-width: 0; flex: 1; }

  .item-title {
    margin: 0 0 2px; font-size: 13px;
    color: var(--el-text-color-primary);
    overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-sub {
    font-size: 12px; color: var(--el-text-color-secondary);
  }
}
</style>
