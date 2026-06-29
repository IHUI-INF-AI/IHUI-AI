<template>
  <div class="agents-filter-bar">
    <div class="filter-row">
      <!-- 搜索框 -->
      <div class="filter-item search-wrapper unified-search-bar">
        <el-input
          v-model="localSearchKeyword"
          :placeholder="t('agents.searchPlaceholder')"
          clearable
          :aria-label="t('agents.searchPlaceholder')"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <SearchIcon class="search-icon" />
          </template>
        </el-input>
      </div>

      <!-- 分类筛选 -->
      <el-select
        v-model="localSelectedCategory"
        :placeholder="t('agents.categoryFilter')"
        clearable
        class="filter-item category-select"
        :aria-label="t('agents.categoryFilter')"
        @change="handleCategoryChange"
      >
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        >
          <span>{{ category.name }}</span>
          <span v-if="category.count !== undefined" class="category-count">
            ({{ category.count }})
          </span>
        </el-option>
      </el-select>

      <!-- 平台筛选 -->
      <el-select
        v-model="localSelectedPlatform"
        :placeholder="t('agents.platformFilter')"
        clearable
        class="filter-item platform-select"
        :aria-label="t('agents.platformFilter')"
        @change="handlePlatformChange"
      >
        <el-option :label="t('agents.platformAll')" value="all" />
        <el-option :label="t('agents.platformInternal')" value="internal" />
        <el-option :label="t('agents.platformCoze')" value="coze" />
        <el-option :label="t('agents.platformN8n')" value="n8n" />
        <el-option :label="t('agents.platformDify')" value="dify" />
        <el-option :label="t('agents.platformMake')" value="make" />
        <el-option :label="t('agents.platformDashscope')" value="dashscope" />
      </el-select>

      <!-- 排序 -->
      <el-select
        v-model="localSortBy"
        :placeholder="t('agents.sortBy')"
        class="filter-item sort-select"
        :aria-label="t('agents.sortBy')"
        @change="handleSortChange"
      >
        <el-option :label="t('agents.sortByUsage')" value="usageCount" />
        <el-option :label="t('agents.sortByRating')" value="rating" />
        <el-option :label="t('agents.sortByTime')" value="createTime" />
      </el-select>

      <!-- 搜索按钮：使用 agents-search-btn 避免被全局 .unified-search-bar .search-btn 等覆盖 -->
      <el-button
        type="primary"
        class="filter-item agents-search-btn"
        :aria-label="t('common.search')"
        @click="handleSearch"
      >
        <SearchIcon />
        <span>{{ t('common.search') }}</span>
      </el-button>
    </div>

    <!-- 筛选条件摘要 -->
    <div v-if="hasActiveFilters" class="filter-summary">
      <span class="summary-label">{{ t('agents.activeFilters') }}:</span>
      <el-tag v-if="localSearchKeyword" closable size="small" @close="clearSearch">
        {{ t('agents.keyword') }}: {{ localSearchKeyword }}
      </el-tag>
      <el-tag
        v-if="localSelectedCategory && localSelectedCategory !== 'all'"
        closable
        size="small"
        @close="clearCategory"
      >
        {{ getCategoryName(localSelectedCategory) }}
      </el-tag>
      <el-tag v-if="localSelectedPlatform" closable size="small" @close="clearPlatform">
        {{ getPlatformName(localSelectedPlatform) }}
      </el-tag>
      <el-button link type="primary" size="small" @click="clearAllFilters">
        {{ t('agents.clearAll') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SearchIcon from '@/components/common/SearchIcon.vue'
import type { AgentCategory, AgentPlatform } from '@/api/agents'

const { t } = useI18n()

interface Props {
  searchKeyword: string
  selectedCategory: string | undefined
  selectedPlatform?: string
  sortBy: string
  categories: AgentCategory[]
}

interface Emits {
  (e: 'update:searchKeyword', value: string): void
  (e: 'update:selectedCategory', value: string): void
  (e: 'update:selectedPlatform', value: string | undefined): void
  (e: 'update:sortBy', value: string): void
  (e: 'search'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localSearchKeyword = ref(props.searchKeyword)
const localSelectedCategory = ref(props.selectedCategory)
const localSelectedPlatform = ref(props.selectedPlatform)
const localSortBy = ref(props.sortBy)

watch(
  () => props.searchKeyword,
  val => (localSearchKeyword.value = val)
)
watch(
  () => props.selectedCategory,
  val => (localSelectedCategory.value = val)
)
watch(
  () => props.selectedPlatform,
  val => (localSelectedPlatform.value = val)
)
watch(
  () => props.sortBy,
  val => (localSortBy.value = val)
)

const hasActiveFilters = computed(() => {
  return (
    !!localSearchKeyword.value ||
    (localSelectedCategory.value !== 'all' && !!localSelectedCategory.value) ||
    !!localSelectedPlatform.value
  )
})

const handleSearch = () => {
  emit('update:searchKeyword', localSearchKeyword.value)
  emit('search')
}

const handleCategoryChange = () => {
  emit('update:selectedCategory', localSelectedCategory.value)
  emit('search')
}

const handlePlatformChange = () => {
  emit('update:selectedPlatform', localSelectedPlatform.value)
  emit('search')
}

const handleSortChange = () => {
  emit('update:sortBy', localSortBy.value)
  emit('search')
}

const clearSearch = () => {
  localSearchKeyword.value = ''
  handleSearch()
}

const clearCategory = () => {
  localSelectedCategory.value = 'all'
  handleCategoryChange()
}

const clearPlatform = () => {
  localSelectedPlatform.value = undefined
  handlePlatformChange()
}

const clearAllFilters = () => {
  localSearchKeyword.value = ''
  localSelectedCategory.value = 'all'
  localSelectedPlatform.value = undefined
  emit('update:searchKeyword', '')
  emit('update:selectedCategory', 'all')
  emit('update:selectedPlatform', undefined)
  emit('search')
}

const getCategoryName = (id: string): string => {
  const category = props.categories.find((c: AgentCategory) => c.id === id)
  return category?.name || id
}

const getPlatformName = (platform: AgentPlatform | undefined): string => {
  if (!platform) return ''
  switch (platform) {
    case 'coze':
      return t('agents.platformCoze')
    case 'n8n':
      return t('agents.platformN8n')
    case 'dify':
      return t('agents.platformDify')
    case 'make':
      return t('agents.platformMake')
    case 'dashscope':
      return t('agents.platformDashscope')
    case 'internal':
      return t('agents.platformInternal')
    default:
      return platform
  }
}
</script>

<style scoped lang="scss">
// 组件级 CSS 变量定义
.agents-filter-bar {
  // 筛选行控件统一高度（与 Element Plus 默认 44px 对齐）
  --afb-control-height: 44px;

  // 亮色模式变量
  --afb-row-bg: transparent;
  --afb-row-border: none;
  --afb-row-shadow: none;
  --afb-search-bg: var(--color-neutral-100);
  --afb-search-bg-hover: var(--el-bg-color);
  --afb-select-bg: var(--color-neutral-100);
  --afb-select-bg-hover: var(--el-bg-color);
  --afb-summary-bg: var(--color-neutral-100);

  // 搜索按钮沿用全局 primary（--el-color-primary），不在此覆盖

  margin-bottom: 24px;

  .filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--afb-row-bg);
    border: var(--afb-row-border);
    border-radius: var(--global-border-radius);
    box-shadow: var(--afb-row-shadow);

    .filter-item {
      height: var(--afb-control-height);
      min-height: var(--afb-control-height);
      border-radius: var(--global-border-radius);
      flex-shrink: 0;
    }

    .search-wrapper {
      flex: 1;
      min-width: 200px;
      max-width: 400px;
      height: var(--afb-control-height);

      /* 覆盖全局 .unified-search-bar 的 padding，使输入框与容器边缘对齐，避免视觉上的“偏离” */
      padding: 0;
      box-sizing: border-box;

      :deep(.el-input) {
        height: 100%;
      }

      :deep(.el-input__wrapper) {
        height: 100%;
        min-height: var(--afb-control-height);
        padding: 0 14px;
        border-radius: var(--global-border-radius);
        box-shadow: none;
        display: flex;
        align-items: center;
      }
    }

    .category-select,
    .platform-select,
    .sort-select {
      width: 160px;
      height: var(--afb-control-height);
      background: var(--afb-select-bg);
      border: none;
      transition: background-color 0.2s ease;

      :deep(.el-select__wrapper) {
        height: 100%;
        min-height: var(--afb-control-height);
        width: 100%;
        border: none;
        background: transparent;
        box-shadow: none;
        padding: 0 14px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: space-between;

        .el-select__placeholder,
        .el-select__selected-item {
          flex: 1;
          width: 100%;
          font-size: 14px;
          color: var(--el-text-color-regular);
          line-height: 1;
          display: flex;
          align-items: center;
          margin: 0;
          padding: 0;
        }

        .el-select__caret {
          font-size: 14px;
          color: var(--el-text-color-secondary);
          margin-left: 8px;
          flex-shrink: 0;
        }
      }

      &:hover {
        background: var(--afb-select-bg-hover);
      }

      :deep(.el-select.is-focused .el-select__wrapper) {
        background: transparent;
      }

      :deep(.el-select.is-focused) {
        background: var(--afb-select-bg-hover);
      }
    }

    // 搜索按钮 - 仅控制高度与对齐，外观由全局 .el-button--primary 规则控制（已从按钮重置中排除 primary）
    .agents-search-btn.el-button {
      height: var(--afb-control-height);
      min-height: var(--afb-control-height);
      padding: 0 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: none;
    }
  }

  .filter-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 16px;
    border-radius: var(--global-border-radius);
    background: var(--afb-summary-bg);
    border: none;

    .summary-label {
      font-size: 13px;
      color: var(--el-text-color-regular);
      margin-right: 4px;
    }

    :deep(.el-tag) {
      border-radius: var(--global-border-radius);
    }
  }
}

// 暗色模式 - 使用变量覆盖
:global(html.dark) .agents-filter-bar,
html.dark .agents-filter-bar {
  --afb-row-bg: transparent;
  --afb-row-border: none;
  --afb-row-shadow: none;
  --afb-search-bg: var(--color-dark-bg-1);
  --afb-search-bg-hover: var(--color-dark-bg-3);
  --afb-select-bg: var(--color-dark-bg-1);
  --afb-select-bg-hover: var(--color-dark-bg-3);
  --afb-summary-bg: var(--color-dark-bg-1);
}

@media (width <= 1024px) {
  .agents-filter-bar .filter-row {
    flex-wrap: wrap;

    .search-wrapper {
      flex: 1 1 100%;
      max-width: 100%;
    }

    .category-select,
    .platform-select,
    .sort-select {
      flex: 1 1 calc(33.333% - 7px);
      min-width: 120px;
    }

    .agents-search-btn {
      flex: 1 1 100%;
      width: 100%;
    }
  }
}
</style>
