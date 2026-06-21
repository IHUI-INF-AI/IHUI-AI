/** * Ripple_Yu * 确认购买弹窗 * 使用微信JSAPI支付 */
<template>
  <view class="popup" v-show="visible" @click.stop="handleMaskClick">
    <view class="popup-mask"></view>
    <view class="popup-content" @click.stop>
      <!-- 内容显示区 -->
      <view class="content-area">
        <view class="popup-header">
          <text class="popup-title">会员购买</text>
        </view>

        <view class="product-info">
          <view class="product-name">AI智汇社 VIP会员</view>
          <view class="product-price">
            <text class="price-symbol">¥</text>
            <text class="price-value">{{ dataInfo.amount }}</text>
          </view>
          <view class="product-desc">
            <text class="benefit-item">✓ 无限AI文案生成</text>
            <text class="benefit-item">✓ 高级AI模型</text>
            <text class="benefit-item">✓ 分佣计划资格</text>
            <text class="benefit-item">✓ 7*24小时技术支持</text>
            <text class="benefit-item highlight">✓ 一次付费，永久使用</text>
          </view>
        </view>

        <view class="payment-options">
          <view class="option-title">支付方式</view>
          <view class="option-item" :class="{ active: payMethod === 'wxpay' }" @tap="selectPayMethod('wxpay')">
            <view class="option-icon wx-icon">
              <text class="icon-text">微信</text>
            </view>
            <view class="option-name">微信支付</view>
            <view class="option-check" v-if="payMethod === 'wxpay'">✓</view>
          </view>
        </view>
      </view>

      <!-- 按钮显示区 -->
      <view class="button-area">
        <button class="pay-button" @tap="handlePayment" :loading="isLoading">
          立即支付 {{ dataInfo.amount }}元
        </button>
        <view class="agreement">
          <text class="agreement-text">点击立即支付，表示同意</text>
          <text class="agreement-link" @tap="openAgreement">《用户协议》</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { pay } from "@/utils/pay/index.js";
import { useUserStore } from '@/store/modules/user';

const userStore = useUserStore();

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  productId: {
    type: String,
    default: "vip_monthly",
  },
  dataInfo: {
    type: Object,
  },
});

const emit = defineEmits(['updateVisible', 'paySuccess']);

const price = ref(588);
const originalPrice = ref(1288);
const payMethod = ref("wxpay");
const isLoading = ref(false);
const products = ref({
  vip: {
    name: "AI智汇社 VIP会员",
    price: 588,
    originalPrice: 1288,
    duration: "永久",
  },
});

function loadProductInfo() {
  const product = products.value[props.productId];
  if (product) {
    price.value = product.price;
    originalPrice.value = product.originalPrice;
  }
}

function selectPayMethod(method) {
  payMethod.value = method;
}

function handleMaskClick() {
  if (!isLoading.value) {
    emit("updateVisible", false);
  }
}

function openAgreement() {
  uni.navigateTo({
    url: "/pages/agreement/index",
    fail: () => {
      uni.showToast({
        title: "协议页面开发中",
        icon: "none",
      });
    },
  });
}

function handlePayment() {
  pay("", props.dataInfo.amount, props.dataInfo.id, 1, 2);
}

async function createPayOrder() {
  try {
    const userInfo = uni.getStorageSync("data");
    if (!userInfo) {
      throw new Error("请先登录");
    }

    if (!userInfo.openId) {
      throw new Error("用户信息不完整，请重新登录");
    }

    console.log("创建订单，用户信息:", userInfo);

    const res = await uniCloud.callFunction({
      name: "payment",
      data: {
        action: "createOrder",
        params: {
          productId: props.productId,
          payMethod: payMethod.value,
          openid: userInfo.openId,
        },
      },
    });

    console.log("创建订单结果:", res);

    if (res.result && res.result.code === 0) {
      return res.result.data;
    } else {
      throw new Error(res.result?.message || "创建订单失败");
    }
  } catch (error) {
    console.error("创建订单失败:", error);
    throw error;
  }
}

function callWxPay(payParams) {
  uni.requestPayment({
    ...payParams,
    success: (res) => {
      console.log("支付成功:", res);
      handlePaySuccess();
    },
    fail: (err) => {
      console.error("支付失败:", err);

      if (err.errMsg.indexOf("cancel") !== -1) {
        uni.showToast({
          title: "支付已取消",
          icon: "none",
        });
      } else {
        uni.showToast({
          title: "支付失败，请重试",
          icon: "none",
        });
      }

      isLoading.value = false;
    },
    complete: () => {
      setTimeout(() => {
        checkOrderStatus();
      }, 1000);
    },
  });
}

function handlePaySuccess() {
  uni.showToast({
    title: "支付成功",
    icon: "success",
  });

  updateUserVipStatus();

  emit("paySuccess", {
    productId: props.productId,
    amount: price.value,
  });

  setTimeout(() => {
    isLoading.value = false;
    emit("updateVisible", false);
  }, 1500);
}

async function checkOrderStatus() {
  try {
    const userInfo = uni.getStorageSync("userInfo");
    if (!userInfo || !userInfo._id) {
      return;
    }

    const res = await uniCloud.callFunction({
      name: "payment",
      data: {
        action: "checkOrderStatus",
        params: {
          userId: userInfo._id,
        },
      },
    });

    if (res.result && res.result.code === 0 && res.result.data.isPaid) {
      handlePaySuccess();
    }
  } catch (error) {
    console.error("检查订单状态失败:", error);
  }
}

async function updateUserVipStatus() {
  try {
    const userInfo = uni.getStorageSync("userInfo");
    if (!userInfo || !userInfo._id) {
      return;
    }

    const res = await uniCloud.callFunction({
      name: "user",
      data: {
        action: "refreshUserInfo",
        params: {
          userId: userInfo._id,
        },
      },
    });

    if (res.result && res.result.code === 0 && res.result.data.userInfo) {
      uni.setStorageSync("userInfo", res.result.data.userInfo);

      if (userStore) {
        userStore.setUserInfo(res.result.data.userInfo);
        userStore.setVipStatus(true);
      }
    }
  } catch (error) {
    console.error("更新用户状态失败:", error);
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadProductInfo();
  }
});

watch(() => props.productId, (newVal) => {
  if (props.visible && newVal) {
    loadProductInfo();
  }
});
</script>

<style lang="scss">
.popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;

  .popup-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
  }

  .popup-content {
    position: relative;
    width: 650rpx;
    background-color: #1a1a20;
    border-radius: 30rpx;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.4);
  }

  .popup-header {
    padding: 30rpx 0;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .popup-title {
      font-size: 36rpx;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 0 0 10rpx rgba(0, 242, 255, 0.5);
    }
  }

  .content-area {
    flex: 1;
    padding: 30rpx;
  }

  .product-info {
    margin-bottom: 40rpx;

    .product-name {
      font-size: 34rpx;
      color: #ffffff;
      font-weight: bold;
      margin-bottom: 20rpx;
      text-align: center;
    }

    .product-price {
      text-align: center;
      margin-bottom: 30rpx;

      .price-symbol {
        font-size: 32rpx;
        color: #00f2ff;
        font-weight: bold;
      }

      .price-value {
        font-size: 60rpx;
        color: #00f2ff;
        font-weight: bold;
      }

      .price-original {
        font-size: 30rpx;
        color: rgba(255, 255, 255, 0.5);
        text-decoration: line-through;
        margin-left: 20rpx;
      }
    }

    .product-desc {
      display: flex;
      flex-direction: column;
      padding: 20rpx;
      background: rgba(0, 242, 255, 0.05);
      border-radius: 15rpx;

      .benefit-item {
        font-size: 26rpx;
        color: #333;
        line-height: 1.6;
        margin-bottom: 10rpx;
      }

      .benefit-item.highlight {
        color: #ff5722;
        font-weight: bold;
      }
    }
  }

  .payment-options {
    margin-bottom: 40rpx;

    .option-title {
      font-size: 30rpx;
      color: #ffffff;
      margin-bottom: 20rpx;
    }

    .option-item {
      display: flex;
      align-items: center;
      padding: 20rpx;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15rpx;
      margin-bottom: 15rpx;

      &.active {
        background: rgba(0, 242, 255, 0.1);
        border: 1px solid rgba(0, 242, 255, 0.3);
      }

      .option-icon {
        width: 70rpx;
        height: 70rpx;
        border-radius: 15rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 20rpx;

        &.wx-icon {
          background: #09bb07;

          .icon-text {
            color: #ffffff;
            font-size: 24rpx;
            font-weight: bold;
          }
        }
      }

      .option-name {
        flex: 1;
        font-size: 30rpx;
        color: #ffffff;
      }

      .option-check {
        font-size: 30rpx;
        color: #00f2ff;
        font-weight: bold;
      }
    }
  }

  .button-area {
    padding: 30rpx;

    .pay-button {
      width: 100%;
      height: 90rpx;
      line-height: 90rpx;
      background: linear-gradient(135deg, #0550d0, #057aff);
      color: #ffffff;
      font-size: 32rpx;
      font-weight: bold;
      border-radius: 30rpx;
      box-shadow: 0 5rpx 15rpx rgba(5, 122, 255, 0.4);
      margin-bottom: 20rpx;

      &:active {
        opacity: 0.9;
        transform: scale(0.98);
      }
    }

    .agreement {
      text-align: center;
      font-size: 24rpx;
      color: rgba(255, 255, 255, 0.5);

      .agreement-link {
        color: #00f2ff;
        margin-left: 5rpx;
      }
    }
  }
}
</style>
