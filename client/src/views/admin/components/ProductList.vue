<template>
  <AdminListPage
    :title="t('adminComponents.product.title')"
    :description="t('adminComponents.product.desc')"
    :columns="columns"
    :data="products"
    :total="total"
    :loading="loading"
    :show-add="true"
    :show-selection="true"
    @add="handleAdd"
    @search="handleSearch"
    @refresh="fetchProducts"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminComponents.product.filterType')">
        <el-select v-model="filterType" :placeholder="t('adminComponents.product.typeAll')" clearable @change="fetchProducts">
          <el-option :label="t('adminComponents.product.typeVip')" value="vip" />
          <el-option :label="t('adminComponents.product.typeCredits')" value="credits" />
          <el-option :label="t('adminComponents.product.typeService')" value="service" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('adminComponents.product.filterStatus')">
        <el-select v-model="filterStatus" :placeholder="t('adminComponents.product.statusAll')" clearable @change="fetchProducts">
          <el-option :label="t('adminComponents.product.statusOnShelf')" value="active" />
          <el-option :label="t('adminComponents.product.statusOffShelf')" value="inactive" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-image="{ row }">
      <el-image :src="row.image" style="width: 60px; height: 60px" fit="cover" />
    </template>

    <template #col-type="{ row }">
      <el-tag :type="getTypeStyle(row.type)">
        {{ getTypeText(row.type) }}
      </el-tag>
    </template>

    <template #col-price="{ row }">
      <span class="price">¥{{ row.price.toFixed(2) }}</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'info'">
        {{ row.status === 'active' ? t('adminComponents.product.statusOnShelf') : t('adminComponents.product.statusOffShelf') }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="editProduct(row)">
        {{ t('adminComponents.listPage.edit') }}
      </el-button>
      <el-button
        :type="row.status === 'active' ? 'warning' : 'success'"
        link
        size="small"
        @click="toggleStatus(row)"
      >
        {{ row.status === 'active' ? t('adminComponents.product.statusOffShelf') : t('adminComponents.product.statusOnShelf') }}
      </el-button>
      <el-popconfirm :title="t('adminComponents.listPage.deleteConfirm')" @confirm="deleteProduct(row)">
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
  getAdminProducts,
  createAdminProduct as _createAdminProduct,
  updateAdminProduct as _updateAdminProduct,
  deleteAdminProduct,
  toggleAdminProductStatus,
  type AdminProduct,
} from '@/api/admin/admin-products'

const { t } = useI18n()

const columns = computed<TableColumn[]>(() => [
  { prop: 'image', label: t('adminComponents.product.colImage'), width: 80, slot: true },
  { prop: 'name', label: t('adminComponents.product.colName'), width: 150 },
  { prop: 'type', label: t('adminComponents.product.colType'), width: 100, slot: true },
  { prop: 'price', label: t('adminComponents.product.colPrice'), width: 100, slot: true },
  { prop: 'stock', label: t('adminComponents.product.colStock'), width: 80 },
  { prop: 'sales', label: t('adminComponents.product.colSales'), width: 80 },
  { prop: 'status', label: t('adminComponents.product.filterStatus'), width: 80, slot: true },
  { prop: 'createdAt', label: t('adminComponents.product.colCreatedAt'), width: 180, type: 'date' },
])

const products = ref<AdminProduct[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterType = ref('')
const filterStatus = ref('')

const typeMap = computed<Record<string, { text: string; style: string }>>(() => ({
  vip: { text: t('adminComponents.product.typeVip'), style: 'warning' },
  credits: { text: t('adminComponents.product.typeCredits'), style: 'primary' },
  service: { text: t('adminComponents.product.typeService'), style: 'success' },
}))

const getTypeText = (type: string): string => typeMap.value[type]?.text || type
const getTypeStyle = (type: string): string => typeMap.value[type]?.style || 'info'

const fetchProducts = async () => {
  loading.value = true
  try {
    const res = await getAdminProducts({
      page: currentPage.value,
      pageSize: pageSize.value,
      type: filterType.value || undefined,
      status: filterStatus.value || undefined,
    })
    if (res.success && res.data) {
      products.value = res.data.list ?? []
      total.value = res.data.total ?? 0
    } else {
      products.value = []
      total.value = 0
      if (res.code !== 200) ElMessage.warning(res.message || t('adminComponents.product.loadFailed'))
    }
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  ElMessage.info(t('adminComponents.product.addHint'))
}

const handleSearch = (_keyword: string) => {
  fetchProducts()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchProducts()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchProducts()
}

const toggleStatus = async (product: AdminProduct) => {
  const nextStatus = product.status === 'active' ? 'inactive' : 'active'
  const res = await toggleAdminProductStatus(product.id, nextStatus)
  if (res.success) {
    ElMessage.success(nextStatus === 'active' ? t('adminComponents.product.onShelfSuccess') : t('adminComponents.product.offShelfSuccess'))
    fetchProducts()
  } else {
    ElMessage.error(res.message || t('adminComponents.product.opFailed'))
  }
}

const editProduct = (product: AdminProduct) => {
  ElMessage.info(t('adminComponents.product.editHint', { name: product.name }))
}

const deleteProduct = async (product: AdminProduct) => {
  const res = await deleteAdminProduct(product.id)
  if (res.success) {
    ElMessage.success(t('adminComponents.product.deleteSuccess'))
    fetchProducts()
  } else {
    ElMessage.error(res.message || t('adminComponents.product.deleteFailed'))
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<style scoped>
.price {
  font-weight: 600;
  color: var(--el-color-danger);
}
</style>
