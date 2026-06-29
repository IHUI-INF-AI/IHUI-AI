<template>
  <view class="typebar">
    <view>
      <button @click="" class="selects"></button>
      <view class="jine">
        <text style="color: black; margin-left: 25rpx"
          >总提现金额 :{{ 999 }}</text
        >
      </view>
      <view class="tabs">
        <view class="list-item" v-for="item in center" :key="item.id">
          <image
            src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/money.png"
            class="status-icon"
          ></image>
          <text class="textone">提现金额</text>
          <text class="texttwo">提现方式:{{ item.way }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const center = ref([
  { id: 1, way: "微信零钱" },
  { id: 2, way: "微信零钱" },
  { id: 3, way: "微信零钱" },
  { id: 4, way: "微信零钱" },
])
</script>
<style scoped>
.typebar {
  height: 1455rpx;
  background: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/mxbackground.png");
}

.selects {
  background: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/date.png");
  background-size: cover;
  width: 100%;
  height: 80rpx;
  border-radius: 15rpx;
}

.jine {
  margin-top: 40rpx;
}

.status-icon {
  width: 80rpx;
  height: 80rpx;
  margin-top: 30rpx;
  margin-left: 15rpx;
}

.tabs {
  margin-top: 35rpx;
  margin-left: 15rpx;
  margin-right: 15rpx;
}

.list-item {
  background: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/qz.png");
  background-size: cover;
  margin-top: 15rpx;
}

.textone {
  display: flex;
  font-size: large;
  color: black;
  font-weight: bold;
  position: relative;
  margin-left: 110rpx;
  margin-top: -100rpx;
}

.texttwo {
  display: flex;
  position: relative;
  color: black;
  margin-left: 110rpx;
  margin-top: 30rpx;
}
</style>
