<template>
  <div class="ask-container">
    <div class="head">
      <el-input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入标题/内容搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <el-button class="search-btn" size="small" type="primary" :icon="Search" @click="search">搜索</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="title" label="标题" min-width="200" :show-overflow-tooltip="true" />
      <el-table-column prop="content" label="内容" min-width="220" :show-overflow-tooltip="true" />
      <el-table-column label="提问人" width="120">
        <template #default="scope">
          {{ scope.row.memberName || scope.row.member?.name || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="viewNum" label="浏览量" width="90" align="center">
        <template #default="scope">{{ scope.row.viewNum || 0 }}</template>
      </el-table-column>
      <el-table-column prop="answerNum" label="回答数" width="90" align="center">
        <template #default="scope">{{ scope.row.answerNum || 0 }}</template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="160" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link size="small" @click="showDetail(scope.row)">详情</el-button>
          <el-button link size="small" style="color: red;" @click="remove(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="问答详情" width="70%" :before-close="hideDetail">
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
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideDetail">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
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
