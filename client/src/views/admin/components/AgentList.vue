<template>
  <AdminListPage
    :title="t('adminComponents.agent.title')"
    :description="t('adminComponents.agent.desc')"
    :columns="columns"
    :data="agents"
    :total="total"
    :loading="loading"
    :show-add="true"
    :show-selection="true"
    @add="handleAdd"
    @search="handleSearch"
    @refresh="fetchAgents"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminCommon.label.status')">
        <el-select v-model="filterStatus" :placeholder="t('adminCommon.placeholder.allStatus')" clearable @change="fetchAgents">
          <el-option :label="t('adminCommon.label.enabled')" value="active" />
          <el-option :label="t('adminCommon.label.disabled')" value="inactive" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-avatar="{ row }">
      <el-avatar :src="row.avatar" :size="40">
        {{ row.name?.charAt(0) }}
      </el-avatar>
    </template>

    <template #col-status="{ row }">
      <el-switch
        :model-value="row.status === 'active'"
        @change="(val: boolean) => toggleStatus(row, val)"
      />
    </template>

    <template #col-model="{ row }">
      <el-tag size="small">{{ row.model }}</el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="editAgent(row)">
        编辑
      </el-button>
      <el-button type="primary" link size="small" @click="configAgent(row)">
        配置
      </el-button>
      <el-popconfirm :title="t('adminCommon.title.confirmDelete')" @confirm="deleteAgent(row)">
        <template #reference>
          <el-button type="danger" link size="small">{{ t('common.delete') }}</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import { getAdminAgents, type AdminAgent } from '@/api/admin/admin/admin-agents'

const { t } = useI18n()

const columns: TableColumn[] = [
  { prop: 'avatar', label: '头像', width: 70, slot: true },
  { prop: 'name', label: '名称', width: 150 },
  { prop: 'model', label: '模型', width: 120, slot: true },
  { prop: 'description', label: '描述', minWidth: 200, showOverflowTooltip: true },
  { prop: 'status', label: '状态', width: 80, slot: true },
  { prop: 'createdAt', label: '创建时间', width: 180, type: 'date' },
]

const agents = ref<AdminAgent[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')

const fetchAgents = async () => {
  loading.value = true
  try {
    const res = await getAdminAgents({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filterStatus.value || undefined,
    })
    if (res.success && res.data) {
      agents.value = res.data.list ?? []
      total.value = res.data.total ?? 0
    } else {
      agents.value = []
      total.value = 0
      if (res.code !== 200) ElMessage.warning(res.message || '加载失败')
    }
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  ElMessage.info(t('adminComponents.agent.addHint'))
}

const handleSearch = (_keyword: string) => {
  fetchAgents()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchAgents()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  fetchAgents()
}

const toggleStatus = (_agent: AdminAgent, _active: boolean) => {
  ElMessage.info(t('adminComponents.agent.toggleHint'))
}

const editAgent = (agent: AdminAgent) => {
  ElMessage.info(`编辑：${agent.name}（需弹窗或编辑页）`)
}

const configAgent = (agent: AdminAgent) => {
  ElMessage.info(`配置：${agent.name}`)
}

const deleteAgent = (_agent: AdminAgent) => {
  ElMessage.info(t('adminComponents.agent.deleteHint'))
}

onMounted(() => {
  fetchAgents()
})
</script>
