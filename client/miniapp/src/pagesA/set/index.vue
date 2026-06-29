<template>
  <view class="center">
    <view class="center-item">
      <view
        class="center-item-text"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
        "
        @click="aboutClick"
      >
        <text style="color: black; font-size: 30rpx">关于我们</text>
        <image
          :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhongxia/right-arrow.png'"
          mode="aspectFill"
          style="width: 50rpx; height: 50rpx"
        ></image>
      </view>
    </view>
  </view>
</template>

<script setup>
function aboutClick() {
  uni.navigateTo({
    url: "/pagesA/set/about",
  });
}

onLoad(() => {});
</script>

<style lang="scss" scoped>
.center {
  height: 100vh;
  padding: 20rpx 30rpx;
  background-color: #f5f5f5;
}

.center-item {
  width: 100%;
}

.center-item-text {
  padding: 20rpx;
  background-color: white;
  border-radius: 20rpx;
}
</style>
