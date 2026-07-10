<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索Agent" v-model="keyword" />
    </view>
    <view class="list" v-if="filtered.length">
      <view class="item" v-for="a in filtered" :key="a.id" @tap="goDetail(a.id)">
        <image class="avatar" :src="a.avatar || '/static/default-agent.png'" mode="aspectFill" />
        <view class="body">
          <text class="name">{{ a.name }}</text>
          <text class="desc">{{ a.desc }}</text>
          <text class="uses">{{ a.uses }}次使用</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>
    <view class="empty" v-if="!loading && !filtered.length"><text>暂无Agent</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAgentList } from '@/api'

const list = ref<Array<{ id: string; name: string; desc: string; avatar?: string; uses: number }>>([])
const keyword = ref('')
const loading = ref(true)

const filtered = computed(() => {
  if (!keyword.value) return list.value
  return list.value.filter(a => a.name.includes(keyword.value) || a.desc.includes(keyword.value))
})

async function load() {
  try { list.value = (await getAgentList()).list || [] } finally { loading.value = false }
}
function goDetail(id: string) { uni.navigateTo({ url: `/pages/ai/agent-detail?id=${id}` }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.search-bar { padding: 24rpx 32rpx; }
.search-input { height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.list { padding: 0 24rpx; }
.item { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: #f5f5f5; }
.body { flex: 1; margin-left: 24rpx; }
.name { display: block; font-size: 30rpx; color: #333; font-weight: 600; }
.desc { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; }
.uses { display: block; font-size: 22rpx; color: #007aff; margin-top: 8rpx; }
.arrow { color: #ccc; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
