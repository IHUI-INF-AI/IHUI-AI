<template>
  <div class="cache-key-analyzer">
    <div class="panel-header">
      <h3>{{ t('cacheDashboard.keyAnalysis') }}</h3>
      <div class="header-actions">
        <el-button size="small" @click="runAnalysis" :loading="analyzing">
          <el-icon><Search /></el-icon>
          {{ t('cacheDashboard.runAnalysis') }}
        </el-button>
        <el-button size="small" @click="showKeyInput = true">
          <el-icon><Plus /></el-icon>
          {{ t('cacheDashboard.addKeys') }}
        </el-button>
      </div>
    </div>

    <div v-if="analysisResult" class="analysis-content">
      <div class="overview-section">
        <div class="overview-card">
          <div class="overview-value">{{ analysisResult.keySpace.totalKeys }}</div>
          <div class="overview-label">{{ t('cacheDashboard.totalKeys') }}</div>
        </div>
        <div class="overview-card">
          <div class="overview-value">{{ formatMemory(analysisResult.keySpace.totalMemory) }}</div>
          <div class="overview-label">{{ t('cacheDashboard.totalMemory') }}</div>
        </div>
        <div class="overview-card">
          <div class="overview-value">{{ analysisResult.keySpace.keyPatterns.length }}</div>
          <div class="overview-label">{{ t('cacheDashboard.keyPatterns') }}</div>
        </div>
        <div class="overview-card">
          <div class="overview-value">{{ analysisResult.hotKeys.length }}</div>
          <div class="overview-label">{{ t('cacheDashboard.hotKeys') }}</div>
        </div>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('cacheDashboard.keyPatterns')" name="patterns">
          <div class="pattern-list">
            <el-table :data="analysisResult.keySpace.keyPatterns" size="small" max-height="300">
              <el-table-column prop="pattern" :label="t('cacheDashboard.pattern')" />
              <el-table-column prop="count" :label="t('cacheDashboard.count')" width="80" />
              <el-table-column prop="totalSize" :label="t('cacheDashboard.size')" width="100">
                <template #default="{ row }">{{ formatMemory(row.totalSize) }}</template>
              </el-table-column>
              <el-table-column prop="avgTTL" :label="t('cacheDashboard.avgTTL')" width="100">
                <template #default="{ row }">{{ formatTTL(row.avgTTL) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('cacheDashboard.hotKeys')" name="hotKeys">
          <div class="hot-keys-list">
            <el-table :data="analysisResult.hotKeys" size="small" max-height="300">
              <el-table-column prop="key" :label="t('cacheDashboard.key')" />
              <el-table-column prop="accessCount" :label="t('cacheDashboard.accessCount')" width="120" />
              <el-table-column prop="size" :label="t('cacheDashboard.size')" width="100">
                <template #default="{ row }">{{ formatMemory(row.size) }}</template>
              </el-table-column>
              <el-table-column prop="trend" :label="t('cacheDashboard.trend')" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.trend === 'increasing' ? 'success' : row.trend === 'decreasing' ? 'danger' : 'info'" size="small">
                    {{ row.trend }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('cacheDashboard.coldKeys')" name="coldKeys">
          <div class="cold-keys-list">
            <el-table :data="analysisResult.coldKeys" size="small" max-height="300">
              <el-table-column prop="key" :label="t('cacheDashboard.key')" />
              <el-table-column prop="accessCount" :label="t('cacheDashboard.accessCount')" width="120" />
              <el-table-column prop="size" :label="t('cacheDashboard.size')" width="100">
                <template #default="{ row }">{{ formatMemory(row.size) }}</template>
              </el-table-column>
              <el-table-column prop="lastAccess" :label="t('cacheDashboard.lastAccess')" width="150">
                <template #default="{ row }">{{ row.lastAccess ? formatTime(row.lastAccess) : '-' }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('cacheDashboard.distribution')" name="distribution">
          <div class="distribution-section">
            <div class="distribution-card">
              <h4>{{ t('cacheDashboard.typeDistribution') }}</h4>
              <div class="distribution-items">
                <div v-for="(count, type) in analysisResult.keySpace.typeDistribution" :key="type" class="distribution-item">
                  <span class="type-label">{{ type }}</span>
                  <el-progress :percentage="getPercentage(count, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ count }}</span>
                </div>
              </div>
            </div>
            <div class="distribution-card">
              <h4>{{ t('cacheDashboard.ttlDistribution') }}</h4>
              <div class="distribution-items">
                <div class="distribution-item">
                  <span class="type-label">{{ t('cacheDashboard.noExpiry') }}</span>
                  <el-progress :percentage="getPercentage(analysisResult.keySpace.ttlDistribution.noExpiry, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ analysisResult.keySpace.ttlDistribution.noExpiry }}</span>
                </div>
                <div class="distribution-item">
                  <span class="type-label">&lt;1h</span>
                  <el-progress :percentage="getPercentage(analysisResult.keySpace.ttlDistribution.lessThan1h, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ analysisResult.keySpace.ttlDistribution.lessThan1h }}</span>
                </div>
                <div class="distribution-item">
                  <span class="type-label">&lt;1d</span>
                  <el-progress :percentage="getPercentage(analysisResult.keySpace.ttlDistribution.lessThan1d, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ analysisResult.keySpace.ttlDistribution.lessThan1d }}</span>
                </div>
                <div class="distribution-item">
                  <span class="type-label">&lt;7d</span>
                  <el-progress :percentage="getPercentage(analysisResult.keySpace.ttlDistribution.lessThan7d, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ analysisResult.keySpace.ttlDistribution.lessThan7d }}</span>
                </div>
                <div class="distribution-item">
                  <span class="type-label">&gt;7d</span>
                  <el-progress :percentage="getPercentage(analysisResult.keySpace.ttlDistribution.moreThan7d, analysisResult.keySpace.totalKeys)" :stroke-width="10" />
                  <span class="count">{{ analysisResult.keySpace.ttlDistribution.moreThan7d }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('cacheDashboard.recommendations')" name="recommendations">
          <div class="recommendations-list">
            <div v-for="(rec, index) in analysisResult.recommendations" :key="index" class="recommendation-item" :class="rec.severity">
              <div class="rec-header">
                <el-tag :type="rec.severity === 'critical' ? 'danger' : rec.severity === 'warning' ? 'warning' : 'info'" size="small">
                  {{ rec.type }}
                </el-tag>
              </div>
              <div class="rec-content">
                <p class="rec-reason">{{ rec.reason }}</p>
                <p class="rec-action">{{ rec.action }}</p>
              </div>
              <div v-if="rec.keys.length > 0" class="rec-keys">
                <el-tag v-for="key in rec.keys.slice(0, 5)" :key="key" size="small" style="margin: 2px">{{ key }}</el-tag>
                <span v-if="rec.keys.length > 5" class="more">+{{ rec.keys.length - 5 }}</span>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-else class="empty-state">
      <el-empty :description="t('cacheDashboard.noAnalysisData')">
        <el-button type="primary" @click="showKeyInput = true">{{ t('cacheDashboard.addKeysToAnalyze') }}</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="showKeyInput" :title="t('cacheDashboard.addKeys')" width="500px">
      <el-input v-model="keysInput" type="textarea" :rows="10" :placeholder="t('cacheDashboard.keysInputPlaceholder')" />
      <template #footer>
        <el-button @click="showKeyInput = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitKeys">{{ t('cacheDashboard.analyze') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { cacheKeyAnalyzer, type KeyAnalysisResult } from '@/services/CacheKeyAnalyzer'
import { formatDateTime as formatTime } from '@/utils/format'

const { t } = useI18n()

const analysisResult = ref<KeyAnalysisResult | null>(null)
const analyzing = ref(false)
const activeTab = ref('patterns')
const showKeyInput = ref(false)
const keysInput = ref('')

const formatMemory = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const formatTTL = (seconds: number): string => {
  if (seconds < 0) return t('cacheDashboard.noExpiry')
  if (seconds < 60) return seconds + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h'
  return Math.floor(seconds / 86400) + 'd'
}

const getPercentage = (value: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

const runAnalysis = async () => {
  analyzing.value = true
  try {
    const mockKeys = Array.from({ length: 100 }, (_, i) => `cache:user:${i}:data`)
    analysisResult.value = await cacheKeyAnalyzer.analyzeKeys(mockKeys)
    ElMessage.success(t('cacheDashboard.analysisComplete'))
  } finally {
    analyzing.value = false
  }
}

const submitKeys = async () => {
  const keys = keysInput.value.split('\n').map(k => k.trim()).filter(Boolean)
  if (keys.length === 0) {
    ElMessage.warning(t('cacheDashboard.enterKeys'))
    return
  }

  showKeyInput.value = false
  analyzing.value = true
  try {
    analysisResult.value = await cacheKeyAnalyzer.analyzeKeys(keys)
    ElMessage.success(t('cacheDashboard.analysisComplete'))
  } finally {
    analyzing.value = false
  }
}

let unsubscribe: (() => void) | null = null

onMounted(() => {
  analysisResult.value = cacheKeyAnalyzer.getLatestAnalysis()
  unsubscribe = cacheKeyAnalyzer.subscribe(result => {
    analysisResult.value = result
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.cache-key-analyzer {
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.overview-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.overview-card {
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
  text-align: center;
}

.overview-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.overview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.distribution-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.distribution-card {
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
}

.distribution-card h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.distribution-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.distribution-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-label {
  min-width: 80px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.distribution-item .el-progress {
  flex: 1;
}

.count {
  min-width: 40px;
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommendation-item {
  background: var(--el-fill-color);
  border-radius: var(--global-border-radius);
  padding: 16px;
  border-left: 3px solid var(--el-color-info);
}

.recommendation-item.warning {
  border-left-color: var(--el-color-warning);
}

.recommendation-item.critical {
  border-left-color: var(--el-color-danger);
}

.rec-header {
  margin-bottom: 8px;
}

.rec-content {
  margin-bottom: 12px;
}

.rec-reason {
  margin: 0 0 4px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.rec-action {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.rec-keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.more {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty-state {
  padding: 40px;
  text-align: center;
}
</style>
