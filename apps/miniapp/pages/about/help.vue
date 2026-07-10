<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索帮助" v-model="keyword" />
    </view>
    <view class="list" v-if="filtered.length">
      <view class="item" v-for="h in filtered" :key="h.id" @tap="toggle(h.id)">
        <view class="item-head">
          <text class="title">{{ h.title }}</text>
          <text class="arrow" :class="{ open: opened === h.id }">›</text>
        </view>
        <view class="content" v-if="opened === h.id">
          <text>{{ h.content }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !filtered.length"><text>暂无帮助内容</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getHelp } from '@/api'

const list = ref<Array<{ id: string; title: string; content: string }>>([])
const keyword = ref('')
const opened = ref('')
const loading = ref(true)

const filtered = computed(() => {
  if (!keyword.value) return list.value
  return list.value.filter(h => h.title.includes(keyword.value) || h.content.includes(keyword.value))
})

async function load() {
  try { list.value = (await getHelp()).list || [] } finally { loading.value = false }
}
function toggle(id: string) { opened.value = opened.value === id ? '' : id }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.search-bar { padding: 24rpx 32rpx; }
.search-input { height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.list { padding: 0 24rpx; }
.item { background: #fff; border-radius: 16rpx; margin-bottom: 16rpx; overflow: hidden; }
.item-head { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; }
.title { font-size: 28rpx; color: #333; }
.arrow { color: #ccc; font-size: 32rpx; transform: rotate(90deg); }
.arrow.open { transform: rotate(-90deg); }
.content { padding: 0 32rpx 32rpx; font-size: 26rpx; color: #666; line-height: 1.6; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
