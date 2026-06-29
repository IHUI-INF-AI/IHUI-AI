/**
 * Ripple_Yu
 * 轮播图组件
 * 可接入点击跳转至 路由页面
 *
 */
<template>
  <view class="image-container">
    <swiper class="carousel" 
            :indicator-dots="false" 
            :autoplay="true" 
            :interval="3000" 
            :duration="500"
            :circular="true"
            @change="onSwiperChange">
      <swiper-item v-for="(item, index) in carouselList" :key="index" @click="handleItemClick(index)">
        <image :src="item.imageUrl" class="carousel-image" mode="aspectFill"></image>
      </swiper-item>
    </swiper>
    <view class="indicator">
      <view 
        v-for="(item, index) in carouselList" 
        :key="index" 
        class="dot"
        :class="{ active: current === index }">
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['item-click'])

const current = ref(0)
const carouselList = [
  {
    id: 1,
    imageUrl: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/BottomFigure.png'
  },
  {
    id: 2,
    imageUrl: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit2.png',
  },
  {
    id: 3,
    imageUrl: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/recruit3.png',
  }
]

function onSwiperChange(e) {
  current.value = e.detail.current;
}

function handleItemClick(index) {
  if (index === 1) {
    emit('item-click', carouselList[index]);
    uni.navigateTo({
      url: "/pagesA/recruitment/index",
    });
  }
}
</script>

<style scoped>
.image-container {
  margin: 32rpx auto 0;
  position: relative;
  width: 100%;
  height: 298rpx;
  overflow: hidden;
  border-radius: 20rpx;
}

.BottomFigure {
  width: 100%;
  height: 100%;
  border-radius: 60rpx; 
  overflow: hidden;
}

.carousel-image {
  width: 100%;
  height: 100%;
  border-radius: 60rpx; 
}

.indicator {
  position: absolute;
  bottom: 30rpx; 
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  background-color: rgb(255 255 255 / 0.5);
  border-radius: 50%;
  margin: 0 10rpx; 
  transition: all 0.3s;
}

.dot.active {
  width: 32rpx; 
  background-color: #fff;
  border-radius: 8rpx; 
}
</style>
