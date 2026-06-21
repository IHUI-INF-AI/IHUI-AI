<template>
  <div class="knowledge-detail-container page-container" role="main">
    <!-- 页面头部 -->
    <header class="detail-header">
      <div class="header-content">
        <div class="page-title-group">
          <el-button link @click="router.back()" class="back-button">
            <el-icon><ArrowLeft /></el-icon>
            {{ t('knowledgeDetail.back') }}
          </el-button>
          <h1 class="page-title">
            {{ knowledgeBase?.kbName || knowledgeBase?.kbId || t('knowledgeDetail.title') }}
          </h1>
        </div>
        <div class="header-actions">
          <el-button @click="handleAddDocument">
            <el-icon><Plus /></el-icon>
            {{ t('knowledgeDetail.addDocument') }}
          </el-button>
        </div>
      </div>
    </header>

    <!-- 文档列表 -->
    <div class="documents-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="6" animated />
      </div>

      <el-empty
        v-else-if="documents.length === 0 && !error"
        :description="t('knowledgeDetail.noDocuments')"
      >
        <el-button type="primary" @click="handleAddDocument">{{
          t('knowledgeDetail.addDocument')
        }}</el-button>
      </el-empty>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <el-empty :description="error">
          <el-button type="primary" @click="loadDocuments">{{
            t('knowledgeDetail.retry')
          }}</el-button>
        </el-empty>
      </div>

      <!-- 文档列表 -->
      <div v-else class="documents-list">
        <el-card v-for="doc in documents" :key="doc.id" class="document-card" shadow="hover">
          <div class="document-content">
            <div class="document-text">
              {{ doc.content.substring(0, 200) }}{{ doc.content.length > 200 ? '...' : '' }}
            </div>
            <div class="document-meta">
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                {{ formatDate(doc.updatedAt) }}
              </span>
              <el-button link type="danger" size="small" @click="handleDeleteDocument(doc)">
                {{ t('knowledgeDetail.delete') }}
              </el-button>
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
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>

    <!-- 添加文档对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="t('knowledgeDetail.addDocumentDialogTitle')"
      width="600px"
      @close="handleDialogClose"
    >
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item :label="t('knowledgeDetail.documentContent')" prop="content">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="10"
            :placeholder="t('knowledgeDetail.documentContentPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('knowledgeDetail.metadataJson')" prop="metadata">
          <el-input
            v-model="formData.metadataText"
            type="textarea"
            :rows="4"
            :placeholder="t('knowledgeDetail.metadataPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('knowledgeDetail.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">{{
          t('knowledgeDetail.confirm')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted, computed } from 'vue'
import { logger } from '../utils/logger'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import { ArrowLeft, Plus, Clock } from '@element-plus/icons-vue'
import {
  getKnowledgeBase,
  getKnowledgeBaseDocuments,
  addDocumentToKnowledgeBase,
  deleteKnowledgeBaseDocument,
  type KnowledgeBase,
  type KnowledgeDocument,
} from '@/api/knowledge'
import type { FormInstance, FormRules } from 'element-plus'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { handleResult, showError: showErrorMsg } = useOperationFeedback()
const { confirmDelete } = useConfirmDialog()
const { loading, error } = usePageState()

const kbId = computed(() => route.params.kbId as string)

// 响应式数据
const knowledgeBase = ref<KnowledgeBase | null>(null)
const documents = ref<KnowledgeDocument[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance | undefined>(undefined)

const formData = ref({
  content: '',
  metadataText: '',
})

const formRules: FormRules = {
  content: [
    { required: true, message: t('knowledgeDetail.pleaseEnterDocumentContent'), trigger: 'blur' },
    { min: 10, message: t('knowledgeDetail.documentContentMinLength'), trigger: 'blur' },
  ],
}

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
})

// 加载知识库详情
const loadKnowledgeBase = async () => {
  try {
    const response = await getKnowledgeBase(kbId.value)
    if (response.code === 200 && response.data) {
      knowledgeBase.value = response.data
    }
  } catch (err) {
    logger.error(t('knowledgeDetail.loadKnowledgeBaseFailed'), err)
  }
}

// 加载文档列表
const loadDocuments = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await getKnowledgeBaseDocuments(kbId.value, {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    })

    if (response.code === 200 && response.data) {
      documents.value = response.data.items || []
      pagination.value.total = response.data.total || 0
    } else {
      const errorMsg = response.message || t('knowledgeDetail.loadDocumentsFailed')
      error.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showErrorMsg(errorMsg)
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : t('knowledgeDetail.loadDocumentsFailed')
    error.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: err,
    }
    showErrorMsg(errorMsg)
  } finally {
    loading.value = false
  }
}

// 添加文档
const handleAddDocument = () => {
  formData.value = {
    content: '',
    metadataText: '',
  }
  dialogVisible.value = true
}

// 删除文档
const handleDeleteDocument = async (doc: KnowledgeDocument) => {
  const confirmed = await confirmDelete(t('knowledgeDetail.deleteDocumentConfirm'))
  if (!confirmed) return

  await handleResult(deleteKnowledgeBaseDocument(kbId.value, doc.id), {
    successMessage: t('knowledgeDetail.deleteSuccess'),
    errorMessage: t('knowledgeDetail.deleteFailed'),
    onSuccess: () => {
      loadDocuments()
    },
  })
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return

    submitting.value = true

    try {
      let metadata: Record<string, unknown> | undefined
      if (formData.value.metadataText) {
        try {
          metadata = JSON.parse(formData.value.metadataText)
        } catch {
          showErrorMsg(t('knowledgeDetail.metadataFormatError'))
          submitting.value = false
          return
        }
      }

      await handleResult(
        addDocumentToKnowledgeBase(kbId.value, {
          content: formData.value.content,
          metadata,
        }),
        {
          successMessage: t('knowledgeDetail.addSuccess'),
          errorMessage: t('knowledgeDetail.addFailed'),
          onSuccess: () => {
            dialogVisible.value = false
            loadDocuments()
          },
        }
      )
    } catch (err) {
      showErrorMsg(err instanceof Error ? err.message : t('knowledgeDetail.addFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 关闭对话框
const handleDialogClose = () => {
  formRef.value?.resetFields()
}

// 分页变化
const onPageChange = (page: number) => {
  pagination.value.page = page
  loadDocuments()
}

const onPageSizeChange = (pageSize: number) => {
  pagination.value.pageSize = pageSize
  pagination.value.page = 1
  loadDocuments()
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
  loadKnowledgeBase()
  loadDocuments()
})
</script>

<style scoped lang="scss">
.knowledge-detail-container {
  padding: 24px;
  width: 100%;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: 24px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .page-title-group {
    display: flex;
    align-items: center;
    gap: 16px;

    .back-button {
      padding: 8px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0;
      color: var(--el-text-color-primary);
    }
  }
}

.documents-content {
  .loading-container,
  .error-container {
    padding: 40px 0;
  }

  .documents-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
  }

  .document-card {
    .document-content {
      .document-text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--el-text-color-primary);
        margin-bottom: 12px;
      }

      .document-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: var(--el-text-color-regular);

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
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
