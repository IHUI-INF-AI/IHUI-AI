<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: tab === 'recommend' }" @tap="switchTab('recommend')">推荐</text>
      <text class="tab" :class="{ active: tab === 'follow' }" @tap="switchTab('follow')">关注</text>
      <text class="tab" :class="{ active: tab === 'hot' }" @tap="switchTab('hot')">热门</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="c in list" :key="c.id" @tap="goDetail(c.id)">
        <view class="user">
          <image class="avatar" :src="c.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="name">{{ c.author }}</text>
          <text class="time">{{ c.createTime }}</text>
        </view>
        <text class="title">{{ c.title }}</text>
        <text class="content">{{ c.content }}</text>
        <view class="images" v-if="c.images?.length">
          <image class="img" v-for="(img, i) in c.images.slice(0, 3)" :key="i" :src="img" mode="aspectFill" />
        </view>
        <view class="actions">
          <text class="action">♡ {{ c.likes || 0 }}</text>
          <text class="action">💬 {{ c.comments || 0 }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无内容</text></view>
    <view class="fab" @tap="goCreate">+</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getCircleList, type Circle } from '@/api'

const list = ref<Circle[]>([])
const loading = ref(false)
const tab = ref('recommend')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getCircleList({ page: page.value, pageSize: 10 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function switchTab(t: string) { tab.value = t; load(true) }
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/circle/detail?id=${id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/circle/create' }) }
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.tabs { display: flex; background: #fff; position: sticky; top: 0; z-index: 1; }
.tab { flex: 1; text-align: center; font-size: 28rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #007aff; font-weight: 600; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.user { display: flex; align-items: center; }
.avatar { width: 60rpx; height: 60rpx; border-radius: 50%; background: #f5f5f5; }
.name { margin-left: 16rpx; font-size: 26rpx; color: #333; font-weight: 600; }
.time { margin-left: auto; font-size: 22rpx; color: #999; }
.title { display: block; font-size: 30rpx; color: #333; font-weight: 600; margin: 16rpx 0; }
.content { font-size: 26rpx; color: #666; line-height: 1.6; }
.images { display: flex; gap: 8rpx; margin-top: 16rpx; }
.img { width: 200rpx; height: 200rpx; border-radius: 8rpx; background: #f5f5f5; }
.actions { display: flex; gap: 32rpx; margin-top: 24rpx; padding-top: 16rpx; border-top: 2rpx solid #f5f5f5; }
.action { font-size: 24rpx; color: #999; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 100rpx; height: 100rpx; line-height: 100rpx; text-align: center; background: #007aff; color: #fff; border-radius: 50%; font-size: 60rpx; box-shadow: 0 4rpx 20rpx rgba(0,122,255,.4); }
</style>
