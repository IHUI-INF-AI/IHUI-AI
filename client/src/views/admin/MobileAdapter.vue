<template>
  <div class="mobile-adapter">
    <div class="flex flex-wrap gap-5">
      <div class="w-1/3">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('mobileAdapter.currentDevice') }}</span>
              <Button variant="outline" size="sm" @click="refreshDevice">{{ t('mobileAdapter.refreshDevice') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <div class="device-info">
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.deviceType') }}</span>
              <span class="value">{{ deviceInfo.type }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.operatingSystem') }}</span>
              <span class="value">{{ deviceInfo.os }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.browser') }}</span>
              <span class="value">{{ deviceInfo.browser }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.screenSize') }}</span>
              <span class="value">{{ deviceInfo.screenWidth }} x {{ deviceInfo.screenHeight }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.pixelRatio') }}</span>
              <span class="value">{{ deviceInfo.pixelRatio }}x</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.touchSupport') }}</span>
              <span class="value">{{ deviceInfo.touchSupport ? t('mobileAdapter.yes') : t('mobileAdapter.no') }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.orientation') }}</span>
              <span class="value">{{ deviceInfo.orientation }}</span>
            </div>
            <div class="info-item">
              <span class="label">{{ t('mobileAdapter.breakpoint') }}</span>
              <Tag>{{ deviceInfo.breakpoint }}</Tag>
            </div>
          </div>
        </CardContent></Card>
      </div>
      <div class="w-2/3">
        <Card><CardHeader><CardTitle>{{ t('mobileAdapter.platformConfig') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('mobileAdapter.platformName') }}</TableHead>
                <TableHead>{{ t('mobileAdapter.platform') }}</TableHead>
                <TableHead>{{ t('mobileAdapter.status') }}</TableHead>
                <TableHead class="w-[120px]">{{ t('mobileAdapter.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in platformConfigs" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.type }}</TableCell>
                <TableCell>
                  <Switch v-model="row.enabled" :disabled="!canConfigPlatform" @change="togglePlatform(row)" />
                </TableCell>
                <TableCell>
                  <Button v-if="canConfigPlatform" variant="ghost" size="sm" @click="editPlatform(row)">{{ t('mobileAdapter.edit') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5 mt-20">
      <div class="w-1/2">
        <Card><CardHeader>
            <div class="card-header">
              <span>{{ t('mobileAdapter.adaptationRules') }}</span>
              <Button v-if="canConfigPlatform" variant="default" size="sm" @click="showRuleDialog = true">{{ t('mobileAdapter.newRule') }}</Button>
            </div>
          </CardHeader><CardContent class="p-5">
                    <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('mobileAdapter.platform') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('mobileAdapter.priority') }}</TableHead>
                <TableHead>{{ t('mobileAdapter.conditionField') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('mobileAdapter.conditionOperator') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('mobileAdapter.conditionValue') }}</TableHead>
                <TableHead class="w-[80px]">{{ t('mobileAdapter.status') }}</TableHead>
                <TableHead class="w-[100px]">{{ t('mobileAdapter.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in adaptationRules" :key="row.id ?? index">
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.priority }}</TableCell>
                <TableCell>{{ t(`mobileAdapter.conditionFields.${row.condition.field}`) }}</TableCell>
                <TableCell>{{ t(`mobileAdapter.operators.${row.condition.operator}`) }}</TableCell>
                <TableCell>{{ row.condition.value }}</TableCell>
                <TableCell>
                  <Switch v-model="row.enabled" :disabled="!canConfigPlatform" @change="toggleRule(row)" />
                </TableCell>
                <TableCell>
                  <Button v-if="canConfigPlatform" variant="ghost" size="sm" @click="deleteRule(row.id)">{{ t('mobileAdapter.delete') }}</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
      <div class="w-1/2">
        <Card><CardHeader><CardTitle>{{ t('mobileAdapter.themeConfig') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <form @submit.prevent>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.primaryColor') }}</label>
              <div class="flex-1">
                <el-color-picker v-model="themeConfig.primaryColor" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.backgroundColor') }}</label>
              <div class="flex-1">
                <el-color-picker v-model="themeConfig.backgroundColor" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.textColor') }}</label>
              <div class="flex-1">
                <el-color-picker v-model="themeConfig.textColor" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.borderRadius') }}</label>
              <div class="flex-1">
                <el-slider v-model="themeConfig.borderRadius" :min="0" :max="20" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.shadowEffect') }}</label>
              <div class="flex-1">
                <Switch v-model="themeConfig.shadowEnabled" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4 flex items-center gap-4">
              <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.compactMode') }}</label>
              <div class="flex-1">
                <Switch v-model="themeConfig.compactMode" :disabled="!canConfigPlatform" />
              </div>
            </div>
            <div class="mb-4">
              <Button v-if="canConfigPlatform" variant="default" @click="applyTheme">{{ t('mobileAdapter.applyTheme') }}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </div>

    <div class="flex flex-wrap gap-5 mt-20">
      <div class="w-full">
        <Card><CardHeader><CardTitle>{{ t('mobileAdapter.preview') }}</CardTitle></CardHeader><CardContent class="p-5">
                    <div class="preview-container" :style="previewStyle">
            <div class="guide-preview">
              <h3>{{ t('mobileAdapter.guideTitle') }}</h3>
              <p>{{ t('mobileAdapter.guideContent') }}</p>
              <Button variant="default">{{ t('mobileAdapter.nextStep') }}</Button>
            </div>
          </div>
        </CardContent></Card>
      </div>
    </div>

    <Dialog v-model="showRuleDialog" width="500px">
      <DialogHeader>
        <DialogTitle>{{ t('mobileAdapter.newRule') }}</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.platform') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.platform">
              <SelectOption label="Web" value="web" />
              <SelectOption label="Mobile" value="mobile" />
              <SelectOption label="WeChat Mini" value="wechat_mini" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.priority') }}</label>
          <div class="flex-1">
            <el-input-number v-model="newRule.priority" :min="1" :max="100" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.conditionField') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.conditionField">
              <SelectOption :label="t('mobileAdapter.conditionFields.screenWidth')" value="screenWidth" />
              <SelectOption :label="t('mobileAdapter.conditionFields.screenHeight')" value="screenHeight" />
              <SelectOption :label="t('mobileAdapter.conditionFields.pixelRatio')" value="pixelRatio" />
              <SelectOption :label="t('mobileAdapter.conditionFields.orientation')" value="orientation" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.conditionOperator') }}</label>
          <div class="flex-1">
            <Select v-model="newRule.conditionOperator">
              <SelectOption :label="t('mobileAdapter.operators.lt')" value="lt" />
              <SelectOption :label="t('mobileAdapter.operators.gt')" value="gt" />
              <SelectOption :label="t('mobileAdapter.operators.eq')" value="eq" />
              <SelectOption :label="t('mobileAdapter.operators.between')" value="between" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-24 shrink-0 text-sm font-medium text-foreground">{{ t('mobileAdapter.conditionValue') }}</label>
          <div class="flex-1">
            <Input v-model="newRule.conditionValue" :placeholder="t('mobileAdapter.conditionValue')" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showRuleDialog = false">{{ t('mobileAdapter.cancel') }}</Button>
        <Button variant="default" @click="createRule">{{ t('mobileAdapter.create') }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tourMultiPlatformService, type DeviceInfo, type PlatformConfig, type AdaptationRule } from '@/services/tourMultiPlatformService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { tourMobileAdapterI18n } from '@/locales/tour-i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Tag } from '@/components/ui/tag'
import { Switch } from '@/components/ui/switch'
import { Select, SelectOption } from '@/components/ui/select'

const t = (key: string) => {
  const keys = key.split('.')
  let result: unknown = tourMobileAdapterI18n
  for (const k of keys) {
    result = (result as Record<string, unknown>)?.[k]
  }
  return typeof result === 'string' ? result : key
}
const { canConfigPlatform, canViewPlatform } = useTourPermissions()

const deviceInfo = ref<DeviceInfo>(tourMultiPlatformService.detectDevice())
const platformConfigs = ref<PlatformConfig[]>([])
const adaptationRules = ref<AdaptationRule[]>([])
const showRuleDialog = ref(false)

const themeConfig = ref({
  primaryColor: 'var(--color-primary)',
  backgroundColor: 'hsl(var(--background))',
  textColor: 'var(--color-gray-303133)',
  borderRadius: 4,
  shadowEnabled: true,
  compactMode: false
})

const newRule = ref({
  platform: 'mobile',
  priority: 50,
  conditionField: 'screenWidth',
  conditionOperator: 'lt',
  conditionValue: '768'
})

const previewStyle = computed(() => ({
  backgroundColor: themeConfig.value.backgroundColor,
  color: themeConfig.value.textColor,
  borderRadius: `${themeConfig.value.borderRadius}px`,
  boxShadow: themeConfig.value.shadowEnabled ? '0 2px 12px color-mix(in srgb, hsl(var(--primary)) 10%, transparent)' : 'none',
  padding: themeConfig.value.compactMode ? '10px' : '20px'
}))

const refreshDevice = () => {
  deviceInfo.value = tourMultiPlatformService.detectDevice()
  ElMessage.success('ok')
}

const loadPlatforms = () => {
  platformConfigs.value = tourMultiPlatformService.getAllPlatforms()
}

const loadRules = () => {
  adaptationRules.value = tourMultiPlatformService.getAdaptationRules()
}

const togglePlatform = (platform: PlatformConfig) => {
  tourMultiPlatformService.updatePlatform(platform.id, { enabled: platform.enabled })
}

const editPlatform = (platform: PlatformConfig) => {
  ElMessage.info('edit: ' + platform.name)
}

const toggleRule = (rule: AdaptationRule) => {
  tourMultiPlatformService.updateAdaptationRule(rule.id, { enabled: rule.enabled })
}

const deleteRule = (id: string) => {
  tourMultiPlatformService.deleteAdaptationRule(id)
  loadRules()
  ElMessage.success('ok')
}

const createRule = () => {
  tourMultiPlatformService.createAdaptationRule({
    platform: newRule.value.platform,
    priority: newRule.value.priority,
    conditions: [{
      field: newRule.value.conditionField as 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'orientation' | 'touchSupport',
      operator: newRule.value.conditionOperator as 'lt' | 'gt' | 'eq' | 'between',
      value: newRule.value.conditionValue
    }],
    adjustments: [],
    enabled: true
  })
  showRuleDialog.value = false
  loadRules()
  ElMessage.success('ok')
}

const applyTheme = () => {
  ElMessage.success('ok')
}

onMounted(() => {
  if (!canViewPlatform.value) return
  loadPlatforms()
  loadRules()
})
</script>

<style scoped>
.mobile-adapter {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.device-info {
  padding: 10px 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: var(--unified-border-bottom);
}

.info-item:last-child {
  border-bottom: none;
}

.info-item .label {
  color: hsl(var(--foreground));
}

.info-item .value {
  font-weight: 500;
}

.preview-container {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guide-preview {
  text-align: center;
}

.guide-preview h3 {
  margin-bottom: 10px;
}

.guide-preview p {
  margin-bottom: 15px;
  color: var(--color-gray-606266);
}

.mt-20 {
  margin-top: 20px;
}
</style>
