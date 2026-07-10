<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="r in list" :key="r.id">
        <view class="item-body">
          <text class="title">{{ r.courseTitle }}</text>
          <view class="meta">
            <text class="duration">学习 {{ r.duration }}分钟</text>
            <text class="time">{{ r.time }}</text>
          </view>
          <view class="progress-bar">
            <view class="progress" :style="{ width: r.progress + '%' }"></view>
          </view>
          <text class="progress-text">进度 {{ r.progress }}%</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无学习记录</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getStudyRecords, type StudyRecord } from '@/api'

const list = ref<StudyRecord[]>([])
const loading = ref(false)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getStudyRecords({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.title { font-size: 28rpx; color: #333; font-weight: 600; }
.meta { display: flex; justify-content: space-between; margin-top: 12rpx; }
.duration { font-size: 22rpx; color: #007aff; }
.time { font-size: 22rpx; color: #999; }
.progress-bar { height: 8rpx; background: #f5f5f5; border-radius: 4rpx; margin-top: 16rpx; }
.progress { height: 100%; background: #007aff; border-radius: 4rpx; }
.progress-text { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
