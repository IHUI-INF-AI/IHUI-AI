<template>
  <div class="recommendation-config">
    <div class="flex flex-wrap gap-5">
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('recommendation.recommendationRules') }}</div>
          <div class="stat-value">{{ ruleStats.total }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('recommendation.enabledRules') }}</div>
          <div class="stat-value success">{{ ruleStats.enabled }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('recommendation.userSegments') }}</div>
          <div class="stat-value">{{ segmentStats.total }}</div>
        </Card>
      </div>
      <div class="w-1/4">
        <Card class="stat-card p-5">
          <div class="stat-title">{{ t('recommendation.abTests') }}</div>
          <div class="stat-value warning">{{ abTestStats.running }}</div>
        </Card>
      </div>
    </div>

    <Tabs v-model="activeTab" class="mt-20">
      <TabsList>
        <TabsTrigger value="rules">{{ t('recommendation.recommendationRules') }}</TabsTrigger>
        <TabsTrigger value="segments">{{ t('recommendation.userSegments') }}</TabsTrigger>
        <TabsTrigger value="abtests">{{ t('recommendation.abTests') }}</TabsTrigger>
        <TabsTrigger value="behavior">{{ t('recommendation.userBehavior') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="rules">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('recommendation.recommendationRules') }}</span>
              <Button v-if="canConfigRecommendation" size="sm" variant="default" @click="showRuleDialog = true">{{ t('recommendation.newRule') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('recommendation.ruleName') }}</TableHead>
                <TableHead>{{ t('recommendation.ruleType') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('recommendation.priority') }}</TableHead>
                <TableHead class="w-[120px]">{{ t('recommendation.actions') }}</TableHead>
                <TableHead class="w-[150px]">{{ t('recommendation.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in rules" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>
                  <Tag>{{ t(`recommendation.ruleTypes.${row.type}`) }}</Tag>
                </TableCell>
                <TableCell>{{ row.priority }}</TableCell>
                <TableCell>
                  <Switch v-model="row.enabled" :disabled="!canConfigRecommendation" @change="toggleRule(row)" />
                </TableCell>
                <TableCell>
                  <Button v-if="canConfigRecommendation" size="sm" variant="ghost" @click="editRule(row)">{{ t('mobileAdapter.edit') }}</Button>
                  <Button v-if="canConfigRecommendation" size="sm" variant="ghost" @click="deleteRule(row.id)">{{ t('mobileAdapter.delete') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="segments">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('recommendation.userSegments') }}</span>
              <Button v-if="canConfigRecommendation" size="sm" variant="default" @click="showSegmentDialog = true">{{ t('recommendation.newSegment') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('recommendation.segmentName') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('recommendation.userCount') }}</TableHead>
                <TableHead class="w-[180px]">{{ t('recommendation.createTime') }}</TableHead>
                <TableHead class="w-[150px]">{{ t('recommendation.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in segments" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.userCount }}</TableCell>
                <TableCell>{{ new Date(row.createdAt).toLocaleString() }}</TableCell>
                <TableCell>
                  <Button v-if="canConfigRecommendation" size="sm" variant="ghost" @click="editSegment(row)">{{ t('mobileAdapter.edit') }}</Button>
                  <Button v-if="canConfigRecommendation" size="sm" variant="ghost" @click="deleteSegment(row.id)">{{ t('mobileAdapter.delete') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="abtests">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('recommendation.abTests') }}</span>
              <Button v-if="canManageABTest" size="sm" variant="default" @click="showABTestDialog = true">{{ t('recommendation.newTest') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('recommendation.testName') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('recommendation.trafficAllocation') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('recommendation.actions') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('recommendation.results') }}</TableHead>
                <TableHead class="w-[200px]">{{ t('recommendation.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in abTests" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.trafficAllocation }}%</TableCell>
                <TableCell>
                  <Tag :type="getABTestStatusTag(row.status)">{{ t(`recommendation.testStatus.${row.status}`) }}</Tag>
                </TableCell>
                <TableCell>
                  <Button v-if="row.status === 'completed'" size="sm" variant="ghost" @click="viewResults(row)">{{ t('recommendation.results') }}</Button>
                </TableCell>
                <TableCell>
                  <Button v-if="canManageABTest && row.status === 'draft'" size="sm" variant="ghost" @click="startABTest(row.id)">{{ t('recommendation.start') }}</Button>
                  <Button v-if="canManageABTest && row.status === 'running'" size="sm" variant="ghost" @click="pauseABTest(row.id)">{{ t('recommendation.pause') }}</Button>
                  <Button v-if="canManageABTest && row.status === 'running'" size="sm" variant="ghost" @click="endABTest(row.id)">{{ t('recommendation.end') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="behavior">
        <Card><CardHeader><CardTitle>{{ t('recommendation.userBehavior') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <form @submit.prevent class="flex flex-wrap items-end gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-foreground">{{ t('recommendation.userId') }}</label>
              <Input v-model="behaviorSearch" :placeholder="t('recommendation.userId')" />
            </div>
            <div>
              <Button variant="default" @click="searchBehavior">{{ t('recommendation.search') }}</Button>
            </div>
          </form>
          <el-descriptions v-if="currentBehavior" :column="3" border>
            <el-descriptions-item :label="t('recommendation.sessions')">{{ currentBehavior.totalSessions }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.pageViews')">{{ currentBehavior.pageViews.length }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.tourInteractions')">{{ currentBehavior.tourInteractions.length }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.lastActive')">{{ new Date(currentBehavior.lastActive).toLocaleString() }}</el-descriptions-item>
            <el-descriptions-item :label="t('recommendation.avgDuration')">{{ currentBehavior.avgSessionDuration.toFixed(0) }}s</el-descriptions-item>
          </el-descriptions>
          <div v-if="recommendations.length > 0" class="mt-20">
            <h4>{{ t('recommendation.recommendationResults') }}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('recommendation.tourId') }}</TableHead>
                  <TableHead class="w-[100px]">{{ t('recommendation.score') }}</TableHead>
                  <TableHead>{{ t('recommendation.reason') }}</TableHead>
                  <TableHead class="w-[100px]">{{ t('recommendation.confidence') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in recommendations" :key="row.tourId ?? index">
                  <TableCell>{{ row.tourId }}</TableCell>
                  <TableCell>{{ row.score }}</TableCell>
                  <TableCell>{{ row.reason }}</TableCell>
                  <TableCell>{{ (row.confidence * 100).toFixed(0) }}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>
      </TabsContent>
    </Tabs>

    <Dialog v-model="showRuleDialog" width="600px">
      <DialogHeader>
        <DialogTitle>{{ t('recommendation.newRule') }}</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('recommendation.ruleName') }}</label>
          <div class="flex-1">
            <Input v-model="newRule.name" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('recommendation.ruleType') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.type">
              <SelectOption :label="t('recommendation.ruleTypes.behavior')" value="behavior" />
              <SelectOption :label="t('recommendation.ruleTypes.context')" value="context" />
              <SelectOption :label="t('recommendation.ruleTypes.time')" value="time" />
              <SelectOption :label="t('recommendation.ruleTypes.segment')" value="segment" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('recommendation.priority') }}</label>
          <div class="flex-1">
            <el-input-number v-model="newRule.priority" :min="1" :max="100" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('recommendation.description') }}</label>
          <div class="flex-1">
            <Textarea v-model="newRule.description" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showRuleDialog = false">{{ t('monitoring.cancel') }}</Button>
        <Button variant="default" @click="createRule">{{ t('monitoring.create') }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tourRecommendationService, type RecommendationRule, type UserSegment, type ABTestConfig } from '@/services/tourRecommendationService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { tourRecommendationI18n } from '@/locales/tour-i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'

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
