<template>
  <view class="function-block-container">
    <view v-for="(item, index) in functionList" :key="index" class="function-card"
      @tap="navigateTo(item.url, item.title)">
      <view class="card-content">
        <view class="icon-container" :class="item.iconClass">
          <image :src="item.iconSrc" mode="aspectFit" class="icon" style="width: 100%; height: 100%;"></image>
        </view>
        <view class="text-container">
          <text class="title">{{ item.title }}</text>
          <text class="subtitle">{{ item.subtitle }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
const emit = defineEmits(['pack'])

const functionList = [
  {
    title: "分销订单",
    subtitle: "查看我的分销订单",
    iconSrc: "/static/images/fenxiao-icon.png",
    iconClass: "",
    url: "/pages/distribution_order_list/index",
  },
  {
    title: "AI团队",
    subtitle: "查看我的AI团队",
    iconSrc: "/static/images/tuandui-icon.png",
    iconClass: "",
    url: "/pages/distribution_personnel_list/index",
  },
  {
    title: "个人名片",
    subtitle: "查看我的名片",
    iconSrc: "/static/images/geren-icon.png",
    iconClass: "",
    url: "/pages/business-card/index",
  },
  {
    title: "AI推广二维码",
    subtitle: "查看我的二维码",
    iconSrc: "/static/images/erweima-icon.png",
    iconClass: "",
    url: "/pages/personal-card/index",
  },
]

function navigateTo(url, title) {
  if (title === "AI推广二维码") {
    emit("pack")
  } else {
    uni.navigateTo({ url })
  }
}
</script>

<style lang="scss" scoped>
.function-block-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 10px;
}

.function-card {
  margin-bottom: 16rpx;
  width: 347rpx;
  padding: 23rpx;
  border-radius: 30rpx;
  background: linear-gradient(111deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
  box-sizing: border-box;
  border-width: 0px 0px 4px 0px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  box-shadow: 0px 2px 4px 0px rgba(0, 0, 0, 0.3);
}

.card-content {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.icon-container {
  width: 85rpx;
  height: 90rpx;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10rpx;
}

.blue {
  background: #FF8F1F;
}

.dark-blue {
  background-color: #3f51b5;
}

.purple {
  background-color: #6366f1;
}

.orange {
  background-color: #ff9f43;
}

.icon {
  width: 24px;
  height: 24px;
}

.text-container {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.title {
  font-size: 30rpx;
  color: #3D3D3D;
}

.subtitle {
  font-size: 26rpx;
  color: #676767;
}

.arrow-container {
  width: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.arrow-icon {
  width: 16px;
  height: 16px;
}
</style>
