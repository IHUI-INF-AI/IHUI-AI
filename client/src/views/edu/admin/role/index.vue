<template>
  <div class="role-container">
    <div class="head">
      <Input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入角色名称搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <Button className="search-btn" size="sm" variant="default" @click="search"><Search />搜索</Button>
      <Button size="sm" variant="default" @click="showDialog()"><Plus />新增角色</Button>
    </div>
    <div v-if="dataLoading" class="loading-div">加载中...</div>
    <Table class="text-sm" style="width: 100%">
      <TableHeader>
        <TableRow>
          <TableHead class="w-[70px]">ID</TableHead>
          <TableHead class="min-w-[160px]">角色名称</TableHead>
          <TableHead class="min-w-[140px]">角色编码</TableHead>
          <TableHead class="min-w-[220px]">描述</TableHead>
          <TableHead class="w-[160px]">创建时间</TableHead>
          <TableHead class="w-[160px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in list" :key="row.id ?? index">
          <TableCell>{{ row.id }}</TableCell>
          <TableCell>{{ row.name }}</TableCell>
          <TableCell>{{ row.code }}</TableCell>
          <TableCell>{{ row.description }}</TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell class="text-center">
            <Button variant="link" size="sm" @click="showDialog(row)">编辑</Button>
            <Button variant="link" size="sm" style="color: red;" @click="remove(row)">删除</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 新增/编辑弹窗 -->
    <Dialog v-model="dialogVisible" :width="'500px'" @close="hideDialog">
      <DialogHeader>
        <DialogTitle>{{ role.id ? '编辑角色' : '新增角色' }}</DialogTitle>
      </DialogHeader>
      <form ref="roleRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">角色名称</label>
          <div>
            <Input v-model="role.name" size="small" placeholder="请输入角色名称" autocomplete="off" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">角色编码</label>
          <div>
            <Input v-model="role.code" size="small" placeholder="请输入角色编码" autocomplete="off" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">描述</label>
          <div>
            <Textarea
              v-model="role.description"
              :rows="3"
              placeholder="请输入描述"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideDialog">取 消</Button>
          <Button size="sm" variant="default" @click="submit">确 定</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFormRef } from '@/composables/useFormRef'
import Page from '@/components/Page/index.vue'
import { roleApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search, Plus } from '@/lib/lucide-fallback'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

const { findRoleList, saveRole, updateRole, deleteRole } = roleApi

const list = ref<any[]>([])
const total = ref(0)
const dataLoading = ref(true)
const searchParam = ref({
  keyword: '',
  size: 20,
  current: 1
})

// 加载列表
const loadList = () => {
  dataLoading.value = true
  findRoleList(searchParam.value, (res: any) => {
    dataLoading.value = false
    if (!res) return
    // 兼容分页结构或直接数组
    if (Array.isArray(res)) {
      list.value = res
      total.value = res.length
    } else {
      list.value = res.list || []
      total.value = res.total || 0
    }
  }).catch(() => {
    dataLoading.value = false
  })
}
loadList()

const currentChange = (currentPage: number) => {
  searchParam.value.current = currentPage
  loadList()
}
const sizeChange = (size: number) => {
  searchParam.value.size = size
  loadList()
}
const search = () => {
  searchParam.value.current = 1
  loadList()
}

// 新增/编辑
const dialogVisible = ref(false)
const roleRef = useFormRef()
const role = ref<any>({})
const roleRules = {
  name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }]
}

const showDialog = (item?: any) => {
  if (item) {
    role.value = { ...item }
  } else {
    role.value = {}
  }
  dialogVisible.value = true
}
const hideDialog = () => {
  dialogVisible.value = false
  role.value = {}
}
const submit = () => {
  if (!roleRef.value) return
  roleRef.value.validate?.((valid: boolean) => {
    if (!valid) return false
    if (role.value.id) {
      updateRole(role.value, () => {
        success('修改成功')
        loadList()
        hideDialog()
      })
    } else {
      saveRole(role.value, () => {
        success('新增成功')
        searchParam.value.current = 1
        loadList()
        hideDialog()
      })
    }
  })
}

// 删除
const remove = (item: any) => {
  confirm('确认删除该角色【' + item.name + '】？', '提示', () => {
    deleteRole(item.id, () => {
      success('删除成功')
      loadList()
    })
  })
}
</script>

<style scoped lang="scss">
.role-container {
  margin: 20px;
  .head {
    margin-bottom: 10px;
    .search-input {
      width: 280px;
    }
  }
}
</style>
