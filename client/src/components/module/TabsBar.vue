<template>
  <div class="tabs-bar">
    <div class="tabs-left">
      <h3 class="title">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span v-if="icon" class="title-icon" v-html="iconSvg"></span>
        <span>{{ item.name || t('tabsBar.category') }}</span>
      </h3>
    </div>
    <div class="tabs-right">
      <a v-for="tag in tags" :key="tag.id" class="tag" @click="emit('select', tag)">
        {{ tag.label }}
      </a>
      <a v-if="moreLink" class="more" :href="moreLink">{{ t('tabsBar.more') }} ›</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { businessIcons } from '@/assets/business-icons'

const { t } = useI18n()
const props = defineProps<{
  item: { name?: string; tags?: Record<string, unknown>[]; id?: string | number }
  type?: string
  tags?: Record<string, unknown>[]
  moreLink?: string
}>()

const emit = defineEmits<{ select: [tag: Record<string, unknown>] }>()

const iconSvg = computed(() => {
  if (!props.item) return ''
  const key = String(props.item.name || '').toLowerCase()
  return businessIcons[key] || ''
})
</script>

<style lang="scss" scoped>
:where(.tabs-bar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: var(--unified-border-bottom);
  margin-bottom: 16px;
}

:where(.title) {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

:where(.title-icon) {
  display: inline-flex;
  width: 24px;
  height: 24px;
  color: var(--el-color-primary);

  :deep(svg) {
    width: 100%;
    height: 100%;
  }
}

:where(.tabs-right) {
  display: flex;
  align-items: center;
  gap: 16px;
}

:where(.tag) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;

  &:hover {
    color: var(--el-color-primary);
  }
}

:where(.more) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-decoration: none;

  &:hover {
    color: var(--el-color-primary);
  }
}
</style>
