<!-- 标题 -->
<template>
  <view class="carousel-container" style="padding: 20rpx 0">
    <view style="height: 60rpx; display: flex; align-items: center">
      <image
        style="width: 60rpx; height: 60rpx"
        :src="images || defaultImg"
        class="carousel-image"
      />
      <text style="color: black; font-size: 28rpx; font-weight: bold">{{
        title
      }}</text>
    </view>
    <view
      style="height: 60rpx; display: flex; align-items: center"
      @click="MoreClick"
    >
      <text style="font-size: 24rpx; color: black">查看更多</text>
      <image
        style="width: 40rpx; height: 40rpx"
        src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/right.png"
      ></image>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  images: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '默认标题',
  },
})

const emit = defineEmits(['pack'])

const defaultImg = "https://yourdomain.com/default.jpg"

function MoreClick() {
  emit("pack");
}
</script>

<style scoped>
.carousel-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.carousel-image {
  width: 100px;
  height: 100px;
}

.carousel-title {
  margin-left: 10px;
}

.arrow {
  margin-left: auto;
}
</style>
