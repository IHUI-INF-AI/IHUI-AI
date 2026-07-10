<template>
  <div class="circle-container">
    <div class="head">
      <Input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入圈子名称搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <Button className="search-btn" size="sm" variant="default" @click="search"><Search />搜索</Button>
    </div>
    <div v-if="dataLoading" class="loading-div">加载中...</div>
    <Table class="text-sm" style="width: 100%">
      <TableHeader>
        <TableRow>
          <TableHead class="w-[70px]">ID</TableHead>
          <TableHead class="min-w-[180px]">圈子名称</TableHead>
          <TableHead class="min-w-[220px]">描述</TableHead>
          <TableHead class="w-[120px]">创建人</TableHead>
          <TableHead class="w-[90px] text-center">成员数</TableHead>
          <TableHead class="w-[90px] text-center">动态数</TableHead>
          <TableHead class="w-[100px] text-center">显示状态</TableHead>
          <TableHead class="w-[160px]">创建时间</TableHead>
          <TableHead class="w-[200px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in list" :key="row.id ?? index">
          <TableCell>{{ row.id }}</TableCell>
          <TableCell>{{ row.name || row.title || '-' }}</TableCell>
          <TableCell>{{ row.description }}</TableCell>
          <TableCell>{{ row.memberName || row.member?.name || '-' }}</TableCell>
          <TableCell class="text-center">{{ row.memberNum || 0 }}</TableCell>
          <TableCell class="text-center">{{ row.dynamicNum || 0 }}</TableCell>
          <TableCell class="text-center">
            <Tag :type="row.isShow === 1 || row.isShow === true ? 'success' : 'info'" size="small">
              {{ row.isShow === 1 || row.isShow === true ? '显示中' : '已隐藏' }}
            </Tag>
          </TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell class="text-center">
            <Button variant="link" size="sm" @click="toggleShow(row)">
              {{ row.isShow === 1 || row.isShow === true ? '隐藏' : '显示' }}
            </Button>
            <Button variant="link" size="sm" style="color: red;" @click="remove(row)">删除</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
import { circleApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search } from '@/lib/lucide-fallback'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Tag } from '@/components/ui/tag'

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
