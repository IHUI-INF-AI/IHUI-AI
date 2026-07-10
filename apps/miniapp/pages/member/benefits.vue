<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="b in list" :key="b.id">
        <view class="item-icon">{{ b.icon || '★' }}</view>
        <view class="item-body">
          <text class="item-title">{{ b.title }}</text>
          <text class="item-desc">{{ b.desc }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无权益</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberBenefits } from '@/api'

const list = ref<Array<{ id: string; title: string; desc: string; icon?: string }>>([])
const loading = ref(true)

async function load() {
  try { list.value = (await getMemberBenefits()).list || [] } finally { loading.value = false }
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }
.item { display: flex; align-items: center; background: #fff; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.item-icon { width: 80rpx; height: 80rpx; line-height: 80rpx; text-align: center; background: #e6f0ff; color: #007aff; border-radius: 50%; font-size: 36rpx; flex-shrink: 0; }
.item-body { margin-left: 24rpx; flex: 1; }
.item-title { display: block; font-size: 30rpx; color: #333; font-weight: 600; }
.item-desc { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
