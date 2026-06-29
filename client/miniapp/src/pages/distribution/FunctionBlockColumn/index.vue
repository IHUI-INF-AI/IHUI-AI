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
import { ref } from 'vue'

const emit = defineEmits(['pack'])

const functionList = ref([
  {
    title: "公司团队",
    subtitle: "查看我的公司团队",
    iconSrc:
      "https://file.aizhs.top/sys-mini/tuandui-icon.png",
    iconClass: "",
    url: "/pages/distribution_personnel_list/index",
  },
  {
    title: "AI团队",
    subtitle: "查看智能体团队",
    iconSrc:
      "https://file.aizhs.top/sys-mini/tuandui-icon.png",
    iconClass: "",
    url: "/pages/tools/ai_group/index",
  },
  {
    title: "我的名片",
    subtitle: "查看我的个人信息",
    iconSrc:
      "https://file.aizhs.top/sys-mini/geren-icon.png",
    iconClass: "",
    url: "/pagesA/business-card/index",
  },
  {
    title: "我的二维码",
    subtitle: "推广专属二维码",
    iconSrc:
      "https://file.aizhs.top/sys-mini/erweima-icon.png",
    iconClass: "",
    url: "/pages/personal-card/index",
  },
  {
    title: "分销订单",
    subtitle: "查看我的分销订单",
    iconSrc:
      "https://file.aizhs.top/sys-mini/fenxiao-icon.png",
    iconClass: "",
    url: "/pages/distribution_order_list/index",
  },
])

const navigateTo = (url, title) => {
  if (title === "我的二维码") {
    emit("pack");
  } else if (title === "领取企业资料") {
    copyUrl(url);
  } else if (title === "产品调查") {
    wx.openEmbeddedMiniProgram({
      appId: 'wxebadf544ddae62cb',
      path: 'pagesA/webview/index?sid=23282167&hash=b498&navigateBackMiniProgram=true',
    });
  } else {
    uni.navigateTo({
      url: url,
    });
  }
}

const copyUrl = (url) => {
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({
        title: '链接已复制，请在浏览器中打开',
        icon: 'none'
      });
    },
    fail: () => {
      uni.showToast({
        title: '复制失败',
        icon: 'none'
      });
    }
  });
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
  background: linear-gradient(111deg, rgb(217 219 255 / 0.8) 3%, rgb(253 255 220 / 0.8) 104%);
  border-width: 0 0 4px;
  border-style: solid;
  border-color: rgb(0 0 0 / 0.1);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 4px 0 rgb(0 0 0 / 0.3);
  box-sizing: border-box;
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
