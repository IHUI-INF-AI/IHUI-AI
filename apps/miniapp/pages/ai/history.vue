<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="h in list" :key="h.id" @tap="goChat(h)">
        <view class="item-body">
          <text class="title">{{ h.title }}</text>
          <text class="preview">{{ h.messages?.[h.messages.length - 1]?.content || '暂无消息' }}</text>
          <text class="time">{{ h.time }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length">
      <text>暂无对话历史</text>
      <button class="btn" @tap="goChat">开始新对话</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { getChatHistory } from '@/api'

const list = ref<Array<{ id: string; title: string; time: string; messages: any[] }>>([])
const loading = ref(false)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getChatHistory({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function goChat(h?: any) {
  uni.navigateTo({ url: `/pages/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
}
onShow(() => load(true))
onReachBottom(() => load())
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.preview { display: block; font-size: 26rpx; color: #999; margin-top: 8rpx; line-height: 1.4; }
.time { display: block; font-size: 22rpx; color: #ccc; margin-top: 12rpx; }
.empty { text-align: center; padding: 120rpx 32rpx; color: #999; }
.btn { margin-top: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 28rpx; }
</style>
