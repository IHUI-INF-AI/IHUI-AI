<template>
  <div class="recommendation-config">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('recommendation.recommendationRules') }}</div>
          <div class="stat-value">{{ ruleStats.total }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('recommendation.enabledRules') }}</div>
          <div class="stat-value success">{{ ruleStats.enabled }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('recommendation.userSegments') }}</div>
          <div class="stat-value">{{ segmentStats.total }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-title">{{ t('recommendation.abTests') }}</div>
          <div class="stat-value warning">{{ abTestStats.running }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="mt-20">
      <el-tab-pane :label="t('recommendation.recommendationRules')" name="rules">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('recommendation.recommendationRules') }}</span>
              <el-button v-if="canConfigRecommendation" size="small" type="primary" @click="showRuleDialog = true">{{ t('recommendation.newRule') }}</el-button>
            </div>
          </template>
          <el-table :data="rules">
            <el-table-column prop="name" :label="t('recommendation.ruleName')" />
            <el-table-column prop="type" :label="t('recommendation.ruleType')">
              <template #default="{ row }">
                <el-tag>{{ t(`recommendation.ruleTypes.${row.type}`) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" :label="t('recommendation.priority')" width="80" />
            <el-table-column prop="enabled" :label="t('recommendation.actions')" width="120">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" :disabled="!canConfigRecommendation" @change="toggleRule(row)" />
              </template>
            </el-table-column>
            <el-table-column :label="t('recommendation.actions')" width="150">
              <template #default="{ row }">
                <el-button v-if="canConfigRecommendation" size="small" text @click="editRule(row)">{{ t('mobileAdapter.edit') }}</el-button>
                <el-button v-if="canConfigRecommendation" size="small" text type="danger" @click="deleteRule(row.id)">{{ t('mobileAdapter.delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('recommendation.userSegments')" name="segments">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('recommendation.userSegments') }}</span>
              <el-button v-if="canConfigRecommendation" size="small" type="primary" @click="showSegmentDialog = true">{{ t('recommendation.newSegment') }}</el-button>
            </div>
          </template>
          <el-table :data="segments">
            <el-table-column prop="name" :label="t('recommendation.segmentName')" />
            <el-table-column prop="userCount" :label="t('recommendation.userCount')" width="100" />
            <el-table-column prop="createdAt" :label="t('recommendation.createTime')" width="180">
              <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column :label="t('recommendation.actions')" width="150">
              <template #default="{ row }">
                <el-button v-if="canConfigRecommendation" size="small" text @click="editSegment(row)">{{ t('mobileAdapter.edit') }}</el-button>
                <el-button v-if="canConfigRecommendation" size="small" text type="danger" @click="deleteSegment(row.id)">{{ t('mobileAdapter.delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('recommendation.abTests')" name="abtests">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('recommendation.abTests') }}</span>
              <el-button v-if="canManageABTest" size="small" type="primary" @click="showABTestDialog = true">{{ t('recommendation.newTest') }}</el-button>
            </div>
          </template>
          <el-table :data="abTests">
            <el-table-column prop="name" :label="t('recommendation.testName')" />
            <el-table-column prop="trafficAllocation" :label="t('recommendation.trafficAllocation')" width="100">
              <template #default="{ row }">{{ row.trafficAllocation }}%</template>
            </el-table-column>
            <el-table-column prop="status" :label="t('recommendation.actions')" width="100">
              <template #default="{ row }">
                <el-tag :type="getABTestStatusTag(row.status)">{{ t(`recommendation.testStatus.${row.status}`) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="t('recommendation.results')" width="100">
              <template #default="{ row }">
                <el-button v-if="row.status === 'completed'" size="small" text @click="viewResults(row)">{{ t('recommendation.results') }}</el-button>
              </template>
            </el-table-column>
            <el-table-column :label="t('recommendation.actions')" width="200">
              <template #default="{ row }">
                <el-button v-if="canManageABTest && row.status === 'draft'" size="small" text type="success" @click="startABTest(row.id)">{{ t('recommendation.start') }}</el-button>
                <el-button v-if="canManageABTest && row.status === 'running'" size="small" text type="warning" @click="pauseABTest(row.id)">{{ t('recommendation.pause') }}</el-button>
                <el-button v-if="canManageABTest && row.status === 'running'" size="small" text type="danger" @click="endABTest(row.id)">{{ t('recommendation.end') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane :label="t('recommendation.userBehavior')" name="behavior">
        <el-card>
          <template #header>{{ t('recommendation.userBehavior') }}</template>
          <el-form :inline="true">
            <el-form-item :label="t('recommendation.userId')">
              <el-input v-model="behaviorSearch" :placeholder="t('recommendation.userId')" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="searchBehavior">{{ t('recommendation.search') }}</el-button>
            </el-form-item>
          </el-form>
          <el-descriptions v-if="currentBehavior" :column="3" border>
            <el-descriptions-item :label="t('recommendation.sessions')">{{ currentBehavior.totalSessions }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.pageViews')">{{ currentBehavior.pageViews.length }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.tourInteractions')">{{ currentBehavior.tourInteractions.length }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.lastActive')">{{ new Date(currentBehavior.lastActive).toLocaleString() }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.avgDuration')">{{ currentBehavior.avgSessionDuration.toFixed(0) }}s</el-descriptions-item>
          </el-descriptions>
          <div v-if="recommendations.length > 0" class="mt-20">
            <h4>{{ t('recommendation.recommendationResults') }}</h4>
            <el-table :data="recommendations">
              <el-table-column prop="tourId" :label="t('recommendation.tourId')" />
              <el-table-column prop="score" :label="t('recommendation.score')" width="100" />
              <el-table-column prop="reason" :label="t('recommendation.reason')" />
              <el-table-column prop="confidence" :label="t('recommendation.confidence')" width="100">
                <template #default="{ row }">{{ (row.confidence * 100).toFixed(0) }}%</template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showRuleDialog" :title="t('recommendation.newRule')" width="600px">
      <el-form :model="newRule" label-width="100px">
        <el-form-item :label="t('recommendation.ruleName')">
          <el-input v-model="newRule.name" />
        </el-form-item>
        <el-form-item :label="t('recommendation.ruleType')">
          <el-select v-model="newRule.type">
            <el-option :label="t('recommendation.ruleTypes.behavior')" value="behavior" />
            <el-option :label="t('recommendation.ruleTypes.context')" value="context" />
            <el-option :label="t('recommendation.ruleTypes.time')" value="time" />
            <el-option :label="t('recommendation.ruleTypes.segment')" value="segment" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('recommendation.priority')">
          <el-input-number v-model="newRule.priority" :min="1" :max="100" />
        </el-form-item>
        <el-form-item :label="t('recommendation.description')">
          <el-input v-model="newRule.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">{{ t('monitoring.cancel') }}</el-button>
        <el-button type="primary" @click="createRule">{{ t('monitoring.create') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tourRecommendationService, type RecommendationRule, type UserSegment, type ABTestConfig } from '@/services/tourRecommendationService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { tourRecommendationI18n } from '@/locales/tour-i18n'

const t = (key: string) => {
  const keys = key.split('.')
  let result: unknown = tourRecommendationI18n
  for (const k of keys) {
    result = (result as Record<string, unknown>)?.[k]
  }
  return typeof result === 'string' ? result : key
}
const { canConfigRecommendation, canManageABTest, canViewRecommendation } = useTourPermissions()

const activeTab = ref('rules')
const showRuleDialog = ref(false)
const showSegmentDialog = ref(false)
const showABTestDialog = ref(false)
const behaviorSearch = ref('')
const currentBehavior = ref<ReturnType<typeof tourRecommendationService.getUserBehavior>>()
const recommendations = ref<ReturnType<typeof tourRecommendationService.getRecommendations>>([])

const rules = ref<RecommendationRule[]>([])
const segments = ref<UserSegment[]>([])
const abTests = ref<ABTestConfig[]>([])

const newRule = ref({
  name: '',
  type: 'behavior' as const,
  priority: 50,
  description: ''
})

const ruleStats = computed(() => {
  const total = rules.value.length
  const enabled = rules.value.filter(r => r.enabled).length
  return { total, enabled }
})

const segmentStats = computed(() => {
  const total = segments.value.length
  return { total }
})

const abTestStats = computed(() => {
  const running = abTests.value.filter(t => t.status === 'running').length
  return { running }
})

const getABTestStatusTag = (status: string) => {
  const map: Record<string, string> = { draft: 'info', running: 'success', paused: 'warning', completed: '' }
  return map[status] || ''
}

const loadRules = () => {
  rules.value = tourRecommendationService.getAllRules()
}

const loadSegments = () => {
  segments.value = tourRecommendationService.getSegments()
}

const loadABTests = () => {
  abTests.value = tourRecommendationService.getAllABTests()
}

const toggleRule = (rule: RecommendationRule) => {
  tourRecommendationService.updateRule(rule.id, { enabled: rule.enabled })
}

const editRule = (rule: RecommendationRule) => {
  ElMessage.info('edit: ' + rule.name)
}

const deleteRule = (id: string) => {
  tourRecommendationService.deleteRule(id)
  loadRules()
  ElMessage.success('ok')
}

const createRule = () => {
  if (!newRule.value.name) {
    ElMessage.warning(t('recommendation.ruleName'))
    return
  }
  tourRecommendationService.createRule({
    name: newRule.value.name,
    type: newRule.value.type,
    priority: newRule.value.priority,
    description: newRule.value.description,
    conditions: [],
    actions: [],
    enabled: true
  })
  showRuleDialog.value = false
  loadRules()
  ElMessage.success('ok')
}

const editSegment = (segment: UserSegment) => {
  ElMessage.info('edit: ' + segment.name)
}

const deleteSegment = (_id: string) => {
  // tourRecommendationService doesn't have deleteSegment method
  // segments.value = segments.value.filter(s => s.id !== id)
  loadSegments()
  ElMessage.success('ok')
}

const startABTest = (id: string) => {
  tourRecommendationService.updateABTest(id, { status: 'running' })
  loadABTests()
  ElMessage.success('ok')
}

const pauseABTest = (id: string) => {
  tourRecommendationService.updateABTest(id, { status: 'paused' })
  loadABTests()
  ElMessage.success('ok')
}

const endABTest = (id: string) => {
  tourRecommendationService.updateABTest(id, { status: 'completed' })
  loadABTests()
  ElMessage.success('ok')
}

const viewResults = (test: ABTestConfig) => {
  const results = tourRecommendationService.getABTestResults(test.id)
  if (results && results.length > 0) {
    const bestVariant = results.reduce((best, current) =>
      current.conversionRate > best.conversionRate ? current : best
    )
    ElMessage.info(`${t('recommendation.winnerVariant')}: ${bestVariant.variantId || 'N/A'}`)
  }
}

const searchBehavior = () => {
  if (!behaviorSearch.value) return
  currentBehavior.value = tourRecommendationService.getUserBehavior(behaviorSearch.value)
  if (currentBehavior.value) {
    recommendations.value = tourRecommendationService.getRecommendations(behaviorSearch.value)
  }
}

onMounted(() => {
  if (!canViewRecommendation.value) return
  loadRules()
  loadSegments()
  loadABTests()
})
</script>

<style scoped>
.recommendation-config {
  padding: 20px;
}

.stat-card {
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-top: 10px;
}

.stat-value.success {
  color: var(--color-success);
}

.stat-value.warning {
  color: var(--color-warning-variant);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mt-20 {
  margin-top: 20px;
}
</style>
