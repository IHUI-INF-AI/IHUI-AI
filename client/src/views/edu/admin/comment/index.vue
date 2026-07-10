<template>
  <div class="comment-container">
    <div class="head">
      <Input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入评论内容搜索"
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
          <TableHead class="min-w-[260px]">评论内容</TableHead>
          <TableHead class="w-[120px]">评论人</TableHead>
          <TableHead class="min-w-[180px]">关联主题</TableHead>
          <TableHead class="w-[100px] text-center">主题类型</TableHead>
          <TableHead class="w-[90px] text-center">点赞数</TableHead>
          <TableHead class="w-[90px] text-center">回复数</TableHead>
          <TableHead class="w-[160px]">创建时间</TableHead>
          <TableHead class="w-[120px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in list" :key="row.id ?? index">
          <TableCell>{{ row.id }}</TableCell>
          <TableCell>{{ row.content }}</TableCell>
          <TableCell>{{ row.memberName || row.member?.name || '-' }}</TableCell>
          <TableCell>{{ row.topicTitle || row.topic?.title || '-' }}</TableCell>
          <TableCell class="text-center">{{ topicTypeMap[row.topicType] || row.topicType || '-' }}</TableCell>
          <TableCell class="text-center">{{ row.likeNum || 0 }}</TableCell>
          <TableCell class="text-center">{{ row.replyNum || 0 }}</TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell class="text-center">
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
import { commentApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search } from '@/lib/lucide-fallback'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'

const { findCommentList, deleteCommentAdmin } = commentApi

const topicTypeMap: Record<string, string> = {
  lesson: '课程',
  news: '资讯',
  article: '文章',
  channel: '直播',
  resource: '资源',
  question: '问答',
  dynamic: '圈子'
}

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
  findCommentList(searchParam.value, (res: any) => {
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
  confirm('确认删除该评论？', '提示', () => {
    deleteCommentAdmin(item.id, () => {
      success('删除成功')
      loadList()
    })
  })
}
</script>

<style scoped lang="scss">
.comment-container {
  margin: 20px;
  .head {
    margin-bottom: 10px;
    .search-input {
      width: 280px;
    }
  }
}
</style>
