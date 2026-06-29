/* 智能助手小智 通用组件 * @author: TONG * @date: 2025-04-28 */

<template>
  <view class="intelligent-assistant">
    <!-- 悬浮装饰图片（机器人） -->
    <image class="floating-decoration" src="/static/images/xiaofang.png" mode="aspectFit"></image>
	<!---->
	<!-- <image class="floating-log" src="https://file.aizhs.top/sys-mini/wirelesslogo.png" mode="aspectFit"></image> -->
	
    <view class="welcome-card">
      <view class="welcome-content">
        <view class="welcome-message">
          <text class="welcome-intro">Hi, 我是您的AI助手小方👋</text>
		  <text class="welcome-action1 font-size-30" style="padding-top: 9rpx;padding-bottom: 9rpx;">用AI.找AI.学AI到AI智汇社区就够了</text>
        </view>
      </view>
      <view class="limit-info">
        <view class="limit-content">
          <view class="limit-text">
            <!-- <text>当前还可免费使用{{ freeTimes }}次</text> -->
            <view class="limit-info">剩余智汇值:
              <span class="count">{{ formatTokenValue(tokenQuantity) }}</span>
            </view>
            <!-- <text>次数或余额用完请充值token值</text> -->
          </view>
          <view class="recharge-action">
            <view class="token-button">
              <image v-if="!isshow" @click="topupClick" src="/static/images/chongzhi1.png"
                mode="widthFix" class="token-button-image"></image>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getTokenCount } from "@/service/pay.js"
import { payToken } from "@/utils/token/index.js"
import { formatTokenValue } from "@/utils/index.js"

const props = defineProps({
	concealxiaBelow: {
		type: Boolean,
		default: true
	}
})

const freeTimes = ref(1)
const walletBalance = ref(999)
const isshow = ref(false)
const tokenQuantity = ref(0)

onShow(() => {
})

const systemInfo = uni.getSystemInfoSync()
if (systemInfo.osName == "ios") {
	isshow.value = true
} else {
	isshow.value = false
}

onMounted(() => {
	var dataInfo = uni.getStorageSync('data');
	if(dataInfo && dataInfo.userMargin){
		tokenQuantity.value = Number(dataInfo.userMargin.tokenQuantity);
	}
	uni.$on("loginSuccess", (data) => {
		if (data && data.userMargin) {
			tokenQuantity.value = Number(data.userMargin.tokenQuantity);
		}
	});
	uni.$on("updateTokenQuantity", (data) => {
		if (data && data.userMargin && data.userMargin.tokenQuantity !== undefined) {
			tokenQuantity.value = Number(data.userMargin.tokenQuantity);
			uni.setStorageSync('data', data);
		}
	});
	uni.$on("flashNum", (data) => {
		tokenQuantity.value = Number(data);
	});
	uni.$on("loginOut", () => {
		tokenQuantity.value = 0;
	});
})

onUnmounted(() => {
	uni.$off("loginSuccess");
	uni.$off("updateTokenQuantity");
	uni.$off("loginOut");
	uni.$off("flashNum");
})

function topupClick() {
	const userInfodata = uni.getStorageSync("data");
	if (!userInfodata) {
		uni.showToast({
			title: '请先登录',
			icon: 'none'
		});
		return;
	}
	uni.navigateTo({
		url: "/pagesA/top-up/index",
	});
}
</script>

<style lang="scss" scoped>
.intelligent-assistant {
  position: relative;
  width: 103%;
  margin-left: -8rpx;
}

/* 悬浮装饰图片 */
.floating-decoration {
  position: absolute;
      top: -17rpx;
      right: 19rpx;
      width: 214rpx;
      height: 220.4rpx;
  animation: float 1s ease-in-out infinite;
  z-index: 1;
}

// 图片logo
.floating-log{
	    position: absolute;
	    top: 78rpx;
	    right: 215rpx;
	    width: 98rpx;
	    height: 79rpx;
	    z-index: 10;
}

.countLoader {
  height: 40rpx;
  aspect-ratio: 1;
  padding: 6rpx;
  border-radius: 50%;
  box-sizing: border-box;
  position: relative;
  mask: conic-gradient(#000 0 0) content-box exclude,conic-gradient(#000 0 0);
  filter: blur(10rpx);
}

.countLoader::before {
  content: "";
  position: absolute;
  inset: 0;
  background: conic-gradient(#FFF 30%,#163FC7,#FFF 65%);
  animation: l1 1.5s linear infinite;
}

@keyframes l1 {
  to {rotate: 1turn}
}

@keyframes float {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-15rpx);
  }

  100% {
    transform: translateY(0);
  }
}

/* 欢迎卡片 */
.welcome-card {
  // margin: 30rpx 20rpx;
  border-radius: 30rpx;
  padding: 9rpx;
  margin: 10rpx 10rpx 0 4rpx;
  background-image: url("/static/images/duihuakuang.pic.jpg");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  position: relative;

  .welcome-content {
    display: flex;
    margin-bottom: 5rpx;
  }

  .welcome-message {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 32rpx;
    padding-top: 9rpx;
    background-size: cover;
    background-position: center;

    .welcome-intro {
      font-size: 38rpx;

      // margin-bottom: 8rpx;
      color: #517bff;
	  font-weight: bold;
	  font-family: AlimamaFangYuanTi !important;

	  // text-shadow: 0px 1px 4px rgba(0, 0, 0, 0.25);
    }

    .welcome-action {
      font-size: 24rpx;
      color: #333;
	  font-family: AlimamaFangYuanTi !important;
	  font-weight: bold;
    }
	
	.welcome-action1 {
		font-family: AlimamaFangYuanTi !important;
		font-size: 24rpx;
		color: #8389FF;
		font-weight: bold;
	}
  }

  .limit-info {
    display: flex;
    flex-direction: row;

    // border-top: 1px solid #f0f0f0;
    // padding-top: 20rpx;
    align-items: center;
  }

  .welcome-avatar {
    width: 100rpx;
    height: 120rpx;
    margin-right: 5rpx;

    image {
      width: 100%;
      height: 100%;
    }
  }

  .limit-content {
    // flex: 1;
    display: flex;
    justify-content: center;

    // margin-left: 40rpx;
    border-top: 1px solid #f0f0f0;
    padding-top: 10rpx;
    padding-bottom: 10rpx;
    margin-left: 32rpx;
  }

  .limit-text {
    display: flex;
    flex-direction: column;
    font-size: 30rpx;
    font-weight: bold;
    align-items: center;
    justify-content: center;
	color: #000;

    .count {
      display: inline-block;

    }

    text {
      margin-bottom: 5rpx;
    }

    view {
      // width: 350rpx;
      word-wrap: break-word;
      word-break: break-all;
      white-space: normal;
    }
  }

  .recharge-action {
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: #000;
	margin-left: 10rpx;

    .token-button {
      color: white;
      padding: 4rpx 10rpx;
      border-radius: 30rpx;
      font-size: 25rpx;
      height: 40rpx;
      display: flex;
      align-items: center;
      justify-content: flex-end;

      .token-button-image {
        width: 150rpx;
        height: 40rpx;
        margin-right: -5rpx;
        margin-bottom: 0;
      }
    }
  }
}
</style>
