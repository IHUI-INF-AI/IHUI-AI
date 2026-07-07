<template>
  <div class="circle-container">
    <div class="head">
      <el-input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入圈子名称搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <el-button class="search-btn" size="small" type="primary" :icon="Search" @click="search">搜索</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="圈子名称" min-width="180">
        <template #default="scope">
          {{ scope.row.name || scope.row.title || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="220" :show-overflow-tooltip="true" />
      <el-table-column label="创建人" width="120">
        <template #default="scope">
          {{ scope.row.memberName || scope.row.member?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="memberNum" label="成员数" width="90" align="center">
        <template #default="scope">{{ scope.row.memberNum || 0 }}</template>
      </el-table-column>
      <el-table-column prop="dynamicNum" label="动态数" width="90" align="center">
        <template #default="scope">{{ scope.row.dynamicNum || 0 }}</template>
      </el-table-column>
      <el-table-column label="显示状态" width="100" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.isShow === 1 || scope.row.isShow === true ? 'success' : 'info'" size="small">
            {{ scope.row.isShow === 1 || scope.row.isShow === true ? '显示中' : '已隐藏' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="操作" align="center" width="200" fixed="right">
        <template #default="scope">
          <el-button link size="small" @click="toggleShow(scope.row)">
            {{ scope.row.isShow === 1 || scope.row.isShow === true ? '隐藏' : '显示' }}
          </el-button>
          <el-button link size="small" style="color: red;" @click="remove(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
import { circleApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search } from '@/lib/lucide-fallback'

const { findCircleList, deleteCircleAdmin, updateCircleShow } = circleApi

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
  findCircleList(searchParam.value, (res: any) => {
    dataLoading.value = false
    if (!res) return
    list.value = res.list || []
    total.value = res.total || 0
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

// 启用/禁用（显示/隐藏）
const toggleShow = (item: any) => {
  const isShow = item.isShow === 1 || item.isShow === true ? 0 : 1
  const tipText = isShow === 1 ? '显示' : '隐藏'
  confirm('确认' + tipText + '该圈子【' + (item.name || item.title || item.id) + '】？', '提示', () => {
    updateCircleShow({ id: item.id, isShow: isShow }, () => {
      success(tipText + '成功')
      loadList()
    })
  })
}

// 删除
const remove = (item: any) => {
  confirm('确认删除该圈子【' + (item.name || item.title || item.id) + '】？', '提示', () => {
    deleteCircleAdmin(item.id, () => {
      success('删除成功')
      loadList()
    })
  })
}
</script>

<style scoped lang="scss">
.circle-container {
  margin: 20px;
  .head {
    margin-bottom: 10px;
    .search-input {
      width: 280px;
    }
  }
}
</style>
