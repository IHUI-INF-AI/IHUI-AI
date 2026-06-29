<template>
  <div class="mobile-adapter">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('mobileAdapter.currentDevice') }}</span>
              <el-button size="small" @click="refreshDevice">{{ t('mobileAdapter.refreshDevice') }}</el-button>
            </div>
          </template>
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
              <el-tag>{{ deviceInfo.breakpoint }}</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card>
          <template #header>{{ t('mobileAdapter.platformConfig') }}</template>
          <el-table :data="platformConfigs">
            <el-table-column prop="name" :label="t('mobileAdapter.platformName')" />
            <el-table-column prop="type" :label="t('mobileAdapter.platform')" />
            <el-table-column prop="enabled" :label="t('mobileAdapter.status')">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" :disabled="!canConfigPlatform" @change="togglePlatform(row)" />
              </template>
            </el-table-column>
            <el-table-column :label="t('mobileAdapter.actions')" width="120">
              <template #default="{ row }">
                <el-button v-if="canConfigPlatform" size="small" text @click="editPlatform(row)">{{ t('mobileAdapter.edit') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ t('mobileAdapter.adaptationRules') }}</span>
              <el-button v-if="canConfigPlatform" size="small" type="primary" @click="showRuleDialog = true">{{ t('mobileAdapter.newRule') }}</el-button>
            </div>
          </template>
          <el-table :data="adaptationRules" max-height="300">
            <el-table-column prop="name" :label="t('mobileAdapter.platform')" />
            <el-table-column prop="priority" :label="t('mobileAdapter.priority')" width="80" />
            <el-table-column prop="condition.field" :label="t('mobileAdapter.conditionField')">
              <template #default="{ row }">
                {{ t(`mobileAdapter.conditionFields.${row.condition.field}`) }}
              </template>
            </el-table-column>
            <el-table-column prop="condition.operator" :label="t('mobileAdapter.conditionOperator')" width="100">
              <template #default="{ row }">
                {{ t(`mobileAdapter.operators.${row.condition.operator}`) }}
              </template>
            </el-table-column>
            <el-table-column prop="condition.value" :label="t('mobileAdapter.conditionValue')" width="100" />
            <el-table-column prop="enabled" :label="t('mobileAdapter.status')" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" :disabled="!canConfigPlatform" @change="toggleRule(row)" />
              </template>
            </el-table-column>
            <el-table-column :label="t('mobileAdapter.actions')" width="100">
              <template #default="{ row }">
                <el-button v-if="canConfigPlatform" size="small" text type="danger" @click="deleteRule(row.id)">{{ t('mobileAdapter.delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>{{ t('mobileAdapter.themeConfig') }}</template>
          <el-form :model="themeConfig" label-width="100px">
            <el-form-item :label="t('mobileAdapter.primaryColor')">
              <el-color-picker v-model="themeConfig.primaryColor" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item :label="t('mobileAdapter.backgroundColor')">
              <el-color-picker v-model="themeConfig.backgroundColor" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item :label="t('mobileAdapter.textColor')">
              <el-color-picker v-model="themeConfig.textColor" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item :label="t('mobileAdapter.borderRadius')">
              <el-slider v-model="themeConfig.borderRadius" :min="0" :max="20" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item :label="t('mobileAdapter.shadowEffect')">
              <el-switch v-model="themeConfig.shadowEnabled" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item :label="t('mobileAdapter.compactMode')">
              <el-switch v-model="themeConfig.compactMode" :disabled="!canConfigPlatform" />
            </el-form-item>
            <el-form-item>
              <el-button v-if="canConfigPlatform" type="primary" @click="applyTheme">{{ t('mobileAdapter.applyTheme') }}</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card>
          <template #header>{{ t('mobileAdapter.preview') }}</template>
          <div class="preview-container" :style="previewStyle">
            <div class="guide-preview">
              <h3>{{ t('mobileAdapter.guideTitle') }}</h3>
              <p>{{ t('mobileAdapter.guideContent') }}</p>
              <el-button type="primary">{{ t('mobileAdapter.nextStep') }}</el-button>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showRuleDialog" :title="t('mobileAdapter.newRule')" width="500px">
      <el-form :model="newRule" label-width="100px">
        <el-form-item :label="t('mobileAdapter.platform')">
          <el-select v-model="newRule.platform">
            <el-option label="Web" value="web" />
            <el-option label="Mobile" value="mobile" />
            <el-option label="WeChat Mini" value="wechat_mini" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mobileAdapter.priority')">
          <el-input-number v-model="newRule.priority" :min="1" :max="100" />
        </el-form-item>
        <el-form-item :label="t('mobileAdapter.conditionField')">
          <el-select v-model="newRule.conditionField">
            <el-option :label="t('mobileAdapter.conditionFields.screenWidth')" value="screenWidth" />
            <el-option :label="t('mobileAdapter.conditionFields.screenHeight')" value="screenHeight" />
            <el-option :label="t('mobileAdapter.conditionFields.pixelRatio')" value="pixelRatio" />
            <el-option :label="t('mobileAdapter.conditionFields.orientation')" value="orientation" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mobileAdapter.conditionOperator')">
          <el-select v-model="newRule.conditionOperator">
            <el-option :label="t('mobileAdapter.operators.lt')" value="lt" />
            <el-option :label="t('mobileAdapter.operators.gt')" value="gt" />
            <el-option :label="t('mobileAdapter.operators.eq')" value="eq" />
            <el-option :label="t('mobileAdapter.operators.between')" value="between" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('mobileAdapter.conditionValue')">
          <el-input v-model="newRule.conditionValue" :placeholder="t('mobileAdapter.conditionValue')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRuleDialog = false">{{ t('mobileAdapter.cancel') }}</el-button>
        <el-button type="primary" @click="createRule">{{ t('mobileAdapter.create') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { tourMultiPlatformService, type DeviceInfo, type PlatformConfig, type AdaptationRule } from '@/services/tourMultiPlatformService'
import { useTourPermissions } from '@/composables/useTourPermissions'
import { tourMobileAdapterI18n } from '@/locales/tour-i18n'

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
  backgroundColor: 'var(--el-bg-color)',
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
  boxShadow: themeConfig.value.shadowEnabled ? '0 2px 12px color-mix(in srgb, var(--el-color-primary) 10%, transparent)' : 'none',
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
  color: var(--el-text-color-primary);
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
