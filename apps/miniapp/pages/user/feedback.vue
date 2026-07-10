<template>
  <view class="page">
    <view class="card">
      <text class="label">反馈类型</text>
      <view class="types">
        <text class="type" v-for="t in types" :key="t" :class="{ active: type === t }" @tap="type = t">{{ t }}</text>
      </view>
      <text class="label">反馈内容</text>
      <textarea class="textarea" v-model="content" placeholder="请详细描述您遇到的问题或建议（10-500字）" maxlength="500" />
      <text class="counter">{{ content.length }}/500</text>
      <text class="label">联系方式（可选）</text>
      <input class="input" v-model="contact" placeholder="手机号/邮箱，方便我们联系您" />
    </view>
    <button class="btn" @tap="onSubmit" :disabled="content.length < 10">提交反馈</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { submitFeedback } from '@/api'

const types = ['功能建议', '问题反馈', '体验问题', '其他']
const type = ref('功能建议')
const content = ref('')
const contact = ref('')

async function onSubmit() {
  if (content.value.length < 10) return uni.showToast({ title: '至少输入10字', icon: 'none' })
  try {
    await submitFeedback({ content: `[${type.value}]${content.value}`, contact: contact.value })
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.label { display: block; font-size: 26rpx; color: #333; margin: 16rpx 0; }
.types { display: flex; flex-wrap: wrap; gap: 16rpx; }
.type { padding: 12rpx 24rpx; border: 2rpx solid #eee; border-radius: 24rpx; font-size: 24rpx; color: #666; }
.type.active { border-color: #007aff; color: #007aff; background: #e6f0ff; }
.textarea { width: 100%; min-height: 240rpx; padding: 20rpx; background: #f7f8fa; border-radius: 12rpx; font-size: 28rpx; box-sizing: border-box; }
.counter { display: block; text-align: right; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.input { width: 100%; padding: 20rpx; background: #f7f8fa; border-radius: 12rpx; font-size: 28rpx; box-sizing: border-box; }
.btn { margin: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
