<template>
  <div class="user-favorites">
    <h3 class="section-title">{{ t('userComponents.favorites.title') }}</h3>
    <div class="favorites-list">
      <div v-for="item in favorites" :key="item.id" class="favorite-item">
        <div class="item-image">
          <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
          <div v-else class="no-image">
            <el-icon :size="32"><Star /></el-icon>
          </div>
        </div>
        <div class="item-content">
          <h4 class="item-title">{{ item.title }}</h4>
          <p class="item-desc">{{ item.description }}</p>
          <span class="item-time">{{ formatTime(item.createTime) }}</span>
        </div>
        <div class="item-actions">
          <el-button type="primary" link @click="handleView(item)">{{ t('userComponents.favorites.view') }}</el-button>
          <el-button type="danger" link @click="handleRemove(item.id)">{{ t('userComponents.favorites.remove') }}</el-button>
        </div>
      </div>
      <div v-if="favorites.length === 0" class="empty-state">
        <el-icon :size="48"><Star /></el-icon>
        <p>{{ t('userComponents.favorites.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Star } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

interface FavoriteItem {
  id: string
  title: string
  description?: string
  image?: string
  createTime: string
}

const _props = defineProps<{
  favorites?: FavoriteItem[]
}>()

const emit = defineEmits<{
  (e: 'view', item: FavoriteItem): void
  (e: 'remove', id: string): void
}>()

const formatTime = (time: string) => _formatTime(time, 'YYYY-MM-DD')

const handleView = (item: FavoriteItem) => {
  emit('view', item)
}

const handleRemove = (id: string) => {
  emit('remove', id)
}
</script>

<style scoped>
.user-favorites {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  }

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.favorite-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.favorite-item:hover {
  background: var(--bg-hover);
}

.item-image {
  width: 80px;
  height: 80px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-secondary);
}

.empty-state .el-icon {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
