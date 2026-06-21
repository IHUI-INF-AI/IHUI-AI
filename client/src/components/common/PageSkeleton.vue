<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  loading?: boolean
  type?: 'list' | 'card' | 'detail' | 'table'
  count?: number
}

withDefaults(defineProps<Props>(), {
  loading: true,
  type: 'list',
  count: 3,
})
</script>

<template>
  <div v-if="loading" class="page-skeleton">
    <template v-if="type === 'list'">
      <div v-for="i in count" :key="i" class="list-skeleton-item">
        <Skeleton variant="circular" width="48" height="48" />
        <div class="list-skeleton-content">
          <Skeleton variant="text" width="60%" height="16" />
          <Skeleton variant="text" width="100%" height="14" />
          <Skeleton variant="text" width="80%" height="14" />
        </div>
      </div>
    </template>

    <template v-else-if="type === 'card'">
      <div class="card-skeleton-grid">
        <Skeleton v-for="i in count" :key="i" variant="card" />
      </div>
    </template>

    <template v-else-if="type === 'detail'">
      <div class="detail-skeleton">
        <Skeleton variant="rectangular" width="100%" height="200" />
        <div class="detail-skeleton-content">
          <Skeleton variant="text" width="40%" height="28" />
          <Skeleton variant="text" width="100%" height="14" />
          <Skeleton variant="text" width="100%" height="14" />
          <Skeleton variant="text" width="80%" height="14" />
          <div class="detail-skeleton-meta">
            <Skeleton variant="circular" width="40" height="40" />
            <div class="detail-skeleton-meta-text">
              <Skeleton variant="text" width="120" height="14" />
              <Skeleton variant="text" width="80" height="12" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'table'">
      <div class="table-skeleton">
        <div class="table-skeleton-header">
          <Skeleton v-for="i in 4" :key="i" variant="text" width="100%" height="20" />
        </div>
        <div v-for="i in count" :key="i" class="table-skeleton-row">
          <Skeleton v-for="j in 4" :key="j" variant="text" width="100%" height="16" />
        </div>
      </div>
    </template>
  </div>
  <slot v-else />
</template>

<style lang="scss" scoped>
.page-skeleton {
  padding: 16px;
}

.list-skeleton-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
}

.list-skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.detail-skeleton {
  max-width: 800px;
  margin: 0 auto;
}

.detail-skeleton-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-skeleton-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: var(--unified-border);
}

.detail-skeleton-meta-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-skeleton {
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  overflow: hidden;
}

.table-skeleton-header {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-bottom: var(--unified-border-bottom);
}

.table-skeleton-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 12px 16px;
  border-bottom: var(--unified-border-bottom);

  &:last-child {
    border-bottom: none;
  }
}
</style>
