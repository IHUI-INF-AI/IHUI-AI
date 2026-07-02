<template>
  <section class="wrong-book-summary">
    <header class="section-header">
      <h3 class="section-title">{{ t('edu.profile.wrongBook') }}</h3>
      <div v-if="wrongBook.length" class="total-badge">
        <span class="total-label">{{ t('edu.profile.totalWrong') }}</span>
        <span class="total-count">{{ totalCount }}</span>
      </div>
    </header>

    <el-empty v-if="!wrongBook.length" :description="t('edu.profile.empty')" />

    <div v-else class="category-tags">
      <el-tag
        v-for="cat in categoryStats"
        :key="cat.category"
        :type="getCategoryTagType(cat.category)"
        size="large"
        effect="light"
        class="category-tag"
      >
        <span class="cat-name">{{ cat.label }}</span>
        <span class="cat-count">{{ cat.count }}</span>
      </el-tag>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  wrongBook: unknown[]
}>()

interface WrongBookItem {
  category?: string
  category_name?: string
  question?: { category?: string; tags?: string }
  tags?: string
}

function asItem(raw: unknown): WrongBookItem {
  return (raw || {}) as WrongBookItem
}

function extractCategory(raw: unknown): string {
  const item = asItem(raw)
  if (item.category) return String(item.category)
  if (item.category_name) return String(item.category_name)
  if (item.question?.category) return String(item.question.category)
  if (item.tags) return String(item.tags.split(',')[0] || '').trim()
  return 'uncategorized'
}

interface CategoryStat {
  category: string
  label: string
  count: number
}

const totalCount = computed(() => props.wrongBook.length)

const categoryStats = computed<CategoryStat[]>(() => {
  const map = new Map<string, number>()
  for (const raw of props.wrongBook) {
    const cat = extractCategory(raw)
    map.set(cat, (map.get(cat) || 0) + 1)
  }
  const stats: CategoryStat[] = []
  for (const [category, count] of map.entries()) {
    stats.push({
      category,
      label: getCategoryLabel(category),
      count,
    })
  }
  return stats.sort((a, b) => b.count - a.count)
})

function getCategoryLabel(category: string): string {
  if (!category || category === 'uncategorized') {
    return t('edu.profile.uncategorized')
  }
  return category
}

function getCategoryTagType(category: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (category) {
    case 'math':
    case 'mathematics':
      return 'primary'
    case 'language':
    case 'english':
      return 'success'
    case 'science':
      return 'warning'
    case 'uncategorized':
      return 'info'
    default:
      return 'danger'
  }
}
</script>

<style lang="scss" scoped>
:where(.wrong-book-summary) {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

:where(.section-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

:where(.section-title) {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:where(.total-badge) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--color-white-10);
  border: 1px solid var(--color-white-30);
}

:where(.total-label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.total-count) {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-danger);
}

:where(.category-tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
}

:where(.category-tag) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default;
}

:where(.cat-name) {
  font-weight: 500;
}

:where(.cat-count) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-white-30);
  font-size: 12px;
  font-weight: 600;
}
</style>
