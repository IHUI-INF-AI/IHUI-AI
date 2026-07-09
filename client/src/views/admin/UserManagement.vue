<template>
  <div class="user-management">
    <Card class="page-card"><CardHeader>
        <div class="card-header">
          <h2>{{ t('adminComponents.userManagement.title') }}</h2>
          <Button variant="default" @click="showAddDialog">
            <Plus class="h-4 w-4" />
            {{ t('adminComponents.userManagement.addUser') }}
          </Button>
        </div>
      </CardHeader><CardContent class="p-5">
      
      <form @submit.prevent class="search-form flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.username') }}</label>
          <Input v-model="searchForm.username" :placeholder="t('adminComponents.userManagement.usernamePlaceholder')" clearable />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.status') }}</label>
          <Select v-model="searchForm.status" :placeholder="t('adminComponents.userManagement.statusPlaceholder')" clearable>
            <SelectOption :label="t('adminComponents.userManagement.enabled')" :value="1" />
            <SelectOption :label="t('adminComponents.userManagement.disabled')" :value="0" />
          </Select>
        </div>
        <div>
          <Button variant="default" @click="handleSearch">
            <SearchIcon />
            {{ t('adminComponents.userManagement.search') }}
          </Button>
          <Button variant="outline" @click="resetSearch">{{ t('adminComponents.userManagement.reset') }}</Button>
        </div>
      </form>

      <div v-if="loading" class="flex justify-center py-8 text-muted-foreground">Loading...</div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[50px]">#</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.username') }}</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.nickname') }}</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.email') }}</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.phone') }}</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.status') }}</TableHead>
            <TableHead>{{ t('adminComponents.userManagement.createTime') }}</TableHead>
            <TableHead class="w-[200px]">{{ t('adminComponents.userManagement.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in userList" :key="row.id ?? index">
            <TableCell>{{ index + 1 }}</TableCell>
            <TableCell>{{ row.username }}</TableCell>
            <TableCell>{{ row.nickname }}</TableCell>
            <TableCell>{{ row.email }}</TableCell>
            <TableCell>{{ row.phone }}</TableCell>
            <TableCell>
              <Tag :type="row.status === 1 ? 'success' : 'danger'">
                {{ row.status === 1 ? t('adminComponents.userManagement.enabled') : t('adminComponents.userManagement.disabled') }}
              </Tag>
            </TableCell>
            <TableCell>{{ row.createTime }}</TableCell>
            <TableCell>
              <Button variant="default" size="sm" @click="handleEdit(row)">{{ t('adminComponents.userManagement.editUser') }}</Button>
              <Button
                :variant="row.status === 1 ? 'destructive' : 'default'"
                size="sm"
                @click="handleToggleStatus(row)"
              >
                {{ row.status === 1 ? t('adminComponents.userManagement.disabled') : t('adminComponents.userManagement.enabled') }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div class="pagination-container">
        <Pagination
          v-model:page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </CardContent></Card>

    <Dialog v-model="dialogVisible" width="500px">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>
      <form ref="formRef" @submit.prevent>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.username') }}</label>
          <div class="flex-1">
            <Input v-model="form.username" :placeholder="t('adminComponents.userManagement.usernamePlaceholder')" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.nickname') }}</label>
          <div class="flex-1">
            <Input v-model="form.nickname" :placeholder="t('adminComponents.userManagement.nicknamePlaceholder')" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.email') }}</label>
          <div class="flex-1">
            <Input v-model="form.email" :placeholder="t('adminComponents.userManagement.emailPlaceholder')" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.phone') }}</label>
          <div class="flex-1">
            <Input v-model="form.phone" :placeholder="t('adminComponents.userManagement.phonePlaceholder')" />
          </div>
        </div>
        <div class="mb-4 flex items-center gap-4">
          <label class="w-20 shrink-0 text-sm font-medium text-foreground">{{ t('adminComponents.userManagement.status') }}</label>
          <div class="flex-1">
            <Radio v-model="form.status" :value="1">{{ t('adminComponents.userManagement.enabled') }}</Radio>
            <Radio v-model="form.status" :value="0">{{ t('adminComponents.userManagement.disabled') }}</Radio>
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="dialogVisible = false">{{ t('adminComponents.userManagement.cancel') }}</Button>
        <Button variant="default" @click="handleSubmit">{{ t('adminComponents.userManagement.confirm') }}</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useI18n } from 'vue-i18n'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Radio } from '@/components/ui/radio'
import { Pagination } from '@/components/ui/pagination'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { Tag } from '@/components/ui/tag'

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
