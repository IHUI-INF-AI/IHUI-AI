<template>
  <div class="css-variables-cheatsheet">
    <h2 class="cheatsheet-title">{{ t('cssVariables.title') }}</h2>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('cssVariables.colorVars')" name="colors">
        <div class="variable-section">
          <h3>{{ t('cssVariables.primaryColor') }}</h3>
          <div class="color-grid">
            <div v-for="color in primaryColors" :key="color.name" class="color-item">
              <div class="color-preview" :style="{ background: color.value }"></div>
              <div class="color-info">
                <code>{{ color.name }}</code>
                <span class="color-value">{{ color.value }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="variable-section">
          <h3>{{ t('cssVariables.textColor') }}</h3>
          <div class="color-grid">
            <div v-for="color in textColors" :key="color.name" class="color-item">
              <div class="color-preview" :style="{ background: color.value }"></div>
              <div class="color-info">
                <code>{{ color.name }}</code>
                <span class="color-value">{{ color.description }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="variable-section">
          <h3>{{ t('cssVariables.bgColor') }}</h3>
          <div class="color-grid">
            <div v-for="color in bgColors" :key="color.name" class="color-item">
              <div class="color-preview" :style="{ background: color.value }"></div>
              <div class="color-info">
                <code>{{ color.name }}</code>
                <span class="color-value">{{ color.description }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="variable-section">
          <h3>{{ t('cssVariables.borderColor') }}</h3>
          <div class="color-grid">
            <div v-for="color in borderColors" :key="color.name" class="color-item">
              <div class="color-preview" :style="{ background: color.value }"></div>
              <div class="color-info">
                <code>{{ color.name }}</code>
                <span class="color-value">{{ color.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="t('cssVariables.spacingVars')" name="spacing">
        <div class="variable-section">
          <h3>{{ t('cssVariables.globalSpacing') }}</h3>
          <div class="spacing-grid">
            <div v-for="spacing in spacings" :key="spacing.name" class="spacing-item">
              <div class="spacing-preview" :style="{ width: spacing.value }"></div>
              <div class="spacing-info">
                <code>{{ spacing.name }}</code>
                <span>{{ spacing.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="t('cssVariables.radiusVars')" name="radius">
        <div class="variable-section">
          <h3>{{ t('cssVariables.globalRadius') }}</h3>
          <div class="radius-grid">
            <div v-for="radius in radiuses" :key="radius.name" class="radius-item">
              <div class="radius-preview" :style="{ borderRadius: radius.value }"></div>
              <div class="radius-info">
                <code>{{ radius.name }}</code>
                <span>{{ radius.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="t('cssVariables.shadowVars')" name="shadow">
        <div class="variable-section">
          <h3>{{ t('cssVariables.globalShadow') }}</h3>
          <div class="shadow-grid">
            <div v-for="shadow in shadows" :key="shadow.name" class="shadow-item">
              <div class="shadow-preview" :style="{ boxShadow: shadow.value }"></div>
              <div class="shadow-info">
                <code>{{ shadow.name }}</code>
                <span>{{ shadow.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane :label="t('cssVariables.migrationGuide')" name="migration">
        <div class="variable-section">
          <h3>{{ t('cssVariables.hardcodedColorMigration') }}</h3>
          <el-table :data="migrationTable" stripe>
            <el-table-column prop="hardcoded" :label="t('cssVariables.hardcodedColor')" width="150">
              <template #default="{ row }">
                <span class="hardcoded-color" :style="{ color: row.hardcoded }">{{ row.hardcoded }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="variable" :label="t('cssVariables.replacement')" width="300">
              <template #default="{ row }">
                <code>{{ row.variable }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="usage" :label="t('cssVariables.usageScenario')" />
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const activeTab = ref('colors')

const primaryColors = [
  { name: '--el-color-primary', value: 'var(--el-color-primary)' },
  { name: '--el-color-primary-light-3', value: 'var(--el-color-primary-light-3)' },
  { name: '--el-color-primary-light-5', value: 'var(--el-color-primary-light-5)' },
  { name: '--el-color-primary-light-7', value: 'var(--el-color-primary-light-7)' },
  { name: '--el-color-primary-light-9', value: 'var(--el-color-primary-light-9)' },
  { name: '--el-color-success', value: 'var(--el-color-success)' },
  { name: '--el-color-warning', value: 'var(--el-color-warning)' },
  { name: '--el-color-danger', value: 'var(--el-color-danger)' },
  { name: '--el-color-info', value: 'var(--el-color-info)' },
]

const textColors = [
  { name: '--el-text-color-primary', value: 'var(--el-text-color-primary)', description: t('cssVariables.primaryText') },
  { name: '--el-text-color-regular', value: 'var(--el-text-color-regular)', description: t('cssVariables.regularText') },
  { name: '--el-text-color-secondary', value: 'var(--el-text-color-secondary)', description: t('cssVariables.secondaryText') },
  { name: '--el-text-color-placeholder', value: 'var(--el-text-color-placeholder)', description: t('cssVariables.placeholderText') },
  { name: '--el-text-color-disabled', value: 'var(--el-text-color-disabled)', description: t('cssVariables.disabledText') },
]

const bgColors = [
  { name: '--el-bg-color', value: 'var(--el-bg-color)', description: t('cssVariables.baseBg') },
  { name: '--el-bg-color-page', value: 'var(--el-bg-color-page)', description: t('cssVariables.pageBg') },
  { name: '--el-bg-color-overlay', value: 'var(--el-bg-color-overlay)', description: t('cssVariables.overlayBg') },
  { name: '--el-fill-color', value: 'var(--el-fill-color)', description: t('cssVariables.baseFill') },
  { name: '--el-fill-color-light', value: 'var(--el-fill-color-light)', description: t('cssVariables.lightFill') },
  { name: '--el-fill-color-lighter', value: 'var(--el-fill-color-lighter)', description: t('cssVariables.lighterFill') },
]

const borderColors = [
  { name: '--el-border-color', value: 'var(--el-border-color)', description: t('cssVariables.baseBorder') },
  { name: '--el-border-color-light', value: 'var(--el-border-color-light)', description: t('cssVariables.lightBorder') },
  { name: '--el-border-color-lighter', value: 'var(--el-border-color-lighter)', description: t('cssVariables.lighterBorder') },
  { name: '--el-border-color-extra-light', value: 'var(--el-border-color-extra-light)', description: t('cssVariables.extraLightBorder') },
  { name: '--el-border-color-dark', value: 'var(--el-border-color-dark)', description: t('cssVariables.darkBorder') },
]

const spacings = [
  { name: '--spacing-xs', value: '4px' },
  { name: '--spacing-sm', value: '8px' },
  { name: '--spacing-md', value: '12px' },
  { name: '--spacing-lg', value: '16px' },
  { name: '--spacing-xl', value: '24px' },
  { name: '--spacing-2xl', value: '32px' },
]

const radiuses = [
  { name: '--global-border-radius-sm', value: '4px' },
  { name: '--global-border-radius', value: '8px' },
  { name: '--global-border-radius-lg', value: '12px' },
  { name: '--global-border-radius-xl', value: '16px' },
  { name: '--global-border-radius-full', value: '9999px' },
]

const shadows = [
  { name: '--global-box-shadow-sm', value: 'var(--global-box-shadow-sm)', description: t('cssVariables.smallShadow') },
  { name: '--global-box-shadow', value: 'var(--global-box-shadow)', description: t('cssVariables.baseShadow') },
  { name: '--global-box-shadow-lg', value: 'var(--global-box-shadow-lg)', description: t('cssVariables.largeShadow') },
  { name: '--global-box-shadow-xl', value: 'var(--global-box-shadow-xl)', description: t('cssVariables.extraLargeShadow') },
]

const migrationTable = [
  { hardcoded: 'var(--el-color-primary)', variable: 'var(--el-text-color-primary)', usage: t('cssVariables.primaryText') },
  { hardcoded: 'var(--el-text-color-primary)', variable: 'var(--el-text-color-regular)', usage: t('cssVariables.regularText') },
  { hardcoded: 'var(--el-text-color-regular)666', variable: 'var(--el-text-color-secondary)', usage: t('cssVariables.secondaryText') },
  { hardcoded: 'var(--el-text-color-secondary)999', variable: 'var(--el-text-color-placeholder)', usage: t('cssVariables.placeholderText') },
  { hardcoded: 'var(--el-bg-color)', variable: 'var(--el-bg-color)', usage: t('cssVariables.bgColorUsage') },
  { hardcoded: 'var(--el-fill-color-light)', variable: 'var(--el-bg-color-page)', usage: t('cssVariables.pageBg') },
  { hardcoded: 'var(--color-gray-e4e7ed)', variable: 'var(--el-border-color-lighter)', usage: t('cssVariables.border') },
  { hardcoded: 'var(--color-primary)', variable: 'var(--el-color-primary)', usage: t('cssVariables.primaryTone') },
  { hardcoded: 'var(--color-success)', variable: 'var(--el-color-success)', usage: t('cssVariables.successColor') },
  { hardcoded: 'var(--color-warning-variant)', variable: 'var(--el-color-warning)', usage: t('cssVariables.warningColor') },
  { hardcoded: 'var(--color-danger-variant)', variable: 'var(--el-color-danger)', usage: t('cssVariables.dangerColor') },
]
</script>

<style lang="scss" scoped>
.css-variables-cheatsheet {
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  
  .cheatsheet-title {
    margin-bottom: 24px;
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 600;
  }
  
  .variable-section {
    margin-bottom: 24px;
    
    h3 {
      margin-bottom: 16px;
      color: var(--el-text-color-primary);
      font-size: 16px;
      font-weight: 500;
    }
  }
  
  .color-grid,
  .spacing-grid,
  .radius-grid,
  .shadow-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }
  
  .color-item,
  .spacing-item,
  .radius-item,
  .shadow-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
  }
  
  .color-preview {
    width: 48px;
    height: 48px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
  }
  
  .spacing-preview {
    height: 24px;
    background: var(--el-color-primary);
    border-radius: var(--global-border-radius-sm);
  }
  
  .radius-preview {
    width: 48px;
    height: 48px;
    background: var(--el-color-primary-light-5);
  }
  
  .shadow-preview {
    width: 48px;
    height: 48px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
  }
  
  .color-info,
  .spacing-info,
  .radius-info,
  .shadow-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    code {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-color-primary);
      background: var(--el-fill-color);
      padding: 2px 6px;
      border-radius: var(--global-border-radius-sm);
    }
    
    span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  
  .hardcoded-color {
    font-family: var(--font-family-mono);
  }
}
</style>
