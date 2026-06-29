<!-- 标题 -->
<template>
  <view>
    <!-- 新闻 -->
    <view class="news">
      <view class="new-center" v-for="_ in centerTitle" :key="_.id" @click="newclick(_)">
        <view style="
            width: 20rpx;
            height: 20rpx;
            background-color: #9f9f9f;
            border-radius: 50%;
          "></view>
        <text style="margin-left: 20rpx; color: black">{{ _.title }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getHomePageResources } from "@/service/index.js";

const props = defineProps({
  centerTitle: {
    type: Array,
    default() {
      return []
    },
  },
})

const emit = defineEmits(['new'])

const HomePagedata = ref({})

onMounted(() => {
  home()
})

function home() {
  getHomePageResources(1).then((res) => {
    HomePagedata.value = res.data
  })
}

function newclick(item) {
  emit("new", item)
}
</script>

<style scoped lang="scss">
.news {
}

.news-title {
  font-size: 32rpx;
  height: 60rpx;
  line-height: 60rpx;
  margin-top: 20rpx;
  color: black;
  font-weight: bold;
}

.new-center {
  display: flex;
  align-items: center;
  height: 60rpx;
  line-height: 60rpx;
  border-top: 1rpx solid #9f9f9f;
}

.custom-carousel-wrapper {
  border: 1px solid rgb(156 156 156 / 0.3);
  box-shadow: 0 0 6rpx 0 rgb(86 71 250 / 0.3);
  border-radius: 30rpx;
  overflow: hidden;
}

@keyframes shadowPulse {
  0% {
	box-shadow: 0 0 6rpx 0 rgb(86 71 250 / 0.3);
  }

  50% {
	box-shadow: 0 0 10rpx 0 rgb(73 56 255 / 0.795);
  }

  100% {
	box-shadow: 0 0 6rpx 0 rgb(86 71 250 / 0.3);
  }
}

.carousel-img {
  width: 100%;
  height: 100%;
  border-radius: 30rpx;
  display: block;
}

.carousel-inner {
  border-radius: 30rpx;
  overflow: hidden;
  background: #fff;
}
</style>
