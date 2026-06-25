<template>
  <div class="user-settings">
    <h3 class="section-title">{{ t('userComponents.settings.title') }}</h3>
    <div class="settings-list">
      <div class="setting-item">
        <div class="item-info">
          <h4>{{ t('userComponents.settings.language') }}</h4>
          <p>{{ t('userComponents.settings.languageDesc') }}</p>
        </div>
        <el-select v-model="settings.language" @change="handleLanguageChange">
          <el-option label="简体中文" value="zh-CN" />
          <el-option label="English" value="en" />
        </el-select>
      </div>
      
      <div class="setting-item">
        <div class="item-info">
          <h4>{{ t('userComponents.settings.theme') }}</h4>
          <p>{{ t('userComponents.settings.themeDesc') }}</p>
        </div>
        <el-select v-model="settings.theme" @change="handleThemeChange">
          <el-option :label="t('userComponents.settings.theme') + ' 1'" value="light" />
          <el-option :label="t('userComponents.settings.theme') + ' 2'" value="dark" />
          <el-option :label="t('commonText.status.processing')" value="auto" />
        </el-select>
      </div>
      
      <div class="setting-item">
        <div class="item-info">
          <h4>{{ t('userComponents.settings.notifications') }}</h4>
          <p>{{ t('userComponents.settings.notificationsDesc') }}</p>
        </div>
        <el-switch v-model="settings.notifications" @change="handleSettingChange('notifications', $event)" />
      </div>
      
      <div class="setting-item">
        <div class="item-info">
          <h4>{{ t('userComponents.settings.soundEffects') }}</h4>
          <p>{{ t('userComponents.settings.soundEffectsDesc') }}</p>
        </div>
        <el-switch v-model="settings.sound" @change="handleSettingChange('sound', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Settings {
  language: string
  theme: string
  notifications: boolean
  sound: boolean
}

const props = defineProps<{
  settings?: Settings
}>()

const emit = defineEmits<{
  (e: 'update-setting', key: string, value: string | boolean): void
  (e: 'change-language', lang: string): void
  (e: 'change-theme', theme: string): void
}>()

const settings = reactive<Settings>({
  language: props.settings?.language ?? 'zh-CN',
  theme: props.settings?.theme ?? 'light',
  notifications: props.settings?.notifications ?? true,
  sound: props.settings?.sound ?? true,
})

const handleLanguageChange = (value: string) => {
  emit('change-language', value)
  emit('update-setting', 'language', value)
}

const handleThemeChange = (value: string) => {
  emit('change-theme', value)
  emit('update-setting', 'theme', value)
}

const handleSettingChange = (key: string, value: boolean) => {
  emit('update-setting', key, value)
}
</script>

<style scoped>
.user-settings {
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

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--global-border-radius);
}

.item-info h4 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-info p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
