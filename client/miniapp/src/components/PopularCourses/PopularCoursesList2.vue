/** * 4-12 * 爆款精选课程 列表组件 */
<template>
  <view class="popular-courses-list-container">
    <view
      v-for="(item, index) in CourseList"
      :key="index"
      class="popular-courses-list-item"
      @click="handleItemClick(item)"
    >
      <view class="popular-courses-list-item-img">
        <image
          :src="item.img"
          mode="aspectFill"
          style="width: 100%; height: 100%"
        >
        </image>
        <view class="price-tag">¥{{ item.price }}</view>
        <text
          style="
            position: absolute;
            top: 0;
            left: 0;
            z-index: 555;
            background-color: rgb(0 0 0 / 0.3);
            color: white;
            padding: 4rpx 20rpx;
            border-radius: 20rpx;
            font-size: 24rpx;
          "
        >
          {{ item.classification }}</text
        >
      </view>
      <view class="popular-courses-list-item-text">
        <text class="popular-courses-list-item-text-title">{{
          item.title
        }}</text>
        <text class="popular-courses-list-item-text-subtitle">{{
          item.subtitle
        }}</text>
        <view class="popular-courses-list-item-text-king">
          <view class="popular-courses-list-item-text-king-img">
            <image
              :src="'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/course/fufei.png'"
              mode="aspectFill"
              style="width: 100%; height: 100%"
            >
            </image>
          </view>
          <text>付费项目</text>
        </view>
        <view class="popular-courses-list-item-text-time-NumberOfHits">
          <text class="popular-courses-list-item-text-time">
            {{ happenTimeFun(item.time) }}
          </text>
          <text class="popular-courses-list-item-text-NumberOfHits"
            >{{ item.Likes }}人已学习</text
          >
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { happenTimeFun, formatFullTime } from "@/utils/time.js";

defineProps({
  CourseList: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['course'])

function handleItemClick(item) {
  emit('course', item)
}
</script>

<style lang="scss" scoped>
.popular-courses-list-container {
  width: 100%;
}

.popular-courses-list-item {
  display: flex;
  width: 100%;
  height: 174rpx;
  margin-top: 20rpx;

  .popular-courses-list-item-img {
    width: 250rpx;
    height: 174rpx;
    border-radius: 20rpx;
    overflow: hidden;
    position: relative;

    .price-tag {
      position: absolute;
      bottom: 0;
      right: 0;
      background-color: rgb(255 0 0 / 0.8);
      color: white;
      padding: 4rpx 10rpx;
      font-size: 24rpx;
      font-weight: bold;
      border-top-left-radius: 12rpx;
    }
  }

  .popular-courses-list-item-text {
    margin-left: 20rpx;
    width: 400rpx;
    height: 178rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-around;

    .popular-courses-list-item-text-title {
      font-size: 28rpx;
      font-weight: bold;
      color: #000;
    }

    .popular-courses-list-item-text-subtitle {
      font-size: 24rpx;
      color: #6c6c6c;
    }

    .popular-courses-list-item-text-king {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 138rpx;
      height: 36rpx;
      border-radius: 15rpx;
      background-color: #f5f5f5;

      .popular-courses-list-item-text-king-img {
        width: 38rpx;
        height: 34rpx;
        margin-right: 10rpx;
      }

      text {
        font-size: 20rpx;
        color: #f00;
      }
    }

    .popular-courses-list-item-text-time-NumberOfHits {
      display: flex;
      align-items: center;

      .popular-courses-list-item-text-time,
      .popular-courses-list-item-text-Price,
      .popular-courses-list-item-text-NumberOfHits {
        margin-right: 20rpx;
        font-size: 24rpx;
        color: #6c6c6c;
        font-weight: bold;
      }
    }
  }
}
</style>
