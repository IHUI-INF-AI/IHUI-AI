/** *最新课程 * */
<template>
  <view class="mian-center">
    <view
      class="mian-center-item"
      v-for="item in list"
      :key="item.id"
      @click="upToDate(item)"
    >
      <view style="height: 200rpx; position: relative">
        <text
          style="
            position: absolute;
            top: 0;
            left: 0;
            z-index: 555;
            background-color: rgba(0, 0, 0, 0.3);
            color: white;
            padding: 4rpx 20rpx;
            border-radius: 20rpx;
            font-size: 24rpx;
          "
        >
          {{ item.classification }}</text
        >
        <text
          v-if="item.classHour"
          style="
            position: absolute;
            bottom: 0;
            right: 0;
            z-index: 555;
            background-color: rgba(0, 0, 0, 0.3);
            color: white;
            padding: 4rpx 20rpx;
            border-radius: 20rpx;
            font-size: 24rpx;
          "
        >
          {{ item.classHour }}课时
          <!-- {{ happenTimeFun(item.time) }} -->
        </text>
        <image
          :src="item.img"
          mode="aspectFill"
          style="width: 100%; height: 100%; border-radius: 24rpx"
        ></image>
      </view>
      <view
        style="
          font-size: 28rpx;
          color: black;
          margin-top: 10rpx;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
        "
        >{{ item.title }}</view
      >
      <view
        style="
          font-size: 24rpx;
          color: black;
          margin-top: 10rpx;
          color: #8e8e8e;
        "
        >{{ item.title }}</view
      >
      <view style="display: flex; margin-top: 10rpx">
        <view class="vip" v-if="item.type === 1">
          <view class="vip-images">
            <image
              :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/zhongxia/king.png'"
              mode="aspectFill"
              style="width: 100%; height: 100%"
            >
            </image>
          </view>
          <text style="color: #e99d42; font-size: 24rpx; margin-left: 10rpx"
            >VIP可看</text
          >
        </view>
        <view style="display: flex; align-items: center" v-if="item.type === 2">
          <view class="vip">
            <view class="vip-images">
              <image
                src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/微信图片_20250419152536.png"
                mode="aspectFill"
                style="width: 100%; height: 100%"
              >
              </image>
            </view>
            <text style="color: #e54834; font-size: 24rpx; margin-left: 10rpx"
              >付费可看</text
            >
          </view>
          <text style="color: #e54834; font-size: 24rpx; margin-left: 20rpx"
            >￥{{ item.price }}.00</text
          >
        </view>
      </view>
    </view>
    <!-- <view
      style="
        text-align: center;
        font-size: 26rpx;
        color: #8e8e8e;
        width: 100%;
        margin-top: 20rpx;
        display: flex;
        justify-content: center;
        align-items: center;
      "
    >
      <text>查看更多</text>
      <image
        src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/下.png"
        mode="aspectFill"
        style="width: 30rpx; height: 30rpx; margin-left: 10rpx"
      ></image>
    </view> -->
    <view style="height: 60rpx; width: 100%"></view>
  </view>
</template>

<script setup>
import { happenTimeFun } from "@/utils/time.js";

const props = defineProps({
  list: {
    type: Array,
    default: '',
  },
})

const emit = defineEmits(['upToDate'])

const center = []

function upToDate(item) {
  emit("upToDate", item);
}
</script>

<style scoped>
.mian-center {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}
.mian-center-item {
  width: calc((100% - 30rpx) / 2);
  margin-bottom: 20rpx;
}
.vip {
  display: flex;
  align-items: center;
  padding: 4rpx 20rpx;
  background-color: white;
  border-radius: 20rpx;
}
.vip-images {
  width: 30rpx;
  height: 30rpx;
}
</style>
