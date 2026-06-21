<template>
  <!-- 按钮 -->
  <view class="share-bar">
    <view v-for="item in title" :key="item.id" class="share-item" @click="hander(item)">
      <button open-type="share" class="custom-share-btn" v-if="item.id === 1" hover-class="none">
        <image :src="item.url" class="share-icon" mode="scaleToFill" />
        <text class="share-text">{{ item.name }}</text>
      </button>
      <button class="custom-share-btn" v-else hover-class="none">
        <image :src="item.url" class="share-icon" mode="scaleToFill" />
        <text class="share-text">{{ item.name }}</text>
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { uploadPictures } from "@/utils/uploadImage.js"
import { saveAlbum } from "@/utils/saveAlbum.js"

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

const emit = defineEmits(['wx', 'upload'])

const title = ref([
  {
    id: 1,
    url: "https://file.aizhs.top/sys-mini//Wechat_white@2x.png",
    name: "发送好友",
  },
  {
    id: 4,
    url: "https://file.aizhs.top/sys-mini/xgzt.jpg",
    name: "修改图片",
  },
  {
    id: 3,
    url: "https://file.aizhs.top/sys-mini//save@2x.png",
    name: "保存相册",
  }
])
const avatarUrl = ref("")

function hander(item) {
  if (item.name === "发送好友") {
    emit("wx")
  } else if (item.name === "修改图片") {
    uploadPictures(1)
      .then((res) => {
        if (res && res.length > 0) {
          avatarUrl.value = res[0]
          emit("upload", avatarUrl.value)
        }
      })
      .catch((err) => {
        uni.showToast({ title: err.message || '图片选择失败，请重试', icon: 'none' })
      })
  } else if (item.name === "保存相册") {
    if (!props.card) {
      uni.showToast({ title: '名片图片不存在', icon: 'none' })
      return
    }
    saveAlbum(props.card).catch((err) => {})
  }
}
</script>

<style>
.share-bar {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 40rpx;
  margin-top: 24rpx;
  margin-bottom: 24rpx;
  padding-right: 32rpx;
  background: transparent;
}

.share-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.custom-share-btn {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-icon {
  width: 70rpx;
  height: 70rpx;
}

.share-text {
  font-size: 26rpx;
  color: #888;
  margin-top: 0;
}
</style>
