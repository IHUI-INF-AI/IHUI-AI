<template>
  <div class="country-code-selector">
    <el-select
      v-model="selectedCountry"
      :placeholder="placeholder"
      filterable
      :filter-method="filterCountries"
      :loading="loading"
      :disabled="disabled"
      class="country-select"
      popper-class="country-code-popper"
      @change="handleChange"
      @visible-change="handleVisibleChange"
    >
      <template #prefix>
        <div class="selected-display">
          <span class="country-flag">{{ selectedCountry?.flag || '🌍' }}</span>
          <span class="country-code">{{ selectedCountry?.dialCode || '+86' }}</span>
        </div>
      </template>

      <el-option-group v-if="popularCountries.length > 0" :label="t('auth.popularCountries')">
        <el-option
          v-for="country in popularCountries"
          :key="`popular-${country.code}`"
          :value="country"
          :label="getCountryLabel(country)"
        >
          <div class="country-option">
            <span class="country-flag">{{ country.flag }}</span>
            <span class="country-name">{{ getCountryName(country) }}</span>
            <span class="country-dial">{{ country.dialCode }}</span>
          </div>
        </el-option>
      </el-option-group>

      <el-option-group :label="t('auth.allCountries')">
        <el-option
          v-for="country in filteredCountries"
          :key="country.code"
          :value="country"
          :label="getCountryLabel(country)"
        >
          <div class="country-option">
            <span class="country-flag">{{ country.flag }}</span>
            <span class="country-name">{{ getCountryName(country) }}</span>
            <span class="country-dial">{{ country.dialCode }}</span>
          </div>
        </el-option>
      </el-option-group>

      <template #empty>
        <div class="empty-text">
          {{ t('auth.noCountriesFound') }}
        </div>
      </template>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { countryCodes, getDefaultCountryCode, type CountryCode } from '@/utils/countryCodes'

interface Props {
  modelValue?: CountryCode
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  popularCodes?: string[] // 热门国家代码列表
}

interface Emits {
  (e: 'update:modelValue', value: CountryCode): void
  (e: 'change', value: CountryCode): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: '',
  disabled: false,
  loading: false,
  popularCodes: () => ['86', '1', '44', '81', '82', '852', '853', '886'],
})

const emit = defineEmits<Emits>()

const { t, locale } = useI18n()

// 响应式数据
const selectedCountry = ref<CountryCode | undefined>(undefined)
const searchQuery = ref('')
const allCountries = ref<CountryCode[]>(countryCodes)

// 计算属性
const isChineseLanguage = computed(() => {
  const lang = locale.value
  return lang === 'zh-CN' || lang === 'zh-TW' || lang.startsWith('zh')
})

// 热门国家列表
const popularCountries = computed(() => {
  if (!props.popularCodes.length) return []

  return props.popularCodes
    .map((code: string | number) =>
      allCountries.value.find(country => country.dialCode === `+${code}`)
    )
    .filter(Boolean) as CountryCode[]
})

// 过滤后的国家列表（排除热门国家）
const filteredCountries = computed(() => {
  let countries = allCountries.value

  // 排除热门国家（避免重复显示）
  if (popularCountries.value.length > 0) {
    const popularCodes = popularCountries.value.map(c => c.code)
    countries = countries.filter(country => !popularCodes.includes(country.code))
  }

  // 应用搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    countries = countries.filter(country => {
      const name = getCountryName(country).toLowerCase()
      const dialCode = country.dialCode.toLowerCase()
      const code = country.code.toLowerCase()

      return name.includes(query) || dialCode.includes(query) || code.includes(query)
    })
  }

  // 按名称排序
  return countries.sort((a, b) => {
    const nameA = getCountryName(a)
    const nameB = getCountryName(b)
    return nameA.localeCompare(nameB)
  })
})

// 获取国家名称（根据当前语言）
const getCountryName = (country: CountryCode): string => {
  return isChineseLanguage.value ? country.name : country.nameEn
}

// 获取国家标签（用于选项显示）
const getCountryLabel = (country: CountryCode): string => {
  return `${getCountryName(country)} ${country.dialCode}`
}

// 过滤国家列表
const filterCountries = (query: string) => {
  searchQuery.value = query
}

// 处理选择变化
const handleChange = (country: CountryCode) => {
  if (!country) return

  selectedCountry.value = country
  emit('update:modelValue', country)
  emit('change', country)
}

// 处理下拉框显示/隐藏
const handleVisibleChange = (visible: boolean) => {
  if (!visible) {
    // 下拉框关闭时清空搜索
    searchQuery.value = ''
  }
}

// 初始化选中的国家
const initSelectedCountry = () => {
  if (props.modelValue) {
    selectedCountry.value = props.modelValue
  } else {
    selectedCountry.value = getDefaultCountryCode()
    emit('update:modelValue', selectedCountry.value)
  }
}

// 监听外部值变化
watch(
  () => props.modelValue,
  newValue => {
    if (newValue && newValue !== selectedCountry.value) {
      selectedCountry.value = newValue
    }
  },
  { immediate: true }
)

// 监听语言变化，强制更新显示
watch(
  () => locale.value,
  () => {
    // 语言变化时，触发重新渲染
    if (selectedCountry.value) {
      const currentCode = selectedCountry.value.code
      const country = allCountries.value.find(c => c.code === currentCode)
      if (country) {
        selectedCountry.value = { ...country }
      }
    }
  },
  { immediate: true }
)

// 组件挂载时初始化
onMounted(() => {
  initSelectedCountry()
})

// 暴露方法给父组件
defineExpose({
  getSelectedCountry: () => selectedCountry.value,
  setSelectedCountry: (country: CountryCode) => {
    selectedCountry.value = country
    emit('update:modelValue', country)
  },
})
</script>

<style scoped>
.country-code-selector {
  width: 100%;
}

.country-select {
  width: 100%;
}

.selected-display {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 60px;
}

.country-flag {
  font-size: 16px;
  line-height: 1;
}

.country-code {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.country-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 0;
}

.country-option .country-flag {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.country-option .country-name {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.country-option .country-dial {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.empty-text {
  padding: 12px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

/* 隐藏三角形箭头 */
.country-select :deep(.el-select__caret) {
  display: none;
}

/* 下拉框样式 - 使用 :deep 与单类，使用 CSS 变量与低特异性 */
:global(.el-popper.country-code-popper) {
  --popper-max-height: 300px;
  
  max-height: var(--popper-max-height);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  box-shadow: none; /* 无投影 */
  overflow: hidden; /* 裁剪内容以显示圆角 */
}

/* 隐藏三角形箭头 */
:global(.country-code-popper .el-popper__arrow) {
  display: none;
}

:global(.country-code-popper .el-select-group__title) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 8px 12px 4px;
}

:global(.country-code-popper .el-select-group__wrap:not(:last-of-type)) {
  border-bottom: var(--unified-border-bottom);
  margin-bottom: 4px;
  padding-bottom: 4px;
}

/* 响应式设计 */
@media (width <= 480px) {
  .country-option .country-name {
    font-size: 13px;
  }

  .country-option .country-dial {
    font-size: 12px;
  }
}

/* 暗色模式适配 */
html.dark .country-code {
  color: var(--el-text-color-primary);
}

:where(html.dark) .country-option .country-name {
  color: var(--el-text-color-primary);
}

:where(html.dark) .country-option .country-dial {
  color: var(--el-text-color-secondary);
}
</style>
