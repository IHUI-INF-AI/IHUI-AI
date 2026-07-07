<template>
  <div class="comment-container">
    <div class="head">
      <el-input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入评论内容搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <el-button class="search-btn" size="small" type="primary" :icon="Search" @click="search">搜索</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="content" label="评论内容" min-width="260" :show-overflow-tooltip="true" />
      <el-table-column label="评论人" width="120">
        <template #default="scope">
          {{ scope.row.memberName || scope.row.member?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="关联主题" min-width="180" :show-overflow-tooltip="true">
        <template #default="scope">
          {{ scope.row.topicTitle || scope.row.topic?.title || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="主题类型" width="100" align="center">
        <template #default="scope">
          {{ topicTypeMap[scope.row.topicType] || scope.row.topicType || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="likeNum" label="点赞数" width="90" align="center">
        <template #default="scope">{{ scope.row.likeNum || 0 }}</template>
      </el-table-column>
      <el-table-column prop="replyNum" label="回复数" width="90" align="center">
        <template #default="scope">{{ scope.row.replyNum || 0 }}</template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="操作" align="center" width="120" fixed="right">
        <template #default="scope">
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
import { commentApi } from '@/api/edu/admin-api'
import { confirm, success } from '@/util/tipsUtils'
import { Search } from '@/lib/lucide-fallback'

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
