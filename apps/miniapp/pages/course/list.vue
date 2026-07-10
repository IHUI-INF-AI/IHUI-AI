<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" type="text" placeholder="搜索课程" v-model="keyword" @confirm="onSearch" />
      <view class="search-btn" @tap="onSearch"><text>搜索</text></view>
    </view>

    <!-- 课程列表 -->
    <view class="list" v-if="list.length">
      <view class="card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <image class="cover" :src="item.coverUrl" mode="aspectFill" />
        <view class="info">
          <text class="title">{{ item.title }}</text>
          <text class="subtitle" v-if="item.subtitle">{{ item.subtitle }}</text>
          <view class="meta">
            <text class="teacher" v-if="item.teacher">{{ item.teacher }}</text>
            <text class="price">¥{{ item.price ?? 0 }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-if="!loading && !list.length">
      <text>暂无课程</text>
    </view>

    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getCourseList, type Course } from '@/api'

const list = ref<Course[]>([])
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) {
    page.value = 1
    hasMore.value = true
    list.value = []
  }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getCourseList({ page: page.value, pageSize, keyword: keyword.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } catch (e) {
    // 统一提示
  } finally {
    loading.value = false
  }
}

function onSearch() {
  load(true)
}

function goDetail(id: string | number) {
  uni.navigateTo({ url: `/pages/course/detail?id=${id}` })
}

onPullDownRefresh(() => {
  load(true).finally(() => uni.stopPullDownRefresh())
})
onReachBottom(() => load())

load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }

.search-bar { display: flex; align-items: center; margin-bottom: 24rpx; }
.search-input { flex: 1; height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.search-btn { margin-left: 16rpx; padding: 0 24rpx; height: 72rpx; line-height: 72rpx; color: #007aff; font-size: 28rpx; }

.card { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; }
.cover { width: 220rpx; height: 160rpx; flex-shrink: 0; }
.info { flex: 1; padding: 20rpx; display: flex; flex-direction: column; justify-content: space-between; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.subtitle { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.meta { display: flex; justify-content: space-between; align-items: center; margin-top: 16rpx; }
.teacher { font-size: 24rpx; color: #666; }
.price { font-size: 32rpx; color: #dd524d; font-weight: 600; }

.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; font-size: 26rpx; }
</style>
