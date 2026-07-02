<template>
  <div class="advanced-search">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ t('search.advanced') }}</span>
          <el-button link size="small" @click="handleReset">
            {{ t('search.reset') }}
          </el-button>
        </div>
      </template>

      <el-form :model="form" label-width="100px" label-position="top">
        <!-- 关键词搜索 -->
        <el-form-item :label="t('search.keyword')">
          <el-input
            v-model="form.keyword"
            :placeholder="t('search.keywordPlaceholder')"
            clearable
          />
        </el-form-item>

        <!-- 多条件搜索 -->
        <el-form-item :label="t('search.conditions')">
          <div class="search-conditions">
            <el-select
              v-model="form.field"
              :placeholder="t('search.selectField')"
              style="width: 120px; margin-right: 8px"
            >
              <el-option
                v-for="field in effectiveFields"
                :key="field.value"
                :label="field.label"
                :value="field.value"
              />
            </el-select>
            <el-select
              v-model="form.operator"
              :placeholder="t('search.selectOperator')"
              style="width: 120px; margin-right: 8px"
            >
              <el-option
                v-for="op in effectiveOperators"
                :key="op.value"
                :label="op.label"
                :value="op.value"
              />
            </el-select>
            <!-- value 输入: 根据当前 field 是否带 options 动态切换 select / input -->
            <el-select
              v-if="currentFieldOptions && currentFieldOptions.length"
              v-model="form.value"
              :placeholder="t('search.valuePlaceholder')"
              style="flex: 1"
              clearable
            >
              <el-option
                v-for="opt in currentFieldOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-input
              v-else
              v-model="form.value"
              :placeholder="t('search.valuePlaceholder')"
              style="flex: 1"
            />
            <el-button @click="handleAddCondition">
              {{ t('search.add') }}
            </el-button>
          </div>
        </el-form-item>

        <!-- 已添加的条件 -->
        <el-form-item v-if="conditions.length > 0" :label="t('search.addedConditions')">
          <div class="conditions-list">
            <el-tag
              v-for="(condition, index) in conditions"
              :key="index"
              closable
              @close="handleRemoveCondition(index)"
              style="margin-right: 8px; margin-bottom: 8px"
            >
              {{ getConditionText(condition) }}
            </el-tag>
          </div>
        </el-form-item>

        <!-- 搜索预设 -->
        <el-form-item :label="t('search.presets')">
          <el-select
            v-model="selectedPreset"
            :placeholder="t('search.selectPreset')"
            clearable
            @change="handlePresetChange"
            style="width: 100%"
          >
            <el-option
              v-for="preset in presets"
              :key="preset.id"
              :label="preset.name"
              :value="preset.id"
            />
          </el-select>
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="searching">
            {{ t('search.search') }}
          </el-button>
          <el-button @click="handleReset">
            {{ t('search.reset') }}
          </el-button>
          <el-button v-if="canSavePreset" @click="handleSavePreset">
            {{ t('search.savePreset') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSearchHistory } from '@/composables/useSearchHistory'
import { logger } from '@/utils/logger'

const { t } = useI18n()

export interface SearchCondition {
  field: string
  operator: string
  value: string
}

export interface SearchPreset {
  id: string
  name: string
  conditions: SearchCondition[]
  keyword?: string
}

/** 字段配置: 支持 input (默认) 或 select (带 options) */
export interface FieldConfig {
  label: string
  value: string
  options?: { label: string; value: string }[]
}

export interface OperatorConfig {
  label: string
  value: string
}

interface Props {
  /** 可用字段列表; 不传则使用默认 4 字段 (name/description/category/tag) */
  fields?: FieldConfig[]
  /** 操作符列表; 不传则使用默认 4 操作符 (contains/equals/startsWith/endsWith) */
  operators?: OperatorConfig[]
  /** 预设存储的 localStorage key; 默认 'search-presets' */
  presetKey?: string
  /** 搜索历史的 storage key; 默认 'advanced-search-history' */
  historyKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  fields: () => [
    { label: t('search.field.name'), value: 'name' },
    { label: t('search.field.description'), value: 'description' },
    { label: t('search.field.category'), value: 'category' },
    { label: t('search.field.tag'), value: 'tag' },
  ],
  operators: () => [
    { label: t('search.operator.contains'), value: 'contains' },
    { label: t('search.operator.equals'), value: 'equals' },
    { label: t('search.operator.startsWith'), value: 'startsWith' },
    { label: t('search.operator.endsWith'), value: 'endsWith' },
  ],
  presetKey: 'search-presets',
  historyKey: 'advanced-search-history',
})

const emit = defineEmits<{
  search: [conditions: SearchCondition[], keyword?: string]
  reset: []
}>()

const form = reactive({
  keyword: '',
  field: '',
  operator: 'contains',
  value: '',
})

const conditions = ref<SearchCondition[]>([])
const selectedPreset = ref<string>('')
const searching = ref(false)

// 生效字段/操作符 (优先用 prop, 兜底默认值)
const effectiveFields = computed(() => props.fields)
const effectiveOperators = computed(() => props.operators)

// 当前选中字段对应的 options (用于 value 输入切换 select / input)
const currentFieldOptions = computed(() => {
  if (!form.field) return null
  const f = effectiveFields.value.find(fd => fd.value === form.field)
  return f?.options && f.options.length ? f.options : null
})

// 搜索预设（从 localStorage 加载）
const presets = ref<SearchPreset[]>([])

// 是否可以保存预设
const canSavePreset = computed(() => {
  return conditions.value.length > 0 || form.keyword.trim() !== ''
})

// 加载预设
const loadPresets = () => {
  try {
    const stored = localStorage.getItem(props.presetKey)
    if (stored) {
      presets.value = JSON.parse(stored)
    }
  } catch (error) {
    logger.warn(t('common.errors.fetchFailed'), {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// 保存预设
const savePresets = () => {
  try {
    localStorage.setItem(props.presetKey, JSON.stringify(presets.value))
  } catch (error) {
    logger.warn(t('common.errors.saveFailed'), {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// 添加条件
const handleAddCondition = () => {
  if (!form.field || !form.value.trim()) {
    return
  }

  conditions.value.push({
    field: form.field,
    operator: form.operator,
    value: form.value,
  })

  // 重置表单
  form.field = ''
  form.operator = 'contains'
  form.value = ''
}

// 移除条件
const handleRemoveCondition = (index: number) => {
  conditions.value.splice(index, 1)
}

// 获取条件文本
const getConditionText = (condition: SearchCondition): string => {
  const field =
    effectiveFields.value.find(f => f.value === condition.field)?.label || condition.field
  const operator =
    effectiveOperators.value.find(o => o.value === condition.operator)?.label || condition.operator
  return `${field} ${operator} ${condition.value}`
}

// 搜索
const handleSearch = () => {
  searching.value = true
  emit('search', conditions.value, form.keyword.trim() || undefined)

  // 使用搜索历史
  const searchHistory = useSearchHistory({ storageKey: props.historyKey })
  if (form.keyword.trim()) {
    searchHistory.addToHistory(form.keyword.trim())
  }

  setTimeout(() => {
    searching.value = false
  }, 300)
}

// 重置
const handleReset = () => {
  form.keyword = ''
  form.field = ''
  form.operator = 'contains'
  form.value = ''
  conditions.value = []
  selectedPreset.value = ''
  emit('reset')
}

// 预设变化
const handlePresetChange = (presetId: string) => {
  if (!presetId) return

  const preset = presets.value.find(p => p.id === presetId)
  if (preset) {
    conditions.value = [...preset.conditions]
    if (preset.keyword) {
      form.keyword = preset.keyword
    }
  }
}

// 保存预设
const handleSavePreset = () => {
  const name = prompt(t('search.presetName'))
  if (!name) return

  const preset: SearchPreset = {
    id: Date.now().toString(),
    name,
    conditions: [...conditions.value],
    keyword: form.keyword.trim() || undefined,
  }

  presets.value.push(preset)
  savePresets()
}

// 初始化
loadPresets()
</script>

<style scoped lang="scss">
.advanced-search {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .search-conditions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .conditions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
