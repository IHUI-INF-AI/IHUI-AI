<template>
  <div class="user-purchases">
    <h3 class="section-title">{{ t('userComponents.purchases.title') }}</h3>
    <div class="purchases-list">
      <div v-for="item in purchases" :key="item.id" class="purchase-item">
        <div class="item-image">
          <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
          <div v-else class="no-image">
            <el-icon :size="32"><ShoppingBag /></el-icon>
          </div>
        </div>
        <div class="item-content">
          <h4 class="item-title">{{ item.title }}</h4>
          <p class="item-desc">{{ item.description }}</p>
          <div class="item-meta">
            <span class="item-price">¥{{ item.price }}</span>
            <span class="item-time">{{ formatTime(item.purchaseTime) }}</span>
          </div>
        </div>
        <div class="item-actions">
          <el-button type="primary" link @click="handleView(item)">{{ t('userComponents.purchases.view') }}</el-button>
          <el-button type="success" link @click="handleDownload(item)">{{ t('userComponents.purchases.download') }}</el-button>
        </div>
      </div>
      <div v-if="purchases.length === 0" class="empty-state">
        <el-icon :size="48"><ShoppingBag /></el-icon>
        <p>{{ t('userComponents.purchases.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShoppingBag } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()

interface PurchaseItem {
  id: string
  title: string
  description?: string
  image?: string
  price: number
  purchaseTime: string
}

const _props = defineProps<{
  purchases?: PurchaseItem[]
}>()

const emit = defineEmits<{
  (e: 'view', item: PurchaseItem): void
  (e: 'download', item: PurchaseItem): void
}>()

const formatTime = (time: string) => _formatTime(time, 'YYYY-MM-DD')

const handleView = (item: PurchaseItem) => {
  emit('view', item)
}

const handleDownload = (item: PurchaseItem) => {
  emit('download', item)
}
</script>

<style scoped>
.user-purchases {
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

.purchases-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.purchase-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: background 0.2s;
}

.purchase-item:hover {
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

.item-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.item-price {
  font-size: 16px;
  font-weight: 600;
  color: var(--danger-color);
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
