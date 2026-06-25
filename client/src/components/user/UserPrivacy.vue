<template>
  <div class="user-privacy">
    <h3 class="section-title">{{ t('userComponents.privacy.title') }}</h3>
    <div class="privacy-list">
      <div class="privacy-item">
        <div class="item-info">
          <h4>{{ t('userComponents.privacy.publicProfile') }}</h4>
          <p>{{ t('userComponents.privacy.publicProfileDesc') }}</p>
        </div>
        <el-switch v-model="settings.publicProfile" @change="handleSettingChange('publicProfile', $event)" />
      </div>

      <div class="privacy-item">
        <div class="item-info">
          <h4>{{ t('userComponents.privacy.showOnlineStatus') }}</h4>
          <p>{{ t('userComponents.privacy.showOnlineStatusDesc') }}</p>
        </div>
        <el-switch v-model="settings.showOnlineStatus" @change="handleSettingChange('showOnlineStatus', $event)" />
      </div>

      <div class="privacy-item">
        <div class="item-info">
          <h4>{{ t('userComponents.privacy.allowSearch') }}</h4>
          <p>{{ t('userComponents.privacy.allowSearchDesc') }}</p>
        </div>
        <el-switch v-model="settings.allowSearch" @change="handleSettingChange('allowSearch', $event)" />
      </div>

      <div class="privacy-item">
        <div class="item-info">
          <h4>{{ t('userComponents.privacy.receiveMessages') }}</h4>
          <p>{{ t('userComponents.privacy.receiveMessagesDesc') }}</p>
        </div>
        <el-switch v-model="settings.receiveMessages" @change="handleSettingChange('receiveMessages', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface PrivacySettings {
  publicProfile: boolean
  showOnlineStatus: boolean
  allowSearch: boolean
  receiveMessages: boolean
}

const props = defineProps<{
  settings?: PrivacySettings
}>()

const emit = defineEmits<{
  (e: 'update-setting', key: string, value: boolean): void
}>()

const settings = reactive<PrivacySettings>({
  publicProfile: props.settings?.publicProfile ?? true,
  showOnlineStatus: props.settings?.showOnlineStatus ?? true,
  allowSearch: props.settings?.allowSearch ?? true,
  receiveMessages: props.settings?.receiveMessages ?? true,
})

const handleSettingChange = (key: string, value: boolean) => {
  emit('update-setting', key, value)
}
</script>

<style scoped>
.user-privacy {
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

.privacy-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.privacy-item {
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
