<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="t in list" :key="t.id" @tap="goDetail(t.id)">
        <image class="cover" v-if="t.coverUrl" :src="t.coverUrl" mode="aspectFill" />
        <view class="body">
          <text class="name">#{{ t.name }}</text>
          <text class="count">{{ t.count }}篇内容</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无话题</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onLoad } from '@dcloudio/uni-app'
import { getTopicList } from '@/api'

const list = ref<Array<{ id: string; name: string; count: number; coverUrl?: string }>>([])
const loading = ref(false)
const from = ref('')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getTopicList({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function goDetail(id: string) {
  if (from.value === 'create') {
    const pages = getCurrentPages()
    const prev = pages[pages.length - 2] as any
    prev && (prev.topic = list.value.find(t => t.id === id)?.name)
    uni.navigateBack()
  } else {
    uni.navigateTo({ url: `/pages/topic/detail?id=${id}` })
  }
}
onLoad((q: any) => { from.value = q.from || '' })
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.cover { width: 100rpx; height: 100rpx; border-radius: 12rpx; background: #f5f5f5; }
.body { margin-left: 24rpx; }
.name { display: block; font-size: 30rpx; color: #007aff; font-weight: 600; }
.count { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
