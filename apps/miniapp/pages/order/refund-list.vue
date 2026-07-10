<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="o in list" :key="o.id">
        <view class="item-top">
          <text class="o-title">{{ o.title }}</text>
          <text class="o-status refunded">{{ statusText(o.status) }}</text>
        </view>
        <text class="o-no">订单号：{{ o.orderNo }}</text>
        <view class="item-bottom">
          <text class="o-time">{{ o.createTime }}</text>
          <text class="o-amount">¥{{ o.amount }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无退款记录</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { getRefundList, type Order } from '@/api'

const list = ref<Order[]>([])
const loading = ref(false)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getRefundList({ page: page.value, pageSize: 10 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function statusText(s: string) { return ({ pending: '处理中', paid: '已支付', cancelled: '已取消', refunded: '已退款' } as any)[s] }
onShow(() => load(true))
onReachBottom(() => load())
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.item-top { display: flex; justify-content: space-between; }
.o-title { font-size: 30rpx; color: #333; font-weight: 600; }
.o-status { font-size: 24rpx; }
.o-status.refunded { color: #999; }
.o-no { display: block; font-size: 22rpx; color: #999; margin-top: 12rpx; }
.item-bottom { display: flex; justify-content: space-between; margin-top: 16rpx; }
.o-time { font-size: 24rpx; color: #999; }
.o-amount { font-size: 32rpx; color: #dd524d; font-weight: 600; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
