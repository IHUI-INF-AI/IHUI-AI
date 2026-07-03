<template>
  <div class="lang-switcher" :class="{ rtl: isRtl }" role="group" :aria-label="ariaLabel">
    <label :for="selectId" class="lang-switcher-label">{{ label }}</label>
    <div class="lang-switcher-control">
      <select
        :id="selectId"
        v-model="model"
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
import { computed, onMounted } from 'vue'
import { useI18nV2 } from '@/composables/useI18nV2'

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

const { state, currentMeta, isCurrentRtl, fetchLanguages, setCurrentLang } = useI18nV2()

const languages = computed(() => state.languages)
const isRtl = computed(() => isCurrentRtl.value)

const model = computed({
  get: () => props.modelValue || state.currentLang,
  set: (v: string) => {
    emit('update:modelValue', v)
  },
})

const onChange = (ev: Event) => {
  const v = (ev.target as HTMLSelectElement).value
  setCurrentLang(v)
  emit('change', v)
}

// 数值/货币预览
const previewNumber = computed(() => {
  if (!currentMeta.value) return ''
  return new Intl.NumberFormat(currentMeta.value.code, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(1234567.89)
})

const previewCurrency = computed(() => {
  if (!currentMeta.value) return ''
  const code = currentMeta.value.currency_position
  return code === 'before' ? '¥ 1,234.56' : '1 234,56 €'
})

onMounted(async () => {
  if (state.languages.length === 0) {
    try { await fetchLanguages() } catch (e) { console.error(e) }
  }
  if (props.modelValue) {
    setCurrentLang(props.modelValue)
  }
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
  border-color: transparent;
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
