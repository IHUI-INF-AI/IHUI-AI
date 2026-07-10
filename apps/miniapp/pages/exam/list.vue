<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: status === '' }" @tap="switchTab('')">全部</text>
      <text class="tab" :class="{ active: status === 'pending' }" @tap="switchTab('pending')">待考试</text>
      <text class="tab" :class="{ active: status === 'done' }" @tap="switchTab('done')">已完成</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="e in list" :key="e.id" @tap="goDetail(e)">
        <view class="item-top">
          <text class="title">{{ e.title }}</text>
          <text class="status" :class="e.status">{{ statusText(e.status) }}</text>
        </view>
        <view class="meta">
          <text>{{ e.questions }}题</text>
          <text>{{ e.duration }}分钟</text>
          <text>及格{{ e.passScore }}分</text>
        </view>
        <view class="time" v-if="e.startTime">时间：{{ e.startTime }} - {{ e.endTime }}</view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无考试</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { getExamList, type Exam } from '@/api'

const list = ref<Exam[]>([])
const loading = ref(false)
const status = ref('')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getExamList({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function switchTab(s: string) { status.value = s; load(true) }
function statusText(s?: string) { return ({ pending: '待考', done: '已完成', expired: '已过期' } as any)[s || ''] || '待考' }
function goDetail(e: Exam) {
  if (e.status === 'done') uni.navigateTo({ url: `/pages/exam/result?id=${e.id}` })
  else uni.navigateTo({ url: `/pages/exam/detail?id=${e.id}` })
}
onShow(() => load(true))
onReachBottom(() => load())
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.tabs { display: flex; background: #fff; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #007aff; font-weight: 600; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.status { font-size: 24rpx; }
.status.pending { color: #ff9a3c; }
.status.done { color: #4caf50; }
.status.expired { color: #999; }
.meta { display: flex; gap: 24rpx; margin-top: 16rpx; }
.meta text { font-size: 24rpx; color: #666; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 12rpx; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
