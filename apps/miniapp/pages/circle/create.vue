<template>
  <view class="page">
    <view class="card">
      <input class="title-input" v-model="form.title" placeholder="标题（必填）" maxlength="30" />
      <textarea class="content-input" v-model="form.content" placeholder="分享你的想法..." maxlength="1000" />
      <view class="images">
        <view class="img-item" v-for="(img, i) in form.images" :key="i">
          <image class="img" :src="img" mode="aspectFill" />
          <view class="del" @tap="removeImg(i)">×</view>
        </view>
        <view class="add-img" v-if="form.images.length < 9" @tap="addImg">+</view>
      </view>
    </view>
    <view class="card">
      <view class="row" @tap="chooseTopic">
        <text class="label">话题</text>
        <text class="value">{{ topic || '选择话题' }} ›</text>
      </view>
    </view>
    <button class="btn" @tap="onSubmit" :disabled="!form.title || !form.content">发布</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createCircle } from '@/api'

const form = ref<{ title: string; content: string; images: string[] }>({ title: '', content: '', images: [] })
const topic = ref('')

function addImg() {
  uni.chooseImage({
    count: 9 - form.value.images.length,
    sizeType: ['compressed'],
    success: (res) => { form.value.images.push(...res.tempFilePaths) }
  })
}
function removeImg(i: number) { form.value.images.splice(i, 1) }
function chooseTopic() { uni.navigateTo({ url: '/pages/topic/list?from=create' }) }

async function onSubmit() {
  if (!form.value.title || !form.value.content) return
  try {
    await createCircle(form.value)
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.title-input { width: 100%; font-size: 32rpx; padding: 16rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.content-input { width: 100%; min-height: 240rpx; margin-top: 16rpx; font-size: 28rpx; line-height: 1.6; }
.images { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 24rpx; }
.img-item { position: relative; }
.img { width: 200rpx; height: 200rpx; border-radius: 8rpx; }
.del { position: absolute; top: -10rpx; right: -10rpx; width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; background: rgba(0,0,0,.5); color: #fff; border-radius: 50%; font-size: 24rpx; }
.add-img { width: 200rpx; height: 200rpx; border: 2rpx dashed #ccc; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 60rpx; color: #ccc; }
.row { display: flex; justify-content: space-between; align-items: center; }
.label { font-size: 28rpx; color: #333; }
.value { font-size: 26rpx; color: #999; }
.btn { margin: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
