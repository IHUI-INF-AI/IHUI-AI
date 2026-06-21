<template>
  <view style="display: flex; flex-wrap: wrap">
    <view
      style="
        width: 25%;
        display: flex;
        align-items: center;
        flex-direction: column;
        margin-bottom: 20rpx;
      "
      v-for="item in title"
      :key="item.id"
    >
      <image
        :src="item.images"
        mode="aspectFill"
        style="width: 80rpx; height: 80rpx"
      ></image>
      <text style="font-size: 28rpx; margin-top: 20rpx; color: black">{{
        item.name
      }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const title = ref([
  {
    id: 1,
    name: "图片",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/8.png",
  },
  {
    id: 2,
    name: "视频",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/4.png",
  },
  {
    id: 3,
    name: "文案",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/2.png",
  },
  {
    id: 4,
    name: "智能体",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/11.png",
  },
  {
    id: 5,
    name: "RPA",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/5.png",
  },
  {
    id: 6,
    name: "编程",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/7.png",
  },
  {
    id: 7,
    name: "音乐",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/3.png",
  },
  {
    id: 8,
    name: "其他",
    images:
      "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/coursePlanet/10.png",
  },
])
</script>

<style scoped></style>
