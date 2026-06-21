/* 官方资讯页面 
* 每日推送文字 
*/
<template>
  <view class="ai-news-page">

    <!-- 主按钮 -->
    <view class="main-btn">
      <text class="main-title">
        {{ information.title }}
      </text>
      <view class="tag-btn">{{ information.tag }}</view>
    </view>

    <!-- 信息行 -->
    <view class="meta-row">
      <view></view>
      <view>
        <text class="meta-views">{{ information.view }}人浏览</text>
        <text class="meta-date">{{  happenTimeFun(information.date) }}</text>
      </view>
    </view>

    <!-- 内容框 -->
    <view class="content-box">
      <image class="content-img" :src="information.img" mode="widthFix" />
      <view class="content-text">{{ information.content }}</view>
    </view>
  </view>
</template>

<script setup>
import { happenTimeFun, formatFullTime } from "@/utils/time.js"

defineProps({
  information:{
    type: Object,
    default: () => ({})
  }
})
</script>

<style scoped>
.ai-news-page {
  background: transparent;
  min-height: 100vh;
  padding-bottom: 32rpx;
}

/* 主按钮 */
.main-btn {
  position: relative;
  margin: 480rpx 1rpx 0 1rpx;
  background: linear-gradient(0deg,rgba(255, 255, 255, 1) 1%, rgba(77, 180, 232, 1) 77%);
  border-radius: 80rpx;
  padding: 20rpx 30rpx 20rpx 32rpx;
  box-shadow: 0 0 16rpx rgba(0,0,0,0.06);
  display: flex;
  align-items: flex-end;
  min-height: 80rpx;
}
.main-title {
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  flex: 1;
  line-height: 1.5;
}
.tag-btn {
  position: absolute;
  right: 32rpx;
  bottom: 15rpx;
  background: #f7b500;
  color: #fff;
  border-radius: 60rpx;
  font-size: 18rpx;
  padding: 4rpx 18rpx;
  font-weight: bold;
  box-shadow: 0 0 8rpx rgba(0,0,0,0.04);
}

/* 信息行 */
.meta-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 18rpx 32rpx 0 32rpx;
  font-size: 22rpx;
  color: black;
}
.meta-views {
  margin-right: 32rpx;
}
.meta-date{
	margin-right: 32rpx;
}

/* 内容框 */
.content-box {
  background: #f0f3fb;
  border-radius: 20rpx;
  margin: 24rpx 24rpx 0 24rpx;
  padding: 24rpx;
  box-shadow: 0 0 16rpx rgba(0,0,0,0.04);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.content-img {
  width: 100%;
  border-radius: 15rpx;
  margin-bottom: 18rpx;
}
.content-text {
  color: #333;
  font-size: 26rpx;
  line-height: 1.8;
  margin-bottom: 12rpx;
  word-break: break-all;
}
</style>