<template>
  <div class="agent-category-manager">
    <el-page-header @back="goBack" class="page-header">
      <template #content>
        <h2>{{ t('agentCategory.title') }}</h2>
      </template>
    </el-page-header>

    <Card class="main-card shadow-none"><CardHeader>
        <div class="card-header">
          <span>{{ t('agentCategory.configList') }}</span>
          <div style="display: flex; gap: 10px">
            <Input
              v-model="searchKeyword"
              :placeholder="t('agentCategory.searchPlaceholder')"
              style="width: 240px"
              clearable
              @input="debouncedLoadCategories"
            />
            <Select v-model="filterType" @change="loadCategories" style="width: 120px" clearable>
              <SelectOption :label="t('agentCategory.allTypes')" value="" />
              <SelectOption :label="t('agentCategory.free')" value="1" />
              <SelectOption :label="t('agentCategory.limitFree')" value="2" />
              <SelectOption :label="t('agentCategory.paid')" value="3" />
            </Select>
            <Button variant="default" @click="showCreateDialog = true">
              <Plus class="h-4 w-4" />
              {{ t('agentCategory.addConfig') }}
            </Button>
          </div>
        </div>
      </CardHeader><CardContent class="p-5">
      
      <div v-if="loading" class="flex justify-center py-8 text-muted-foreground">Loading...</div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="min-w-[150px]">{{ t('agentCategory.agentName') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentCategory.agentId') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('agentCategory.mainCategory') }}</TableHead>
            <TableHead class="w-[100px]">{{ t('agentCategory.type') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentCategory.price') }}</TableHead>
            <TableHead class="w-[120px]">{{ t('agentCategory.creator') }}</TableHead>
            <TableHead class="w-[180px]">{{ t('agentCategory.createTime') }}</TableHead>
            <TableHead class="w-[150px]">{{ t('agentCategory.editConfig') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in categoryList" :key="row.id ?? index">
            <TableCell>{{ row.agent_name }}</TableCell>
            <TableCell>{{ row.agent_id }}</TableCell>
            <TableCell>{{ getMainCategoryText(row.agent_main_category) }}</TableCell>
            <TableCell>
              <Tag :type="getTypeTagType(row.type)">
                {{ getTypeText(row.type) }}
              </Tag>
            </TableCell>
            <TableCell>
              <span v-if="row.account"
                >¥{{ (row.account / 100).toFixed(2) }}/{{ t('agentCategory.pricePerMonth') }}</span
              >
              <span v-else style="color: hsl(var(--muted-foreground))">-</span>
            </TableCell>
            <TableCell>{{ row.create_name }}</TableCell>
            <TableCell>{{ formatTime(row.create_time) }}</TableCell>
            <TableCell>
              <Button variant="link" @click="handleEdit(row)">{{
                t('agentCategory.edit')
              }}</Button>
              <Button variant="link" @click="handleDelete(row)">{{
                t('agentCategory.delete')
              }}</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Pagination
        v-if="pagination.total > 0"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="prev, pager, next, sizes, jumper, total"
        @size-change="loadCategories"
        @current-change="loadCategories"
        style="margin-top: 20px"
      />
    </CardContent></Card>

    <!-- 创建/编辑对话框 -->
    <Dialog
      v-model="showCreateDialog"
      width="600px"
    >
      <DialogHeader>
        <DialogTitle>{{ editingCategory ? t('agentCategory.editConfig') : t('agentCategory.addConfig') }}</DialogTitle>
      </DialogHeader>
      <form
        ref="categoryFormRef"
        @submit.prevent
      >
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.agentId') }}</label>
          <div class="flex-1">
            <Input
              v-model="categoryForm.agent_id"
              :placeholder="t('agentCategory.agentIdPlaceholder')"
            />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.agentName') }}</label>
          <div class="flex-1">
            <Input
              v-model="categoryForm.agent_name"
              :placeholder="t('agentCategory.agentNamePlaceholder')"
            />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.mainCategory') }}</label>
          <div class="flex-1">
            <Select v-model="categoryForm.agent_main_category" style="width: 100%">
              <SelectOption :label="t('agentCategory.text')" value="1" />
              <SelectOption :label="t('agentCategory.image')" value="2" />
              <SelectOption :label="t('agentCategory.video')" value="3" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.type') }}</label>
          <div class="flex-1">
            <Radio v-model="categoryForm.type" value="1">{{ t('agentCategory.free') }}</Radio>
            <Radio v-model="categoryForm.type" value="2">{{ t('agentCategory.limitFree') }}</Radio>
            <Radio v-model="categoryForm.type" value="3">{{ t('agentCategory.paid') }}</Radio>
          </div>
        </div>
        <div
          v-if="categoryForm.type === '3'"
          class="mb-4 flex items-center gap-4"
        >
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.pricePerMonthPlaceholder') }}</label>
          <div class="flex-1">
            <el-input-number
              v-model="categoryForm.account"
              :min="0"
              :precision="0"
              style="width: 100%"
            />
          </div>
        </div>
        <div
          v-if="categoryForm.type === '2'"
          class="mb-4 flex items-center gap-4"
        >
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.limitFreeDuration') }}</label>
          <div class="flex-1">
            <Select v-model="categoryForm.limit_free" style="width: 100%">
              <SelectOption :label="t('agentCategory.oneMonth')" value="1" />
              <SelectOption :label="t('agentCategory.threeMonths')" value="2" />
              <SelectOption :label="t('agentCategory.sixMonths')" value="3" />
              <SelectOption :label="t('agentCategory.oneYear')" value="4" />
            </Select>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.group') }}</label>
          <div class="flex-1">
            <Radio v-model="categoryForm.group" value="1">{{ t('agentCategory.member') }}</Radio>
            <Radio v-model="categoryForm.group" value="2">{{ t('agentCategory.all') }}</Radio>
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-28 shrink-0 text-sm font-medium text-foreground">{{ t('agentCategory.description') }}</label>
          <div class="flex-1">
            <Textarea
              v-model="categoryForm.prologue"
              :rows="3"
              :placeholder="t('agentCategory.descriptionPlaceholder')"
            />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="showCreateDialog = false">{{ t('common.cancel') }}</Button>
        <Button variant="default" @click="handleSubmit">{{
          t('common.confirm')
        }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Plus } from '@/lib/lucide-fallback'
import {
  getAgentCategoryList,
  createAgentCategory,
  updateAgentCategory,
  deleteAgentCategory,
  type AgentCategory,
} from '@/api/agent-category'
import { useAuthStore } from '@/stores/auth'
import { validateForm, commonRules } from '@/shared'
import type { FormInstance } from 'element-plus'
import { handleApiError } from '@/utils/error-handler'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { usePageState } from '@/composables/usePageState'
import { ApiErrorType } from '@/utils/errorHandler'
import { formatDateTime as _formatTime } from '@/utils/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Radio } from '@/components/ui/radio'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/ui/pagination'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'

const { t } = useI18n()
const { showSuccess, showWarning, showError: showErrorMsg } = useOperationFeedback()

// 防抖函数
const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return function (this: unknown, ...args: Parameters<T>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait)
  }
}

const router = useRouter()
const authStore = useAuthStore()
const { loading, error: pageError } = usePageState()
const { confirmDelete } = useConfirmDialog()

const categoryList = ref<AgentCategory[]>([])
const searchKeyword = ref('')
const filterType = ref('')
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const showCreateDialog = ref(false)
const editingCategory = ref<AgentCategory | null>(null)
const submitting = ref(false)
const categoryFormRef = ref<FormInstance | null>(null)

const categoryForm = reactive({
  agent_id: '',
  agent_name: '',
  agent_main_category: '1',
  agent_category: '',
  type: '1',
  type_child: undefined as string | undefined,
  account: undefined as number | undefined,
  group: '2',
  limit_free: undefined as number | undefined,
  discount_month: undefined as string | undefined,
  prologue: '',
})

const categoryRules = {
  agent_id: [
    commonRules.required(t('agentCategory.agentIdRequired')),
    commonRules.stringLength(1, 200, t('agentCategory.agentIdLength')),
  ],
  agent_name: [
    commonRules.required(t('agentCategory.agentNameRequired')),
    commonRules.stringLength(1, 100, t('agentCategory.agentNameLength')),
  ],
  agent_main_category: [commonRules.required(t('agentCategory.mainCategoryRequired'))],
  type: [commonRules.required(t('agentCategory.typeRequired'))],
  account: [
    {
      validator: (_rule: unknown, value: unknown, callback: (error?: Error) => void) => {
        if (categoryForm.type === '3' && (value === undefined || value === null || value === '')) {
          callback(new Error(t('agentCategory.priceRequired')))
        } else if (value !== undefined && value !== null && value !== '') {
          const num = Number(value)
          if (isNaN(num) || num < 0) {
            callback(new Error(t('agentCategory.priceMinValue')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

const loadCategories = async () => {
  const user = authStore.user as { uuid?: string; name?: string } | undefined
  if (!user?.uuid) {
    showWarning(t('agentCategory.pleaseLogin'))
    return
  }
  loading.value = true
  pageError.value = null
  try {
    const response = await getAgentCategoryList({
      page: pagination.page,
      pageSize: pagination.pageSize,
      agent_name: searchKeyword.value || undefined,
      type: filterType.value || undefined,
      create_uuid: (authStore.user as { uuid?: string }).uuid || '',
    })
    if (response.code === 200 || response.success) {
      categoryList.value = response.data?.list || []
      pagination.total = response.data?.pagination?.total || 0
    } else {
      const errorMsg = response.message || t('agentCategory.loadFailed')
      pageError.value = {
        type: ApiErrorType.BUSINESS,
        code: response.code,
        message: errorMsg,
      }
      showErrorMsg(errorMsg)
    }
  } catch (error: unknown) {
    const errorMsg =
      (error instanceof Error ? error.message : String(error)) || t('agentCategory.loadFailed')
    pageError.value = {
      type: ApiErrorType.UNKNOWN,
      code: 500,
      message: errorMsg,
      originalError: error,
    }
    showErrorMsg(errorMsg)
  } finally {
    loading.value = false
  }
}

const debouncedLoadCategories = debounce(loadCategories, 300)

const handleEdit = (category: AgentCategory) => {
  editingCategory.value = category
  Object.assign(categoryForm, {
    agent_id: category.agent_id || '',
    agent_name: category.agent_name || '',
    agent_main_category: category.agent_main_category || '1',
    agent_category: category.agent_category || '',
    type: category.type || '1',
    account: category.account,
    group: category.group || '2',
    limit_free: category.limit_free,
    discount_month: category.discount_month,
    prologue: category.prologue || '',
  })
  showCreateDialog.value = true
}

const handleDelete = async (category: AgentCategory) => {
  const confirmed = await confirmDelete(
    category.agent_name || t('agentCategory.agentName')
  )
  if (!confirmed) return
  try {
    const response = await deleteAgentCategory(category.id)
    if (response.code === 200 || response.success) {
      showSuccess(t('agentCategory.deleteSuccess'))
      loadCategories()
    } else {
      handleApiError(
        { response: { data: { message: response.message } } },
        { defaultMessage: t('agentCategory.deleteFailed') }
      )
    }
  } catch (error: unknown) {
    handleApiError(error, { defaultMessage: t('agentCategory.deleteFailed') })
  }
}

const handleSubmit = async () => {
  const isValid = await validateForm(categoryFormRef.value)
  if (!isValid) return
  const user = authStore.user as { uuid?: string; name?: string } | undefined
  if (!user?.uuid) {
    showWarning(t('agentCategory.pleaseLogin'))
    return
  }
  submitting.value = true
  try {
    let response
    if (editingCategory.value) {
      response = await updateAgentCategory({ 
        id: editingCategory.value.id,
        agent_name: categoryForm.agent_name,
        agent_main_category: categoryForm.agent_main_category,
        agent_category: categoryForm.agent_category,
        type: categoryForm.type,
        type_child: categoryForm.type_child,
        account: categoryForm.account,
        group: categoryForm.group,
        limit_free: categoryForm.limit_free,
        discount_month: categoryForm.discount_month,
        prologue: categoryForm.prologue,
      })
    } else {
      // 验证必需字段
      if (!categoryForm.agent_id || !categoryForm.agent_name || !categoryForm.agent_main_category || !categoryForm.agent_category || !categoryForm.type) {
        showWarning(t('agentCategory.missingRequiredFields'))
        return
      }
      response = await createAgentCategory({
        agent_id: categoryForm.agent_id,
        agent_name: categoryForm.agent_name,
        create_uuid: (authStore.user as { uuid?: string }).uuid || '',
        create_name:
          (authStore.user as { name?: string; uuid?: string }).name ||
          (authStore.user as { name?: string; uuid?: string }).uuid ||
          '',
        agent_main_category: categoryForm.agent_main_category,
        agent_category: categoryForm.agent_category,
        type: categoryForm.type,
        type_child: categoryForm.type_child,
        account: categoryForm.account,
        group: categoryForm.group,
        limit_free: categoryForm.limit_free,
        discount_month: categoryForm.discount_month,
        prologue: categoryForm.prologue,
      })
    }
    if (response.code === 200 || response.success) {
      showSuccess(
        editingCategory.value ? t('agentCategory.updateSuccess') : t('agentCategory.createSuccess')
      )
      showCreateDialog.value = false
      resetForm()
      loadCategories()
    } else {
      handleApiError(
        { message: response.message, code: response.code } as unknown,
        { defaultMessage: t('agentCategory.operationFailed') }
      )
    }
  } catch (error: unknown) {
    handleApiError(error, { defaultMessage: t('agentCategory.operationFailed') })
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  editingCategory.value = null
  Object.assign(categoryForm, {
    agent_id: '',
    agent_name: '',
    agent_main_category: '1',
    agent_category: '',
    type: '1',
    account: undefined,
    group: '2',
    limit_free: undefined,
    discount_month: undefined,
    prologue: '',
  })
  if (categoryFormRef.value) {
    categoryFormRef.value.resetFields()
    categoryFormRef.value.clearValidate()
  }
}

const getMainCategoryText = (category?: string): string => {
  const map: Record<string, string> = {
    '1': t('agentCategory.text'),
    '2': t('agentCategory.image'),
    '3': t('agentCategory.video'),
  }
  return map[category || ''] || '-'
}

const getTypeText = (type?: string): string => {
  const map: Record<string, string> = {
    '1': t('agentCategory.free'),
    '2': t('agentCategory.limitFree'),
    '3': t('agentCategory.paid'),
  }
  return map[type || ''] || '-'
}

const getTypeTagType = (type?: string): string => {
  const map: Record<string, string> = {
    '1': 'success',
    '2': 'warning',
    '3': 'primary',
  }
  return map[type || ''] || 'info'
}

const formatTime = (time?: string): string => {
  return time ? _formatTime(time) : '-'
}

const goBack = () => {
  router.replace('/')
}

onMounted(() => {
  loadCategories()
})
</script>

<style scoped lang="scss">
.agent-category-manager {
  padding: 20px;

  .page-header {
    margin-bottom: 20px;
  }

  .main-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }
}
</style>
