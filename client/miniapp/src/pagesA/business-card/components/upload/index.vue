<template>
  <view class="picktwo" v-if="isShow">
    <image style="width: 100%; height: 100%; border-radius: 30rpx" :src="card" mode="scaleToFill" />
  </view>
  <view v-else class="upload-card-wrapper">
    <view class="upload-card">
    </view>
    <view class="upload-content" @click="uploadClick">
      <text class="upload-plus">+</text>
      <view>
        <view class="upload-tip">点击上传</view>
        <view class="upload-tip">社区定制名片</view>
      </view>  
    </view>
  </view>

</template>

<script setup>
import { ref } from 'vue'
import { uploadPictures } from "@/utils/uploadImage.js"

const props = defineProps({
  isShow: {
    type: Boolean,
    default: false,
  },
  card: {
    type: String,
    default: "",
  },
})

const emit = defineEmits(['upload'])

const avatarUrl = ref("")

function uploadClick() {
  uploadPictures(1)
    .then((res) => {
      if (res && res.length > 0) {
        avatarUrl.value = res[0]
        emit("upload", avatarUrl.value)
      }
    })
    .catch((err) => {
      uni.showToast({ title: err.message || '图片上传失败，请重试', icon: 'none' })
    })
}
</script>

<style>
.pick {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  border-radius: 30rpx;
  background: linear-gradient(180deg, #FFFFFF 0%, rgba(51, 255, 255, 0.2) 100%);
}

.picktwo {
  margin-top: 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #fafdff 60%, #e6e7fa 100%);
}

.upload-card {
  width: 100%;
  height: 450rpx;
  border-radius: 30rpx;
  border: 2rpx solid #d6d3f7;
  background: linear-gradient(135deg, #fafdff 60%, #e6e7fa 100%);
  background: url('https://file.aizhs.top/sys-mini/default/mingpian.jpg')no-repeat center center;
  background-size: 100%;
  opacity: 0.4;
  box-sizing: border-box;
  box-shadow: 0 0 8rpx rgba(186, 202, 255, 0.08);
  transition: border-color 0.2s;
}

.upload-card-wrapper {
  position: relative;
}

.upload-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 1;
  text-align: center;
}

.upload-plus {
  font-size: 140rpx;
  color: #7E72FF;
  line-height: 1;
}

.upload-tip {
  font-size: 38rpx;
  color: #575757;
  margin-top: 12rpx;
}
</style>
