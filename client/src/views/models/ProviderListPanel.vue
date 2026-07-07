<template>
  <div class="provider-list-panel">
    <!-- Built-in providers section -->
    <div class="provider-section">
      <div class="provider-section__header">
        <span class="provider-section__title">{{ t('models.builtinProviders') }}</span>
      </div>
      <div class="provider-list">
        <div
          v-for="provider in builtinProviders"
          :key="provider.code"
          class="provider-item"
          :class="{
            'provider-item--active': selectedCode === provider.code,
            'provider-item--disabled': !isProviderEnabled(provider.code),
          }"
          @click="$emit('select', provider.code)"
        >
          <div class="provider-item__icon">{{ provider.icon }}</div>
          <div class="provider-item__info">
            <div class="provider-item__name">{{ provider.name }}</div>
            <div class="provider-item__status">
              <span
                class="status-badge"
                :class="isProviderEnabled(provider.code) ? 'status-badge--on' : 'status-badge--off'"
              >
                {{ isProviderEnabled(provider.code) ? t('models.enabled') : t('models.disabled') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom providers section -->
    <div class="provider-section">
      <div class="provider-section__header">
        <span class="provider-section__title">{{ t('models.customProviders') }}</span>
        <button class="add-provider-btn" @click="$emit('add')">
          <PlusIcon class="add-icon" />
          <span>{{ t('models.addProvider') }}</span>
        </button>
      </div>
      <div class="provider-list">
        <div
          v-for="provider in customProviders"
          :key="provider.id"
          class="provider-item"
          :class="{
            'provider-item--active': selectedId === provider.id,
            'provider-item--disabled': !provider.enabled,
          }"
          @click="$emit('selectCustom', provider.id)"
        >
          <div class="provider-item__icon">
            <Plug class="custom-icon" />
          </div>
          <div class="provider-item__info">
            <div class="provider-item__name">{{ provider.name }}</div>
            <div class="provider-item__status">
              <span
                class="status-badge"
                :class="provider.enabled ? 'status-badge--on' : 'status-badge--off'"
              >
                {{ provider.enabled ? t('models.enabled') : t('models.disabled') }}
              </span>
              <span
                v-if="provider.lastTestStatus"
                class="test-badge"
                :class="`test-badge--${provider.lastTestStatus}`"
              >
                {{ getTestBadgeText(provider.lastTestStatus) }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="customProviders.length === 0" class="empty-custom">
          {{ t('models.noCustomProviders') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { PlusIcon, Plug } from '@/lib/lucide-fallback'
import type { ModelProviderConfig } from '@/api/models'

defineProps<{
  builtinProviders: Array<{ code: string; name: string; icon: string }>
  customProviders: ModelProviderConfig[]
  selectedCode: string | null
  selectedId: number | string | null
  enabledCodes: Set<string>
}>()

defineEmits<{
  select: [code: string]
  selectCustom: [id: number | string]
  add: []
}>()

const { t } = useI18n()

function isProviderEnabled(code: string): boolean {
  // Built-in providers are considered "enabled" if they have a config entry that's enabled
  return true // Default to enabled for display; actual state comes from config
}

function getTestBadgeText(status: string): string {
  if (status === 'operational') return t('models.testOk')
  if (status === 'degraded') return t('models.testSlow')
  if (status === 'failed') return t('models.testFail')
  return ''
}
</script>

<style scoped lang="scss">
.provider-list-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.provider-section {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
  }

  &__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--app-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.add-provider-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--global-border-radius);
  border-width: 1px;
  border-style: solid;
  border-color: var(--border-unified-color);
  background-color: var(--app-surface-2);
  font-size: 12px;
  color: var(--app-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;

  .add-icon {
    width: 14px;
    height: 14px;
  }

  &:hover {
    border-color: var(--border-unified-color-hover);
    color: var(--el-color-primary);
  }
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.provider-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--global-border-radius);
  border-width: 1px;
  border-style: solid;
  border-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &__icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--global-border-radius);
    background-color: var(--el-fill-color-light);
    font-size: 18px;
    flex-shrink: 0;

    .custom-icon {
      width: 18px;
      height: 18px;
      color: var(--app-text-secondary);
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 14px;
    font-weight: 500;
    color: var(--app-text-primary);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &--active {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);

    .provider-item__name {
      color: var(--el-color-primary);
    }
  }

  &--disabled {
    opacity: 0.6;
  }
}

.status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;

  &--on {
    background-color: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  &--off {
    background-color: var(--el-fill-color);
    color: var(--app-text-muted);
  }
}

.test-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;

  &--operational {
    background-color: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  &--degraded {
    background-color: var(--el-color-warning-light-9);
    color: var(--el-color-warning);
  }

  &--failed {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
  }
}

.empty-custom {
  padding: var(--spacing-md);
  text-align: center;
  font-size: 13px;
  color: var(--app-text-muted);
}
</style>
