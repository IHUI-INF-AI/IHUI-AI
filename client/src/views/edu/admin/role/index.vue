<template>
  <div class="role-container">
    <div class="head">
      <el-input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入角色名称搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <el-button class="search-btn" size="small" type="primary" :icon="Search" @click="search">搜索</el-button>
      <el-button size="small" type="primary" :icon="Plus" @click="showDialog()">新增角色</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="角色名称" min-width="160" />
      <el-table-column prop="code" label="角色编码" min-width="140" />
      <el-table-column prop="description" label="描述" min-width="220" :show-overflow-tooltip="true" />
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link size="small" @click="showDialog(scope.row)">编辑</el-button>
          <el-button link size="small" style="color: red;" @click="remove(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="role.id ? '编辑角色' : '新增角色'" width="500px" :before-close="hideDialog">
      <el-form :model="role" :rules="roleRules" ref="roleRef" label-width="90px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="role.name" size="small" placeholder="请输入角色名称" autocomplete="off" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="role.code" size="small" placeholder="请输入角色编码" autocomplete="off" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="role.description"
            size="small"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
            autocomplete="off"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideDialog">取 消</el-button>
          <el-button size="small" type="primary" @click="submit">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
import { roleApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search, Plus } from '@/lib/lucide-fallback'

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
const roleRef = ref<any>(null)
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
  roleRef.value.validate((valid: boolean) => {
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
