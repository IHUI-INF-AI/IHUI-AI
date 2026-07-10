<template>
  <view class="page">
    <view class="preview">
      <image class="avatar" :src="avatar || '/static/default-avatar.png'" mode="aspectFill" />
    </view>
    <button class="btn" @tap="chooseImg">选择头像</button>
    <view class="tips">
      <text>支持 JPG、PNG 格式</text>
      <text>建议尺寸 200×200</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, updateUserAvatar } from '@/api'

const avatar = ref('')

onShow(async () => { try { avatar.value = (await getProfile()).avatar || '' } catch (e) {} })

function chooseImg() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const path = res.tempFilePaths[0]
      try {
        // 上传头像(此处简化为直接提交URL，实际应上传到OSS)
        avatar.value = path
        await updateUserAvatar(path)
        uni.showToast({ title: '更新成功', icon: 'success' })
      } catch (e) {}
    }
  })
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding: 60rpx 32rpx; }
.preview { width: 200rpx; height: 200rpx; margin: 0 auto; border-radius: 50%; overflow: hidden; box-shadow: 0 4rpx 20rpx rgba(0,0,0,.1); }
.avatar { width: 100%; height: 100%; }
.btn { margin: 60rpx 0 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 30rpx; }
.tips { text-align: center; }
.tips text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
</style>
