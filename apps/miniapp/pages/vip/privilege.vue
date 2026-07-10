<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="p in list" :key="p.id">
        <view class="item-head">
          <view class="item-icon">★</view>
          <text class="item-title">{{ p.title }}</text>
        </view>
        <text class="item-desc">{{ p.desc }}</text>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无特权信息</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getVipPrivilege } from '@/api'

const list = ref<Array<{ id: string; title: string; desc: string }>>([])
const loading = ref(true)

async function load() {
  try {
    const res = await getVipPrivilege()
    list.value = res.list || []
  } finally { loading.value = false }
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.item-head { display: flex; align-items: center; margin-bottom: 16rpx; }
.item-icon { width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center; border-radius: 50%; background: #fff5e6; color: #f2b04a; }
.item-title { margin-left: 16rpx; font-size: 30rpx; color: #333; font-weight: 600; }
.item-desc { font-size: 26rpx; color: #666; line-height: 1.6; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
