<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索讲师" v-model="keyword" @confirm="load(true)" />
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="t in list" :key="t.id" @tap="goDetail(t.id)">
        <image class="avatar" :src="t.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="body">
          <view class="name-row">
            <text class="name">{{ t.name }}</text>
            <text class="title-tag" v-if="t.title">{{ t.title }}</text>
          </view>
          <text class="intro">{{ t.intro }}</text>
          <view class="meta">
            <text class="num">{{ t.courses || 0 }}课程</text>
            <text class="num">{{ t.students || 0 }}学员</text>
          </view>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无讲师</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getTeacherList, type Teacher } from '@/api'

const list = ref<Teacher[]>([])
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getTeacherList({ page: page.value, pageSize: 10, keyword: keyword.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/teacher/detail?id=${id}` }) }
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.search-bar { padding: 24rpx 32rpx; }
.search-input { height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.list { padding: 0 24rpx; }
.item { display: flex; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: #f5f5f5; flex-shrink: 0; }
.body { flex: 1; margin-left: 24rpx; }
.name-row { display: flex; align-items: center; gap: 16rpx; }
.name { font-size: 30rpx; color: #333; font-weight: 600; }
.title-tag { font-size: 20rpx; color: #007aff; background: #e6f0ff; padding: 4rpx 12rpx; border-radius: 4rpx; }
.intro { display: block; font-size: 24rpx; color: #999; margin-top: 12rpx; line-height: 1.5; }
.meta { display: flex; gap: 24rpx; margin-top: 12rpx; }
.num { font-size: 22rpx; color: #666; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
