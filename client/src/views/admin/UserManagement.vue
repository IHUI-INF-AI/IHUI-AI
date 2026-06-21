<template>
  <div class="user-management">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('adminComponents.userManagement.title') }}</h2>
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            {{ t('adminComponents.userManagement.addUser') }}
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item :label="t('adminComponents.userManagement.username')">
          <el-input v-model="searchForm.username" :placeholder="t('adminComponents.userManagement.usernamePlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('adminComponents.userManagement.status')">
          <el-select v-model="searchForm.status" :placeholder="t('adminComponents.userManagement.statusPlaceholder')" clearable>
            <el-option :label="t('adminComponents.userManagement.enabled')" :value="1" />
            <el-option :label="t('adminComponents.userManagement.disabled')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <SearchIcon />
            {{ t('adminComponents.userManagement.search') }}
          </el-button>
          <el-button @click="resetSearch">{{ t('adminComponents.userManagement.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="userList" v-loading="loading" stripe>
        <el-table-column type="index" width="50" />
        <el-table-column prop="username" :label="t('adminComponents.userManagement.username')" />
        <el-table-column prop="nickname" :label="t('adminComponents.userManagement.nickname')" />
        <el-table-column prop="email" :label="t('adminComponents.userManagement.email')" />
        <el-table-column prop="phone" :label="t('adminComponents.userManagement.phone')" />
        <el-table-column prop="status" :label="t('adminComponents.userManagement.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? t('adminComponents.userManagement.enabled') : t('adminComponents.userManagement.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" :label="t('adminComponents.userManagement.createTime')" />
        <el-table-column :label="t('adminComponents.userManagement.actions')" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">{{ t('adminComponents.userManagement.editUser') }}</el-button>
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? t('adminComponents.userManagement.disabled') : t('adminComponents.userManagement.enabled') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item :label="t('adminComponents.userManagement.username')" prop="username">
          <el-input v-model="form.username" :placeholder="t('adminComponents.userManagement.usernamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('adminComponents.userManagement.nickname')" prop="nickname">
          <el-input v-model="form.nickname" :placeholder="t('adminComponents.userManagement.nicknamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('adminComponents.userManagement.email')" prop="email">
          <el-input v-model="form.email" :placeholder="t('adminComponents.userManagement.emailPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('adminComponents.userManagement.phone')" prop="phone">
          <el-input v-model="form.phone" :placeholder="t('adminComponents.userManagement.phonePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('adminComponents.userManagement.status')" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio :label="1">{{ t('adminComponents.userManagement.enabled') }}</el-radio>
            <el-radio :label="0">{{ t('adminComponents.userManagement.disabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('adminComponents.userManagement.cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit">{{ t('adminComponents.userManagement.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface User {
  id: string
  username: string
  nickname: string
  email: string
  phone: string
  status: number
  createTime: string
}

const loading = ref(false)
const userList = ref<User[]>([])
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const formRef = ref<{ validate: () => Promise<boolean> }>()

const searchForm = reactive({
  username: '',
  status: undefined as number | undefined,
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
})

const form = reactive({
  id: '',
  username: '',
  nickname: '',
  email: '',
  phone: '',
  status: 1,
})

const rules = {
  username: [{ required: true, message: t('adminComponents.userManagement.usernameRequired'), trigger: 'blur' }],
  nickname: [{ required: true, message: t('adminComponents.userManagement.nicknameRequired'), trigger: 'blur' }],
  email: [
    { required: true, message: t('adminComponents.userManagement.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('adminComponents.userManagement.emailInvalid'), trigger: 'blur' },
  ],
}

const loadUserList = () => {
  loading.value = true
  setTimeout(() => {
    userList.value = [
      {
        id: '1',
        username: 'admin',
        nickname: '管理员',
        email: 'admin@example.com',
        phone: '13800138000',
        status: 1,
        createTime: '2024-01-01 00:00:00',
      },
      {
        id: '2',
        username: 'user1',
        nickname: '用户1',
        email: 'user1@example.com',
        phone: '13800138001',
        status: 1,
        createTime: '2024-01-02 00:00:00',
      },
      {
        id: '3',
        username: 'user2',
        nickname: '用户2',
        email: 'user2@example.com',
        phone: '13800138002',
        status: 0,
        createTime: '2024-01-03 00:00:00',
      },
    ]
    pagination.total = 3
    loading.value = false
  }, 500)
}

const handleSearch = () => {
  pagination.page = 1
  loadUserList()
}

const resetSearch = () => {
  searchForm.username = ''
  searchForm.status = undefined
  handleSearch()
}

const showAddDialog = () => {
  isEdit.value = false
  dialogTitle.value = t('adminComponents.userManagement.addUser')
  form.id = ''
  form.username = ''
  form.nickname = ''
  form.email = ''
  form.phone = ''
  form.status = 1
  dialogVisible.value = true
}

const handleEdit = (row: User) => {
  isEdit.value = true
  dialogTitle.value = t('adminComponents.userManagement.editUser')
  form.id = row.id
  form.username = row.username
  form.nickname = row.nickname
  form.email = row.email
  form.phone = row.phone
  form.status = row.status
  dialogVisible.value = true
}

const handleToggleStatus = async (row: User) => {
  try {
    const action = row.status === 1 ? t('adminComponents.userManagement.disabled') : t('adminComponents.userManagement.enabled')
    await ElMessageBox.confirm(t('adminComponents.userManagement.confirmAction').replace('${action}', action), t('adminComponents.userManagement.tip'), {
      type: 'warning',
    })
    ElMessage.success(t('adminComponents.userManagement.actionSuccess').replace('${action}', action))
    loadUserList()
  } catch {
    // 用户取消操作
  }
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  ElMessage.success(isEdit.value ? t('adminComponents.userManagement.editSuccess') : t('adminComponents.userManagement.addSuccess'))
  dialogVisible.value = false
  loadUserList()
}

const handleSizeChange = (val: number) => {
  pagination.pageSize = val
  loadUserList()
}

const handlePageChange = (val: number) => {
  pagination.page = val
  loadUserList()
}

onMounted(() => {
  loadUserList()
})
</script>

<style scoped lang="scss">
.user-management {
  padding: 20px;

  .page-card {
    max-width: 1200px;
    margin: 0 auto;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h2 {
      margin: 0;
      font-size: 18px;
    }
  }

  .search-form {
    margin-bottom: 20px;
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
