<template>
  <view class="center">
    <view></view>
    <view>
      <view
        style="display: flex; flex-direction: column; justify-content: center"
      >
        <image
          style="width: 300rpx; height: 300rpx"
          src="cloud://cloud1-5gszljn762dc4719.636c-cloud1-5gszljn762dc4719-1353421569/log/logo.png"
          mode="scaleToFill"
        />
        <text
          style="
            font-size: 42rpx;
            font-weight: bold;
            color: black;
            text-align: center;
            margin-top: 30rpx;
          "
          >AI|智汇社</text
        >
      </view>
    </view>
    <view style="padding-bottom: 80rpx; color: black">
      吉林省李氏数字文化有限公司
    </view>
  </view>
</template>

<script setup>
onLoad(() => {});
</script>

<style lang="scss" scoped>
.center {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  background-color: white;
}
</style>
