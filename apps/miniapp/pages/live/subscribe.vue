<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="l in list" :key="l.id">
        <image class="cover" :src="l.coverUrl" mode="aspectFill" />
        <view class="body">
          <text class="title">{{ l.title }}</text>
          <text class="time" v-if="l.startTime">{{ l.startTime }}</text>
        </view>
        <view class="status" :class="l.status">
          <text class="s-text">{{ statusText(l.status) }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无订阅</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { subscribeLive, type Live } from '@/api'

const list = ref<Live[]>([])
const loading = ref(true)

async function load() {
  try { list.value = list.value } finally { loading.value = false }
}
function statusText(s: string) { return ({ upcoming: '未开始', living: '直播中', ended: '已结束' } as any)[s] }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.cover { width: 120rpx; height: 80rpx; border-radius: 8rpx; background: #f5f5f5; }
.body { flex: 1; margin-left: 24rpx; }
.title { font-size: 28rpx; color: #333; font-weight: 600; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.status { padding: 8rpx 16rpx; border-radius: 8rpx; }
.status.upcoming { background: #fff5e6; }
.status.living { background: #ffe6e6; }
.status.ended { background: #f5f5f5; }
.s-text { font-size: 22rpx; }
.status.upcoming .s-text { color: #ff9a3c; }
.status.living .s-text { color: #dd524d; }
.status.ended .s-text { color: #999; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
