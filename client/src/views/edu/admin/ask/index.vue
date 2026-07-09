<template>
  <div class="ask-container">
    <div class="head">
      <Input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入标题/内容搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <Button className="search-btn" size="sm" variant="default" @click="search"><Search />搜索</Button>
    </div>
    <div v-if="dataLoading" class="loading-overlay">加载中...</div>
    <Table class="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead class="w-[70px]">ID</TableHead>
          <TableHead class="min-w-[200px]">标题</TableHead>
          <TableHead class="min-w-[220px]">内容</TableHead>
          <TableHead class="w-[120px]">提问人</TableHead>
          <TableHead class="w-[90px] text-center">浏览量</TableHead>
          <TableHead class="w-[90px] text-center">回答数</TableHead>
          <TableHead class="w-[160px]">创建时间</TableHead>
          <TableHead class="w-[160px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in list" :key="row.id ?? index">
          <TableCell>{{ row.id }}</TableCell>
          <TableCell>{{ row.title }}</TableCell>
          <TableCell>{{ row.content }}</TableCell>
          <TableCell>{{ row.memberName || row.member?.name || '-' }}</TableCell>
          <TableCell class="text-center">{{ row.viewNum || 0 }}</TableCell>
          <TableCell class="text-center">{{ row.answerNum || 0 }}</TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell class="text-center">
            <Button variant="link" size="sm" @click="showDetail(row)">详情</Button>
            <Button variant="link" size="sm" style="color: red;" @click="remove(row)">删除</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 详情弹窗 -->
    <Dialog v-model="detailDialogVisible" width="70%" @close="hideDetail">
      <DialogHeader>
        <DialogTitle>问答详情</DialogTitle>
      </DialogHeader>
      <div v-loading="detailLoading" class="detail-wrapper">
        <template v-if="detail">
          <div class="detail-item"><span class="detail-label">ID：</span>{{ detail.id }}</div>
          <div class="detail-item"><span class="detail-label">标题：</span>{{ detail.title }}</div>
          <div class="detail-item"><span class="detail-label">内容：</span>
            <div class="detail-content" v-html="detail.content"></div>
          </div>
          <div class="detail-item"><span class="detail-label">提问人：</span>{{ detail.memberName || detail.member?.name || '-' }}</div>
          <div class="detail-item"><span class="detail-label">浏览量：</span>{{ detail.viewNum || 0 }}</div>
          <div class="detail-item"><span class="detail-label">回答数：</span>{{ detail.answerNum || 0 }}</div>
          <div class="detail-item"><span class="detail-label">创建时间：</span>{{ detail.createTime }}</div>
        </template>
      </div>
      <DialogFooter>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideDetail">关 闭</Button>
        </div>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { askApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search } from '@/lib/lucide-fallback'

const { findQuestionList, getQuestionDetail, deleteQuestion } = askApi

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
  findQuestionList(searchParam.value, (res: any) => {
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

// 删除
const remove = (item: any) => {
  confirm('确认删除该问答【' + (item.title || item.id) + '】？', '提示', () => {
    deleteQuestion(item.id, () => {
      success('删除成功')
      loadList()
    })
  })
}

// 详情
const detailDialogVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)
const showDetail = (item: any) => {
  detailDialogVisible.value = true
  detailLoading.value = true
  detail.value = null
  getQuestionDetail(item.id, (res: any) => {
    detailLoading.value = false
    detail.value = res
  }).catch(() => {
    detailLoading.value = false
  })
}
const hideDetail = () => {
  detailDialogVisible.value = false
  detail.value = null
}
</script>

<style scoped lang="scss">
.ask-container {
  margin: 20px;
  .head {
    margin-bottom: 10px;
    .search-input {
      width: 280px;
    }
  }
}
.detail-wrapper {
  padding: 10px 20px;
  .detail-item {
    margin-bottom: 14px;
    line-height: 1.6;
    .detail-label {
      display: inline-block;
      width: 90px;
      color: #909399;
      font-weight: 500;
      vertical-align: top;
    }
    .detail-content {
      display: inline-block;
      max-width: calc(100% - 90px);
      word-break: break-all;
    }
  }
}
</style>
