<template>
  <view class="success-container">
    <image
      class="success-image"
      style="width: 100%; height: 100%"
      src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/topup.png"
      mode="aspectFill"
    />
    <view class="center">
      <image
        src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/hello2.png"
        style="width: 400rpx; height: 400rpx"
      ></image>
      <text
        style="
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 40rpx;
          font-weight: bold;
          color: black;
        "
        >充值成功</text
      >
    </view>
  </view>
</template>
<style lang="less" scoped>
.success-container {
  width: 100%;
  height: 100%;
}
.success-image {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.center {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -70%);
}
</style>
