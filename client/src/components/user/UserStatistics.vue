<template>
  <div class="user-statistics">
    <h3 class="section-title">{{ t('userComponents.statistics.title') }}</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <el-icon :size="32"><View /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ statistics.totalViews || 0 }}</span>
          <span class="stat-label">{{ t('userComponents.statistics.totalViews') }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <el-icon :size="32"><Star /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ statistics.totalFavorites || 0 }}</span>
          <span class="stat-label">{{ t('userComponents.statistics.favorites') }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <el-icon :size="32"><ShoppingCart /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ statistics.totalOrders || 0 }}</span>
          <span class="stat-label">{{ t('userComponents.statistics.orders') }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <el-icon :size="32"><Wallet /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">¥{{ statistics.totalSpent || 0 }}</span>
          <span class="stat-label">{{ t('userComponents.statistics.totalSpent') }}</span>
        </div>
      </div>
    </div>
    
    <div class="chart-section" v-if="showChart">
      <h4>{{ t('userComponents.statistics.usageTrend') }}</h4>
      <div class="chart-placeholder">
        <p>{{ t('userComponents.statistics.chartDeveloping') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { View, Star, ShoppingCart, Wallet } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface UserStatistics {
  totalViews?: number
  totalFavorites?: number
  totalOrders?: number
  totalSpent?: number
}

const _props = defineProps<{
  statistics?: UserStatistics
  showChart?: boolean
}>()
</script>

<style scoped>
.user-statistics {
  background: var(--bg-card);
  border-radius: var(--global-border-radius);
  padding: 24px;
  box-shadow: var(--global-box-shadow);
}

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--global-box-shadow);
}

.stat-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.chart-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: var(--unified-border);
}

.chart-section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
  color: var(--text-secondary);
}
</style>
