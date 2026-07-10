<template>
  <view class="page">
    <view class="canvas" v-if="result">
      <image class="result-img" :src="result" mode="aspectFit" />
    </view>
    <view class="empty" v-else>
      <text class="empty-icon">🎨</text>
      <text class="empty-text">输入描述生成AI图片</text>
    </view>
    <view class="examples" v-if="!result">
      <text class="ex-title">试试这些：</text>
      <view class="ex-list">
        <text class="ex-item" v-for="ex in examples" :key="ex" @tap="prompt = ex">{{ ex }}</text>
      </view>
    </view>
    <view class="form">
      <textarea class="input" v-model="prompt" placeholder="描述你想要生成的图片..." maxlength="500" />
      <view class="form-row">
        <view class="size-selector">
          <text class="size" v-for="s in sizes" :key="s.value" :class="{ active: size === s.value }" @tap="size = s.value">{{ s.label }}</text>
        </view>
        <button class="btn" @tap="onGenerate" :disabled="!prompt || loading">{{ loading ? '生成中' : '生成' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { generateImage } from '@/api'

const prompt = ref('')
const size = ref('1024x1024')
const result = ref('')
const loading = ref(false)
const sizes = [
  { value: '512x512', label: '512' },
  { value: '1024x1024', label: '1024' },
  { value: '1024x1792', label: '竖版' },
]
const examples = ['一只可爱的猫咪', '未来城市夜景', '抽象艺术作品', '油画风格山水']

async function onGenerate() {
  if (!prompt.value || loading.value) return
  loading.value = true
  try {
    const res = await generateImage({ prompt: prompt.value, size: size.value })
    result.value = res.url
  } catch (e) {} finally { loading.value = false }
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; display: flex; flex-direction: column; }
.canvas { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32rpx; }
.result-img { max-width: 100%; max-height: 600rpx; border-radius: 16rpx; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.empty-icon { font-size: 120rpx; }
.empty-text { font-size: 26rpx; color: #999; margin-top: 24rpx; }
.examples { padding: 0 32rpx 24rpx; }
.ex-title { font-size: 24rpx; color: #999; }
.ex-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.ex-item { padding: 12rpx 24rpx; background: #fff; border-radius: 24rpx; font-size: 24rpx; color: #666; }
.form { padding: 24rpx 32rpx; background: #fff; }
.input { width: 100%; min-height: 120rpx; padding: 20rpx; background: #f7f8fa; border-radius: 12rpx; font-size: 28rpx; box-sizing: border-box; }
.form-row { display: flex; align-items: center; margin-top: 16rpx; gap: 16rpx; }
.size-selector { display: flex; gap: 12rpx; flex: 1; }
.size { padding: 8rpx 16rpx; border: 2rpx solid #eee; border-radius: 8rpx; font-size: 24rpx; color: #666; }
.size.active { border-color: #007aff; color: #007aff; }
.btn { background: #007aff; color: #fff; border-radius: 40rpx; font-size: 28rpx; padding: 0 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
