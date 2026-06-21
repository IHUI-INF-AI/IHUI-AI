<template>
  <div class="knowledge-base-container page-container" role="main">
    <!-- 页面头部 -->
    <header class="knowledge-base-header">
      <div class="header-content">
        <div class="page-title-group">
          <h1 class="page-title">{{ t('knowledgeBase.title') }}</h1>
          <p class="page-subtitle">{{ t('knowledgeBase.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <el-button type="primary" @click="handleCreateKnowledgeBase">
            <el-icon><Plus /></el-icon>
            {{ t('knowledgeBase.createKnowledgeBase') }}
          </el-button>
        </div>
      </div>
    </header>

    <!-- 搜索和筛选 -->
    <div class="filter-bar">
      <div class="unified-search-input-wrap">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('knowledgeBase.searchPlaceholder')"
          clearable
        >
          <template #prefix>
            <SearchIcon />
          </template>
        </el-input>
      </div>
    </div>

    <!-- 知识库列表 -->
    <div class="knowledge-base-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="6" animated />
      </div>

      <el-empty
        v-else-if="knowledgeBases.length === 0 && !error"
        :description="t('knowledgeBase.noKnowledgeBase')"
      >
        <el-button type="primary" @click="handleCreateKnowledgeBase">{{
          t('knowledgeBase.createFirstKnowledgeBase')
        }}</el-button>
      </el-empty>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <el-empty :description="error">
          <el-button type="primary" @click="loadKnowledgeBases">{{
            t('knowledgeBase.retry')
          }}</el-button>
        </el-empty>
      </div>

      <!-- 知识库卡片列表 -->
      <div v-else class="knowledge-base-grid">
        <el-card
          v-for="kb in knowledgeBases"
          :key="kb.id"
          class="knowledge-base-card"
          shadow="hover"
          @click="handleViewKnowledgeBase(kb)"
        >
          <template #header>
            <div class="card-header">
              <h3 class="card-title">{{ kb.kbName || kb.kbId }}</h3>
              <el-dropdown @command="handleCommand">
                <el-icon class="more-icon"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'edit', kb }">{{
                      t('knowledgeBase.edit')
                    }}</el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'delete', kb }" divided>
                      {{ t('knowledgeBase.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
          <div class="card-content">
            <div class="card-meta">
              <span class="meta-item">
                <el-icon><Document /></el-icon>
                {{ kb.documentCount || 0 }} {{ t('knowledgeBase.documentCount') }}
              </span>
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ formatDate(kb.updatedAt) }}
              </span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>

    <!-- 创建/编辑知识库对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      @close="handleDialogClose"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item :label="t('knowledgeBase.kbId')" prop="kbId">
          <el-input
            v-model="formData.kbId"
            :placeholder="t('knowledgeBase.kbIdPlaceholder')"
            :disabled="isEdit"
          />
        </el-form-item>
        <el-form-item :label="t('knowledgeBase.kbName')" prop="kbName">
          <el-input v-model="formData.kbName" :placeholder="t('knowledgeBase.kbNamePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">{{
          t('common.ok')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useApiError } from '@/composables/useApiError'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import { usePagination } from '@/composables/user/usePagination'
import { useRouter } from 'vue-router'
import { Plus, MoreFilled, Document, Clock } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import {
  getKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  searchKnowledge,
  type KnowledgeBase,
} from '@/api/knowledge'
import type { FormInstance, FormRules } from 'element-plus'

const { t } = useI18n()
const router = useRouter() as ReturnType<typeof useRouter> & {
  push: (
    to: string | { path: string; params?: Record<string, string>; name?: string }
  ) => Promise<void>
}
const { handleResult, showError: showErrorMsg } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()
const { loading: apiLoading, error: apiError, execute } = useApiError()

// 响应式数据
const knowledgeBases = ref<KnowledgeBase[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance | undefined>(undefined)
const loading = computed(() => apiLoading.value)
const error = computed(() => apiError.value?.message || null)

const formData = ref({
  kbId: '',
  kbName: '',
})

const formRules: FormRules = {
  kbId: [
    { required: true, message: t('knowledgeBase.kbIdRequired'), trigger: 'blur' },
    { min: 1, max: 100, message: t('knowledgeBase.kbIdLength'), trigger: 'blur' },
  ],
  kbName: [{ max: 200, message: t('knowledgeBase.kbNameLength'), trigger: 'blur' }],
}

// 使用 usePagination composable
const { pagination, handlePageChange, handlePageSizeChange, resetPagination: _resetPagination } = usePagination({
  initialPage: 1,
  initialPageSize: 12,
  onPageChange: async () => {
    await loadKnowledgeBases()
  },
  onPageSizeChange: async () => {
    await loadKnowledgeBases()
  },
})

const dialogTitle = computed(() =>
  isEdit.value
    ? t('knowledgeBase.editKnowledgeBaseDialogTitle')
    : t('knowledgeBase.createKnowledgeBaseDialogTitle')
)

// 搜索防抖
const { searchKeyword } = useDebounceSearch(
  (keyword: string) => {
    if (keyword.trim()) {
      performSearch()
    } else {
      loadKnowledgeBases()
    }
  },
  { delay: 300 }
)

// 加载知识库列表
const loadKnowledgeBases = async () => {
  const result = await execute(
    () =>
      getKnowledgeBases({
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    {
      showMessage: false,
    }
  )

  if (result && 'items' in result) {
    knowledgeBases.value = result.items || []
    pagination.total = result.total || 0
  } else {
    knowledgeBases.value = []
    pagination.total = 0
  }
}

// 执行搜索
const performSearch = async () => {
  if (!searchKeyword.value.trim()) {
    loadKnowledgeBases()
    return
  }

  loading.value = true
  error.value = null

  try {
    // 使用搜索API搜索知识库
    const response = await searchKnowledge({
      query: searchKeyword.value.trim(),
      topK: 50,
    })

    if (response.code === 200 && response.data) {
      // 将搜索结果转换为知识库列表格式
      // 注意：搜索结果可能包含多个知识库的文档，需要去重
      const kbMap = new Map<string, KnowledgeBase>()

      response.data.forEach(result => {
        if (result.kbId) {
          if (!kbMap.has(result.kbId)) {
            // 尝试从现有列表中找到对应的知识库
            const existingKb = knowledgeBases.value.find(kb => kb.kbId === result.kbId)
            if (existingKb) {
              kbMap.set(result.kbId, existingKb)
            } else {
              // 如果不存在，创建一个临时对象
              kbMap.set(result.kbId, {
                id: result.kbId,
                kbId: result.kbId,
                kbName: result.kbId,
                documentCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          }
        }
      })

      knowledgeBases.value = Array.from(kbMap.values())
      pagination.total = knowledgeBases.value.length
    } else {
      error.value = response.message || t('knowledgeBase.searchFailed')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('knowledgeBase.searchFailed')
    showErrorMsg(error.value)
  } finally {
    loading.value = false
  }
}

// 创建知识库
const handleCreateKnowledgeBase = () => {
  isEdit.value = false
  formData.value = {
    kbId: '',
    kbName: '',
  }
  dialogVisible.value = true
}

// 查看知识库详情
const handleViewKnowledgeBase = (kb: KnowledgeBase) => {
  router.push({
    path: `/knowledge/${kb.kbId}`,
    params: { kbId: kb.kbId },
  })
}

// 编辑知识库
const handleEditKnowledgeBase = (kb: KnowledgeBase) => {
  isEdit.value = true
  formData.value = {
    kbId: kb.kbId,
    kbName: kb.kbName || '',
  }
  dialogVisible.value = true
}

// 删除知识库
const handleDeleteKnowledgeBase = async (kb: KnowledgeBase) => {
  const confirmed = await confirmDelete(
    t('knowledgeBase.deleteConfirm', { name: kb.kbName || kb.kbId })
  )
  if (!confirmed) return

  await handleResult(deleteKnowledgeBase(kb.kbId), {
    successMessage: t('knowledgeBase.deleteSuccess'),
    errorMessage: t('knowledgeBase.deleteFailed'),
    onSuccess: () => {
      loadKnowledgeBases()
    },
  })
}

// 处理下拉菜单命令
const handleCommand = (command: { action: string; kb: KnowledgeBase }) => {
  if (command.action === 'edit') {
    handleEditKnowledgeBase(command.kb)
  } else if (command.action === 'delete') {
    handleDeleteKnowledgeBase(command.kb)
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return

    submitting.value = true

    try {
      const apiCall = isEdit.value
        ? updateKnowledgeBase(formData.value.kbId, {
            kbName: formData.value.kbName,
          })
        : createKnowledgeBase({
            kbId: formData.value.kbId,
            kbName: formData.value.kbName,
          })

      await handleResult(apiCall, {
        successMessage: isEdit.value
          ? t('knowledgeBase.updateSuccess')
          : t('knowledgeBase.createSuccess'),
        errorMessage: t('knowledgeBase.operationFailed'),
        onSuccess: () => {
          dialogVisible.value = false
          loadKnowledgeBases()
        },
      })
    } finally {
      submitting.value = false
    }
  })
}

// 关闭对话框
const handleDialogClose = () => {
  formRef.value?.resetFields()
}

// 格式化日期
const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// 初始化
onMounted(() => {
  loadKnowledgeBases()
})
</script>

<style scoped lang="scss">
.knowledge-base-container {
  padding: 24px;
  width: 100%;
  margin: 0 auto;
}

.knowledge-base-header {
  margin-bottom: 24px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .page-title-group {
    .page-title {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px;
      color: var(--el-text-color-primary);
    }

    .page-subtitle {
      font-size: 14px;
      color: var(--el-text-color-regular);
      margin: 0;
    }
  }
}

.filter-bar {
  margin-bottom: 24px;

  .search-input {
    width: 100%;
  }
}

.knowledge-base-content {
  .loading-container,
  .error-container {
    padding: 40px 0;
  }

  .knowledge-base-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .knowledge-base-card {
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-4px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .card-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .more-icon {
        cursor: pointer;
        font-size: 18px;
        color: var(--el-text-color-secondary);
      }
    }

    .card-content {
      .card-meta {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 14px;
        color: var(--el-text-color-regular);

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
      }
    }
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
