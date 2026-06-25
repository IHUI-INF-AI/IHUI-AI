<template>
  <div class="middle-rectangle-module">
    <div class="rect-grid" v-if="list && list.length">
      <div class="rect-card" v-for="item in list" :key="item.id" @click="handleClick(item)">
        <div class="cover">
          <img v-if="item.cover" :src="item.cover" :alt="item.title" loading="lazy" />
          <div v-else class="cover-placeholder">
            <el-icon><Picture /></el-icon>
          </div>
          <span v-if="item.tag" class="tag">{{ item.tag }}</span>
        </div>
        <div class="info">
          <h3 class="title" :title="item.title">{{ item.title }}</h3>
          <p class="meta" v-if="item.author || item.count">{{ item.author || '' }}<span v-if="item.count"> · {{ item.count }} {{ t('middleRectangle.learners') }}</span></p>
          <div class="bottom">
            <span class="price" v-if="item.price !== undefined">
              <template v-if="item.price === 0">{{ t('middleRectangle.free') }}</template>
              <template v-else>¥{{ item.price }}</template>
            </span>
            <span class="level" v-if="item.level">{{ item.level }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-else :description="t('middleRectangle.noContent')" />
  </div>
</template>

<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

interface Item { id: string | number; title: string; cover?: string; author?: string; count?: number; price?: number; level?: string; tag?: string; link?: string }
defineProps<{ list?: Item[] }>()
const emit = defineEmits<{ (e: 'click', item: Item): void }>()
const handleClick = (item: Item) => emit('click', item)
</script>

<style scoped lang="scss">
:where(.middle-rectangle-module) {
  .rect-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .rect-card {
    cursor: pointer;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      }
  }

  .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: var(--el-fill-color-light);
    overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
  }

  .cover-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--el-text-color-placeholder);
    font-size: 32px;
  }

  .tag {
    position: absolute; top: 8px; left: 8px;
    padding: 2px 8px; border-radius: var(--global-border-radius);
    background: var(--el-color-primary); color: var(--el-bg-color);
    font-size: 12px;
  }
  .info { padding: 12px; }

  .title {
    margin: 0 0 6px;
    font-size: 14px; font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.4;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .meta {
    margin: 0 0 8px;
    font-size: 12px; color: var(--el-text-color-secondary);
  }

  .bottom {
    display: flex; justify-content: space-between; align-items: center;
  }
  .price { color: var(--el-color-primary); font-weight: 600; font-size: 14px; }
  .level { font-size: 12px; color: var(--el-text-color-secondary); }
}
</style>
