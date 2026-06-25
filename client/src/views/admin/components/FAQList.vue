<template>
  <AdminListPage
    :title="t('adminComponents.faq.title')"
    :description="t('adminComponents.faq.desc')"
    :columns="columns"
    :data="faqs"
    :total="total"
    :loading="loading"
    :show-add="true"
    @add="handleAdd"
    @search="handleSearch"
    @refresh="fetchFAQs"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminComponents.faq.filterCategory')">
        <el-select v-model="filterCategory" :placeholder="t('adminComponents.faq.categoryAll')" clearable @change="fetchFAQs">
          <el-option :label="t('adminComponents.faq.categoryAccount')" value="account" />
          <el-option :label="t('adminComponents.faq.categoryPayment')" value="payment" />
          <el-option :label="t('adminComponents.faq.categoryFeature')" value="feature" />
          <el-option :label="t('adminComponents.faq.categoryOther')" value="other" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-category="{ row }">
      <el-tag size="small">{{ getCategoryText(row.category) }}</el-tag>
    </template>

    <template #col-question="{ row }">
      <el-tooltip :content="row.question" placement="top">
        <span class="question-text">{{ row.question }}</span>
      </el-tooltip>
    </template>

    <template #col-isTop="{ row }">
      <el-switch :model-value="row.isTop" @change="(val: boolean) => toggleTop(row, val)" />
    </template>

    <template #col-status="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'info'">
        {{ row.status === 'active' ? t('adminComponents.faq.statusActive') : t('adminComponents.faq.statusInactive') }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="editFAQ(row)">
        {{ t('adminComponents.listPage.edit') }}
      </el-button>
      <el-popconfirm :title="t('adminComponents.listPage.deleteConfirm')" @confirm="deleteFAQ(row)">
        <template #reference>
          <el-button type="danger" link size="small">{{ t('adminComponents.listPage.delete') }}</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getAdminFAQs,
  createAdminFAQ as _createAdminFAQ,
  updateAdminFAQ as _updateAdminFAQ,
  deleteAdminFAQ,
  toggleAdminFAQTop,
  type AdminFAQ,
} from '@/api/admin/admin/admin-faq'

const { t } = useI18n()

const columns = computed<TableColumn[]>(() => [
  { prop: 'question', label: t('adminComponents.faq.colQuestion'), minWidth: 200, slot: true },
  { prop: 'category', label: t('adminComponents.faq.colCategory'), width: 100, slot: true },
  { prop: 'isTop', label: t('adminComponents.faq.colIsTop'), width: 80, slot: true },
  { prop: 'views', label: t('adminComponents.faq.colViews'), width: 80 },
  { prop: 'status', label: t('adminComponents.product.filterStatus'), width: 80, slot: true },
  { prop: 'createdAt', label: t('adminComponents.product.colCreatedAt'), width: 180, type: 'date' },
])

const faqs = ref<AdminFAQ[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterCategory = ref('')

const categoryMap = computed<Record<string, string>>(() => ({
  account: t('adminComponents.faq.categoryAccount'),
  payment: t('adminComponents.faq.categoryPayment'),
  feature: t('adminComponents.faq.categoryFeature'),
  other: t('adminComponents.faq.categoryOther'),
}))

const getCategoryText = (category: string): string => categoryMap.value[category] || category

const fetchFAQs = async () => {
  loading.value = true
  try {
    const res = await getAdminFAQs({
      page: currentPage.value,
      pageSize: pageSize.value,
      category: filterCategory.value || undefined,
    })
    if (res.success && res.data) {
      faqs.value = res.data.list ?? []
      total.value = res.data.total ?? 0
    } else {
      faqs.value = []
      total.value = 0
      if (res.code !== 200) ElMessage.warning(res.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  ElMessage.info(t('adminComponents.faq.addHint'))
}

const handleSearch = (_keyword: string) => {
  fetchFAQs()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchFAQs()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchFAQs()
}

const toggleTop = async (faq: AdminFAQ, val: boolean) => {
  const res = await toggleAdminFAQTop(faq.id, val)
  if (res.success) {
    ElMessage.success(val ? t('adminFAQList.pinned') : t('adminFAQList.unpinned'))
    fetchFAQs()
  } else {
    ElMessage.error(res.message || '操作失败')
  }
}

const editFAQ = (faq: AdminFAQ) => {
  ElMessage.info(t('adminComponents.faq.editHint', { question: faq.question }))
}

const deleteFAQ = async (faq: AdminFAQ) => {
  const res = await deleteAdminFAQ(faq.id)
  if (res.success) {
    ElMessage.success(t('adminFAQList.deleted'))
    fetchFAQs()
  } else {
    ElMessage.error(res.message || '删除失败')
  }
}

onMounted(() => fetchFAQs())
</script>

<style scoped>
.question-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 300px;
}
</style>
