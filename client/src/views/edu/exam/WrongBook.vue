<template>
  <!--
    WrongBook.vue — 错题本页
    展示错题列表（题目/分类/标签/掌握状态），支持标记已掌握
    路由: EduExamWrongBook (/edu/exam/wrong-book)
  -->
  <div class="wrong-book">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.exam.wrongBookTitle') }}</h1>
        <p class="page-subtitle">{{ t('edu.exam.wrongBookSubtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadWrongBook">
          {{ t('edu.profile.retry') }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.profile.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- 筛选条 -->
    <div class="filter-bar">
      <el-radio-group v-model="masteredFilter" @change="handleFilterChange">
        <el-radio-button :value="''">{{ t('edu.exam.filterAll') }}</el-radio-button>
        <el-radio-button :value="'unmastered'">{{ t('edu.exam.unmastered') }}</el-radio-button>
        <el-radio-button :value="'mastered'">{{ t('edu.exam.mastered') }}</el-radio-button>
      </el-radio-group>
    </div>

    <div v-loading="loading" class="wrong-body">
      <el-empty
        v-if="!loading && !items.length"
        :description="t('edu.exam.wrongBookEmpty')"
      />
      <el-table
        v-else
        :data="items"
        stripe
        class="wrong-table"
      >
        <el-table-column type="index" width="60" label="#" />
        <el-table-column :label="t('edu.exam.questionType')" min-width="240">
          <template #default="{ row }">
            <div class="question-cell">
              <span class="question-stem-text">{{ getStem(row) }}</span>
              <div v-if="getTags(row)" class="tag-row">
                <el-tag
                  v-for="tag in splitTags(getTags(row))"
                  :key="tag"
                  size="small"
                  class="tag-item"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.exam.difficulty')" width="140" align="center">
          <template #default="{ row }">
            <el-tag v-if="getCategory(row)" size="small" type="info">
              {{ getCategory(row) }}
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('edu.profile.status')" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.mastered" type="success">
              {{ t('edu.exam.mastered') }}
            </el-tag>
            <el-tag v-else type="warning">
              {{ t('edu.exam.unmastered') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('edu.exam.markMastered')"
          width="140"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="!row.mastered && row.id"
              type="primary"
              size="small"
              :loading="markingId === row.id"
              @click="handleMarkMastered(row.id!)"
            >
              {{ t('edu.exam.markMastered') }}
            </el-button>
            <span v-else class="done-text">—</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="page.page"
          v-model:page-size="page.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="loadWrongBook"
          @current-change="loadWrongBook"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { examApi, type EduWrongBookItem } from '@/api/edu'

const { t } = useI18n()

const loading = ref(false)
const error = ref(false)
const markingId = ref<number | null>(null)

const items = ref<EduWrongBookItem[]>([])
const total = ref(0)
const page = reactive({ page: 1, size: 10 })
const masteredFilter = ref<'' | 'mastered' | 'unmastered'>('')

async function loadWrongBook() {
  loading.value = true
  error.value = false
  try {
    const params: Parameters<typeof examApi.myWrongBook>[0] = {
      page: page.page,
      size: page.size,
    }
    if (masteredFilter.value === 'mastered') params.mastered = true
    if (masteredFilter.value === 'unmastered') params.mastered = false

    const res = await examApi.myWrongBook(params)
    items.value = res.data?.data?.items ?? []
    total.value = res.data?.data?.total ?? 0
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  page.page = 1
  loadWrongBook()
}

async function handleMarkMastered(wrongBookId: number) {
  markingId.value = wrongBookId
  try {
    await examApi.markMastered(wrongBookId)
    ElMessage.success(t('edu.exam.markMasteredSuccess'))
    // 本地更新状态，避免重新拉取
    const item = items.value.find((i) => i.id === wrongBookId)
    if (item) {
      item.mastered = true
    }
  } catch {
    // 标记失败由 axios 拦截器统一提示
  } finally {
    markingId.value = null
  }
}

// 兼容错题条目的多种字段结构
function getStem(row: EduWrongBookItem): string {
  const q = row.question as { stem?: string } | undefined
  return q?.stem ?? row.tags ?? `#${row.question_id ?? row.id ?? ''}`
}

function getCategory(row: EduWrongBookItem): string {
  const q = row.question as { category?: string } | undefined
  return q?.category ?? row.category ?? row.category_name ?? ''
}

function getTags(row: EduWrongBookItem): string {
  const q = row.question as { tags?: string } | undefined
  return q?.tags ?? row.tags ?? ''
}

function splitTags(tags: string): string[] {
  if (!tags) return []
  return tags.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)
}

onMounted(loadWrongBook)
</script>

<style scoped lang="scss">
.wrong-book {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.error-alert {
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.wrong-body {
  width: 100%;
  min-height: 200px;
}

.wrong-table {
  border-radius: 8px;
  overflow: hidden;
}

.question-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.question-stem-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-item {
  border-radius: 8px;
}

.done-text {
  color: var(--el-text-color-secondary);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
