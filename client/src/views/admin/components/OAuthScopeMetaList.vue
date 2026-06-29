<template>
  <AdminListPage
    title="OAuth Scope 元数据管理"
    description="维护 scope 元数据 (名称/描述/分类/排序/启用), 取代前端硬编码描述表 (Round 29-D 新增)"
    :columns="columns"
    :data="metas"
    :total="total"
    :loading="loading"
    :show-add="true"
    :show-selection="false"
    add-text="新建 scope"
    @add="handleAdd"
    @refresh="fetchMetas"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item label="scope">
        <el-input
          v-model="filterScope"
          placeholder="按 scope 模糊筛选"
          clearable
          style="width: 200px"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
      </el-form-item>
      <el-form-item label="分类">
        <el-input
          v-model="filterCategory"
          placeholder="如 profile/orders/wallet"
          clearable
          style="width: 180px"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select
          v-model="filterActive"
          placeholder="全部"
          clearable
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-scope="{ row }">
      <span class="scope-mono">{{ row.scope }}</span>
    </template>

    <template #col-description="{ row }">
      <span v-if="row.description" class="desc-text" :title="row.description">
        {{ row.description }}
      </span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-category="{ row }">
      <el-tag v-if="row.category" size="small" type="info">{{ row.category }}</el-tag>
      <span v-else class="empty">-</span>
    </template>

    <template #col-is_active="{ row }">
      <el-tag :type="row.is_active === 1 ? 'success' : 'info'" size="small">
        {{ row.is_active === 1 ? '启用' : '禁用' }}
      </el-tag>
    </template>

    <template #col-sort_order="{ row }">
      <span class="sort-num">{{ row.sort_order ?? 0 }}</span>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="handleEdit(row)">
        编辑
      </el-button>
      <el-popconfirm
        title="确认删除? 删除后授权页回退到默认描述"
        @confirm="handleDelete(row)"
      >
        <template #reference>
          <el-button type="danger" link size="small">删除</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>

  <!-- 创建/编辑对话框 -->
  <el-dialog
    v-model="formDialogVisible"
    :title="editingId ? '编辑 scope 元数据' : '新建 scope 元数据'"
    width="600px"
  >
    <el-form :model="formData" label-width="120px">
      <el-form-item label="scope 标识符" required>
        <el-input
          v-model="formData.scope"
          :disabled="!!editingId"
          :placeholder="editingId ? 'scope 创建后不可修改' : '如 read:profile'"
        />
        <div class="form-hint">
          scope 唯一, 创建后不可修改. 修改会影响已签发 JWT 的 scope 字段语义.
        </div>
      </el-form-item>
      <el-form-item label="中文名" required>
        <el-input v-model="formData.name" placeholder="如 读取资料" />
      </el-form-item>
      <el-form-item label="详细描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="2"
          placeholder="如 读取您的资料 (昵称/头像/简介)"
        />
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="formData.category" placeholder="如 profile / orders / wallet" />
      </el-form-item>
      <el-form-item label="排序权重">
        <el-input-number v-model="formData.sort_order" :min="0" :max="9999" />
        <div class="form-hint">asc 升序, 数值越小越靠前 (默认 0)</div>
      </el-form-item>
      <el-form-item label="是否启用">
        <el-switch v-model="formData.is_active" :active-value="1" :inactive-value="0" />
        <div class="form-hint">禁用后授权页回退到默认描述, 不报错</div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitForm">
        {{ editingId ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getAdminOAuthScopeMetaList,
  createAdminOAuthScopeMeta,
  updateAdminOAuthScopeMeta,
  deleteAdminOAuthScopeMeta,
  type AdminOAuthScopeMeta,
  type AdminOAuthScopeMetaListParams,
} from '@/api/admin-oauth-scope-meta'

const metas = ref<AdminOAuthScopeMeta[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

// 筛选条件
const filterScope = ref<string>('')
const filterCategory = ref<string>('')
const filterActive = ref<number | undefined>(undefined)

// 创建/编辑对话框
const formDialogVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formData = ref({
  scope: '',
  name: '',
  description: '',
  category: '',
  sort_order: 0,
  is_active: 1,
})

const columns = computed<TableColumn[]>(() => [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'scope', label: 'scope 标识符', width: 200, slot: true },
  { prop: 'name', label: '中文名', width: 160 },
  { prop: 'description', label: '详细描述', minWidth: 280, slot: true },
  { prop: 'category', label: '分类', width: 120, slot: true },
  { prop: 'sort_order', label: '排序', width: 80, slot: true },
  { prop: 'is_active', label: '状态', width: 90, slot: true },
])

async function fetchMetas() {
  loading.value = true
  try {
    const params: AdminOAuthScopeMetaListParams = {
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (filterScope.value.trim()) params.scope = filterScope.value.trim()
    if (filterCategory.value.trim()) params.category = filterCategory.value.trim()
    if (filterActive.value !== undefined) params.is_active = filterActive.value
    const res = await getAdminOAuthScopeMetaList(params)
    if (res.success && res.data) {
      metas.value = res.data
      total.value = (res as { total?: number }).total || res.data.length
    } else {
      ElMessage.error(res.message || '获取列表失败')
      metas.value = []
      total.value = 0
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '获取列表失败')
    metas.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  fetchMetas()
}

function handlePageChange(page: number) {
  currentPage.value = page
  fetchMetas()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  fetchMetas()
}

function handleAdd() {
  editingId.value = null
  formData.value = {
    scope: '',
    name: '',
    description: '',
    category: '',
    sort_order: 0,
    is_active: 1,
  }
  formDialogVisible.value = true
}

function handleEdit(row: AdminOAuthScopeMeta) {
  editingId.value = row.id
  formData.value = {
    scope: row.scope,
    name: row.name,
    description: row.description || '',
    category: row.category || '',
    sort_order: row.sort_order ?? 0,
    is_active: row.is_active,
  }
  formDialogVisible.value = true
}

async function submitForm() {
  if (!formData.value.scope.trim()) {
    ElMessage.warning('scope 标识符不能为空')
    return
  }
  if (!formData.value.name.trim()) {
    ElMessage.warning('中文名不能为空')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      // 更新 (scope 不可改)
      const res = await updateAdminOAuthScopeMeta(editingId.value, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || undefined,
        category: formData.value.category.trim() || undefined,
        sort_order: formData.value.sort_order,
        is_active: formData.value.is_active,
      })
      if (res.success) {
        ElMessage.success('保存成功')
        formDialogVisible.value = false
        fetchMetas()
      } else {
        ElMessage.error(res.message || '保存失败')
      }
    } else {
      // 创建
      const res = await createAdminOAuthScopeMeta({
        scope: formData.value.scope.trim(),
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || undefined,
        category: formData.value.category.trim() || undefined,
        sort_order: formData.value.sort_order,
        is_active: formData.value.is_active,
      })
      if (res.success) {
        ElMessage.success('创建成功')
        formDialogVisible.value = false
        fetchMetas()
      } else {
        ElMessage.error(res.message || '创建失败')
      }
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: AdminOAuthScopeMeta) {
  try {
    const res = await deleteAdminOAuthScopeMeta(row.id)
    if (res.success) {
      ElMessage.success('已删除')
      fetchMetas()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '删除失败')
  }
}

onMounted(() => {
  fetchMetas()
})
</script>

<style scoped>
.scope-mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.desc-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty {
  color: var(--el-text-color-placeholder);
}

.sort-num {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
