<template>
  <div class="lang-switcher" :class="{ rtl: isRtl }" role="group" :aria-label="ariaLabel">
    <label :for="selectId" class="lang-switcher-label">{{ label }}</label>
    <div class="lang-switcher-control">
      <select
        :id="selectId"
        :value="currentLang"
        class="lang-switcher-select"
        :aria-label="ariaLabel"
        @change="onChange"
      >
        <option v-for="m in languages" :key="m.code" :value="m.code">
          {{ m.code }} · {{ m.display_name }} · {{ m.english_name }}
          {{ m.is_rtl ? '· RTL' : '' }}
        </option>
      </select>
      <span
        v-if="currentMeta"
        class="lang-switcher-meta"
        :aria-live="'polite'"
      >
        <span class="lang-switcher-tag" :class="{ rtl: currentMeta.is_rtl }">
          {{ currentMeta.is_rtl ? 'RTL' : 'LTR' }}
        </span>
        <span class="lang-switcher-plural">{{ currentMeta.plural_rule }}</span>
      </span>
    </div>
    <p v-if="currentMeta" class="lang-switcher-hint">
      <span class="lang-switcher-num">{{ previewNumber }}</span>
      <span class="lang-switcher-curr">{{ previewCurrency }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
// LanguageSwitcher - V1 静态数据版（替代原 useI18nV2 依赖）
// 数据源: constants/i18nLanguages.ts (本地 9 语言元数据)
// 格式化: 使用 Intl 原生 API
// 无任何后端依赖

import { computed, ref } from 'vue'
import { I18N_LANGUAGES, getLanguageMeta, type LanguageMeta } from '@/constants/i18nLanguages'

interface Props {
  modelValue?: string
  label?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '语言',
  ariaLabel: '切换语言',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string]
}>()

const selectId = `lang-switcher-${Math.random().toString(36).slice(2, 8)}`

// 本地状态 - 不持久化, 仅作为受控组件
const currentLang = ref<string>(props.modelValue || 'zh-CN')

const languages = computed<LanguageMeta[]>(() => I18N_LANGUAGES)
const currentMeta = computed<LanguageMeta | undefined>(() => getLanguageMeta(currentLang.value))
const isRtl = computed<boolean>(() => currentMeta.value?.is_rtl ?? false)

const onChange = (ev: Event) => {
  const v = (ev.target as HTMLSelectElement).value
  currentLang.value = v
  emit('update:modelValue', v)
  emit('change', v)
}

// 数值预览 - 使用 Intl.NumberFormat
const previewNumber = computed(() => {
  const code = currentMeta.value?.code
  if (!code) return ''
  try {
    return new Intl.NumberFormat(code, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234567.89)
  } catch {
    return '1,234,567.89'
  }
})

// 货币预览 - 根据 currency_position 选择前缀或后缀
const previewCurrency = computed(() => {
  if (!currentMeta.value) return ''
  const pos = currentMeta.value.currency_position
  return pos === 'before' ? '¥ 1,234.56' : '1 234,56 €'
})
</script>

<style scoped lang="scss">
.lang-switcher {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  font-family: inherit;
  color: var(--el-text-color-primary);
}

.lang-switcher.rtl {
  direction: rtl;
  text-align: start;
}

.lang-switcher-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lang-switcher-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.lang-switcher-select {
  flex: 1 1 200px;
  min-height: 36px;
  padding: 0 12px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s;
}

.lang-switcher-select:hover {
  border-color: var(--border-unified-color-hover);
}

.lang-switcher-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.lang-switcher-tag {
  display: inline-block;
  padding: 2px 8px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lang-switcher-tag.rtl {
  /* WCAG AA: 4.5:1 对比度. 使用主文字色作背景 + 白字, 对比度 ≈ 12:1 */
  background: var(--el-text-color-primary);
  color: var(--el-color-white);
  border-color: var(--el-text-color-primary);
}

.lang-switcher-plural {
  font-variant-numeric: tabular-nums;
}

.lang-switcher-hint {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.lang-switcher-num,
.lang-switcher-curr {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
</style>
