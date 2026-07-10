<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="p in list" :key="p.id">
        <view class="item-top">
          <text class="title">{{ p.title }}</text>
          <text class="target">目标{{ p.target }}%</text>
        </view>
        <view class="progress-bar">
          <view class="progress" :style="{ width: p.progress + '%' }"></view>
        </view>
        <view class="item-bottom">
          <text class="progress-text">已完成 {{ p.progress }}%</text>
          <text class="status" :class="{ done: p.progress >= p.target }">{{ p.progress >= p.target ? '已完成' : '进行中' }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无学习计划</text></view>
    <button class="fab" @tap="onAdd">+ 新建计划</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStudyPlan } from '@/api'

const list = ref<Array<{ id: string; title: string; target: number; progress: number }>>([])
const loading = ref(true)

async function load() {
  try { list.value = (await getStudyPlan()).list || [] } finally { loading.value = false }
}
function onAdd() { uni.showToast({ title: '功能开发中', icon: 'none' }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 28rpx; color: #333; font-weight: 600; }
.target { font-size: 22rpx; color: #999; }
.progress-bar { height: 12rpx; background: #f5f5f5; border-radius: 6rpx; margin-top: 16rpx; }
.progress { height: 100%; background: #007aff; border-radius: 6rpx; }
.item-bottom { display: flex; justify-content: space-between; margin-top: 12rpx; }
.progress-text { font-size: 22rpx; color: #999; }
.status { font-size: 22rpx; color: #ff9a3c; }
.status.done { color: #4caf50; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
.fab { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 30rpx; }
</style>
