<template>
  <view class="page">
    <view class="card">
      <text class="label">问题标题</text>
      <input class="input" v-model="form.title" placeholder="一句话描述你的问题" maxlength="50" />
      <text class="label">问题详情</text>
      <textarea class="textarea" v-model="form.content" placeholder="详细描述问题背景、已尝试的方法等" maxlength="1000" />
      <text class="counter">{{ form.content.length }}/1000</text>
    </view>
    <view class="card">
      <text class="label">悬赏积分</text>
      <view class="rewards">
        <text class="reward" v-for="r in rewards" :key="r" :class="{ active: form.reward === r }" @tap="form.reward = r">{{ r }}</text>
      </view>
    </view>
    <view class="tips">
      <text>· 提问前请先搜索，避免重复提问</text>
      <text>· 问题应具体明确，便于他人回答</text>
      <text>· 采纳回答后悬赏积分将自动发放</text>
    </view>
    <button class="btn" @tap="onSubmit" :disabled="!form.title || form.content.length < 5">发布问题</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createAsk } from '@/api'

const form = ref<{ title: string; content: string; reward: number }>({ title: '', content: '', reward: 0 })
const rewards = [0, 5, 10, 20, 50]

async function onSubmit() {
  try {
    await createAsk({ title: form.value.title, content: form.value.content })
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.label { display: block; font-size: 26rpx; color: #333; margin: 16rpx 0; }
.input { width: 100%; padding: 16rpx 0; font-size: 30rpx; border-bottom: 2rpx solid #f5f5f5; }
.textarea { width: 100%; min-height: 240rpx; margin-top: 16rpx; padding: 16rpx; background: #f7f8fa; border-radius: 12rpx; font-size: 28rpx; box-sizing: border-box; }
.counter { display: block; text-align: right; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.rewards { display: flex; flex-wrap: wrap; gap: 16rpx; }
.reward { padding: 12rpx 24rpx; border: 2rpx solid #eee; border-radius: 24rpx; font-size: 24rpx; color: #666; }
.reward.active { border-color: #007aff; color: #007aff; background: #e6f0ff; }
.tips { padding: 0 32rpx; }
.tips text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
.btn { margin: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
